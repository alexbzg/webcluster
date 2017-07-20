#!/usr/bin/python
#coding=utf-8

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict,\
        argparse

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb, cursor2dicts
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
#udv = loadJSON( webRoot + '/userMetadata.json' )
#if udv:
#    udv = int( udv ) + 1
#else:
#    udv = '0'

def makeStr( list ):
    return ', '.join( ( "'{}'".format( x ) for x in list ) )

cfmTypesDef = [ 'cfm_lotw', 'cfm_paper', 'cfm_eqsl' ]
sql = """select * from user_awards
    where award = %s """ + \
    ( "and callsign = 'QQQQ' " if testMode else '' )

for aw in awards:
    
    print aw['name']
    awardCfm = [ type[1] for type in aw['cfmTypes'] ] if aw.has_key( 'cfmTypes' ) \
            else cfmTypesDef

    data = cursor2dicts(  dxdb.execute( sql, ( aw['name'], ) ), False )
    if data:
        for record in data:
            recordCfm = { cfmType: record[cfmType] if record.has_key( cfmType ) \
                            else False for cfmType in awardCfm }
            dxdb.paramUpdate( 'user_awards', \
                    { 'award': aw['name'], 'value': record['value'], \
                    'band': record['band'], 'mode': record['mode'], \
                    'callsign': record['callsign'] },
                    { 'cfm': json.dumps( recordCfm ) } )
dxdb.commit()


#with open( webRoot + '/userMetadata.json', 'w' ) as f:
#    f.write( json.dumps( udv ) )



