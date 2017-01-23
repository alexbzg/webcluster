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

from uwsgisrv import spliceParams

data = { 'callsign': '1111' }
idParams = { 'callsign': data['callsign'] }
if data.has_key('delete'):
    if dxdb.paramDelete( 'dxpedition', idParams ):
        okResponse = 'OK'
    else:
        dbError = True
else:
    updParams = spliceParams( data, [ 'dt_begin', 'dt_end', \
        'descr', 'link' ] )
    if dxdb.paramUpdateInsert( 'dxpedition', idParams, \
            updParams ):
        okResponse = 'OK'
    else:
        dbError = True
if okResponse:
    dxdb.commit()

