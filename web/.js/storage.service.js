angular
    .module( 'adxcApp' )
    .service( 'Storage', StorageService );

function StorageService( $window ) {
    var ownStorage = {
        setItem: 
            function( name, value ) {
               document.cookie = name+"="+value+"; path=/";
        },
        getItem: function(name) {
            var nameEQ = name + "=";
            var ca = document.cookie.split(';');
            for(var i=0;i < ca.length;i++) {
                var c = ca[i];
                while (c.charAt(0)==' ') c = c.substring(1,c.length);
                if (c.indexOf(nameEQ) == 0) {
                    ret = c.substring(nameEQ.length,c.length);
                    switch (ret) {
                      case 'true': 
                          return true;
                      case 'false':
                          return false;
                      default:
                          return ret;
                    }
                }
            }
            return null;
        },
        removeItem: function(name) {
                this.setItem( name, "" );
        }
    };

    var _storage = {
        load: load,
        save: save,
        remove: remove
    };
    return _storage;

    function storage( type ) {
        try {
            return $window[ type + 'Storage' ];
        } catch (err) {
            return ownStorage;
        }
    }

    function load( key, storageN ) {
         function testStorage( storage ) {
            var r = null;
            try {
                if ( r = storage.getItem( key ) )
                    r = JSON.parse( r );
            } catch( err ) {
                r = null;
            }
            return r;
        }

        if ( storageN ) {
            try {
                return testStorage( storage( storageN ) )
            } catch( err ) {
                return null;
            }
        }

        var r = testStorage( storage( 'local' ) );    
        if ( !r )
            r = testStorage( storage( 'session' ) );
        return r;
    }  

    function save( key, data, storageN ) {
        var s = storage( storageN );
        s.setItem( key, JSON.stringify( data ) );
    }

    function remove( key, storageN ) {
        var s = storage( storageN );
        s.removeItem( key );
    }

    
}

