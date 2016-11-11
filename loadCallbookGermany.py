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

columns = { 'id': { 'callsign' : 0 }, 'upd':  { 'district': 1 } }

with open( webRoot + '/csv/dl_callbook.csv', 'r' ) as file:
    params = { 'id': {}, 'upd': { 'country': 'Germany' } }
    data = getSplitLine( file )
    while data:
        for type in columns:
            for ( field, column ) in columns[type].iteritems():
                params[type][field] = data[column]

        dxdb.paramUpdateInsert( 'callsigns', params['id'], params['upd'] )

        data = getSplitLine( file )
    dxdb.commit()



