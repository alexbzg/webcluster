#!/usr/bin/python
#coding=utf-8

import psycopg2, sys, logging, json, traceback

from common import siteConf

def cursor2dicts( cur, keys = None ):
    if cur and cur.rowcount:
        colNames = [ col[0] for col in cur.description ]
        if cur.rowcount == 1 and not keys:
            return dict( zip( colNames, cur.fetchone() ) )
        else:
            if ( 'id' in colNames ) and keys:
                idIdx = colNames.index( 'id' )
                return dict( 
                        ( row[ idIdx ], dict( zip( colNames, row ) ) )
                        for row in cur.fetchall() )
            else:
                return [ dict( zip( colNames, row ) ) for
                        row in cur.fetchall() ]
    else:
        return False

def paramStr( params, str ):
    return str.join( [ x + " = %(" + x + ")s" for x in params.keys() ] )

def spliceParams( data, params ):
    return { param: json.dumps( data[param] ) \
            if isinstance( data[param],dict ) else data[param] \
        for param in params \
        if data.has_key( param ) }


class dbConn:
    def __init__( self ):
        conf = siteConf()
        connStr = ' '.join( 
                [ k + "='" + v + "'" 
                    for k, v in conf.items( 'db' ) ] )
        try:
            self.verbose = False
            conn = psycopg2.connect( connStr )
            conn.set_client_encoding( 'UTF8' )
            self.conn = conn
            self.conn.autocommit = True
            self.error = None
        except:
            sys.stderr.write( "No db connection!" )
            self = False

    def fetch( self, sql, params = None ):
        cur = self.conn.cursor()
        cur.execute( sql, params )
        if cur.rowcount:
            res = cur.fetchall()
            cur.close()
            return res
        else:
            cur.close()
            return False

    def paramUpdate( self, table, idParams, updParams ):
        return self.execute( 'update ' + table + \
                ' set ' + paramStr( updParams, ', ' ) + \
                " where " + paramStr( idParams, ' and ' ), \
                dict( idParams, **updParams ) )

    def paramDelete( self, table, idParams ):
        return self.execute( 'delete from ' + table + \
                " where " + paramStr( idParams, ' and ' ), \
                idParams )

    def paramUpdateInsert( self, table, idParams, updParams ):
        logging.debug( 'idParams:' )
        logging.debug( idParams )
        logging.debug( 'updParams:' )
        logging.debug( updParams )
        lookup = self.getObject( table, idParams, False, True )
        r = None
        if lookup:
            r = self.paramUpdate( table, idParams, updParams )
        else:
            r = self.getObject( table, dict( idParams, **updParams ), \
                    True )
        return r

    def execute( self, sql, params = None ):
        cur = self.conn.cursor()
        try:
            if self.verbose:
                logging.debug( sql )
                logging.debug( params )
            cur.execute( sql, params )
        except psycopg2.Error, e:
            logging.exception( "Error executing: " + sql + "\n" )
            stack = traceback.extract_stack()
            logging.error( stack )
            if params:
                logging.error( "Params: " )
                logging.error( params )
            if e.pgerror:
                logging.error(  e.pgerror )
                self.error = e.pgerror
            self.conn.rollback()
            return False
        return cur

    def getValue( self, sql, params = None ):
        res = self.fetch( sql, params )
        if res:
            return res[0][0]
        else:
            return False

    def commit( self ):
        self.conn.commit()

    def rollback( self ):
        self.conn.rollback()



    def getObject( self, table, params, create = False, 
            never_create = False ):
        sql = ''
        cur = False
        if not create:
            if self.verbose:
                logging.debug( 'getObject lookup' )
            sql = "select * from %s where %s" % (
                    table, 
                    " and ".join( [ k + " = %(" + k + ")s"
                        if params[ k ] != None 
                        else k + " is null"
                        for k in params.keys() ] ) )
            cur = self.execute( sql, params )
            if cur and not cur.rowcount:
                cur.close()
                cur = False
                if never_create:
                    return False
        if create or not cur:
            if self.verbose:
                logging.debug( 'getObject insert' )
            keys = params.keys()
            sql = "insert into " + table + " ( " + \
                ", ".join( keys ) + ") values ( " + \
                ', '.join( [ "%(" + k + ")s" for k in keys ] ) + \
                " ) returning *"
            cur = self.execute( sql, params )
        if cur:
            objRes = cursor2dicts( cur )
            cur.close()
            self.commit()
            return objRes
        else:
            return False

    def getMasterDetail( self, masterSQL, params, detailSQL, 
            detailFieldName = 'detail' ):
        data = cursor2dicts( self.execute( masterSQL, params ) )
        for row in data:
            row[ detailFieldName ] = cursor2dicts( 
                    self.execute( detailSQL, row ) )
        return data

    def updateObject( self, table, params, idParam = "id" ):
        paramString = ", ".join( [ k + " = %(" + k + ")s" 
            for k in params.keys() if k != idParam ] )
        if paramString != '':
            sql = "update " + table + " set " + paramString + \
                " where " + idParam + " = %(" + idParam + ")s returning *" 
            cur = self.execute( sql, params )
            if cur:
                objRes = cursor2dicts( cur )
                cur.close()
                self.commit()
                return objRes

    def deleteObject( self, table, id ):
        sql = "delete from " + table + " where id = %s" 
        self.execute( sql, ( id, ) ).close()
        self.commit()


dxdb = dbConn()


    
