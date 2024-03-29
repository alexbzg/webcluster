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

dxData = DXData( conf.get( 'web', 'root' ) + "/dxdata.json", disable_qrz_ru = False )
init_cmd = []
with open(appRoot + '/cluster.init.cmd', 'r') as f_cmd:
    init_cmd = f_cmd.readlines()

class ClusterProtocol(StatefulTelnetProtocol):
    def lineReceived(self, line):
        logging.debug(line)
        dxData.dxLine( line )
        self.schedulePing()
        if self.connectionStatus == 'testing':
            self.setConnectionStatus( 'connected' )

    def schedulePing( self ):
        if self.pingTask and self.pingTask.active():
            self.pingTask.cancel()
        self.pingTask = reactor.callLater( 60, self.ping )
        if self.timeoutTask:
            self.timeoutTask.cancel()
            self.timeoutTask = None

    def connectionMade(self):
        reactor.callLater(0.2, self._sendLine, conf.get( 'cluster', 'callsign' ) )
        for cmd in init_cmd:
            reactor.callLater(0.3, self._sendLine, cmd)  
        self.setLineMode()
        self.pingTask = None
        self.timeoutTask = None
        self.schedulePing()
        self.setConnectionStatus( 'connected' )
        logging.error( 'Cluster connection made' )

    def _sendLine(self, text):
        logging.debug('>>> ' + text)
        self.sendLine(text)

    def connectionLost(self, reason):
        logging.error( 'Cluster connection lost: ' + reason.getErrorMessage() )
        self.setConnectionStatus( 'disconnected' )

    def ping( self ):
        self.sendLine( 'dxtest 14001 rn6bnd' )
        self.setConnectionStatus( 'testing' )
        logging.debug( 'sending ping' )
        self.timeoutTask = reactor.callLater( 5, self.timeout )

    def timeout( self ):
        self.transport.loseConnection()
        logging.error( 'Cluster timeout' )

    def setConnectionStatus( self, status ):
        self.connectionStatus = status
        with open( conf.get( 'web', 'root' ) + '/clusterConnection.json', 'w' ) \
                as fS:
            fS.write( json.dumps( { 'status': status } ) )
       

class ClusterClient(ReconnectingClientFactory):
    maxDelay = 30


    def buildProtocol(self, addr):
        return TelnetTransport(ClusterProtocol)



reactor.connectTCP( conf.get( 'cluster', 'host' ), \
        conf.getint( 'cluster', 'port' ), ClusterClient())

reactor.run()
