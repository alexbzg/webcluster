angular
    .module( 'adxcApp' )
    .service( 'Storage', StorageService );

function StorageService( $window ) {
    var _storage = {
        load: load,
        save: save,
        remove: remove
    };
    return _storage;

    function storage( type ) {
        return $window[ type + 'Storage' ];
    }

    function load( key, storageN ) {
         function testStorage( storage ) {
            var r = null;
            if ( r = storage.getItem( key ) ) {
                try {
                    r = JSON.parse( r );
                } catch( err ) {
                    r = null;
                }
            }
            return r;
        }

        if ( storageN )
            return testStorage( storage( storageN ) )

        var r = testStorage( storage( 'local' ) );    
        if ( !r )
            r = testStorage( storage( 'session' ) );
        return r;
    }  

    function save( key, data, storageN ) {
        var s = storage( storageN );
        s[key] = JSON.stringify( data );
    }

    function remove( key, storageN ) {
        var s = storage( storageN );
        s.removeItem( key );
    }

    
}

