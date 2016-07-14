var webDXapp = angular.module( 'webDXapp', [] );

webDXapp.controller( 'bodyCtrl', function( $scope, $http, $interval, $window ) {
    var stateAw = { 'Russia': 'RDA', 'Ukraine': 'URDA' };

    $scope.user = getUserData( $scope, $window ); 

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

    $scope.logout = function() {
        logoutUser();
        $scope.user = null;
        $scope.dxItems.forEach( awards );
    }

    function awards( dx ) {
        dx.awards = [];
        if ( dx.state != null )
            dx.awards.push( { 'award': stateAw[dx.country], 'value': dx.state } );
        if ( dx.rafa != null )
            dx.awards.push( { 'award': 'RAFA', 'value': dx.rafa } );
        if ( $scope.user != null && $scope.user.awardsSettings != null ) {
            fAwards = [];
            dx.awards.forEach( function( award ) {
                if ( $scope.user.awardsSettings[award.award].track ) {
                    award.color = $scope.user.awardsSettings[award.award].color;
                    fAwards.push( award );
                }
            });
            dx.awards = fAwards;
        }
        dx.noAwards = dx.awards.length == 0;
    }

   

    $scope.etag = null;
    loadDX();

    $interval( loadDX, 1000 );
} );

