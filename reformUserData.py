#!/usr/bin/python
#coding=utf-8

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict,\
        argparse

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb
from dx import DX, DXData

argparser = argparse.ArgumentParser()
argparser.add_argument( '-t', action = 'store_true' )
args = vars( argparser.parse_args() )
testMode = args['t']

conf = siteConf()
webRoot = conf.get( 'web', ( 'test_' if testMode else '' ) + 'root' ) 
awards = loadJSON( webRoot + '/awards.json' )
if not awards:
    print 'No awards data!'
else:
    print 'Processing ' + webRoot + '/awards.json'
udv = loadJSON( webRoot + '/userMetadata.json' )
if udv:
    udv = int( udv ) + 1
else:
    udv = '0'

def makeStr( list ):
    return ', '.join( ( "'{}'".format( x ) for x in list ) )

digiModes = ('RTTY', 'PSK31', 'PSK63', 'JT65' )
digiModesStr = makeStr( digiModes )
allModes = digiModes + ('CW', 'SSB')

for aw in awards:
    if aw['name'] != 'Russia_':
        continue
    if not aw.has_key( 'byBand' ) or not aw['byBand']:
        continue
    modes = aw['modes'] if aw.has_key( 'modes' ) else allModes
    modesStr = makeStr( modes )
    if 'DIGI' in modes:
        sql = """insert into user_awards 
            ( callsign, award, value, cfm_paper, cfm_lotw, cfm_eqsl, mode, band )
            select callsign, award, value, bool_or( cfm_paper ), bool_or( cfm_lotw ),
                bool_or( cfm_eqsl ), 'DIGI', band
            from user_awards
            where award = %s and mode in (""" + digiModesStr + ") " + \
            ( " and callsign = 'QQQQ' " if testMode else '' ) + \
            """group by callsign, award, value, band"""
        dxdb.execute( sql, ( aw['name'], ) )
        dxdb.commit()
    sql = """delete from user_awards
        where award = %s and not mode in (""" + modesStr + """) and 
        mode != 'N/A' """ + \
        "and callsign = 'QQQQ' " if testMode else ''
    dxdb.execute( sql, ( aw['name'], ) )
    dxdb.commit()


with open( webRoot + '/userMetadata.json', 'w' ) as f:
    f.write( json.dumps( udv ) )



