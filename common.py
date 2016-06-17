#!/usr/bin/python
#coding=utf-8

import ConfigParser

appRoot = '/usr/local/webcluster'

def siteConf():
    conf = ConfigParser.ConfigParser()
    conf.read( appRoot + '/site.conf' )
    return conf

def readConf( file ):
    conf = ConfigParser.ConfigParser()
    conf.read( appRoot + '/' + file )
    return conf



