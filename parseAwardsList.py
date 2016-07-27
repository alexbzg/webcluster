#!/usr/bin/python
#coding=utf-8

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict,\
        argparse

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb
from dx import DX, DXData


if len( sys.argv ) < 2:
    raise Exception( "No filename given!" )

conf = siteConf()
fnAwardsValues = conf.get( 'web', 'root' ) + '/awardsValues.json'
awardsValues = loadJSON( fnAwardsValues )
if not awardsValues:
    awardsValues = [] 

def getSplitLine( file, fr, to ):
    line = file.readline()
    if line:
        return [item.strip( '"\r\n ' ) for item in line.split( ';' )[fr:to]]
    else:
        return None

for fName in sys.argv[1:]:
    with open( fName, 'r' ) as file:
        name, fullName, country = getSplitLine( file, 0, 3 )
        av = [ x for x in awardsValues if x['name'] == name ]
        if av:
            av = av[0]
        else:
            av = { 'name': name, 'fullName': fullName, 'country': country, 'values': [], 'groups': {} }
            awardsValues.append( av )
        reGroup = re.compile( '\((\w\w)\)' )
        data = getSplitLine( file, 0, 3 )
        group = None
        while data:
            if ( not data[0] and data[1] ) or ( len( data ) > 2 and data[2] ):
                if len( data ) > 2 and data[2]:
                    group = data[2]
                    av['groups'][group] = data[1]
                else:
                    m = reGroup.search( data[1] )
                    if m:
                        group = m.group(1)
                        av['groups'][group] = data[1]
            elif data[0] and data[1]:
                displayValue = data[0].split( '-' )[1] if '-' in data[0] else data[0]
                av['values'].append( { 'value': data[0], 'desc': data[1], 'group': group, \
                        'displayValue': displayValue } )
            data = getSplitLine( file, 0, 3 )
        av['values'].sort( key = lambda x: x['value'] )
        av['orderedGroups'] = av['groups'].keys()
        av['orderedGroups'].sort()

with open( fnAwardsValues, 'w' ) as fav:
    fav.write( json.dumps( awardsValues ) )



