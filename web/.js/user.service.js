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
        if ( !user.data )
            user.data = {};
        if ( !user.data.lists )
            user.data.lists = [];

        if ( user.data.listsAwards )
            user.data.listsAwards = {};

        if ( user.data.awardsSettings )
            user.data.awardsSettings = {};
       
    }

    function toStorage() {
    }
}

