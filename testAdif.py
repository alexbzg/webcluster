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
from dx import DX, getCountry

import uwsgisrv 
conf = siteConf()


uwsgisrv.dxdb = dbConn()

with open( '/var/www/adxc.73/debug/fullAdif.adi', 'r' ) as f:
    adif = f.read()
    uwsgisrv.loadAdif( 'CCCC', adif )
