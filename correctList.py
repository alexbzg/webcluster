#!/usr/bin/python
#coding=utf-8


with open( '/var/www/adxc.test/csv/list_wwdxc.csv', 'r' ) as fS:
    with open( '/var/www/adxc.test/csv/list_wwdxc_.csv', 'w' ) as fD:
        l = ';' + ','.join( fS.readlines() ).replace( 'Ø', '0' ).replace( '\r\n', '' ).replace( ' ', '' )
        fD.write( l )

