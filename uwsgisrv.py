#!/usr/bin/python
#coding=utf-8
from common import appRoot, readConf, siteConf, loadJSON, jsonEncodeExtra
from dxdb import cursor2dicts, dbConn, paramStr
from dx import loadSpecialLists

import json, smtplib, urllib2, urllib, os, base64, jwt, re, logging, time, urlparse
import time, zlib, ssl

from urlparse import parse_qs
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from email import charset
charset.add_charset('utf-8', charset.SHORTEST, charset.QP)
secret = None
fpSecret = '/var/tmp/adxcluster.secret'
if ( os.path.isfile( fpSecret ) ):
    with open( fpSecret, 'r' ) as fSecret:
        secret = fSecret.read()
if not secret:
    secret = base64.b64encode( os.urandom( 64 ) )
    with open( fpSecret, 'w' ) as fSecret:
        fSecret.write( secret )

conf = siteConf()
adifQueueDir = conf.get( 'web', 'root' ) + '/.adif/'

logging.basicConfig( level = logging.DEBUG,
        format='%(asctime)s %(message)s', 
        filename='/var/log/adxcluster_uwsgi.log',
        datefmt='%Y-%m-%d %H:%M:%S' )
logging.info( 'starting in test mode' )

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
        updMeta = True
        if data.has_key( 'token' ):
            try:
                pl = jwt.decode( data['token'], secret, algorithms=['HS256'] )
            except jwt.exceptions.DecodeError, e:
                start_response( '400 Bad Request', [('Content-Type','text/plain')])
                return 'Login expired'
            if pl.has_key( 'callsign' ):
                callsign = pl['callsign']
        if callsign:
#award settings
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
#check message
            elif data.has_key( 'checkMessage' ):
                userData = dxdb.getObject( 'users', \
                        { 'callsign': callsign },\
                        False, True )
                if ( userData['msg'] ):
                    dxdb.paramUpdate( 'users', { 'callsign': callsign }, \
                            { 'msg': None } )
                    dxdb.commit()
                start_response('200 OK', [('Content-Type','application/json')])
                return json.dumps( userData['msg'] )
#reload data
            elif data.has_key( 'reload' ):
                userData = dxdb.getObject( 'users', \
                        { 'callsign': callsign },\
                        False, True )
                return sendUserData( userData, start_response )
#dxped admin
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
                        updMeta = False

                else:
                    start_response( '403 Forbidden', \
                            [('Content-Type','text/plain')])
                    return 'Permission denied'
#adif                   
            elif data.has_key( 'adif' ):
                adif = data['adif']['file'].split( ',' )[1].decode( \
                        'base64', 'strict' )
                fName = callsign + '-' + str( time.time() ) + '.adif'
                with open( adifQueueDir + fName, 'w' ) as f:
                    f.write( adif )
                queue = loadJSON( adifQueueDir + 'queue.json' )
                if not queue:
                    queue = []
                queue.append( { 'callsign': callsign, \
                        'awards': data['adif']['awards'],\
                        'file': fName } )
                with open( adifQueueDir + 'queue.json', 'w' ) as f:
                    f.write( json.dumps( queue ) )

                start_response( '200 OK', [('Content-Type','text/plain')])     
                return 'OK'
#autocfm    
            elif data.has_key( 'loadAutoCfm' ):
                rTxt = ''
                r = False
                try:
                    r = loadAutoCfm( callsign )
                    rTxt = 'Your awards were updated.' if r \
                            else 'No new callsigns were found.'
                except:
                    rTxt = 'There was an error. Please try to update later.'
                    logging.exception( 'Error while loading autoCfm. Callsign: ' + \
                            callsign )
                start_response( '200 OK', [('Content-Type','application/json')])     
                return json.dumps( { 'reload': r, 'text': rTxt } )
#user award data
            elif data.has_key( 'award' ) and data.has_key( 'value' ) \
                    and ( data.has_key( 'confirmed' ) or data.has_key('delete') or \
                    data.has_key( 'cfm_paper' ) or data.has_key( 'cfm' ) ):

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
                    updParams = spliceParams( data, \
                        [ 'confirmed', 'cfm_paper', 'cfm_eqsl', 'cfm_lotw', \
                        'cfm', 'worked_cs'] )
                    dxdb.verbose = True
                    fl = dxdb.paramUpdateInsert( 'user_awards', params, updParams )
                    dxdb.verbose = False
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
                elif data.has_key( 'items' ):
                    idParams = { 'list_id': data['list_id'] }
                    okResponse = 'OK'
                    for item in data['items']:
                        idParams['callsign'] = item['callsign']
                        if not dxdb.paramUpdateInsert( 'users_lists_items', \
                            idParams,
                            spliceParams( item, [ 'settings', 'pfx' ] ) ):  
                            okResponse = ''
                            dbError = True
                            dxdb.rollback()
                        else:
                            dxdb.commit()
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
            if updMeta:
                umd = readWebFile( 'userMetadata.json', env )
                if not umd:
                    umd = {}
                ts = time.time()
                umd[callsign] = ts
                writeWebFile( json.dumps( umd ), 'userMetadata.json', env )
                start_response( '200 OK', [('Content-Type','application/json')])
                return json.dumps( { 'version': ts } )
            else:
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
                    'cfm_lotw': item['cfm_lotw'],
                    'cfm': item['cfm']}
            else:
                r[item['award']][item['value']] = \
                    { 'confirmed': item['confirmed'], 'workedCS': item['worked_cs'],\
                    'cfm_paper': item['cfm_paper'], 'cfm_eqsl': item['cfm_eqsl'],\
                    'cfm_lotw': item['cfm_lotw'],
                    'cfm': item['cfm']}
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

def readWebFile( fName, env ):
    test = 'test' in env['SERVER_NAME']
    return loadJSON( conf.get( 'web', 'test_root' if test else 'root' ) + \
            '/' + fName )

def writeWebFile( data, fName, env ):
    test = 'test' in env['SERVER_NAME']
    keys = ( 'test_root', ) if test else ( 'root', 'test_root' )
    dirs = [ conf.get( 'web', key ) for key in keys ]
    for dir in dirs:
        with open( dir + '/' + fName, 'w' ) as f:
            f.write( data )

def exportDXpedition( env ):
    dxp = cursor2dicts( \
            dxdb.execute( """
                select * from dxpedition
                where dt_end > now() - interval '1 week'
                order by callsign;"""), True )
    if not dxp:
        dxp = [];
    dxpJSON = json.dumps( dxp, default = jsonEncodeExtra ) 
#    with open( dir + '/dxpedition.json', 'w' ) as f:
#        f.write( dxpJSON )
    sl = loadSpecialLists()
    sl['DXpedition'] = dxp
    slJSON = json.dumps( sl, default = jsonEncodeExtra ) 
    writeWebFile( slJSON, 'specialLists.json', env )

def loadAutoCfm( callsign ):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    url = 'https://mydx.eu/rda/csv?call=' + \
            ( 'RA3AV' if callsign == 'QQQQ' else callsign )
    u = urllib2.urlopen(url, context = ctx)
    data = zlib.decompress( u.read() , -15).split( '\n' )
    idParams = { 'callsign': callsign, 'award': 'RDA' }
    commitFl = False
    for line in data:
        if ',' in line:
            val, cs = ( line.split( ',', 2 )[:2] )
            idParams['value'] = val
            lookup = dxdb.getObject( 'user_awards', idParams, False, True )
            if lookup:
                if not lookup['cfm'].has_key( 'cfm_auto' ) or \
                        not lookup['cfm']['cfm_auto']: 
                    commitFl = True
                    lookup['cfm']['cfm_auto'] = True
                    if not lookup['worked_cs'] or not ',' in lookup['worked_cs']:
                        if lookup['worked_cs']:
                            lookup['worked_cs'] += ', ' + cs
                        else:
                            lookup['worked_cs'] = cs
                    dxdb.paramUpdate( 'user_awards', idParams, \
                            spliceParams( lookup, [ 'cfm', 'worked_cs' ] ) )
            else:
                commitFl = True
                updParams = { 'cfm': json.dumps( { 'cfm_auto': True } ), \
                        'worked_cs': cs }
                updParams.update( idParams )
                dxdb.getObject( 'user_awards', updParams, True )
    if commitFl:
        dxdb.commit()   
    return commitFl
