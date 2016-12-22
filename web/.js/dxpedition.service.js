angular
    .module( 'adxcApp' )
    .service( 'DXpedition', DXpeditionService );


DXpeditionService.$inject = ['$http', '$rootScope', 'Notify' ];

function DXpeditionService( $http, $rootScope, Notify ) {
    var s = { lasModified: null,
                    load: load,
                    dxpedition: null,
                    onUpdate: onUpdate };
    return s;

    function onUpdate( callback, scope ) {
        Notify.notify( 'dxpedition-updated', callback, scope );
    }


    function load() {
        var url = '/dxpedition.json';
        return $http.get( url )
            .then(loadComplete)
            .catch(loadFailed);

        function loadComplete(response) {
            if ( s.lastModified != response.headers( 'last-modified' ) ) {
                s.lastModified =  response.headers( 'last-modified' );
                if ( response.data )
                    s.dxpedition = response.data.filter( function( item ) {
                        return moment( item.dt_end ).add( 1, 'weeks' ) > moment();
                    });
                else
                    s.dxpedition = null;
                $rootScope.$emit('dxpedition-updated');
            }
            return response.data;
        }

        function loadFailed(error) {
            console.log('DXpedition XHR Failed: ' + error.data);
        }
    }
}   
 
