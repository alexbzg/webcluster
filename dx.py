#!/usr/bin/python
#coding=utf-8

from twisted.internet import reactor, task, defer
from twisted.internet.defer import DeferredQueue
from twisted.python import log

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb, cursor2dicts


states = frozenset( [ x['state'] for x in cursor2dicts( dxdb.execute( \
        'select distinct state from callsigns where state is not null;' ) ) ] )
reState = re.compile( '[a-zA-Z]{2}[ -]+\d\d' )


class QRZLink:

    def __init__( self ):
        conf = siteConf()
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
                with open( '/run/clustercn.sessionid', 'w' ) as f:
                    f.write( self.sessionID )
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


class DX:

    def toDict( self ):
        return {
            'cs': self.cs,
            'text': self.text,
            'de': self.de,
            'freq': self.freq,
            'ts': self.ts,
            'time': self.time,
            'state': self.state,
            'qth': self.qth }

    def __init__( self, dxData = None, **params ):

        self.dxData = dxData
        self.text = params['text']
        self.freq = params['freq']
        self.cs = params['cs']
        self.de = params['de']
        self.qrzData = False
        self.inDB = False

        if params.has_key( 'ts' ):
            self.ts = params['ts']
            self.time = params['time']
            self.state = params['state'] if params.has_key( 'state' ) else None
            self.qth = params['qth'] if params.has_key( 'qth' ) else None
            self.inDB = True

        else:
        
            self.time = params['time'][:2] + ':' + params['time'][2:4]
            self.ts = time.time()
            self.state = None
            self.qth = None



            csLookup = dxdb.getObject( 'callsigns', { 'callsign': self.cs }, \
                    False, True )

            if csLookup:
                self.state = csLookup['state']
                self.qth = csLookup['qth']
                self.inDB = True
                self.qrzData = csLookup['qrz_data_loaded']
                logging.debug( 'callsign found in db' )
            if  self.dxData and ( not '/' in self.cs or ( not csLookup or \
                    not csLookup['qrz_data_loaded'] ) ):
                logging.debug( 'putting calssign in query queue: ' + self.cs )
                self.dxData.qrzLink.csQueue.put( { 'cs': self.cs, 'cb': self.onQRZdata } )

            if '#' in self.de:
                self.text = (self.text.split( ' ', 1 ))[0]
            else:
                for m in reState.finditer( self.text ):
                    state = m.group( 0 ).upper()
                    if  state in states:
                        if self.state != state:
                            self.state = state
                            self.updateDB()
                        break

    def onQRZdata( self, data ):
        logging.debug( 'query received ' +  self.cs )
        if data:
            if data.has_key( 'qthloc' ):
                self.qth = data['qthloc']            
            if not self.state and data.has_key( 'state' ) and data['state']:
                self.state = data['state']
            self.qrzData = True
            self.updateDB()
            if self.dxData:
                self.dxData.toFile()

    def updateDB( self ):
        if self.inDB:
            logging.debug( 'updating db callsign record' )
            dxdb.updateObject( 'callsigns',
                { 'callsign': self.cs, 'qth': self.qth, \
                'qrz_data_loaded': self.qrzData }, 'callsign' )
        else:
            logging.debug( 'creating new db callsign record' )
            dxdb.getObject( 'callsigns', \
                    { 'callsign': self.cs, 'state': self.state, \
                    'qth': self.qth, 'qrz_data_loaded': self.qrzData }, \
                    True )
            dxdb.commit()


class DXData:
    def __init__( self, file = None ):
        self.data = []
        self.file = file
        self.qrzLink = QRZLink()
        if file:
            prevDX = loadJSON( file )
            if prevDX:
                for item in prevDX:
                    self.append( DX( **item ), False )

    def append( self, dxItem, new = True ):
        if new:
            self.data[:] = [ x for x in self.data \
                    if x.ts > dxItem.ts - 1800 and \
                    not ( x.cs == dxItem.cs and ( x.freq - dxItem.freq < 0.3 and \
                    dxItem.freq - x.freq < 0.3 ) ) ]

        self.data.append( dxItem )
        dxItem.dxData = self
        
        if new and self.file:
            self.toFile()


    def toFile( self ):
        if self.file:
            with open( self.file, 'w' ) as fDxData:
                fDxData.write( json.dumps( [ x.toDict() for x in self.data ] ) )



