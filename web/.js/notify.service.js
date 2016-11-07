angular
    .module( 'adxcApp' )
    .service( 'Notify', notifyService );

function notifyService( $rootScope ) {
    return { notify: notify };

    function notify( evt, callback, scope ) {
        var handler = $rootScope.$on( evt, callback);
        if ( scope )
            scope.$on('$destroy', handler);
    }
}

