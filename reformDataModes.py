#!/usr/bin/python
#coding=utf-8

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict,\
        argparse

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb, cursor2dicts, spliceParams
from dx import DX, DXData

argparser = argparse.ArgumentParser()
argparser.add_argument( '-t', action = 'store_true' )
args = vars( argparser.parse_args() )
testMode = args['t']

conf = siteConf()
webRoot = conf.get( 'web', ( 'test_' if testMode else '' ) + 'root' ) 

awards = loadJSON( webRoot + '/awards.json' )

dataModesFull = """('DIGI', 'HELL', 'MT63', 'THOR16', 'FAX', 'OPERA', 'PKT', 'SIM31',
'CONTESTI', 'CONTESTIA', 'AMTOR', 'JT6M', 'ASCI', 'FT8', 'MSK144', 'THOR', 'QRA64',
'CONTESTIA', 'DOMINO', 'JT4C', 'THROB', 'DIG', 'ROS', 'SIM63', 'FSQ', 'THRB', 'J3E',
'WSPR', 'ISCAT', 'CONTESTIA8', 'ALE', 'JT10', 'TOR', 'PACKET', 'RTTY',  'PSK31', 
'PSK63', 'PSK125', 'JT65', 'FSK', 'OLIVIA', 'SSTV', 'JT9', 'FT8' )"""
modes = { 'CW':  """( 'A1A' )""",
        'SSB': """( 'AM', 'PHONE' )""",
        'DATA':  """('DIGI', 'HELL', 'MT63', 'THOR16', 'FAX', 'OPERA', 'PKT', 'SIM31',
'CONTESTI', 'CONTESTIA', 'AMTOR', 'JT6M', 'ASCI', 'FT8', 'MSK144', 'THOR', 'QRA64',
'CONTESTIA', 'DOMINO', 'JT4C', 'THROB', 'DIG', 'ROS', 'SIM63', 'FSQ', 'THRB', 'J3E',
'WSPR', 'ISCAT', 'CONTESTIA8', 'ALE', 'JT10', 'TOR', 'PACKET')""" }


def joinModes( mode, modeAliases, awardsList = None ):
    sql = """
        select distinct callsign, award, value, band
        from user_awards where mode in """ + modeAliases
    if awardsList:
        sql += " and award in " + awardsList
    awardItems = cursor2dicts( dxdb.execute( sql ) )
    if awardItems:
        if isinstance( awardItems, dict ):
            awardItems = ( awardItems, )
        for awardItem in awardItems:
            award = [ x for x in awards if x['name'] == awardItem['award'] ][0]
            cfmTypes = [ 'cfm_paper', 'cfm_eqsl', 'cfm_lotw' ]
            if award.has_key( 'cfmTypes' ):
                cfmTypes = []
                for cfmType in award['cfmTypes']:
                    cfmTypes.append( cfmType[1] )
            sql = """select * from user_awards 
                where callsign = %(callsign)s and award = %(award)s 
                    and value = %(value)s and band = %(band)s and ( mode = '""" \
                    + mode + "' or mode in" + modeAliases + ")"
            modeItems = cursor2dicts( dxdb.execute( sql, awardItem ) )
            if isinstance(modeItems, dict):
                modeItems = ( modeItems, )
            awardItem['cfm'] = {}
            for cfmType in cfmTypes:
                awardItem['cfm'][cfmType] = False
            awardItem['worked_cs'] = ''
            awardItem['mode'] = mode
            for modeItem in modeItems:
                for cfmType in cfmTypes:
                    if cfmType in modeItem['cfm']:
                        awardItem['cfm'][cfmType] |= modeItem['cfm'][cfmType]
                if not ',' in awardItem['worked_cs'] and modeItem['worked_cs']:
                    if len( awardItem['worked_cs'] ) == 0:
                        awardItem['worked_cs'] = modeItem['worked_cs']
                    else:
                        awardItem['worked_cs'] += ', ' + modeItem['worked_cs']
            dxdb.paramUpdateInsert( 'user_awards', \
                spliceParams( awardItem, ( 'callsign', 'award', 'value', 'band', 'mode' ) ),
                spliceParams( awardItem, ( 'cfm', 'worked_cs' ) ) )
    sql = """delete from user_awards where mode in""" + modeAliases
    dxdb.execute( sql )

joinModes( 'DATA', dataModesFull )

sql = """select callsign, award, settings, stats_settings
            from users_awards_settings
            """
if testMode:
    sql += " where callsign = 'QQQQ'"
data = cursor2dicts( dxdb.execute( sql ) )

for row in data:
    fl = False
    #print row['award']
    if row['settings']:
        if row['settings'].has_key( 'modes' ):
            #print row['settings']['modes']
            if not [ x for x in row['settings']['modes'] if x['name'] == 'DATA' ]:
                dt = { 'name': 'DATA', 'display': 'DATA',
                        'enabled': bool( [ x for x in row['settings']['modes'] if 
                            x['name'] in dataModesFull and x['enabled'] ] ) }
                row['settings']['modes'].append( dt )
            row['settings']['modes'] = [ x for x in row['settings']['modes'] if
                    x['name'] in ( 'CW', 'SSB', 'DATA' ) ]
            fl = True
            print row['settings']['modes']
    if row['stats_settings']:
        if row['stats_settings'].has_key( 'modesFilter' ):
            #print row['stats_settings']['modesFilter']
            row['stats_settings']['modesFilter'] = \
                { 'CW': row['stats_settings']['modesFilter']['CW'],
                    'SSB': row['stats_settings']['modesFilter']['SSB'],
                    'DATA': bool( [ x for x in row['stats_settings']['modesFilter'].keys() if \
                            x in dataModesFull and row['stats_settings']['modesFilter'][x] ] ) }
            fl = True
            #print row['stats_settings']['modesFilter']
    if fl and False:
        dxdb.paramUpdate( 'users_awards_settings', spliceParams( row, ( 'user', 'award' ) ), \
            spliceParams( row, ( 'settings', 'stats_settings' ) ) )

#sys.exit(0)

sql = "select callsign from users"
users = cursor2dicts( dxdb.execute( sql ) )
ts = time.time()
uData = {}
for user in users:
    uData[user['callsign']] = ts


with open( webRoot + '/userMetadata.json', 'w' ) as f:
    f.write( json.dumps( uData ) )



