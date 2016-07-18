#!/usr/bin/python
#coding=utf-8


from twisted.internet import reactor, task, defer
from twisted.internet.protocol import ReconnectingClientFactory
from twisted.internet.defer import DeferredQueue
from twisted.conch.telnet import TelnetTransport, StatefulTelnetProtocol
from twisted.python import log
import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict,\
        argparse

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb
from dx import DX, DXData

argparser = argparse.ArgumentParser()
argparser.add_argument( '-t', action = 'store_true' )
args = vars( argparser.parse_args() )
postfix = '_t' if args['t'] else ''

conf = siteConf()
pidFile = open( '/run/clustercn' + postfix + '.pid', 'w' )
pidFile.write( str( os.getpid() ) )
pidFile.close()
observer = log.PythonLoggingObserver()
observer.start()

logging.basicConfig( level = logging.DEBUG if args['t'] else logging.ERROR,
        format='%(asctime)s %(message)s', 
        filename='/var/log/clustercn' + postfix + '.log',
        datefmt='%Y-%m-%d %H:%M:%S' )
logging.info( 'starting in test mode' )

dxData = DXData( conf.get( 'web', 'root' ) + "/dxdata.json" )

class ClusterProtocol(StatefulTelnetProtocol):
    def lineReceived(self, line):
        dxData.dxLine( line )
        logging.error( line )
        self.schedulePing()

    def schedulePing( self ):
        if self.pingTask and self.pingTask.active():
            self.pingTask.cancel()
        self.pingTask = reactor.callLater( 60, self.ping )
        if self.timeoutTask:
            self.timeoutTask.cancel()
            self.timeoutTask = None

    def connectionMade(self):
        self.sendLine( conf.get( 'cluster', 'callsign' ) )
        self.sendLine( conf.get( 'cluster', 'init_cmd' ) )  
        self.setLineMode()
        self.pingTask = None
        self.timeoutTask = None
        self.schedulePing()

    def ping( self ):
        self.sendLine( 'dxtest 14001 r7ab' )
        logging.error( 'sending ping' )
        self.timeoutTask = reactor.callLater( 5, self.timeout )

    def timeout( self ):
        self.transport.loseConnection()
        logging.error( 'Cluster timeout' )

class ClusterClient(ReconnectingClientFactory):
    def buildProtocol(self, addr):
        return TelnetTransport(ClusterProtocol)

    def clientConnectionLost(self, connector, reason):
        # do stuff here that is unique to your own requirements, then:
        ReconnectingClientFactory.clientConnectionLost(self, connector, reason)

reactor.connectTCP( conf.get( 'cluster', 'host' ), \
        conf.getint( 'cluster', 'port' ), ClusterClient())

reactor.run()
