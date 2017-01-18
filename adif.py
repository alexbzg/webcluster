#!/usr/bin/python
#coding=utf-8


from common import appRoot, readConf, siteConf, loadJSON, jsonEncodeExtra
from dxdb import cursor2dicts, dxdb, paramStr
import dx as dxMod

import json, re, logging, time, os, fcntl, sys

conf = siteConf()
adifQueueDir = conf.get( 'web', 'root' ) + '/.adif/'

pid_file = '/var/run/adif.pid'
fp = open(pid_file, 'w')
try:
        fcntl.lockf(fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
except IOError:
        # another instance is running
        sys.exit(0)

logging.basicConfig( level = logging.DEBUG,
        format='%(asctime)s %(message)s', 
        filename='/var/log/adxcluster_adif.log',
        datefmt='%Y-%m-%d %H:%M:%S' )
logging.info( 'starting in test mode' )

bands = { '160M': '1.8', '80M': '3.5', '40M': '7', \
        '30M': '10', '20M': '14', '14M': '20', '17M': '18', '15M': '21', \
        '12M': '24', '10M': '28', '6M': '50', '2M': '144', \
        '33CM': 'UHF', '23CM':'UHF', '13CM': 'UHF' }

countries = {}
for cty, cl in conf.items( 'countries' ):
    for code in cl.split( ',' ):
        countries[code] = cty.title()

countryCodes = {}
with open( appRoot + '/CountryCode.txt', 'r' ) as fcc:
    for line in fcc.readlines():
        dxcc, pfx = line.split( ',', 3 )[0:2]
        if countries.has_key( pfx ):
            countryCodes[dxcc] = pfx
countryStateAward = { 'Russia': 'RDA', 'Ukraine': 'URDA' }

awardsDataJS = loadJSON( conf.get( 'web', 'root' ) + '/awards.json' )
awardsData = {}
for entry in awardsDataJS:
    awardsData[entry['name']] = entry


def loadQueue():
    return loadJSON( adifQueueDir + 'queue.json' )

def getAdifField( line, field ):
    iHead = line.find( '<' + field + ':' )
    if iHead < 0:
        return ''
    iBeg = line.find( ">", iHead ) + 1
    ends = [ x for x in [ line.find( x, iBeg ) for x in ( ' ', '<' ) ] \
                if x > -1 ]
    iEnd = min( ends ) if ends else len( line )
    return line[iBeg:iEnd]         



def loadAdif( callsign, adif, awardsEnabled ):
    logging.debug( 'ADIF parsing start. Callsign: ' + callsign )
    idParams = { 'callsign': callsign }
    updParams = {}
    for ( award, enabled ) in awardsEnabled.iteritems():
        idParams['award'] = award
        updParams['adif'] = enabled
        dxdb.paramUpdateInsert( 'users_awards_settings', idParams, updParams )
    awards = {}
    detectAwardsList = [ x for x in awardsEnabled.keys() if awardsEnabled[x] ]
    dxMod.dxdb = dxdb
    eoh = False
    adif = adif.upper().replace( '\r', '' ).replace( '\n', '' )
    adif = adif.split( '<EOH>' )[1]
    lines = adif.split( '<EOR>' )
    reDistrict = re.compile( '[a-zA-Z]{2}-\d\d' )
    lastLine = ''
    cfmFields = { 'cfm_paper': 'QSL_RCVD',\
        'cfm_eqsl': 'EQSL_QSL_RCVD',\
        'cfm_lotw': 'LOTW_QSL_RCVD' }
    for line in lines:
        if '<' in line:
            cs = getAdifField( line, 'CALL' )  
            lastLine = getAdifField( line, 'QSO_DATE' ) + ' ' + \
                    getAdifField( line, 'TIME_ON' ) + ' ' + cs
            freq = getAdifField( line, 'FREQ' )
            mode = getAdifField( line, 'MODE' )


            dx = dxMod.DX( cs = cs, de = '', text = '', \
                    freq = float( freq ) if freq else None, \
                    mode = mode if mode else None, \
                    time = '    ', detectAwardsList = detectAwardsList )


            if dx.isBeacon:
                continue
            band = dx.band
            bandData = getAdifField( line, 'BAND' ).upper()
            if bands.has_key( bandData ):
                band = bands[bandData]
            if dx.country == 'Russia' or dx.country == 'Ukraine':
                district = getAdifField( line, 'CNTY' )
                if not district or not reDistrict.match( district ):
                    district = getAdifField( line, 'STATE' )
                    if district and not reDistrict.match( district ):
                        state = None
                if district and district != dx.district:
                    dx.offDB = True
                    dx.district = district
                    dx.detectAwards()
            if dx.country == 'USA':
                data = getAdifField( line, 'CNTY'  )
                if data and ',' in data:
                    region, district = data.split( ',', 1 )
                    district = district.title()
                    if ' Jd' in  district:
                        district.replace( ' Jd', ' JD' )
                    district = region + ' ' + district
                    if region and district:
                        if region != dx.region or district != dx.district:
                            dx.offDB = True
                            dx.region = region
                            dx.district = district
                            dx.detectAwards()
            if dx.awards:
                cfm = {}
                for ( cfmType, field ) in cfmFields.iteritems():
                    cfm[cfmType] = getAdifField( line, field ) == 'Y'
                for ( award, value ) in dx.awards.iteritems():
                    if awardsData[award].has_key( 'noStats' ) and \
                        awardsData[award]['noStats']:
                        continue
                    if not awards.has_key(award):
                        awards[award] = {}
                    if not awards[award].has_key( value['value'] ):
                        awards[award][ value['value'] ] = {}
                    aw = awards[award][ value['value'] ]
                    if awardsData[award].has_key('byBand') and \
                            awardsData[award]['byBand']:
                        if not aw.has_key( band ):
                            aw[band] = {}
                        if not aw[band].has_key( value['mode'] ):
                            aw[band][value['mode']] = {}
                        aw = aw[band][value['mode']]
                    for cfmType in cfmFields.keys():
                        if not aw.has_key( cfmType ):
                            aw[cfmType] = False
                        if not aw[cfmType] and cfm[cfmType]:
                            aw[cfmType] = True
                    if not aw.has_key( 'callsigns' ):
                        aw['callsigns'] = []
                    if len( aw['callsigns'] ) < 2 and \
                        not cs in aw['callsigns']:
                        aw['callsigns'].append( cs )
    logging.debug( 'ADIF parsed' )
    commitFl = False
    if awards:

        def updateAward( idParams, awState ):
            updParams = {}
            awLookup = dxdb.getObject( 'user_awards', idParams, False, True )
            if awLookup:
                updateFl = False
                for cfmType in cfmFields.keys():
                    if not awLookup[cfmType] and awState[cfmType]:
                        updParams[cfmType] = True
                        updateFl = True
                csCount = 0 if not awLookup['worked_cs'] else \
                        2 if ',' in awLookup['worked_cs'] else 1
                if csCount < 2:
                    workedCs = awLookup['worked_cs'] \
                            if awLookup['worked_cs'] else ''
                    for cs in awState['callsigns']:
                        if not cs in workedCs:
                            workedCs += ', ' + cs if workedCs else cs
                            csCount += 1
                            updateFl = True
                            if csCount > 1:
                                    break
                    updParams['worked_cs'] = workedCs
                if updateFl:                        
                    dxdb.paramUpdate( 'user_awards', idParams, updParams )
                    return True
            else:
                idParams['worked_cs'] = ', '.join( awState['callsigns'] )
                for cfmType in cfmFields.keys():
                    idParams[cfmType] = awState[cfmType]
                dxdb.getObject( 'user_awards', idParams, True )
                return True

        for award in awards.keys():
            for value in awards[award].keys():
                awState = awards[award][value]
                idParams = { 'callsign': callsign, \
                        'award': award,\
                        'value': value, \
                        'band': 'N/A', \
                        'mode': 'N/A' }
                if awardsData[award].has_key('byBand') and \
                    awardsData[award]['byBand']:
                    for band in awState:
                        idParams['band'] = band
                        for mode in awState[band]:
                            idParams['mode'] = mode
                            commitFl = updateAward( idParams, awState[band][mode] )
                else:
                    commitFl = updateAward( idParams, awState )

    msg = { 'text': 'Your ADIF log was processed succefully.' + \
            ( '' if commitFl \
                else ' No new callsigns for supported awards were found.' ), \
            'reload': commitFl }

    dxdb.updateObject( 'users', \
            { 'callsign': callsign, 'last_adif_line': lastLine, \
            'msg': json.dumps( msg ) }, \
            'callsign' )
    dxdb.commit()

    return ( commitFl, lastLine )


queue = loadQueue()
while queue:
    qe = queue[0]
    with open( adifQueueDir + 'queue.json', 'w' ) as f:
        f.write( json.dumps( queue[1:] ) )
    adifName = adifQueueDir + qe['file']
    with open( adifName, 'r' ) as f:
        adif = f.read()
    loadAdif( qe['callsign'], adif, qe['awards'] )
    os.remove( adifName )
    queue = loadQueue()

