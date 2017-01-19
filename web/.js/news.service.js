angular
    .module( 'adxcApp' )
    .service( 'News', newsService );

newsService.$inject = [ '$http', 'Storage' ];
   

function newsService( $http, Storage ) {
    var storageKey = 'adxcluster-news';
    var storageType = 'local';
    var html = '';
    var lm = Storage.load( storageKey, storageType );

    $http.get( '/news.txt', { cache: false } )
        .then( loadHtml );

    return {
        html: function() { return html; },
        close: close
    };    

    function loadHtml( response ) {
        if ( lm != response.headers( 'last-modified' ) ) {
            lm = response.headers( 'last-modified' );
            if ( response.data.length > 10 )
                html = response.data;
        }
    }

    function close() {
        Storage.save( storageKey, lm, storageType );
        html = '';
    }
}
