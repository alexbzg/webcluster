#!/usr/bin/python
#coding=utf-8

import re
from common import appRoot

reCountry = re.compile("\s\*?(\S+):$")
rePfx = re.compile("(\(.*\))?(\[.*\])?")
reDiap = re.compile(".-.")
prefixes = []
with open( appRoot + '/cty.dat', 'r' ) as fCty:
    for line in fCty.readlines():
        line = line.rstrip( '\r\n' )
        mCountry = reCountry.search( line )
        if mCountry:
            prefixes.append( mCountry.group( 1 ) )

def splitLine( line, fr = 0, to = None ):
    if line:
        data = [item.strip( '"\r\n ' ) for item in line.split( ';' )]
        if to:
            return data[fr:to]
        else:
            return data[fr:]
    else:
        return None

with open( '/var/www/adxc.test/csv/iota_csv', 'r' ) as fS:
    with open( '/var/www/adxc.test/csv/iota.csv', 'w' ) as fD:
        for line in fS.readlines():
            data = splitLine( line )
            if not data[0]:
                pfx = ''
                if data[3]:
                    if '*' in data[3]:
                        pfxPcs = data[3].split( '*' )
                        pfx = pfxPcs[0] + '/' + pfxPcs[1].lower()
                    if not pfx in prefixes:
                        pfx = data[3].replace( '*', '\d' )
                        if "-" in pfx:
                            pfx = reDiap.sub( "[\g<0>]", pfx )
                    else:
                        pfx = data[3]
                if not pfx in prefixes:
                    pfx = '^' + pfx
                if pfx == '^R0F':
                    pfx = '^R.?0F'
                       
                lookup = ''
                if data[5]:
                    lookup = 'web'
                elif not data[4]:
                    lookup = 'text'
                line = ';' + data[1] + ';' + \
                        data[2].replace( '  ( ', ' (' ).replace( ' )', ')' \
                            ).replace( '()', '' ) + ';' + pfx + ';' + lookup + '\n'
            fD.write( line )            


