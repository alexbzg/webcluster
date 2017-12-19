#!/usr/bin/python
#coding=utf-8

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict,\
        argparse

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb, cursor2dicts, spliceParam
from dx import DX, DXData

argparser = argparse.ArgumentParser()
argparser.add_argument( '-t', action = 'store_true' )
args = vars( argparser.parse_args() )
testMode = args['t']

conf = siteConf()
webRoot = conf.get( 'web', ( 'test_' if testMode else '' ) + 'root' ) 

def makeStr( list ):
    return ', '.join( ( "'{}'".format( x ) for x in list ) )

dataModesFull = """('DIGI', 'HELL', 'MT63', 'THOR16', 'FAX', 'OPERA', 'PKT', 'SIM31',
'CONTESTI', 'CONTESTIA', 'AMTOR', 'JT6M', 'ASCI', 'FT8', 'MSK144', 'THOR', 'QRA64',
'CONTESTIA', 'DOMINO', 'JT4C', 'THROB', 'DIG', 'ROS', 'SIM63', 'FSQ', 'THRB', 'J3E',
'WSPR', 'ISCAT', 'CONTESTIA8', 'ALE', 'JT10', 'TOR', 'PACKET', 'RTTY',  'PSK31', 
'PSK63', 'PSK125', 'JT65', 'FSK', 'OLIVIA', 'SSTV', 'JT9', 'FT8' )"""
modes = { 'CW':  """( 'A1A' )""",
        'SSB': """( 'AM', 'PHONE' )""",
        'DATA':  """('DIGI', 'HELL', 'MT63', 'THOR16', 'FAX', 'OPERA', 'PKT', 'SIM31',
'CONTESTI', 'CONTESTIA', 'AMTOR', 'JT6M', 'ASCI', 'FT8', 'MSK144', 'THOR', 'QRA64',
'CONTESTIA', 'DOMINO', 'JT4C', 'THROB', 'DIG', 'ROS', 'SIM63', 'FSQ', 'THRB', 'J3E',
'WSPR', 'ISCAT', 'CONTESTIA8', 'ALE', 'JT10', 'TOR', 'PACKET')""" }

for ( k, v ) in modes.iteritems():
    sql = """update user_awards 
            set mode = """ + k + 
        """ where mode in """ + v
dxdb.execute( sql )

sql = """update user_awards 
            set mode = 'DATA' 
            where award in ( 'DXCC', 'Russia' ) and mode in """ + dataModesFull
dxdb.execute( sql )

sql = """select callsign, award, settings, stats_settings
            from user_awards_settings
            where award = 'DXCC'
            """
if testMode:
    sql += " where callsign = 'QQQQ'"
data = cursor2dicts( dxdb.execute( sql ) )

for row in data:
    fl = False
    if row['settings']:
        row['settings'] = json.loads( row['settings'] )
        if row['settings'].has_key( 'modes' ) \
            and row['settings']['modes'].has_key( 'RTTY' ):
            del row['settings']['modes']['RTTY']
            fl = True
    if row['stats_settings']:
        row['stats_settings'] = json.loads( row['stats_settings'] )
        if row['stats_settings'].has_key( 'modesFilter' ) \
            and [ x for x in row['stats_settings']['modeFilter'] \
            if x['name'] == 'RTTY' ]:
            row['stats_settings']['modeFilter'] = \
                [ x for x in row['stats_settings']['modeFilter'] \
                    if x['name'] != 'RTTY' ]
            fl = True
    if fl:
        dxdb.paramUpdate( 'user_awards', spliceParams( row, ( 'user', 'award' ) ), \
            spliceParams( row, ( 'settings', 'stats_settings' ) ) )


with open( webRoot + '/userMetadata.json', 'w' ) as f:
    f.write( json.dumps( udv ) )



