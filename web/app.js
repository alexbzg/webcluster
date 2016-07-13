var webDXapp = angular.module( 'webDXapp', [] );

function getUserData( $scope, $window ) {
    if ( $window.localStorage['adxcluster-user'] )
        $scope.user = JSON.parse( $window.localStorage['adxcluster-user'] );
    else if ( $window.sessionStorage['adxcluster-user'] )
        $scope.user = JSON.parse( $window.sessionStorage['adxcluster-user'] );
    else
        $scope.user = null;
}

webDXapp.controller( 'bodyCtrl', function( $scope, $http, $interval, $window ) {
    var stateAw = { 'Russia': 'RDA', 'Ukraine': 'URDA' };

    getUserData( $scope, $window ); 

    function loadDX() {
        $http.get( '/dxdata.json', { cache: false } ).then( function( response ) {
            if ( $scope.etag != response.headers( 'etag' ) ) {
                $scope.dxItems = response.data.reverse();
                $scope.dxItems.forEach( awards );
                $scope.etag = response.headers( 'etag' );
            }
        } );
    }

    $scope.replace0 = function( str ) {
        return str == null ? null : str.replace( /0/g, '\u00D8' );
    }

    function awards( dx ) {
        dx.awards = [];
        if ( dx.state != null )
            dx.awards.push( { 'award': stateAw[dx.country], 'value': dx.state } );
        if ( dx.rafa != null )
            dx.awards.push( { 'award': 'RAFA', 'value': dx.rafa } );
    }

   

    $scope.etag = null;
    loadDX();

    $interval( loadDX, 1000 );
} );

