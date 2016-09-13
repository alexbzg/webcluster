#!/usr/bin/python
#coding=utf-8

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict,\
        argparse

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb
from dx import DX, DXData



conf = siteConf()
webRoot = conf.get( 'web', 'root' ) 
awardsData = loadJSON( webRoot + '/debug/awards.json' )
if not awardsData:
    print 'No awards data!'
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

for aw in awardsData:
    webAw = { 'name': aw['name'], 'country': aw['country'], \
            'fullName': aw['fullName'], 'values': [], 'groups': {} }
    aw['values'] = {}
    if aw.has_key( 'keyAttr' ):
        aw['byKey'] = {}
    columns = { 'group' : aw['groupColumns'] if aw.has_key( 'groupColumns' ) \
            else { 'value': 0, 'desc': 2 }, \
        'value': aw['valueColumns'] if aw.has_key( 'valueColumns' ) \
            else { 'value': 1, 'desc': 2, 'keys': 3 } }
    groupSeparator = aw['groupSeparator'] if aw.has_key( 'groupSeparator' )\
            else '-'

    def getType( data ):
        return 'group' if data[columns['group']['value']] \
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
                av['displayValue'] = getColumn( data, 'value' )
                av['value'] = group + groupSeparator + av['displayValue'] if \
                    aw['groupInValue'] else av['displayValue']
                av['group'] = group
                webAw['values'].append( av )
                aw['values'][av['value']] = {'lookups':[]}
                if aw.has_key( 'keyAttr' ):
                    for key in getColumn( data, 'keys' ).split( ',' ):
                        if key:
                            aw['byKey'][key] = av['value']
            data = getSplitLine( file, 0 )
        webAw['values'].sort( key = lambda x: x['value'] )
        webAw['orderedGroups'] = webAw['groups'].keys()
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
    webAwards.append( webAw )


with open( webRoot + '/debug/awardsValues.json', 'w' ) as fav:
    fav.write( json.dumps( webAwards ) )

with open( webRoot + '/debug/awardsData.json', 'w' ) as fav:
    fav.write( json.dumps( awards ) )


