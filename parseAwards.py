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
awardsData = loadJSON( webRoot + '/awards.json' )
if not awardsData:
    print 'No awards data!'
else:
    print 'Processing ' + webRoot + '/awards.json'
awards = []
webAwards = []


def getSplitLine( file, fr, to = None ):
    line = file.readline()
    if line:
        data = [item.strip( '"\r\n ' ) for item in line.split( ';' )]
        if to:
            return data[fr:to]
        else:
            return data[fr:]
    else:
        return None

def strIsInt(s):
    try: 
        int(s)
        return True
    except ValueError:
        return False    

for aw in awardsData:
    webAw = dict( aw )
    print aw['name']
    webAw['values'] = []
    webAw['groups'] = {}
    aw['values'] = {}
    columns = { 'group' : aw['groupColumns'] if aw.has_key( 'groupColumns' ) \
            else { 'value': 0, 'desc': 2 }, \
        'value': aw['valueColumns'] if aw.has_key( 'valueColumns' ) \
            else { 'value': 1, 'desc': 2, 'keys': 3 } }
    if columns['value'].has_key( 'keys' ):
        aw['byKey'] = {}
    groupSeparator = aw['groupSeparator'] if aw.has_key( 'groupSeparator' )\
            else '-'

    def getType( data ):
        return 'group' if columns['group']['value'] < len( data ) and \
                data[columns['group']['value']] \
                else 'value'

    def getColumn( data, column ):
        type = getType( data )
        return data[columns[type][column]] if columns[type].has_key(column) \
                else None

    with open( webRoot + '/' + aw['valuesFile'], 'r' ) as file:
        data = getSplitLine( file, 0 )
        group = None
        while data:
            type = getType( data )
            if type == 'group':
                group = getColumn( data, 'value' )
                webAw['groups'][group] = getColumn( data, 'desc' )
            else:
                av = {}
                val = getColumn( data, 'value' )
                if strIsInt( val ) and len( val ) < 2:
                    val = '0' + val
                av['displayValue'] = val
                av['value'] = group + groupSeparator + av['displayValue'] \
                    if aw.has_key( 'groupInValue' ) and aw['groupInValue'] \
                    else av['displayValue']
                av['group'] = group
                if columns['value'].has_key( 'desc' ):
                    av['desc'] = getColumn( data, 'desc' )
                webAw['values'].append( av )
                aw['values'][av['value']] = {'lookups':[]}
                if columns['value'].has_key( 'keys' ):
                    for key in getColumn( data, 'keys' ).split( ',' ):
                        if key:
                            aw['byKey'][key.strip().upper()] = av['value']
            data = getSplitLine( file, 0 )
        webAw['values'].sort( key = lambda x: x['value'] )
        webAw['orderedGroups'] = webAw['groups'].keys() if webAw['groups'] \
                else [ None ]
        webAw['orderedGroups'].sort()

    if aw.has_key( 'substFile' ) and aw['substFile']:
        aw['subst'] = {}
        with open( webRoot + '/' + aw['substFile'], 'r' ) as file:
            data = getSplitLine( file, 0 )
            while data:
                if data[0] and data[1]:
                    aw['subst'][data[0]] = data[1]
                data = getSplitLine( file, 0 )
    
    awards.append( aw )
    if not aw.has_key( 'noStats' ):
        webAwards.append( webAw )


with open( webRoot + '/awardsValues.json', 'w' ) as fav:
    fav.write( json.dumps( webAwards ) )

with open( webRoot + '/awardsData.json', 'w' ) as fav:
    fav.write( json.dumps( awards ) )


