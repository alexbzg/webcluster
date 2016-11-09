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


conf = siteConf()
webRoot = conf.get( 'web', ( 'test_' if args['t'] else '' ) + 'root' ) 
awardsData = loadJSON( webRoot + '/awardsData.json' )

def getAward( name ):
    return [ award for award in awardsData
        if award['name'] == name ][0]

jcc = getAward( 'JCC' )
waku = getAward( 'WAKU' )
waja = getAward( 'WAJA' )

def getSplitLine( file, fr = 0, to = None ):
    line = file.readline()
    if line:
        data = [item.strip( '"\r\n ' ) for item in line.split( ';' )]
        if to:
            return data[fr:to]
        else:
            return data[fr:]
    else:
        return None

columns = { 'callsign' : 0, 'region': 2, 'district': 3 }
kuColumn = 5

with open( webRoot + '/csv/ja_callbook.csv', 'r' ) as file:
    params = { 'country': 'Japan' }
    data = getSplitLine( file )
    while data:
        for ( field, column ) in columns.iteritems():
            params[field] = data[column]

        if not jcc['values'].has_key( params['region'].upper() + ' ' + \
                params['district'] ):
            params['district'] = ''
            params['region'] = ''

        ku = ''
        if len( data ) >= kuColumn:
            for kuPfx in ( params['region'], params['district'] ):
                if waku['values'].has_key( kuPfx + ' ' + data[kuColumn] ):
                    ku = kuPfx + ' ' + data[kuColumn]

        if params['district'] or params['region'] or ku:
            params['region'] = params['region'].upper()
            if not dxdb.getObject( 'callsigns', { 'callsign': params['callsign'] }, \
                    False, True ):
                dxdb.getObject( 'callsigns', params, True )
            if ku and not dxdb.getObject( 'awards', \
                { 'callsign': params['callsign'], 'award': 'WAKU' }, False, True ):
                dxdb.getObject( 'awards', 
                    { 'callsign': params['callsign'], \
                        'award': 'WAKU', \
                        'value': ku }, True )

        data = getSplitLine( file )
    dxdb.commit()



