angular
    .module( 'adxcApp' )
    .service( 'DX', DXService );

function DXService( $http, User ) {
    var url = '/dxdata.json';
    var lastModified = null;
    var user = User;
    var dx = { 
        items: null,
        load: load,
        updateAwards: updateAwards
    };
    return dx;

    function load( lastModified ) {
        $http.get( url, { cache: false } ).then( function( response ) {
            if ( lastModified != response.headers( 'last-modified' ) ) {
                dx.items = response.data.reverse();
                dx.items.forEach( function( item ) {
                    item._awards = angular.extend( {}, item.awards );
                });
                lastModified =  response.headers( 'last-modified' );
                updateAwards();
            } 
            return response;
        } );
    }

    function updateAwards() {
        dx.items.forEach( function( item ) {
            item.awards = [];
            itemAwards( item );
            itemListAwards( item );
        });
    }

    function itemAwards( item ) {
        for ( var aN in item._awards ) {
            var aV = item._awards[aN];
            var a = { award: aN, value: aV };
            if ( user.awards || user.awardsSettings ) {
            }
            item.awards.push( a );
        }
    }

    function itemListAwards( item ) {
    }
}

