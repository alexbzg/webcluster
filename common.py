#!/usr/bin/python
#coding=utf-8

import ConfigParser, decimal

appRoot = '/usr/local/webcluster'

def siteConf():
    conf = ConfigParser.ConfigParser()
    conf.read( appRoot + '/site.conf' )
    return conf

def readConf( file ):
    conf = ConfigParser.ConfigParser()
    conf.read( appRoot + '/' + file )
    return conf


def jsonEncodeExtra( obj ):
    if isinstance( obj, decimal.Decimal ):
        return float( obj )
    raise TypeError( repr( obj ) + " is not JSON serializable" )

