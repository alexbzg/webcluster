#!/usr/bin/python
#coding=utf-8

import ConfigParser, decimal, json, logging
from os import path
from datetime import datetime, date

appRoot = path.dirname( path.abspath( __file__ ) ) 

def siteConf():
    conf = ConfigParser.ConfigParser()
    conf.optionxform = str
    conf.read( appRoot + '/site.conf' )
    return conf

def readConf( file ):
    conf = ConfigParser.ConfigParser()
    conf.read( appRoot + '/' + file )
    return conf


def jsonEncodeExtra( obj ):
    if isinstance( obj, decimal.Decimal ):
        return float( obj )
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, date):
        return obj.isoformat()
    raise TypeError( repr( obj ) + " is not JSON serializable" )

def loadJSON( pathJS ):
    if not path.isfile( pathJS ):
        logging.exception( pathJS + " not found" )
        return False
    try:
        r = json.load( open( pathJS ) )
        return r
    except Exception as ex:
        logging.error( "Error loading " + pathJS )
        logging.exception( ex )
        return False

def splitLine( line, fr = 0, to = None, delim = ';' ):
    if line:
        data = [item.strip( '"\r\n ' ) for item in line.split( delim )]
        if to:
            return data[fr:to]
        else:
            return data[fr:]
    else:
        return None

