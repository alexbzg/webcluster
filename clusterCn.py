#!/usr/bin/python
#coding=utf-8


from twisted.internet import reactor
from twisted.internet.protocol import ClientFactory
from twisted.conch.telnet import TelnetTransport, StatefulTelnetProtocol
from twisted.python import log
import sys, decimal, re, datetime, os, logging, time, json

from common import appRoot, readConf, siteConf



conf = siteConf()
pidFile = open( appRoot + '/clusterCn.pid', 'w' )
pidFile.write( str( os.getpid() ) )
pidFile.close()
observer = log.PythonLoggingObserver()
observer.start()
logging.basicConfig( level = logging.DEBUG,
        format='%(asctime)s %(message)s', 
        datefmt='%Y-%m-%d %H:%M:%S' )
logging.info( 'starting in test mode' )

reDX = re.compile( "DX de (\S+):\s+(\d+\.\d+)\s+(\S+)\s+(.+)\s(\d\d\d\dZ)" )

country = "";
reCountry = re.compile("\s(\S+):$");
rePfx = re.compile("(\(.*\))?(\[.*\])?");
prefixes = [ {}, {} ]
dxData = []

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

class DX:


    def __init__( self, **params ):

        self.text = params['text']
        self.freq = params['freq']
        self.cs = params['cs']
        self.ts = time.time()

        dxData[:] = [ x for x in dxData \
                if x.ts > self.ts - 1800 and \
                not ( x.cs == self.cs and ( x.freq - self.freq < 0.3 and \
                self.freq - x.freq < 0.3 ) ) ]

        dxData.append( self )

        with open( conf.get( 'web', 'root' ) + "/dxdata.json", 'w' ) as fDxData:
            fDxData.write( json.dumps( dxData, default=lambda o: o.__dict__ ) )




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
                DX( text = line, cs = cs, freq = freq )
                print line, dxCty

    def connectionMade(self):
        self.sendLine( conf.get( 'cluster', 'callsign' ) )
        self.setLineMode()

class ClusterClient(ClientFactory):
    def buildProtocol(self, addr):
        return TelnetTransport(ClusterProtocol)

reactor.connectTCP( conf.get( 'cluster', 'host' ), conf.getint( 'cluster', 'port' ), ClusterClient())

reactor.run()
