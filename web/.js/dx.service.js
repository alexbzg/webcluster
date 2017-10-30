angular
    .module( 'adxcApp' )
    .service( 'DX', DXService );

DXService.$inject = [ '$rootScope', '$http', '$interval', 'SpotAwards', 'Notify' ];

function DXService( $rootScope, $http, $interval, SpotAwards, Notify ) {
    var url = '/dxdata.json';
    var lastModified = null;
    var lastItem = null;

    var dx = { 
        items: [],
        load: load,
        updateAwards: updateAwards,
        onUpdate: onUpdate
    };

    init();
    return dx;

    function init() {
       SpotAwards.onUpdate( updateAwards );
    }

    function onUpdate( callback, scope ) {
        Notify.notify( 'dx-update', callback, scope );
    }

    function load() {
        return $http.get( url, { cache: false } )
            .then( function( response ) {
                if ( ( lastModified != response.headers( 'last-modified' ) ) && 
                        response.data ) {
                    var lastRespItemIdx = response.data.length - 1;
                    for ( var co = 0; co <= lastRespItemIdx; co++ ) {
                        var item = response.data[lastRespItemIdx - co];
                        if ( co < dx.items.length && dx.items[co].cs == item.cs && 
                                dx.items[co].freq == item.freq && 
                                dx.items[co].ts == item.ts )
                                break;
                        for ( var coDup = co; coDup < dx.items.length; coDup++ )
                            if ( dx.items[coDup].cs == item.cs &&
                                ( dx.items[coDup].freq - item.freq < 1 &&
                                  item.freq - dx.items[coDup].freq < 1 ) ) {
                                dx.items.splice( coDup, 1 );
                                coDup--;
                            }
                        item._awards = angular.extend( {}, item.awards );
                        if ( SpotAwards.ready )
                            SpotAwards.processSpot( item );            
                        dx.items.splice( co, 0, item );
                    }
                    if ( dx.items.length > 500 )
                        dx.items.length = 500;
                    lastModified =  response.headers( 'last-modified' );
                    if ( SpotAwards.ready )
                        $rootScope.$emit( 'dx-update' );
                    return true;
                } 
                return false;
            } );
    }

    function updateAwards() {
        if ( SpotAwards.ready && dx.items.length > 0 ) {
            dx.items.forEach( function( item ) { 
                SpotAwards.processSpot( item ); 
            });
            $rootScope.$emit( 'dx-update' );
        }
    }



}

