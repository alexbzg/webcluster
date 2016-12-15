#!/usr/bin/python
#coding=utf-8


with open( '/var/www/adxc.test/csv/list_rnars.csv', 'r' ) as fS:
    with open( '/var/www/adxc.test/csv/list_rnars_.csv', 'w' ) as fD:
#        ll = [ ( x.split( ';' ) )[0] for x in fS.readlines() ]
#        l = ';' + ','.join( ll ).replace( 'Ø', '0' ).replace( '\r\n', '' ).replace( ' ', '' )
        l = ';' + ','.join( fS.readlines() ).replace( 'Ø', '0' ).replace( '\r\n', '' ).replace( ' ', '' )
        fD.write( l )

