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
webRoot = conf.get( 'web', 'root' ) 
dir = webRoot + ( '/debug' if args['t'] else '' )


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

columns = { 'callsign' : 0, 'region': 3, 'qth': 4 }

with open( webRoot + '/csv/i_callbook.csv', 'r' ) as file:
    params = { 'country': 'Italy' }
    data = getSplitLine( file )
    while data:
        for ( field, column ) in columns.iteritems():
            params[field] = data[column]
        dxdb.getObject( 'callsigns', params, True )
        data = getSplitLine( file )
    dxdb.commit()



