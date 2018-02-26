#!/usr/bin/python
#coding=utf-8

from twisted.internet import reactor, task, defer
from twisted.internet.protocol import ReconnectingClientFactory
from twisted.internet.defer import DeferredQueue
from twisted.conch.telnet import TelnetTransport, StatefulTelnetProtocol
from twisted.python import log
import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict, jwt

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb, dbConn, cursor2dicts
from dx_t import DX

print dxdb.getObject( 'users', { 'callsign': 'QQQQ' } )




