#!/usr/bin/python
#coding=utf-8

from twisted.internet import reactor, task, defer
from twisted.internet.defer import DeferredQueue
from twisted.python import log

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb, cursor2dicts

conf = siteConf()
webRoot = conf.get( 'web', 'root' )

awardsData = loadJSON( webRoot + '/awardsData.json' )

fieldValues = {}
for ad in awardsData:
    if ad['country'] and ad.has_key( 'fieldValues' ) and ad['fieldValues']:
        if not fieldValues.has_key(ad['country']):
            fieldValues[ad['country']] = {}
        fieldValues[ad['country']][ad['fieldValues']] = frozenset( ad['values'].keys() )

fieldRe = { 'district': re.compile( '[a-zA-Z]{2}[ -]+\d\d' ),\
        'gridsquare': re.compile( '[a-zA-Z0-9]{6}' ) }

reCountry = re.compile("\s(\S+):$");
rePfx = re.compile("(\(.*\))?(\[.*\])?");
prefixes = [ {}, {} ]
countries = {}
for cty, cl in conf.items( 'countries' ):
    for code in cl.split( ',' ):
        countries[code] = cty.title()
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

def getCountry( cs ):
    dxCty = None
    if prefixes[1].has_key( cs ):
        dxCty = prefixes[1][cs];
    else:
        for c in xrange(1, len( cs ) ):
            if prefixes[0].has_key( cs[:c] ):
                dxCty = prefixes[0][ cs[:c] ]
    if dxCty:
        return countries[ dxCty ] if countries.has_key( dxCty ) else None
    else:
        return None



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

def findDiap( diaps, value ):
    for diap in diaps:
        if diap[1] <= value and diap[2] >= value:
            return diap[0]
        elif diap[1] > value:
            return None
    return None



class DX( object ):
    reState0 = re.compile( '(\w+)\s*-?\s*0*(\d\d)' )
    bands = [ [ '1.8', 1800, 2000 ],
            [ '3.5', 3500, 4000 ],
            [ '7', 7000, 7300 ],
            [ '10', 1000, 10150 ],
            [ '14', 14000, 14350 ],
            [ '18', 18068, 18168 ],
            [ '21', 21000, 21450 ],
            [ '24', 24890, 24990 ],
            [ '28', 28000, 29700 ], 
            [ '50', 50000, 54000 ], 
            [ '144', 144000, 148000 ] ]
    modes = { 'CW': ( 'CW', ),
            'SSB': ( 'USB', 'LSB', 'FM', 'SSB' ),
            'DIGI': ( 'RTTY', 'PSK', 'JT65', 'FSK', 'OLIVIA', 'SSTV' ) }
    modesMap = []
    with open( appRoot + '/bandMap.txt', 'r' ) as fBandMap:
        reBandMap = re.compile( "^(\d+\.?\d*)\s*-?(\d+\.?\d*)\s+(\S+)(\r\n)?$" )
        for line in fBandMap.readlines():
            m = reBandMap.match( line )
            if m:
                modesMap.append( [ m.group(3), float( m.group(1) ), \
                        float( m.group(2) ) ] )

    def toDict( self ):
        return {
            'cs': self.cs,
            'text': self.text,
            'de': self.de,
            'freq': self.freq,
            'ts': self.ts,
            'time': self.time,
            'district': self.district,
            'gridsquare': self.gridsquare,
            'country' : self.country,
            'awards': self.awards,
            'mode': self.mode,
            'band': self.band

            }

    def __init__( self, dxData = None, **params ):

        self._district = None
        self.awards = {}
        self.dxData = dxData
        self.text = params['text']
        self.freq = params['freq']

        self.band = findDiap( DX.bands, self.freq )

        self.mode = None
        t = self.text.upper()
        for ( mode, aliases ) in DX.modes.iteritems():
            for alias in aliases:
                if re.search( '(^|\s)' + alias + '(\d|\s|$)', t ):
                    self.mode = mode
                    break
        if not self.mode:
            modeByMap = findDiap( DX.modesMap, self.freq )
            if modeByMap:
                for ( mode, aliases ) in DX.modes.iteritems():
                    if modeByMap in aliases:
                        self.mode = mode
                        break
        
        self.cs = params['cs']
        self.de = params['de']
        self.country = params['country'] if params.has_key( 'country' ) \
                else getCountry( self.cs )
        self.qrzData = False
        self.inDB = False

        if params.has_key( 'ts' ):
            self.ts = params['ts']
            self.time = params['time']
            self.district = params['district'] if params.has_key( 'state' ) else None
            self.gridsquare = params['gridsquare'] if params.has_key( 'qth' ) \
                    else None
            self.inDB = True
            self.awards = params['awards'] if params.has_key( 'awards' ) else {}

        else:
        
            self.time = params['time'][:2] + ':' + params['time'][2:4]
            self.ts = time.time()
            self.district = None
            self.gridsquare = None

            csLookup = dxdb.getObject( 'callsigns', { 'callsign': self.cs }, \
                    False, True )

            if csLookup:
                self.district = csLookup['state']
                self.gridsquare = csLookup['qth']
                self.inDB = True
                self.qrzData = csLookup['qrz_data_loaded']
                logging.debug( 'callsign found in db' )
                awLookup = cursor2dicts( dxdb.execute( """ 
                    select award, value 
                    from awards
                    where callsign = %s""", ( self.cs, ) ), True )
                if awLookup:
                    for i in awLookup:
                        self.awards[i['award']] = i['value']

            if '#' in self.de:
                self.text = (self.text.split( ' ', 1 ))[0]

            self.testLookups()
            self.detectAwards()


    def testLookups( self ):
        skip = { 'web': self.qrzData or '/' in self.cs, 'text': '#' in self.de }
        do = { 'web': False , 'text': False }
        for ad in awardsData:
            if not ad['country'] or ad['country'] == self.country:
                for t in do.keys():
                    if not do[t] and ad['getFields'][t]:
                        do[t] = True
                if ( do['text'] or skip['text'] ) and ( do['web'] or skip['web'] ):
                    break
                else:
                    av = None
                    if ad.has_key('valueAttr') and getattr( self, ad['valueAttr'] ) \
                        and ad['values'].has_key( getattr( self, ad['valueAttr'] ) ):
                        av = ad['values'][getattr( self, ad['valueAttr'] )]
                    elif ad.has_key('keyAttr') and getattr( self, ad['keyAttr'] ) \
                        and ad['byKey'].has_key( getattr( self, ad['keyAttr'] ) ):
                        av = ad['values'][ad['byKey'][getattr( self, ad['valueAttr'] )]]
                    if av and av.has_key( 'getFields' ):
                        for t in do.keys():
                            if not do[t] and av['getFields'][t]:
                                do[t] = True
                        if ( do['text'] or skip['text'] ) and ( do['web'] or skip['web'] ):
                            break
        if do['web'] and not skip['web']:
            self.doWebLookup()
        if do['text'] and not skip['text']:
            self.doTextLookup()

    def doWebLookup( self ):
        if self.country == 'Russia':
            if self.dxData:
                self.dxData.qrzLink.csQueue.put( { 'cs': self.cs, 'cb': self.onQRZdata } )
            elif self.country == 'Ukraine':
                r = urllib2.urlopen( 'http://www.uarl.com.ua/UkrainianCallBOOK/adxcluster.php?calls=' \
                        + self.cs )
                rBody = r.read()
                self.doTextLookup( rBody )

    def doTextLookup( self, text = None ):
        if not text:
            text = self.text
        for field in fieldRe.keys():
            if fieldValues.has_key( self.country ) and \
                fieldValues[ self.country ].has_key( field ):
                for m in fieldRe[field].finditer( text ):
                    if m.group(0) in fieldValues[self.country][field]:
                        setattr( self, field, m.group( 0 ).upper() )

                   

    def onQRZdata( self, data ):
        logging.debug( 'query received ' +  self.cs )
        if data:
            if data.has_key( 'qthloc' ) and data['qthloc'] and not self.gridsquare:
                self.gridsquare = data['qthloc']            
            if not self.district and data.has_key( 'state' ) and data['state']:
                self.district = data['state']
            self.qrzData = True
            self.updateDB()
            self.detectAwards()


    def checkEmpty( self ):
        if self.dxData and not self.awards and self.qrzData:
            self.dxData.remove( self )
            return True

    def updateDB( self ):
        if self.inDB:
            logging.debug( 'updating db callsign record' )
            dxdb.updateObject( 'callsigns',
              { 'callsign': self.cs, 'qth': self.gridlock, 'state': self.district,\
                      'qrz_data_loaded': self.qrzData }, 'callsign' )
        else:
            logging.debug( 'creating new db callsign record' )
            dxdb.getObject( 'callsigns', \
                    { 'callsign': self.cs, 'state': self.district, \
                    'qth': self.gridlock, 'qrz_data_loaded': self.qrzData, \
                    'country': self.country }, \
                    True )
            dxdb.commit()

    def detectAwards( self ):

        def checkAwardValue( ad, l, v ):
            if l['type'] == 'key':
                if ad['byKey'].has_key( v ):
                    return ad['byKey'][v]
            elif l['type'] == 'value':
                if ad['values'].has_key( v ):
                    return v
            return None

        for ad in awardsData:
            if not ad['country'] or ad['country'] == self.country:
                
                av = None
                
                for l in ad['lookups']:                
                    if l['source'] == 'text':
                        for m in re.finditer( l['re'], self.text ):
                            v = m.group(0).upper()
                            av = checkAwardValue( ad, l, v )
                    elif l['source'] == 'field' and getattr( self, l['field'] ):
                        av = checkAwardValue( ad, l, getattr( self, l['field'] )  )
                    if av:
                        self.updateAward( ad, av )
                        break


    def updateAward( self, ad, av ):
        if self.awards.has_key( ad['name'] ):
            if self.awards[ad['name']] == av:
                return
            dxdb.execute( """
                update awards
                set value = %(value)s
                where callsign = %(callsign)s and award = %(award)s""",
                { 'value': av, 'award': ad['name'], 'callsign': self.cs } )
        else:
            dxdb.execute( """
                insert into awards
                values ( %(callsign)s, %(award)s, %(value)s )""",
                { 'value': av, 'award': ad['name'], 'callsign': self.cs } )
        dxdb.commit()
        self.awards[ad['name']] = av


    @property
    def district( self ):
        return self._district

    @district.setter
    def district( self, value ):
        v = None
        if value:
            v = value.replace( ' ', '' )
            m = DX.reState0.match( v )
            if m:
                v = m.group( 1 ) + '-' + m.group( 2 )
        if self._district and self._district != v and self.awards:
            self.awards.clear()
            dxdb.execute( """
                delete from awards
                where callsign = %s """, ( self.cs, ) )
            dxdb.commit()
        self._district = v



class DXData:
    reDX = re.compile( "DX de (\S+):\s+(\d+\.\d+)\s+(\S+)\s+(.+)\s(\d\d\d\dZ)" )

    
    def __init__( self, file = None ):
        self.data = []
        self.file = file
        self.qrzLink = QRZLink()
        if file:
            prevDX = loadJSON( file )
            if prevDX:
                for item in prevDX:
                    self.append( DX( **item ), False )

    def dxLine( self, line ):
        m = DXData.reDX.match( line )
        if m: 
            cs = m.group( 3 )
            country = getCountry( cs )
            freq = float( m.group(2) )
            if country:
                dx = DX( dxData = self, text = m.group(4), cs = cs, freq = freq, \
                        de = m.group(1), time = m.group(5), country = country )
                if not dx.checkEmpty():
                    self.append( dx )



    def append( self, dxItem, new = True ):
        if new:
            self.data[:] = [ x for x in self.data \
                    if x.ts > dxItem.ts - 1800 and \
                    not ( x.cs == dxItem.cs and ( x.freq - dxItem.freq < 1 and \
                    dxItem.freq - x.freq < 1 ) ) ]

        self.data.append( dxItem )
        dxItem.dxData = self
        
        if new and self.file:
            self.toFile()


    def remove( self, dx ):
        if dx in self.data:
            self.data.remove( dx )
            self.toFile()

    def toFile( self ):
        if self.file:
            with open( self.file, 'w' ) as fDxData:
                fDxData.write( json.dumps( [ x.toDict() for x in self.data ] ) )



