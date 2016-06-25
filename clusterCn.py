#!/usr/bin/python
#coding=utf-8


from twisted.internet import reactor, task, defer
from twisted.internet.protocol import ReconnectingClientFactory
from twisted.internet.defer import DeferredQueue
from twisted.conch.telnet import TelnetTransport, StatefulTelnetProtocol
from twisted.python import log
import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict

from common import appRoot, readConf, siteConf
from dxdb import dxdb


conf = siteConf()
pidFile = open( appRoot + '/clusterCn.pid', 'w' )
pidFile.write( str( os.getpid() ) )
pidFile.close()
observer = log.PythonLoggingObserver()
observer.start()
logging.basicConfig( level = logging.ERROR,
        format='%(asctime)s %(message)s', 
        datefmt='%Y-%m-%d %H:%M:%S' )
logging.info( 'starting in test mode' )

reDX = re.compile( "DX de (\S+):\s+(\d+\.\d+)\s+(\S+)\s+(.+)\s(\d\d\d\dZ)" )

class QRZLink:

    def __init__( self ):
        self.login = conf.get( 'QRZ', 'login' )
        self.pwd = conf.get( 'QRZ', 'pwd' )
        self.csQueue = DeferredQueue()
        self.queueTask = None
        self.getSessionID()

    def startQueueTask( self ):
        self.queueTask = self.csQueue.get()
        self.queueTask.addCallback( self.onCS )

    def stopQueueTask( self ):
        if self.queueTask:
            self.queueTask.cancel()
            self.queueTask = None

    def onCS( self, item ):
        self.stopQueueTask()
        self.queueTask = task.deferLater( reactor, 3.5, self.startQueueTask )
        item['cb']( self.getData( item['cs'] ) )


    def getSessionID( self ):
        if self.queueTask:
            self.stopQueueTask()
            self.sessionID = None
            reactor.callLater( 3, self.getSessionID )
            return
        r, rBody = None, None
        try:
            r = urllib2.urlopen( 'http://api.qrz.ru/login?u=' + \
                    self.login + '&p=' + self.pwd )
            rBody = r.read()
            rDict = xmltodict.parse( rBody )
            if rDict['QRZDatabase']['Session'].has_key( 'session_id' ):
                self.sessionID = rDict['QRZDatabase']['Session']['session_id']
                self.startQueueTask()
                reactor.callLater( 60*59, self.getSessionID )            
            else:
                if rDict['QRZDatabase']['Session'].has_key('error'):
                    logging.error( 'QRZ returned error: ' + \
                            rDict['QRZDatabase']['Session']['error'] )
                    task.deferLater( reactor, 60*10, self.getSessionID )
                else:
                    raise Exception( 'Wrong QRZ response' )
        except Exception as e:
            logging.exception( 'Error getting logging into QRZ' )
            if isinstance(e, urllib2.HTTPError):
                r = e                    
            if r:
                logging.error( 'Http result code: ' + str( r.getcode() ) )
                logging.error( 'Http response body: ' + r.read() )
            task.deferLater( reactor, 60*10, self.getSessionID )

    def getData( self, cs ):
        if self.sessionID:
            r, rBody = None, None
            try:
                r = urllib2.urlopen( 'http://api.qrz.ru/callsign?id=' + \
                        self.sessionID + '&callsign=' + cs )
                rBody = r.read()
                rDict = xmltodict.parse( rBody )
                if rDict['QRZDatabase'].has_key( 'Callsign' ):
                    return rDict['QRZDatabase']['Callsign']
                else:
                    if rDict['QRZDatabase']['Session'].has_key('error'):
                        if rDict['QRZDatabase']['Session']['error'] == \
                                'Callsign not found':
                            return { 'state': None, 'qthloc': None }
                        elif rDict['QRZDatabase']['Session']['error'] == \
                                'Session does not exist or expired':
                            self.getSessionID()
                            return None
                    raise Exception( 'Wrong QRZ response' )
            except Exception as e:
                if isinstance(e, urllib2.HTTPError):
                    if e.getcode() == 404:
                        return { 'state': None, 'qthloc': None }
                    elif e.getcode() == 403:
                        self.getSessionID()
                        return None
                    r = e                    
                logging.exception( 'QRZ query error' )
                if r:
                    logging.error( 'Http result code: ' + str( r.getcode() ) )
                    logging.error( 'Http response body: ' + r.read() )
                return None


country = "";
reCountry = re.compile("\s(\S+):$");
rePfx = re.compile("(\(.*\))?(\[.*\])?");
prefixes = [ {}, {} ]
dxData = []
qrzLink = QRZLink()

def exportDxData():
    with open( conf.get( 'web', 'root' ) + "/dxdata.json", 'w' ) as fDxData:
        fDxData.write( json.dumps( dxData, default=lambda o: o.__dict__ ) )
   

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
        self.de = params['de']
        self.time = params['time'][:2] + ':' + params['time'][2:4]
        self.ts = time.time()

        if '#' in self.de:
            self.text = (self.text.split( ' ', 1 ))[0]


        csLookup = dxdb.getObject( 'callsigns', { 'callsign': self.cs }, \
                False, True )

        if csLookup:
            self.state = csLookup['state']
            self.qth = csLookup['qth']
            logging.debug( 'callsign found in db' )
        else:
            logging.debug( 'putting calssign in query queue: ' + self.cs )
            qrzLink.csQueue.put( { 'cs': self.cs, 'cb': self.onQRZdata } )



        dxData[:] = [ x for x in dxData \
                if x.ts > self.ts - 1800 and \
                not ( x.cs == self.cs and ( x.freq - self.freq < 0.3 and \
                self.freq - x.freq < 0.3 ) ) ]

        dxData.append( self )

        exportDxData()


    def onQRZdata( self, data ):
        logging.debug( 'query received ' +  self.cs )
        print data
        if data:
            self.state = data['state'] if data.has_key( 'state' ) else None
            self.qth = data['qthloc'] if data.has_key( 'qthloc' ) else None
            logging.debug( 'saving to db' )
            dxdb.getObject( 'callsigns', \
                    { 'callsign': self.cs, 'state': self.state, 'qth': self.qth }, \
                    True )
            dxdb.commit()
            exportDxData()





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
                DX( text = m.group(4), cs = cs, freq = freq, de = m.group(1), \
                        time = m.group(5) )
                print line, dxCty

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
