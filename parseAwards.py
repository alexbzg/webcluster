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
    aw['values'] = []
    if aw.has_key( 'keyAttr' ):
        aw['byKey'] = {}

    with open( webRoot + '/' + aw['valuesFile'], 'r' ) as file:
        data = getSplitLine( file, 0 )
        group = None
        while data:
            if data[0]:
                group = data[0]
                webAw['groups'][group] = data[2]
            else:
                value = group + '-' + data[1] if \
                    aw['groupInValue'] else data[1]
                webAw['values'].append( { 'value': value, 'desc': data[2], 'group': group, \
                        'displayValue': data[1] } )
                aw['values'].append( value )
                if aw.has_key( 'keyAttr' ):
                    for key in data[3].split( ',' ):
                        aw['byKey'][key] = value
            data = getSplitLine( file, 0, 3 )
        webAw['values'].sort( key = lambda x: x['value'] )
        webAw['orderedGroups'] = webAw['groups'].keys()
        webAw['orderedGroups'].sort()
    
    awards.append( aw )
    webAwards.append( webAw )


with open( webRoot + '/debug/awardsValues.json', 'w' ) as fav:
    fav.write( json.dumps( webAwards ) )

with open( webRoot + '/debug/awardsData.json', 'w' ) as fav:
    fav.write( json.dumps( awards ) )


