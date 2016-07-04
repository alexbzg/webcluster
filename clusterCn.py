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

reDX = re.compile( "DX de (\S+):\s+(\d+\.\d+)\s+(\S+)\s+(.+)\s(\d\d\d\dZ)" )
country = "";
reCountry = re.compile("\s(\S+):$");
rePfx = re.compile("(\(.*\))?(\[.*\])?");
prefixes = [ {}, {} ]
dxData = DXData( conf.get( 'web', 'root' ) + "/dxdata.json" )

with open( appRoot + '/cty.dat', 'r' ) as fCty:
    for line in fCty.readlines():
        line = line.rstrip( '\r\n' )
        mCountry = reCountry.search( line )
        if mCountry:
            country = mCountry.group( 1 )
        else: 
            pfxs = line.lstrip(' ').rstrip( ';,' ).split(',')
            for pfx in pfxs:
                pfxType = 0
                pfx0 = rePfx.sub( pfx, "" )
                if pfx0.startswith("="):
                    pfx0 = pfx0.lstrip('=')
                    pfxType = 1
                if prefixes[pfxType].has_key( pfx0 ):
                    prefixes[pfxType][pfx0] += "; " + country;
                else:
                    prefixes[pfxType][pfx0] =  country




class ClusterProtocol(StatefulTelnetProtocol):
    def lineReceived(self, line):
        m = reDX.match( line )
        if m: 
            cs = m.group( 3 )
            dxCty = ""
            if prefixes[1].has_key( cs ):
                dxCty = prefixes[1][cs];
            else:
                for c in xrange(1, len( cs ) ):
                    if prefixes[0].has_key( cs[:c] ):
                        dxCty = prefixes[0][ cs[:c] ]
            freq = float( m.group(2) )
            if dxCty in ( 'UA', 'UA2', 'UA9' ):
                dxData.append( DX( dxData = dxData, text = m.group(4), cs = cs, freq = freq, de = m.group(1), \
                        time = m.group(5) ) )

    def connectionMade(self):
        self.sendLine( conf.get( 'cluster', 'callsign' ) )
        self.setLineMode()

class ClusterClient(ReconnectingClientFactory):
    def buildProtocol(self, addr):
        return TelnetTransport(ClusterProtocol)

    def clientConnectionLost(self, connector, reason):
        # do stuff here that is unique to your own requirements, then:
        ReconnectingClientFactory.clientConnectionLost(self, connector, reason)

reactor.connectTCP( conf.get( 'cluster', 'host' ), \
        conf.getint( 'cluster', 'port' ), ClusterClient())

reactor.run()
