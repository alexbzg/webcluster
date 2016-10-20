angular
    .module( 'adxcApp' )
    .service( 'User', UserService );

function UserService( $http, Storage ) {
    var storageKey = 'adxcluster-user';
    var user = { 
        login: login,
        fromStorage: fromStorage,
        toStorage: toStorage };
    return user;

    function login( loginData ) {
    }
    
    function fromStorage() {
        var ud;
        var storages = {'local': true, 'session': false };
        for ( var storage in storages )
            if ( ud = Storage.load( storageKey, storage ) ) {
                ud['remember'] = storages[storage];
                break;
            }

        if ( ud ) {
            user.data = ud;
            user.loggedIn = Boolean( user.data.token );
        }
    }

    function toStorage() {
    }
}

