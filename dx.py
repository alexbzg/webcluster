#!/usr/bin/python
#coding=utf-8

from twisted.internet import reactor, task, defer
from twisted.internet.defer import DeferredQueue
from twisted.python import log

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict
import logging
from urlparse import urlparse

from common import appRoot, readConf, siteConf, loadJSON, jsonEncodeExtra
from dxdb import dxdb, cursor2dicts

conf = siteConf()
testMode = '_t' in __name__
webRoot = conf.get( 'web', ( 'test_' if testMode else '' ) + 'root' )
testRoot = conf.get( 'web', 'test_root' )
dirs = [ testRoot ]
if not testMode:
    dirs.append( webRoot )

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

def getWebData( url, returnError = False ):
    try:
        headers = { 
                'User-Agent': 'Wget/1.16 (linux-gnu)',
                'Accept': '*/*',
                'Host': urlparse( url ).hostname,
                'Connection': 'Keep-Alive' }
        req = urllib2.Request( url, None, headers )
        if 'ssa.se' in url:
            logging.debug( 'Query to Sweden: ' + url )
        r = urllib2.urlopen( req )
        return r.read()
    except urllib2.HTTPError as e:
        if returnError:
            return e.read()
        logging.exception( 'Error getting data from ' + url )
        logging.error( e.read() )
        return ''


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

def loadSpecialLists():
    fName = webRoot + '/specialLists.json'
    slData = loadJSON( fName )
    if not slData:
        slData = { 'DXpedition': [], 'Special': [] }
    return slData

def updateSpecialLists():
    slData = loadSpecialLists()
    slData['Special'] = cursor2dicts( dxdb.execute( """
        select callsign, last_ts 
        from callsigns 
        where special_cs and last_ts > now() - interval '2 days';""" ) )
    slDataJSON = json.dumps( slData, default = jsonEncodeExtra )
    for dir in dirs:
        with open( dir + '/specialLists.json', 'w' ) as fsl:
            fsl.write( slDataJSON )

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
    reState0 = re.compile( r'(\w+)\s*-?\s*0*(\d\d)' )
    reFranceDC = re.compile( r'(?<=\n)\d{5}(?=[^\n]*\(FRANCE\)<)' )
    rePolandDC = re.compile( 
            r'<SMALL>(?:<I>)?\(woj\) pow:(?:<\/I>)?<\/SMALL> \((\w)\) (\w\w)' )
    reGermanyDOK = re.compile(r"[Dd][Oo][Kk].*?[:\-\s]([a-zA-Z])-? ?(\d\d)")

    reZIP = { 'Spain': r'\d\d(?=\d\d\d)',
                'Finland': r'\d\d\d\d\d',
                'Sweden': r'(?<=\b)\d\d\d \d\d(?=\b)' }
    for k in reZIP.keys():
        reZIP[k] = re.compile( reZIP[k] )

    zipData = { 'Sweden': 'SE' }
    for k in zipData:
        with open( appRoot + '/zip/' + zipData[k] + '.txt', 'r' ) as zipF:
            zipData[k] = {}
            for line in zipF.readlines():
                lineD = line.decode( 'UTF-8' ).split( '\t' )
                zipData[k][lineD[1]] = lineD[2:]

    reDigitsSpecial = re.compile( r'\d\d' )
    reLettersSpecial = re.compile( r'(?<!^VK)\d[A-Z]{4}' )
    reTempPfx = re.compile( r'^([A-Z]+)\d$' )
    specialPfx = conf.get( 'misc', 'SpecialPfx' ).split( ',' )

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
            'DIGI': ( 'RTTY', 'PSK', 'JT65', 'FSK', 'OLIVIA', 'SSTV', 'JT9' ) }
    subModes = { 'RTTY': [], 'JT65': [], 'PSK': [ 'PSK31', 'PSK63', 'PSK125' ] }
    modesMap = []
    with open( appRoot + '/bandMap.txt', 'r' ) as fBandMap:
        reBandMap = re.compile( "^(\d+\.?\d*)\s*-?(\d+\.?\d*)\s+(\S+)(\r\n)?$" )
        for line in fBandMap.readlines():
            m = reBandMap.match( line )
            if m:
                modesMap.append( [ m.group(3), float( m.group(1) ), \
                        float( m.group(2) ) ] )

    def getAwardMode( self, award ):
        if award.has_key( 'modes' ):
            if self.mode in award['modes']:
                return self.mode
            if self.subMode in award['modes']:
                return self.subMode
            if ( r'DATA' in award['modes'] ) and self.subMode and \
                    ( r'PSK' in self.subMode or r'JT' in self.subMode ):
                return r'DATA'
            logging.debug( 'Award mode detection failed: award' + award['name'] + \
                    ' mode ' + str( self.mode ) + ' ' + str( self.subMode ) )
        return self.subMode if self.subMode else self.mode

    def toDict( self ):
        if self.isBeacon:
            return { 'beacon': True }
        return {
            'cs': self.cs,
            'pfx': self.pfx,
            'qrp': self.qrp,
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
            'region': self.region,
            'special': self.special,
            'iota': self.iota

            }

    def setMode( self, value ):
        alias = None
        for ( mode, aliases ) in DX.modes.iteritems():
            if value == mode:
                self.mode = mode
                break
            if value in aliases:
                self.mode = mode
                alias = value
                break
            for a in aliases:
                if a in value:
                    self.mode = mode
                    alias = a
                    break
            if alias:
                break
        if DX.subModes.has_key( alias ):
            if DX.subModes[alias]:
                t = self.text.upper()
                for subMode in DX.subModes[alias]:
                    if subMode in t:
                        self.subMode = subMode
                        break
            else:
                self.subMode = alias
            if not self.subMode:
                for a in DX.subModes[alias]:
                    if a in value:
                        self.subMode = a
                        break
            if not self.subMode:
                self.subMode = DX.subModes[alias][0]

    def __init__( self, dxData = None, newSpot = False, **params ):
        self.isBeacon = False
        self._district = None
        self.region = None
        self.iota = None
        self.offDB = False
        self.pfx = None
        self.awards = {}
        self.dxData = dxData
        self.country = None
        self.special = False
        self.text = params['text'].decode('utf-8','ignore').encode("utf-8")
        self.freq = params['freq']        
        self.cs = params['cs']
        if '/QRP' in self.cs:
            self.cs = self.cs.replace( '/QRP', '' )
            self.qrp = True
        else:
            self.qrp = False
        self.de = params['de']

        txt = self.text.lower()
        if 'ncdxf' in txt or 'beacon' in txt or 'bcn' in txt or '/B' in self.cs:
            self.isBeacon = True
            return
       

        self.band = params['band'] if params.has_key( 'band' ) else None
        self.mode = None
        self.subMode = None
        if params.has_key( 'mode' ) and params['mode']:
            self.setMode( params['mode'] )
            if not self.mode:
                print params['mode']
                self.mode = params['mode']
        else:
            self.mode = None
        if params.has_key( 'subMode' ):
            self.subMode = params['subMode'] 
        self.detectAwardsList = params['detectAwards'] \
                if params.has_key( 'detectAwards' ) else None


        if not self.band and self.freq:
            self.band = findDiap( DX.bands, self.freq )

        if not self.mode and self.text:
            t = self.text.upper()
            for ( mode, aliases ) in DX.modes.iteritems():
                for alias in aliases:
                    if re.search( '(^|\s)' + alias + '(\d|\s|$)', t ):
                        self.setMode( alias )
                        break
        if not self.mode and self.freq:
            modeByMap = findDiap( DX.modesMap, self.freq )
            if modeByMap:
                if modeByMap == 'BCN':
                    self.isBeacon = True
                    return
                self.setMode( modeByMap )
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
            self.iota = params['iota'] if params.has_key( 'iota' ) else None

        else:
        
            self.time = params['time'][:2] + ':' + params['time'][2:4]
            self.ts = time.time()
            self.region = None
            self.district = None
            self.gridsquare = None

        dxCty = None
        pfx = None

        slashPos = self.cs.find( '/' )
        if self.cs.endswith( '/AM' ) or self.cs.endswith( '/MM' ) \
                or self.subMode == 'PSK125':
            return
        if slashPos != -1:
            parts = self.cs.split( '/' )
            for part in parts:
                if part in ( 'M', 'P', 'QRP', 'QRO' ):
                    continue
                if prefixes[0].has_key( part ):
                    pfx = part
                else:
                    m = DX.reTempPfx.search( part )
                    if m and prefixes[0].has_key( m.group( 1 ) ):
                        pfx = m.group( 1 )
                if pfx:
                    dxCty = prefixes[0][pfx]
                    break

        if not pfx:
            if prefixes[1].has_key( self.cs ):
                dxCty = prefixes[1][self.cs];
            else:
                for c in xrange(1, len( self.cs ) ):
                    if prefixes[0].has_key( self.cs[:c] ):
                        pfx = self.cs[:c]
                        dxCty = prefixes[0][ self.cs[:c] ]

        if dxCty and pfx:
            self.country = countries[ dxCty ] if countries.has_key( dxCty ) \
                    else None
            if pfx in DX.specialPfx:
                self.special = True
            elif self.country == 'Russia':
                m = DX.reDigitsSpecial.search( self.cs )
                if m:
                    self.special = True
            else:
                m = DX.reDigitsSpecial.search( pfx )
                if m:
                    self.special = True
                else:
                    m = DX.reDigitsSpecial.search( self.cs[len( pfx ):] )
                    if m: 
                        self.special = True
                    else:
                        m = DX.reLettersSpecial.search( self.cs )
                        if m:
                            self.special = True
        self.pfx = dxCty

        if not self.inDB:

            csLookup = dxdb.getObject( 'callsigns', { 'callsign': self.cs }, \
                    False, True )

            if csLookup:
                self.inDB = True
                self.region = csLookup['region']
                self._district = csLookup['district']
                self.gridsquare = csLookup['qth']
                self.qrzData = csLookup['qrz_data_loaded']
                awLookup = cursor2dicts( dxdb.execute( """ 
                    select award, value, mode
                    from awards
                    where callsign = %s""", ( self.cs, ) ), True )
                if awLookup:
                    for i in awLookup:
                        #if not i['mode']:
                        award = [a for a in awardsData \
                                if a['name'] == i['award'] ][0]
                        i['mode'] = self.getAwardMode( award )
                        self.awards[i['award']] = \
                            { 'value': i['value'], 'mode': i['mode'] }

            if '#' in self.de:
                self.text = (self.text.split( ' ', 1 ))[0]
            self.testLookups()
            self.detectAwards()
            self.updateDB()

        if newSpot and not '#' in self.de:
            dxdb.getObject( 'spots', \
                { 'callsign': self.cs, 'time': self.time, \
                'de': self.de, 'text': self.text, \
                'freq': self.freq, 'band': self.band, \
                'mode': self.mode, 'submode': self.subMode }, \
                True )




    def testLookups( self ):
        skip = { 'web': self.qrzData or '/' in self.cs, 'text': '#' in self.de }
        do = { 'web': False , 'text': False }
        for ad in awardsData:
            if self.detectAwardsList and not ad['name'] in self.detectAwardsList:
                continue
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

    def detectZip( self, data ):
        for f in ( 'zip', 'addr1', 'addr2' ):
            if data.has_key( f ):
                for m in DX.reZIP[ self.country ].finditer( data[f] ):
                    if DX.zipData.has_key( self.country ):
                        if DX.zipData[ self.country ].has_key( m.group(0) ):
                            return m.group( 0 )
                    else:
                        return m.group( 0 )
        return None

    def doWebLookup( self ):
        if self.country == 'Russia':
            if self.dxData:
                self.dxData.qrzLink.csQueue.put( \
                        { 'cs': self.cs, 'cb': self.onQRZdata } )
        elif self.country == 'Ukraine':
            r = getWebData( \
                'http://www.uarl.com.ua/UkrainianCallBOOK/adxcluster.php?calls='\
                    + self.cs )
            self.doTextLookup( r )
            self.qrzData = True
            self.updateDB()
        elif self.country == 'France':
            r = getWebData( \
                'http://nomenclature.r-e-f.org/index.php?req='\
                    + self.cs )
            m = DX.reFranceDC.search( r )
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
        elif self.country == 'Sweden':
            zip = None
            r = getWebData( \
                r'http://www.ssa.se/smcb/adxcluster.php?callsign='\
                + self.cs )
            try:
                rDict = xmltodict.parse( r )
                if rDict.has_key( 'callbookentry' ) and \
                    rDict['callbookentry'].has_key( 'zipcode' ) \
                    and rDict['callbookentry']['zipcode']:
                        zip = rDict['callbookentry']['zipcode']
            except Exception as e:
                logging.exception( 'Error parsing data from Sweden' )
                logging.error( 'callsign: ' + self.cs )
                logging.error( r )
            if not zip:
                data = qrzComLink.getData( self.cs )
                if data:
                    zip = self.detectZip( data )
            if zip and DX.zipData['Sweden'].has_key( zip ):
                self.district = DX.zipData['Sweden'][zip][3]



        elif self.country == 'Poland':
            r = getWebData( \
                'https://callbook.pzk.org.pl/szukaj.php?adv=1&query='\
                    + self.cs )
            m = DX.rePolandDC.search( r )
            if m:
                self.region = m.group(1)
                self.district = m.group(1) + m.group(2)
                self.qrzData = True
                self.updateDB()

        else:
            data = qrzComLink.getData( self.cs )            
            if data:
                self.qrzData = True
                self.updateIOTA( data )
                if self.country == 'USA':
                    if data.has_key( 'state' ):
                        self.region = data['state']
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
                            for m in DX.reGermanyDOK.finditer( bio ):
                                v = m.group( 1 ).upper() + m.group( 2 )
                                self.district = v
                                if self.district == v:
                                    break
                elif self.country in ( 'Spain', 'Finland' ):
                    zip = self.detectZip( data )
                    if zip:
                        self.district = zip
                elif self.country == 'United Kingdom':
                    if data.has_key( 'lat' ) and  data.has_key( 'lon' ):
                        try:
                            url = \
                                'http://www.whatsmylocator.co.uk/wabsquare.php?lat=' \
                                + data['lat'] + '&long=' + data['lon']
                            wabData = getWebData( url, True )
                            if wabData.has_key( 'wabsquare' ):
                                self.district = wabData['wabsquare']
                        except Exception as e:
                            logging.exception('Error loading data')


                else:
                    if data.has_key( 'state' ):
                        self.region = data['state']
                    if data.has_key( 'county' ):
                        self.district = data['county']
                    if data.has_key( 'grid' ):
                        self.gridsquare = data['grid'].upper()

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
                      'qrz_data_loaded': self.qrzData, \
                      'special_cs': self.special,\
                      'iota': self.iota }, 'callsign' )
        else:
            dxdb.getObject( 'callsigns', \
                    { 'callsign': self.cs, 'region': self.region, \
                    'district': self.district,\
                    'qth': self.gridsquare, 'qrz_data_loaded': self.qrzData, \
                    'iota':self.iota,
                    'country': self.country, 'special_cs': self.special,  }, \
                    True )
            dxdb.commit()
            self.inDB = True
        if self.special:
            updateSpecialLists()

    def detectIOTA( self, ad ):
        iota = None
        text = []
        web = False
        for av, avd in ad['values'].items():
            match = False
            for f in avd['filter']:
                if '^' in f: 
                    match = re.match( f, self.cs )
                else:
                    match = f == self.pfx
                if match:
                    if avd['getFields']:
                        text.append( av )
                        if not web and avd['getFields'] == 'web':
                            web = True
                    elif not avd['getFields']:
                        return av
        if text:
            t = self.text.upper()
            for av in text:
                avp = av.split( '-' )
                if avp[1].startswith( '0' ):
                    avp[1] = '0*' + avp[1].lstrip( '0' )
                avre = r"(?<=\s)" + avp[0] + r"[ -]+" + avp[1]
                if re.search( avre, t ):
                    return av
        if web:
            if not self.iota:
                data = qrzComLink.getData( self.cs )            
                if data:
                    self.updateIOTA( data )
                    self.updateDB()
            if self.iota and self.iota != 'N/A' \
                    and ad['values'].has_key( self.iota ):
                return self.iota
        return None
            
    def updateIOTA( self, data ):
        if data.has_key( 'iota' ) and data['iota']:
            self.iota = data['iota']
        else:
            self.iota = 'N/A'
            

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

            if self.detectAwardsList and not ad['name'] in self.detectAwardsList:
                continue

            if ad['name'] == 'IOTA':
                av = self.detectIOTA( ad )
                if av:
                    self.updateAward( ad, av )

            elif not ad['country'] or ad['country'] == self.country:
                
                av = None
                
                for l in ad['lookups']:                
                    try:
                        if l['source'] == 'text':
                            text = getattr( self, l['field'] ) \
                                    if l.has_key( 'field' ) \
                                    else self.text
                            if text:
                                for m in re.finditer( l['re'], text ):
                                    v = m.group(0).upper()
                                    av = checkAwardValue( ad, l, v )
                        elif l['source'] == 'field' and getattr( self, l['field'] ):
                            av = checkAwardValue( ad, l, \
                                    getattr( self, l['field'] )  )
                        if ad['values'].has_key( av ):
                            self.updateAward( ad, av )
                            break
                    except Exception as e:
                        logging.exception( 'Award detection error: award ' \
                                + ad['name'] + ' lookup' + str( l ) + ' dx ' + \
                                str( self.toDict() ) )
                        logging.exception( e )


    def updateAward( self, ad, av ):
        if not self.inDB:
            self.updateDB()
        awardEntry = { 'value': av, 'mode': self.getAwardMode( ad ) }
        if not self.awards.has_key( ad['name'] ) or \
            self.awards[ad['name']] != awardEntry:
            if not self.offDB:
                idParams = { 'callsign': self.cs, 'award': ad['name'] }
                dxdb.paramUpdateInsert( 'awards', idParams, awardEntry )
                dxdb.commit()
            self.awards[ad['name']] = awardEntry


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
        elif self.country in ( 'Japan', 'Germany', 'Poland', 'France' ):
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
            freq = float( m.group(2) )
            self.append( \
                    DX( dxData = self, newSpot = True, \
                        text = m.group(4), cs = cs, freq = freq, \
                        de = m.group(1), time = m.group(5) ) )



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
            data = []
            for x in self.data:
                try:
                    json.dumps( x.toDict() ).encode( 'utf-8' )
                    data.append( x.toDict() )
                except Exception as e:
                    logging.exception( 'Non unicode character in dx' )
                    logging.exception( x.toDict() )
                    self.data.remove( x )
            dataJSON = json.dumps( data )
            for dir in dirs:
                with open( dir + '/dxdata.json', 'w' ) as fDxData:
                    fDxData.write( dataJSON )



