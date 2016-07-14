function getUserData() {
    
    function testStorage( storage ) {
        var r = null;
        if ( r = storage.getItem('adxcluster-user') ) {
            try {
                r = JSON.parse( r );
                if ( !( 'callsign' in r && 'token' in r ) ) 
                    r = null;
            } catch( err ) {
                r = null;
            }
        }
        return r;
    }

    var ud = testStorage( window.localStorage );    
    if ( ud )
        ud['remeber'] = true;
    else {
        ud = testStorage( window.sessionStorage );
        if ( ud )
            ud['remember'] = false;
    }
    return ud;
}

function saveUserData( userData ) {
    var storage = userData['remember'] ? window.localStorage : window.sessionStorage;
    storage['adxcluster-user'] = JSON.stringify( userData );
}

function logoutUser() {
    window.localStorage.removeItem( 'adxcluster-user' );
    window.sessionStorage.removeItem( 'adxcluster-user' );   
}

