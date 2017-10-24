#!/usr/bin/python
#coding=utf-8

import re
from common import appRoot, splitLine

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

with open( '/var/www/adxc.test/csv/iota_csv', 'r' ) as fS:
    with open( '/var/www/adxc.test/csv/iota.csv', 'w' ) as fD:
        for line in fS.readlines():
            data = splitLine( line )
            if not data[0]:
                val = data[1]
                digits = 0
                for s in val:
                    if s.isdigit():
                        digits += 1
                while digits < 3:
                    val = '0' + val
                    digits += 1
                pfx = ''
                if data[3]:
                    if '*' in data[3]:
                        pfxPcs = data[3].split( '*' )
                        pfx = pfxPcs[0] + '/' + pfxPcs[1].lower()
                    if not pfx in prefixes:
                        pfx = data[3].replace( '*', '.' )
                        if "-" in pfx:
                            pfx = reDiap.sub( "[\g<0>]", pfx )
                if pfx and not pfx in prefixes:
                    pfx = '^' + pfx
                if pfx == '^R0F':
                    pfx = '^R.?0F'
                       
                lookup = ''
                if data[5]:
                    lookup = 'web'
                elif not data[4]:
                    lookup = 'text'
                line = ';' + val + ';' + \
                        data[2].replace( '  ( ', ' (' ).replace( ' )', ')' \
                            ).replace( '()', '' ) + ';' + pfx + ';' + lookup + '\n'
            fD.write( line )            


