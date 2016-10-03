#!/usr/bin/python
#coding=utf-8
from common import appRoot, readConf, siteConf, loadJSON
from dxdb import cursor2dicts, dbConn, paramStr
from dx import DX

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
                    csLookup = dxdb.getObject( 'users', { 'callsign': data['callsign'] },\
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
        callsign = None
        if data.has_key( 'token' ):
            pl = jwt.decode( data['token'], secret, algorithms=['HS256'] )
            if pl.has_key( 'callsign' ):
                callsign = pl['callsign']
        if callsign:
            if data.has_key( 'award' ) and data.has_key( 'track' ) \
                    and data.has_key( 'color' ):
                params = { 'callsign': callsign, 'award': data['award'] }
                dbRec = dxdb.getObject( 'users_awards_settings', \
                    params, \
                    False, True )
                params['track'] = data['track']
                params['color'] = data['color']
                params['settings'] = json.dumps( data['settings'] ) \
                        if data.has_key( 'settings' ) else None
                sql = ''
                if dbRec:
                    sql = """
                        update users_awards_settings
                        set track = %(track)s, color = %(color)s, 
                            settings = %(settings)s
                        where callsign = %(callsign)s and
                            award = %(award)s"""
                else:
                     sql = """
                        insert into users_awards_settings
                        values ( %(callsign)s, %(award)s, %(track)s, %(color)s,
                            %(settings)s )"""
                if dxdb.execute( sql, params ):
                    dxdb.commit()
                    start_response( '200 OK', [('Content-Type','text/plain')])
                    return 'OK'
                else:
                    start_response( '500 Server Error', \
                            [('Content-Type','text/plain')])
                    return
            elif data.has_key( 'adif' ):
                adif = data['adif'].split( ',' )[1].decode( 'base64', 'strict' )
                logging.debug( 'adif received' )
                newAwards, lastLine = loadAdif( callsign, adif )
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
                
                awardLookup = dxdb.getObject( 'user_awards', params, \
                    False, True )
                fl = False
                if data.has_key( 'delete' ) and data['delete']:
                    if awardLookup:
                        fl = dxdb.execute( """
                            delete from user_awards
                            where callsign = %(callsign)s and award = %(award)s and
                                value = %(value)s""", params )
                else:
                    params['confirmed'] = data['confirmed'] \
                            if data.has_key('confirmed') else None
                    params['cfm_paper'] = data['cfm_paper'] \
                            if data.has_key('cfm_paper') else None
                    params['cfm_eqsl'] = data['cfm_eqsl'] \
                            if data.has_key('cfm_eqsl') else None
                    params['cfm_lotw'] = data['cfm_lotw'] \
                            if data.has_key('cfm_lotw') else None
                    params['worked_cs'] = data['workedCS'] \
                            if data.has_key( 'workedCS' ) else None
                    if awardLookup:
                        fl = dxdb.execute( """
                            update user_awards
                            set confirmed = %(confirmed)s, worked_cs = %(worked_cs)s
                            where callsign = %(callsign)s and award = %(award)s and
                                value = %(value)s""", params )
                    else:
                        fl = dxdb.getObject( 'user_awards', params, True )
                if fl:
                    dxdb.commit()
                    start_response( '200 OK', [('Content-Type','text/plain')])
                    return 'OK'
                else:
                    start_response( '500 Server Error', \
                            [('Content-Type','text/plain')])
                    return
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
                        start_response( '200 OK', [('Content-Type','text/plain')])
                        return 'OK'
                    else:
                        start_response( '500 Server Error', \
                                [('Content-Type','text/plain')])
                        return

            elif not error:
                error = 'Bad user settings'
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
            r[item['award']][item['value']] = \
                { 'confirmed': item['confirmed'], 'workedCS': item['worked_cs'],\
                'cfm_paper': item['cfm_paper'], 'cfm_eqsl': item['cfm_eqsl'],\
                'cfm_lotw': item['cfm_lotw'] }
        return r
    else:
        return None

def sendUserData( userData, start_response ):
    awardsSettings = cursor2dicts( \
            dxdb.execute( """
                select award, track, color, settings
                from users_awards_settings
                where callsign = %(callsign)s """, \
                 userData ), True )
    toSend = { 'token': jwt.encode( { 'callsign': userData['callsign'] }, \
            secret, algorithm='HS256' ), 'callsign': userData['callsign'], \
            'email': userData['email'], \
            'lastAdifLine': userData['last_adif_line'], \
            'awardValueWorkedColor': userData['award_value_worked_color'], \
            'awardValueConfirmedColor': userData['award_value_confirmed_color'], \
            'awards': getUserAwards( userData['callsign'] )}
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


def loadAdif( callsign, adif ):
    awards = {}
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
            dx = DX( cs = cs, de = '', text = '', \
                    freq = float( freq ) if freq else None, \
                    time = '    ' )
            if dx.country == 'Russia' or dx.country == 'Ukraine':
                district = getAdifField( line, 'CNTY' )
                if not district or not reDistrict.match( district ):
                    district = getAdifField( line, 'STATE' )
                    if district and not reDistrict.match( district ):
                        state = None
                if district and district != dx.district:
                    dx.district = district
                    dx.detectAwards()
            if dx.country == '_USA':
                region = getAdifField( line, 'STATE' )
                district = getAdifField( line, 'CNTY' )
                district = region + ' ' + district \
                        if region and district \
                        else None
                if region and region != dx.region:
                    if dx.region:
                        dx.offDB = True
                    dx.region = region
                    dx.detectAwards()
                if district and dx.district != district:
                    if dx.district:
                        dx.offDB = True
                    dx.district = district
            if dx.awards:
                cfm = {}
                for ( cfmType, field ) in cfmFields.iteritems():
                    cfm[cfmType] = getAdifField( line, field ) == 'Y'
                for ( award, value ) in dx.awards.iteritems():
                    if not awards.has_key(award):
                        awards[award] = {}
                    if awards[award].has_key(value):
                        aw = awards[award][value]
                        for cfmType in cfmFields.keys():
                            if not aw[cfmType] and cfm[cfmType]:
                                aw[cfmType] = True
                        if len( aw['callsigns'] ) < 2 and \
                            not cs in aw['callsigns']:
                            aw['callsigns'].append( cs )
                    else:
                        awards[award][value] = { 'callsigns': [ cs, ] }    
                        for cfmType in cfmFields.keys():
                            awards[award][value][cfmType] = cfm[cfmType]
    with open( '/var/www/adxc.73/adifAwardsDebug.json', 'w' ) as f:
        f.write( json.dumps( awards ) )
    commitFl = False
    if awards:
        for award in awards.keys():
            for value in awards[award].keys():
                awState = awards[award][value]
                idParams = { 'callsign': callsign, \
                        'award': award,\
                        'value': value }
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
                        dxdb.execute( """update user_awards
                            set """ + paramStr( updParams, ', ' ) + \
                            " where " + paramStr( idParams, ' and ' ), \
                            dict( idParams, **updParams ) )
                        commitFl = True
                else:
                    idParams['worked_cs'] = ', '.join( awState['callsigns'] )
                    for cfmType in cfmFields.keys():
                        idParams[cfmType] = awState[cfmType]
                    dxdb.getObject( 'user_awards', idParams, True )
                    commitFl = True

    dxdb.updateObject( 'users', { 'callsign': callsign, 'last_adif_line': lastLine }, \
            'callsign' )
    dxdb.commit()

    return ( commitFl, lastLine )

