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

ad = loadJSON( '/var/www/adxc.73/awards.json' )
aw = [ a for a in ad if a['name'] == 'WAB-LSA' ][0]

re.finditer( aw['lookups'][0]['re'], 'blah blah' )

