#!/usr/bin/python
#coding=utf-8

from twisted.internet import reactor, task, defer
from twisted.internet.defer import DeferredQueue
from twisted.python import log

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb, cursor2dicts

conf = siteConf()
webRoot = conf.get( 'web', ( 'test_' if '_t' in __name__ else '' ) + 'root' )

awardsData = loadJSON( webRoot + '/awardsData.json' )

fieldValues = {}
fieldValuesSubst = {}
for ad in awardsData:
    if ad['country'] and ad.has_key( 'fieldValues' ) and ad['fieldValues']:
        if not fieldValues.has_key(ad['country']):
            fieldValues[ad['country']] = {}
            fieldValuesSubst[ad['country']] = {}
        fieldValues[ad['country']][ad['fieldValues']] = \
                frozenset( ad['values'].keys() )
        if ad.has_key( 'subst' ):
            fieldValuesSubst[ad['country']][ad['fieldValues']] = ad['subst']

fieldRe = { 'district': re.compile( '[a-zA-Z]{2}[ -]+\d\d' ),\
        'gridsquare': re.compile( '[a-zA-Z0-9]{6}' ) }

reCountry = re.compile("\s\*?(\S+):$")
rePfx = re.compile("(\(.*\))?(\[.*\])?")
reGermanyDOK = re.compile("DOK.*?[:\-\s]([a-zA-Z])-? ?(\d\d)")
prefixes = [ {}, {} ]
countries = {}
for cty, cl in conf.items( 'countries' ):
    for code in cl.split( ',' ):
        countries[code] = cty
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

class QRZComLink:

    def __init__( self ):
        conf = siteConf()
        self.login = conf.get( 'QRZCom', 'login' )
        self.pwd = conf.get( 'QRZCom', 'pwd' )
        self.sessionID = None
        self.getSessionID()


    def getSessionID( self ):

        fpSession = '/var/run/qrzcom.sessionkey'
        if ( os.path.isfile( fpSession ) ):
            with open( fpSession, 'r' ) as fSession:
                sessionID = fSession.read()
                if self.sessionID != sessionID:
                    self.sessionID = sessionID
                    return

        r, rBody = None, None
        try:
            r = urllib2.urlopen( 'http://xmldata.qrz.com/xml/current/?username=' \
                    + self.login + ';password=' + self.pwd )
            rBody = r.read()
            rDict = xmltodict.parse( rBody )
            if rDict['QRZDatabase']['Session'].has_key( 'Key' ):
                self.sessionID = rDict['QRZDatabase']['Session']['Key']
                with open( fpSession, 'w' ) as fSession:
                    fSession.write( self.sessionID )
            else:
                raise Exception( 'Wrong QRZ response' )
        except Exception as e:
            logging.exception( 'Error logging into QRZ.com' )
            if isinstance(e, urllib2.HTTPError):
                r = e                    
            if r:
                logging.error( 'Http result code: ' + str( r.getcode() ) )
                logging.error( 'Http response body: ' + r.read() )
            task.deferLater( reactor, 60*10, self.getSessionID )

    def getData( self, cs, bio = False ):
        if self.sessionID:
            r, rBody = None, None
            type = 'html' if bio else 'callsign'
            try:
                r = urllib2.urlopen( 'http://xmldata.qrz.com/xml/current/?s=' \
                        + self.sessionID + ';' + type + '=' + cs )
                rBody = r.read()
                if bio:
                    return rBody
                rDict = xmltodict.parse( rBody )
                if rDict['QRZDatabase'].has_key( 'Callsign' ):
                    return rDict['QRZDatabase']['Callsign']
                elif rDict['QRZDatabase'].has_key('Session') and \
                    rDict['QRZDatabase']['Session'].has_key( 'Error' ) and \
                    ( rDict['QRZDatabase']['Session']['Error'] == \
                        'Session Timeout' or \
                        rDict['QRZDatabase']['Session']['Error'] == \
                        'Invalid session key' ) :
                        self.getSessionID()
                        if self.sessionID:
                            return self.getData( cs )
                elif rDict['QRZDatabase'].has_key('Session') and \
                    rDict['QRZDatabase']['Session'].has_key( 'Error' ):
                        if 'Not found' in rDict['QRZDatabase']['Session']['Error']:
                            return None
                        else:
                            raise Exception( 'QRZ error: ' + \
                                rDict['QRZDatabase']['Session']['Error'] )
                else:
                    raise Exception( 'Wrong QRZ response: ' + json.dumps( rDict ) )
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
        else:
            self.getSessionID()
            if self.sessionID:
                return self.getData( cs )

qrzComLink = QRZComLink()


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
    reFranceDC = re.compile( '(?<=\n)\d{5}(?=[^\n]*\(FRANCE\)<)' )
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
            [ '144', 144000, 148000 ],
            [ 'UHF', 150000, 2000000 ] ]
    modes = { 'CW': ( 'CW', ),
            'SSB': ( 'USB', 'LSB', 'FM', 'SSB' ),
            'DIGI': ( 'RTTY', 'PSK', 'JT65', 'FSK', 'OLIVIA', 'SSTV' ) }
    subModes = { 'RTTY': [], 'JT65': [], 'PSK': [ 'PSK31', 'PSK63', 'PSK125' ] }
    modesMap = []
    with open( appRoot + '/bandMap.txt', 'r' ) as fBandMap:
        reBandMap = re.compile( "^(\d+\.?\d*)\s*-?(\d+\.?\d*)\s+(\S+)(\r\n)?$" )
        for line in fBandMap.readlines():
            m = reBandMap.match( line )
            if m:
                modesMap.append( [ m.group(3), float( m.group(1) ), \
                        float( m.group(2) ) ] )

    def toDict( self ):
        if self.isBeacon:
            return { 'beacon': True }
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
            'subMode': self.subMode,
            'band': self.band,
            'region': self.region
            }

    def setMode( self, mode, alias ):
        self.mode = mode
        if DX.subModes.has_key( alias ):
            if DX.subModes[alias]:
                t = self.text.upper()
                for subMode in DX.subModes[alias]:
                    if subMode in t:
                        self.subMode = subMode
                        break
            else:
                self.subMode = alias

    def __init__( self, dxData = None, **params ):
        self.isBeacon = False
        self._district = None
        self.region = None
        self.offDB = False
        self.awards = {}
        self.dxData = dxData
        self.text = params['text'].decode('utf-8','ignore').encode("utf-8")
        self.freq = params['freq']
        self.cs = params['cs']
        self.de = params['de']

        txt = self.text.lower()
        if 'ncdxf' in txt or 'beacon' in txt or 'bcn' in txt or '/B' in self.cs:
            self.isBeacon = True
            return
       

        self.band = params['band'] if params.has_key( 'band' ) else None
        self.mode = params['mode'] if params.has_key( 'mode' ) else None
        self.subMode = params['subMode'] if params.has_key( 'subMode' ) else None


        if not self.band and self.freq:
            self.band = findDiap( DX.bands, self.freq )

        if not self.mode and self.text:
            t = self.text.upper()
            for ( mode, aliases ) in DX.modes.iteritems():
                for alias in aliases:
                    if re.search( '(^|\s)' + alias + '(\d|\s|$)', t ):
                        self.setMode( mode, alias )
                        break
        if not self.mode and self.freq:
            modeByMap = findDiap( DX.modesMap, self.freq )
            if modeByMap:
                if modeByMap == 'BCN':
                    self.isBeacon = True
                    return
                for ( mode, aliases ) in DX.modes.iteritems():
                    if modeByMap in aliases:
                        self.setMode( mode, modeByMap )
                        break


        
        self.country = params['country'] if params.has_key( 'country' ) \
                else getCountry( self.cs )
        self.qrzData = False
        self.inDB = False

        if params.has_key( 'ts' ):
            self.inDB = True
            self.ts = params['ts']
            self.time = params['time']
            self._district = params['district'] if params.has_key( 'state' ) \
                    else None
            self.region = params['region'] if params.has_key( 'region' ) \
                    else None
            self.gridsquare = params['gridsquare'] if params.has_key( 'qth' ) \
                    else None
            self.awards = params['awards'] if params.has_key( 'awards' ) else {}

        else:
        
            self.time = params['time'][:2] + ':' + params['time'][2:4]
            self.ts = time.time()
            self.region = None
            self.district = None
            self.gridsquare = None

            csLookup = dxdb.getObject( 'callsigns', { 'callsign': self.cs }, \
                    False, True )

            if csLookup:
                self.inDB = True
                self.region = csLookup['region']
                self._district = csLookup['district']
                self.gridsquare = csLookup['qth']
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
                    if not do[t] and ad['getFields'].has_key( t ) and \
                        ad['getFields'][t]:
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
                        av = ad['values'][ad['byKey'][getattr( \
                                self, ad['keyAttr'] )]]
                    if av and av.has_key( 'getFields' ):
                        for t in do.keys():
                            if not do[t] and av['getFields'][t]:
                                do[t] = True
                        if ( do['text'] or skip['text'] ) and \
                                ( do['web'] or skip['web'] ):
                            break
        if do['web'] and not skip['web']:
            self.doWebLookup()
        if do['text'] and not skip['text']:
            self.doTextLookup()

    def doWebLookup( self ):
        if self.country == 'Russia':
            if self.dxData:
                self.dxData.qrzLink.csQueue.put( \
                        { 'cs': self.cs, 'cb': self.onQRZdata } )
        elif self.country == 'Ukraine':
            r = urllib2.urlopen( \
                'http://www.uarl.com.ua/UkrainianCallBOOK/adxcluster.php?calls='\
                    + self.cs )
            rBody = r.read()
            self.doTextLookup( rBody )
            self.qrzData = True
            self.updateDB()
        elif self.country == 'France':
            r = urllib2.urlopen( \
                'http://nomenclature.r-e-f.org/index.php?req='\
                    + self.cs )
            rBody = r.read()
            m = DX.reFranceDC.search( rBody )
            if m:
                idx = m.group(0)
                if idx.startswith( '200' ) or idx.startswith( '201' ):
                    idx = '201'
                elif idx.startswith( '202' ):
                    idx = '202'
                else:
                    idx = idx[0:2]
                self.district = idx
                self.qrzData = True
                self.updateDB()

        else:
            data = qrzComLink.getData( self.cs )
            if data:
                self.qrzData = True
                if self.country == 'USA':
                    if data.has_key( 'state' ):
                        self.state = data['state']
                    if data.has_key( 'state' ) or data.has_key( 'county' ):
                        self.district = ( data['state'] \
                                if data.has_key( 'state' ) else '' ) + \
                                ( ' ' if data.has_key( 'state' ) and \
                                    data.has_key( 'county' ) else '' ) + \
                                ( data['county'] if data.has_key( 'county' ) \
                                    else '' )
                    if data.has_key( 'grid' ):
                        self.gridsquare = data['grid'].upper()
                elif self.country == 'Germany':
                    if data.has_key( 'bio' ):
                        bio = qrzComLink.getData( self.cs, True )
                        if bio:
                            for m in reGermanyDOK.finditer( bio ):
                                v = m.group( 1 ).upper() + m.group( 2 )
                                self.district = v
                                if self.district == v:
                                    break
                self.updateDB()

    def doTextLookup( self, text = None ):
        if not text:
            text = self.text
        for field in fieldRe.keys():
            if fieldValues.has_key( self.country ) and \
                fieldValues[ self.country ].has_key( field ):
                for m in fieldRe[field].finditer( text ):
                    v = m.group( 0 ).upper()
                    if field == 'district':
                        oldDistrict = self.district
                        self.district = v
                        if oldDistrict != self.district:
                            break
                    if v in fieldValues[self.country][field]:
                        setattr( self, field, v )
                    elif fieldValuesSubst[ self.country ].has_key( field ) and \
                        fieldValuesSubst[ self.country ][ field ].has_key( v ):
                        setattr( self, field, \
                            fieldValuesSubst[ self.country ][ field ][ v ] )

                   

    def onQRZdata( self, data ):
    #    logging.debug( 'query received ' +  self.cs )
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
        if self.offDB:
            return
        if self.inDB:
            dxdb.updateObject( 'callsigns',
              { 'callsign': self.cs, 'qth': self.gridsquare, \
                      'district': self.district, 'region': self.region,\
                      'qrz_data_loaded': self.qrzData }, 'callsign' )
        else:
            dxdb.getObject( 'callsigns', \
                    { 'callsign': self.cs, 'region': self.region, \
                    'district': self.district,\
                    'qth': self.gridsquare, 'qrz_data_loaded': self.qrzData, \
                    'country': self.country }, \
                    True )
            dxdb.commit()
            self.inDB = True

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
                        text = getattr( self, l['field'] ) if l.has_key( 'field' ) \
                                else self.text
                        for m in re.finditer( l['re'], text ):
                            v = m.group(0).upper()
                            av = checkAwardValue( ad, l, v )
                    elif l['source'] == 'field' and getattr( self, l['field'] ):
                        av = checkAwardValue( ad, l, getattr( self, l['field'] )  )
                    if av:
                        self.updateAward( ad, av )
                        break


    def updateAward( self, ad, av ):
        if not self.inDB:
            self.updateDB()
        if self.awards.has_key( ad['name'] ):
            if self.awards[ad['name']] == av:
                return
            if not self.offDB:
                dxdb.execute( """
                    update awards
                    set value = %(value)s
                    where callsign = %(callsign)s and award = %(award)s""",
                    { 'value': av, 'award': ad['name'], 'callsign': self.cs } )
        else:
            if not self.offDB:
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
        if self.country == 'USA':
            v = value
            if v and self.region == None:
                r = v.split( ' ' )[0]
                if r in fieldValues[ 'USA' ]['region']:
                    self.region = r
                    self.updateDB()
        elif self.country in ( 'Japan', 'Germany' ):
            v = value
        else:
            if value:
                v = value.replace( ' ', '' )
                if self.country in ( 'Russia', 'Ukraine' ):
                    m = DX.reState0.match( v )
                    if m:
                        v = m.group( 1 ) + '-' + m.group( 2 )
        if v and fieldValues.has_key( self.country ) and \
            fieldValuesSubst[ self.country ].has_key( 'district' ) and \
            fieldValuesSubst[ self.country ]['district'].has_key( v ):
            v = fieldValuesSubst[ self.country ]['district'][v]
        elif v and fieldValues.has_key( self.country) \
            and fieldValues[ self.country ].has_key( 'district' ) and \
            not v in fieldValues[ self.country ]['district']:
            return
        if self._district and self._district != v and self.awards:
            self.awards.clear()
            dxdb.execute( """
                delete from awards
                where callsign = %s """, ( self.cs, ) )
            dxdb.commit()
        if self._district != v:
            self._district = v
            self.updateDB()



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
            self.append( \
                    DX( dxData = self, text = m.group(4), cs = cs, freq = freq, \
                        de = m.group(1), time = m.group(5), country = country ) )



    def append( self, dxItem, new = True ):
        if dxItem.isBeacon:
            return
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
                data = []
                for x in self.data:
                    try:
                        json.dumps( x.toDict() ).encode( 'utf-8' )
                        data.append( x.toDict() )
                    except Exception as e:
                        logging.exception( 'Non unicode character in dx' )
                        logging.exception( x.toDict() )
                        self.data.remove( x )
                fDxData.write( json.dumps( data ) )



