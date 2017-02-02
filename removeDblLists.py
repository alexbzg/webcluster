#!/usr/bin/python
#coding=utf-8

import sys, decimal, re, datetime, os, logging, time, json, urllib2, xmltodict,\
        argparse

from common import appRoot, readConf, siteConf, loadJSON
from dxdb import dxdb, cursor2dicts
from dx import DX, DXData


conf = siteConf()
webRoot = conf.get( 'web', 'root' ) 
udv = loadJSON( webRoot + '/userMetadata.json' )
if not udv:
    udv = {}

dblSql = """
    select callsign, title, sum( 1 )
    from users_lists
    where title in ( 'DX', 'DXpedition', 'Special' )
    group by callsign, title
    having sum( 1 ) > 1
"""
dbls = cursor2dicts( dxdb.execute( dblSql ) ) 
idSql = """
    select id from users_lists 
    where callsign = %(callsign)s and title = %(title)s
    """
updateItemsSql = """
    update users_lists_items as items0 set list_id = %(id0)s
    where list_id = %(id1)s and not exists 
        (select callsign from users_lists_items as items1
            where list_id = %(id0)s and items0.callsign = items1.callsign )
"""
deleteItemsSql = """
    delete from users_lists_items where list_id = %(id1)s
"""
deleteListSql = """
    delete from users_lists where id = %(id1)s
"""
for dbl in dbls:
    ids = cursor2dicts( dxdb.execute( idSql, dbl ), False )
    dbl['id0'] = ids[0]['id']
    for id in ids[1:]:
        dbl['id1'] = id['id']
        dxdb.execute( updateItemsSql, dbl )
        dxdb.execute( deleteItemsSql, dbl )
        dxdb.execute( deleteListSql, dbl )
        dxdb.updateObject( 'users', \
                { 'callsign': dbl['callsign'], 
                    'msg': json.dumps( { 'reload': 1 } ) }, \
                'callsign' )




