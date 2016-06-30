#!/usr/bin/python
#coding=utf-8

import ConfigParser, decimal, json
from os import path

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

def loadJSON( pathJS ):
    if not path.isfile( pathJS ):
        print pathJS + " not found"
        return False
    try:
        r = json.load( open( pathJS ) )
        return r
    except Exception as ex:
        print "Error loading " + pathJS
        logEx( ex )
        return False

