#!/usr/bin/python
#coding=utf-8

from common import appRoot, readConf, siteConf, loadJSON, jsonEncodeExtra
from dxdb import cursor2dicts, dxdb, paramStr
import dx as dxMod

import json, re, logging, time, os, fcntl, sys


logging.basicConfig( level = logging.DEBUG,
        format='%(asctime)s %(message)s', 
        filename='/var/log/adxcluster_history.log',
        datefmt='%Y-%m-%d %H:%M:%S' )
logging.info( 'starting in test mode' )

testMode = False
conf = siteConf()
webRoot = conf.get( 'web', ( 'test_' if testMode else '' ) + 'root' )
testRoot = conf.get( 'web', 'test_root' )
dirs = [ testRoot ]
if not testMode:
    dirs.append( webRoot )

awardsData = loadJSON( webRoot + '/awards.json' )

def getAwardMode( row, awardName ):
    award = [a for a in awardsData \
        if a['name'] == awardName ][0]
    if award.has_key( 'modes' ):
        if row['mode'] in award['modes']:
            return row['mode']
        if row['subMode'] in award['modes']:
            return row['subMode']
        if ( r'DATA' in award['modes'] ) and row['subMode'] and \
                ( r'PSK' in row['subMode'] or r'JT' in row['subMode'] ):
            return r'DATA'
    return row['subMode'] if row['subMode'] else row['mode']

dbData = cursor2dicts( dxdb.execute( """
    select text, mode, subMode, extract( epoch from ts) as ts, time, qrp, 
        freq, de, pfx, spots.callsign as cs, band, special_cs as special
    from spots inner join callsigns on spots.callsign = callsigns.callsign
    where ts > now() - interval '24 hours'
    """ ), True )

for row in dbData:
    row['subMode'] = row['submode']
    del row['submode']
    awlu = cursor2dicts( dxdb.execute( """ 
        select award, value
        from awards
        where callsign = %s""", ( row['cs'], ) ), True )
    row['awards'] = {}
    if awlu:
        for a in awlu:
            row['awards'][a['award']] = { 'value': a['value'], \
                'mode': getAwardMode( row, a['award'] ) }

dataJSON = json.dumps( dbData, default = jsonEncodeExtra )
for dir in dirs:
    with open( dir + '/history.json', 'w' ) as fDxData:
        fDxData.write( dataJSON )

