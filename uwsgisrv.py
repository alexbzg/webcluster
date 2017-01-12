#!/usr/bin/python
#coding=utf-8
from common import appRoot, readConf, siteConf, loadJSON, jsonEncodeExtra
from dxdb import cursor2dicts, dbConn, paramStr
import dx as dxMod

import json, smtplib, urllib2, urllib, os, base64, jwt, re, logging, time, urlparse

from urlparse import parse_qs
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from email import charset
charset.add_charset('utf-8', charset.SHORTEST, charset.QP)
secret = None
fpSecret = '/var/run/adxcluster.secret'
if ( os.path.isfile( fpSecret ) ):
    with open( fpSecret, 'r' ) as fSecret:
        secret = fSecret.read()
if not secret:
    secret = base64.b64encode( os.urandom( 64 ) )
    with open( fpSecret, 'w' ) as fSecret:
        fSecret.write( secret )

conf = siteConf()

logging.basicConfig( level = logging.DEBUG,
        format='%(asctime)s %(message)s', 
        filename='/var/log/adxcluster_uwsgi.log',
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

admins = conf.get( 'web', 'admin' ).split( ',' )

def checkRecaptcha( response ):
    rcData = urllib.urlencode( \
            { 'secret': '6LeDVCQTAAAAABn29KxDjWk_6Kjv-CXQbPv3sqwP',\
            'response': response } )
    rcRequest = urllib2.Request( 'https://www.google.com/recaptcha/api/siteverify', \
            rcData )
    opener = urllib2.build_opener()
    rcResponse = opener.open( rcRequest ).read()
#        with open( '/var/www/adxc.73/debugRCapt.json', 'w' ) as fD:
#            fD.write( rcResponse )
    return json.loads( rcResponse )['success']

reEmail = re.compile( r"[^@]+@[^@]+\.[^@]+" )
def validEmail( address ):
    return reEmail.match( address )
dxdb = None

def spliceParams( data, params ):
    return { param: json.dumps( data[param] ) \
            if isinstance( data[param],dict ) else data[param] \
        for param in params \
        if data.has_key( param ) }


def sendEmail( **email ):
    myAddress = conf.get( 'email', 'address' )
    msg = MIMEText( email['text'].encode( 'utf-8' ), 'plain', 'UTF-8' )
    msg['from'] = email['fr']
    msg['to'] = email['to']
    msg['MIME-Version'] = "1.0"
    msg['Subject'] = email['subject']
    msg['Content-Type'] = "text/plain; charset=utf-8"
    msg['Content-Transfer-Encoding'] = "quoted-printable"
    server = smtplib.SMTP_SSL( conf.get( 'email', 'smtp' ) )
    server.login( myAddress, conf.get( 'email', 'password' ) )
    server.sendmail( myAddress, msg['to'], str( msg ) )

def application(env, start_response):
    global dxdb
    try:
        reqSize = int( env.get( 'CONTENT_LENGTH', 0 ) )
    except:
        reqSize = 0

    if env['PATH_INFO'] == '/uwsgi/contact':
        start_response('200 OK', [('Content-Type','text/plain')])
        email = json.loads( env['wsgi.input'].read( reqSize ) )
#        with open( '/var/www/adxc.73/debugEmail.json', 'w' ) as fD:
#            fD.write( json.dumps( email ) )
        if checkRecaptcha( email['recaptcha'] ):
            sendEmail( text = email['text'], fr = email['from'], \
                to = conf.get( 'email', 'address' ), \
                subject = "Message from ADXcluster.com" )
            return 'OK'
        else:
            return 'recaptcha failed'
    elif env['PATH_INFO'] == '/uwsgi/login':
        dxdb = dbConn()
        data = json.loads( env['wsgi.input'].read( reqSize ) )
        error = ''
        if not data.has_key( 'callsign' ) or len( data['callsign'] ) < 2:
            error = 'Invalid callsign'
        elif not data.has_key( 'password' ) or len( data['password'] ) < 6:
            error = 'Invalid password'
        data['callsign'] = data['callsign'].upper()
        if not error:

            if data.has_key( 'register' ) and data['register']:
                if not data.has_key( 'email' ) or not validEmail( data['email'] ):
                    error = 'Invalid email'
                elif not data.has_key( 'recaptcha' ) or \
                        not checkRecaptcha( data['recaptcha'] ):
                    error = 'Recaptcha error'
                else:
                    csLookup = dxdb.getObject( 'users', \
                            { 'callsign': data['callsign'] },\
                            False )
                    if csLookup:
                        error = 'callsign is already registered'

                if error == '':

                    userData = dxdb.getObject( 'users', 
                            { 'callsign': data['callsign'], 
                                'password': data['password'],
                                'email': data['email'] }, True )
                    if userData:
                        return sendUserData( userData, start_response )
                    else:
                        start_response('500 Server Error', \
                                [('Content-Type','text/plain')])
                        return 'Could not create user'
            else:
                userData = dxdb.getObject( 'users', \
                        { 'callsign': data['callsign'] },\
                        False, True )
                if userData and userData['password'] == data['password']:
                    return sendUserData( userData, start_response )
                else:
                    error = 'Wrong callsign or password'
        start_response( '400 Bad Request', [('Content-Type','text/plain')])
        return 'Invalid login/register request: ' + error
    elif env['PATH_INFO'] == '/uwsgi/userSettings':
        dxdb = dbConn()
        data = json.loads( env['wsgi.input'].read( reqSize ) )
        error = ''
        okResponse = ''
        dbError = False
        callsign = None
        if data.has_key( 'token' ):
            try:
                pl = jwt.decode( data['token'], secret, algorithms=['HS256'] )
            except jwt.exceptions.DecodeError, e:
                start_response( '400 Bad Request', [('Content-Type','text/plain')])
                return 'Login expired'
            if pl.has_key( 'callsign' ):
                callsign = pl['callsign']
        if callsign:
            if data.has_key( 'award' ) and ( ( data.has_key( 'track' ) \
                    and data.has_key( 'color' ) ) \
                    or data.has_key( 'stats_settings' ) ) :
                idParams = { 'callsign': callsign, 'award': data['award'] }
                updParams = spliceParams( data, \
                    [ 'track', 'color', 'settings', 'stats_settings' ] )
                if dxdb.paramUpdateInsert( 'users_awards_settings', idParams, 
                        updParams ):
                    dxdb.commit()
                    okResponse = 'OK'
                else:
                    dbError = True
            elif data.has_key( 'reload' ):
                userData = dxdb.getObject( 'users', \
                        { 'callsign': callsign },\
                        False, True )
                return sendUserData( userData, start_response )

            elif data.has_key( 'dxpedition' ) and data['dxpedition'] == 'admin':
                if callsign in admins:
                    idParams = { 'callsign': data['callsign'] }
                    if data.has_key('delete'):
                        if dxdb.paramDelete( 'dxpedition', idParams ):
                            okResponse = 'OK'
                        else:
                            dbError = True
                    else:
                        updParams = spliceParams( data, [ 'dt_begin', 'dt_end', \
                            'descr', 'link' ] )
                        if dxdb.paramUpdateInsert( 'dxpedition', idParams, \
                                updParams ):
                            okResponse = 'OK'
                        else:
                            dbError = True
                    if okResponse:
                        dxdb.commit()
                        exportDXpedition( env )

                else:
                    start_response( '403 Forbidden', \
                            [('Content-Type','text/plain')])
                    return 'Permission denied'
                   
            elif data.has_key( 'adif' ):
                adif = data['adif']['file'].split( ',' )[1].decode( \
                        'base64', 'strict' )
                logging.debug( 'adif received' )
                newAwards, lastLine = loadAdif( callsign, adif, \
                        data['adif']['awards'] )
                start_response( '200 OK', [('Content-Type','application/json')])     
                return json.dumps( { 'lastAdifLine': lastLine, \
                        'awards': getUserAwards( callsign ) \
                            if newAwards else False } )
            elif data.has_key( 'award' ) and data.has_key( 'value' ) \
                    and ( data.has_key( 'confirmed' ) or data.has_key('delete') or \
                    data.has_key( 'cfm_paper' ) ):

                params =  { 'callsign': callsign, 'award': data['award'], \
                    'value': data['value'], \
                    'band': data['band'] if data.has_key( 'band' ) else 'N/A',\
                    'mode': data['mode'] if data.has_key( 'mode' ) else 'N/A',\
                    }
                
                fl = False
                if data.has_key( 'delete' ) and data['delete']:
                    awardLookup = dxdb.getObject( 'user_awards', params, \
                        False, True )
                    if awardLookup:
                        fl = dxdb.paramDelete( 'user_awards', params )
                else:
                    updParams = {}
                    updParams['confirmed'] = data['confirmed'] \
                            if data.has_key('confirmed') else None
                    updParams['cfm_paper'] = data['cfm_paper'] \
                            if data.has_key('cfm_paper') else None
                    updParams['cfm_eqsl'] = data['cfm_eqsl'] \
                            if data.has_key('cfm_eqsl') else None
                    updParams['cfm_lotw'] = data['cfm_lotw'] \
                            if data.has_key('cfm_lotw') else None
                    updParams['worked_cs'] = data['workedCS'] \
                            if data.has_key( 'workedCS' ) else None
                    fl = dxdb.paramUpdateInsert( 'user_awards', params, updParams )
                if fl:
                    dxdb.commit()
                    okResponse = 'OK'
                else:
                    dbError = True
            elif data.has_key( 'award_value_worked_color' ):
                del data['token']
                data['callsign'] = callsign
                if dxdb.updateObject( 'users', data, 'callsign' ):
                    dxdb.commit()
                    start_response( '200 OK', [('Content-Type','text/plain')])
                    return 'OK'
                else:
                    start_response( '500 Server Error', \
                            [('Content-Type','text/plain')])
                    return
            elif ( data.has_key( 'email' ) and validEmail( data['email'] ) ) or \
                ( data.has_key( 'password' ) and len( data['password'] ) > 5  ):
                field = 'email' if data.has_key( 'email' ) else 'password'
                if field == 'password':
                    if data.has_key('oldPassword'):
                        if data['oldPassword'] != \
                            dxdb.getObject( 'users', {'callsign': callsign} \
                                )['password']:
                            error = 'Wrong current password'
                    else:
                        error = 'No current password'
                if not error:
                    if dxdb.updateObject( 'users', \
                            { 'callsign': callsign, field: data[field] },
                            'callsign' ):
                        dxdb.commit()
                        okResponse = 'OK'
                    else:
                        dbError = True
            elif data.has_key( 'list_id' ):
                if data['list_id'] == 'new':
                    list = dxdb.getObject( 'users_lists',\
                            { 'callsign': callsign, \
                            'title': data['title'] if data.has_key( 'title' ) \
                                else None },\
                            True )
                    if list:
                        start_response( '200 OK', \
                                [('Content-Type', 'application/json')] )
                        return json.dumps( { 'list_id': list['id'] } )
                    else:
                        dbError = True
                elif data.has_key( 'title' ) or data.has_key( 'track' ) or \
                        data.has_key( 'stats_settings' ) or \
                        data.has_key( 'full_title' ):
                    if dxdb.paramUpdate( 'users_lists', { 'id': data['list_id'] }, \
                            spliceParams( data, [ 'title', 'track', 'color', \
                                'stats_settings', 'full_title' ] ) ):
                        dxdb.commit()
                        okResponse = 'OK'
                    else:
                        dbError = True
                elif data.has_key( 'callsign' ):
                    if data.has_key( 'delete' ):
                        if dxdb.paramDelete( 'users_lists_items',\
                            { 'list_id': data['list_id'], \
                            'callsign': data['callsign'] } ):
                            dxdb.commit()
                            okResponse = 'OK'
                        else:
                            dbError = True
                    else:
                        if dxdb.paramUpdateInsert( 'users_lists_items', \
                            spliceParams( data, [ 'list_id', 'callsign' ] ), \
                            spliceParams( data, [ 'settings', 'pfx' ] ) ):
                            dxdb.commit()
                            okResponse = 'OK'
                        else:
                            dbError = True
                elif data.has_key( 'value' ):
                    params =  { 'list_id': data['list_id'], \
                            'callsign': data['value'], \
                        'band': data['band'] if data.has_key( 'band' ) else 'N/A',\
                        'mode': data['mode'] if data.has_key( 'mode' ) else 'N/A',\
                        }
                    if data.has_key( 'delete' ) and data['delete']:
                        if dxdb.getObject( 'users_lists_awards', params, \
                            False, True ):
                            if dxdb.paramDelete( 'users_lists_awards', params ):
                                dxdb.commit()
                                okResponse = 'OK'
                            else:
                                dbError = True
                    else:
                        if dxdb.paramUpdateInsert( 'users_lists_awards', params, \
                            spliceParams( data, \
                            ['cfm_paper', 'cfm_eqsl', 'cfm_lotw', 'worked_cs'] )):
                            dxdb.commit()
                            okResponse = 'OK'
                        else:
                            dbError = True
                elif data.has_key( 'delete' ):
                    if dxdb.execute( """delete from users_lists_awards
                        where list_id = %(list_id)s""", data ) and \
                        dxdb.execute( """delete from users_lists_items
                        where list_id = %(list_id)s""", data ) and \
                        dxdb.execute( """delete from users_lists
                        where id = %(list_id)s""", data ):
                        dxdb.commit()
                        okResponse = 'OK'
                    else:
                        dbError = True
    
            elif not error:
                error = 'Bad user settings'
        if dbError:
            start_response( '500 Server Error', \
                    [('Content-Type','text/plain')])
            return
        if okResponse:
            start_response( '200 OK', [('Content-Type','text/plain')])
            return okResponse

        start_response( '400 Bad Request', [('Content-Type','text/plain')])
        return error
    elif env['PATH_INFO'] == '/uwsgi/recoverPassword':
        logging.debug( 'password recovery' )
        data = json.loads( env['wsgi.input'].read( reqSize ) )
        logging.error( json.dumps( data ) )
#        with open( '/var/www/adxc.73/debugEmail.json', 'w' ) as fD:
#            fD.write( json.dumps( email ) )
        error = ''
        if checkRecaptcha( data['recaptcha'] ):
            logging.error( 'recaptcha passed' )
            if data.has_key( 'callsign' ) and len( data['callsign'] ) > 2:
                data['callsign'] = data['callsign'].upper()
                logging.error( 'found valid callsign' )
                dxdb = dbConn()
                user = dxdb.getObject( 'users', { 'callsign': data['callsign'] },\
                        False, True )
                if user:
                    logging.error( 'got user data' )
                    token = jwt.encode( { 'time': time.time() }, \
                        secret, algorithm='HS256' )
                    dxdb.getObject( 'password_change_tokens', \
                        { 'callsign': data['callsign'], 'token': token }, \
                        True );
                    text = """
Click on this link to recover your ADXcluster.com password:

http://adxcluster.com/changePassword.html?callsign=""" + data['callsign'] + \
                    '&token=' + token + """

If you did not request password recovery just ignore this message. 
The link above will be valid for 1 hour.

ADXcluster.com support"""
                    sendEmail( text = text, fr = conf.get( 'email', 'address' ), \
                        to = user['email'], \
                        subject = "ADXcluster.com password recovery" )
                    start_response( '200 OK', [('Content-Type','text/plain')])
                    return 'OK'
                else:
                    error = 'The callsign ' + data['callsign'] + \
                            ' is not registered'
            else:
                error = 'Non-valid callsign'
        else:
            error = 'Recaptcha failed'
        start_response( '400 Bad Request', [('Content-Type','text/plain')])
        return error
    elif env['PATH_INFO'] == '/uwsgi/changePassword':
        dxdb = dbConn()
        data = json.loads( env['wsgi.input'].read( reqSize ) )
        error = ''
        if data.has_key( 'token' ) and data.has_key( 'callsign' ) \
                and data.has_key( 'password' ):
            dbToken = dxdb.getObject( 'password_change_tokens', \
                    { 'callsign': data['callsign'] }, False )
            if dbToken and dbToken['token'] == data['token']:
                pl = jwt.decode( data['token'], secret, algorithms=['HS256'] )
                if pl.has_key( 'time' ):
                    if time.time() - pl['time'] > 60 * 60:
                        error = 'Password change token is expired'
                    else:
                        dxdb.updateObject( 'users', \
                            { 'callsign': data['callsign'], 'password': data['password'] }, \
                            'callsign' )
                        dxdb.execute( """
                            delete from password_change_tokens 
                            where callsign = %(callsign)s""", data )
                        dxdb.commit()
                        start_response( '200 OK', [('Content-Type','text/plain')])
                        return 'OK'
                else:
                    error = 'Invalid change password token'
            else:
                error = 'Invalid password change token'
        else:
            error = 'Invalid password change request'
        start_response( '400 Bad Request', [('Content-Type','text/plain')])
        return error

def getUserAwards( callsign ):
    awards = cursor2dicts( \
            dxdb.execute( """
                select * 
                from user_awards
                where callsign = %s """, \
                 ( callsign, ) ), True )
    if awards:
        r = {}
        for item in awards:
            if not r.has_key( item['award'] ):
                r[item['award']] = {}
            if item['band'] != 'N/A':
                if not r[item['award']].has_key( item['value'] ):
                    r[item['award']][item['value']] = {}
                if not r[item['award']][item['value']].has_key( item['band'] ):
                    r[item['award']][item['value']][item['band']] = {}
                r[item['award']][item['value']][item['band']][item['mode']] = \
                    { 'confirmed': item['confirmed'], \
                    'workedCS': item['worked_cs'],\
                    'cfm_paper': item['cfm_paper'], 'cfm_eqsl': item['cfm_eqsl'],\
                    'cfm_lotw': item['cfm_lotw'] }
            else:
                r[item['award']][item['value']] = \
                    { 'confirmed': item['confirmed'], 'workedCS': item['worked_cs'],\
                    'cfm_paper': item['cfm_paper'], 'cfm_eqsl': item['cfm_eqsl'],\
                    'cfm_lotw': item['cfm_lotw'] }
        return r
    else:
        return None

def getUserListsAwards( callsign ):
    awards = cursor2dicts( \
            dxdb.execute( """
                select users_lists_awards.*
                from users_lists_awards join users_lists on
                    users_lists_awards.list_id = users_lists.id
                where users_lists.callsign = %s """, \
                 ( callsign, ) ), True )
    if awards:
        r = {}
        for item in awards:
            if not r.has_key( item['list_id'] ):
                r[item['list_id']] = {}
            if not r[item['list_id']].has_key( item['callsign'] ):
                r[item['list_id']][item['callsign']] = {}
            if not r[item['list_id']][item['callsign']].has_key( item['band'] ):
                r[item['list_id']][item['callsign']][item['band']] = {}
            r[item['list_id']][item['callsign']][item['band']][item['mode']] = \
                { 'workedCS': item['worked_cs'],\
                'cfm_paper': item['cfm_paper'], 'cfm_eqsl': item['cfm_eqsl'],\
                'cfm_lotw': item['cfm_lotw'] }
        return r
    else:
        return None

   

def sendUserData( userData, start_response ):
    awardsSettings = cursor2dicts( \
            dxdb.execute( """
                select award, track, color, settings, stats_settings, adif
                from users_awards_settings
                where callsign = %(callsign)s """, \
                 userData ), True )
    lists = cursor2dicts( \
            dxdb.execute( """
                select id, title, track, color, full_title
                from users_lists 
                where callsign = %(callsign)s """, \
                userData ), True )
    if lists:
        lists = lists.values()
        for list in lists:
            list['items'] = cursor2dicts( \
                dxdb.execute( """
                    select * from users_lists_items
                    where list_id = %(id)s """, \
                    list ), True )
    toSend = { 'token': jwt.encode( { 'callsign': userData['callsign'] }, \
            secret, algorithm='HS256' ), 'callsign': userData['callsign'], \
            'email': userData['email'], \
            'lastAdifLine': userData['last_adif_line'], \
            'awardValueWorkedColor': userData['award_value_worked_color'], \
            'awardValueConfirmedColor': userData['award_value_confirmed_color'], \
            'awards': getUserAwards( userData['callsign'] ),\
            'listsAwards': getUserListsAwards( userData['callsign'] ),\
            'lists': lists, 'admin': userData['callsign'] in admins, \
            'dxpedition': userData['dxpedition'] }
    if awardsSettings:
        toSend['awardsSettings'] = {}
        for item in awardsSettings:
            toSend['awardsSettings'][item['award']] = item
    start_response('200 OK', [('Content-Type','application/json')])
    return json.dumps( toSend )

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

    dxdb.updateObject( 'users', \
            { 'callsign': callsign, 'last_adif_line': lastLine }, \
            'callsign' )
    dxdb.commit()

    return ( commitFl, lastLine )

def exportDXpedition( env ):
    dir = conf.get( 'web', \
            ( 'test_' if 'test' in env['SERVER_NAME'] else '' ) + 'root' )
    dxp = cursor2dicts( \
            dxdb.execute( """
                select * from dxpedition
                where dt_end > now() - interval '1 week'
                order by callsign;"""), True )
    if not dxp:
        dxp = [];
    dxpJSON = json.dumps( dxp, default = jsonEncodeExtra ) 
    with open( dir + '/dxpedition.json', 'w' ) as f:
        f.write( dxpJSON )
    slFName = dir + '/specialLists.json'
    sl = loadJSON( slFName )
    if not sl:
        sl = { 'DXpedition': [], 'Special': [] }
    sl['DXpedition'] = dxp
    slJSON = json.dumps( sl, default = jsonEncodeExtra ) 
    with open( slFName, 'w' ) as slF:
        slF.write( slJSON )

       
