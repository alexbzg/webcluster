#!/usr/bin/python
#coding=utf-8

from twisted.internet import reactor, task, defer
from twisted.internet.protocol import ReconnectingClientFactory
from twisted.internet.defer import DeferredQueue
from twisted.conch.telnet import TelnetTransport, StatefulTelnetProtocol
from twisted.python import log
import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict, jwt

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dbConn, cursor2dicts
from dx_t import DX

conf = siteConf()
while 1:
    d = []
    td = loadJSON( '/var/www/adxc.test/dxdata_.json' )
    for i in td:
        del i['ts']
        tm = i['time']
        aw = DX( **i ).toDict()
        aw['time'] = tm
        d.append( aw )
    with open( '/var/www/adxc.test/dxdata_.json', 'w' ) as f:
        f.write( json.dumps( d ) )
    break
    time.sleep( 100 )


