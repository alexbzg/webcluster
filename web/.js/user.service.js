angular
    .module( 'adxcApp' )
    .service( 'User', UserService );

function UserService( $http, $window ) {
    var storageKey = 'adxcluster-user';
    var user = { 
        login: login,
        fromStorage: fromStorage,
        toStorage: toStorage };
    return user;

    function login( loginData ) {
    }
    
    function fromStorage() {
        function testStorage( storage ) {
            var r = null;
            if ( r = storage.getItem( storageKey ) ) {
                try {
                    r = JSON.parse( r );
                } catch( err ) {
                    r = null;
                }
            }
            return r;
        }

        var ud = testStorage( $window.localStorage );    
        if ( ud )
            ud['remeber'] = true;
        else {
            ud = testStorage( $window.sessionStorage );
            if ( ud )
                ud['remember'] = false;
        }
        user.data = ud;
        user.loggedIn = Boolean( user.data.token );
    }

    function toStorage() {
    }
}

