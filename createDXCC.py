#!/usr/bin/python
#coding=utf-8
import re

with open( '/var/www/adxc.test/csv/dxcc.csv', 'w' ) as f:
    reCountry = re.compile("^([^:]+):.*\s\*?(\S+):$")
    rePfx = re.compile("(\(.*\))?(\[.*\])?")
    with open( '/usr/local/webcluster/cty.dat', 'r' ) as fCty:
        for line in fCty.readlines():
            line = line.rstrip( '\r\n' )
            m = reCountry.search( line )
            if m:
                f.write( m.group(2) + ';' + m.group(1) + '\n' )

