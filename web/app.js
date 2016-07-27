var webDXapp = angular.module( 'webDXapp', [ 'ngSanitize' ] );

webDXapp.controller( 'bodyCtrl', function( $scope, $http, $interval, $window, $timeout ) {
    var stateAw = { 'Russia': 'RDA', 'Ukraine': 'URDA' };

    if ( $scope.user = getUserData( $scope, $window ) )
        $scope.awardsSettings = $scope.user.awardsSettings;

    function loadDX() {
        $http.get( '/dxdata.json', { cache: false } ).then( function( response ) {
            if ( $scope.dxlm != response.headers( 'last-modified' ) ) {
                $scope.dxItems = response.data.reverse();
                $scope.dxItems.forEach( awards );
                $scope.dxlm = response.headers( 'last-modified' );
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
        if ( $scope.user != null && ( $scope.user.awards != null || 
                    $scope.awardsSettings != null ) ) {
            fAwards = [];
            dx.awards.forEach( function( award ) {
                if ( $scope.user.awards != null 
                    && award.award in $scope.user.awards &&
                    award.value in $scope.user.awards[award.award] ) {
                    if ( $scope.user.awards[award.award][award.value].confirmed )
                        return;
                    else
                        award.worked = true;
                }
                if ( $scope.awardsSettings != null &&
                        award.award in $scope.awardsSettings ) {
                    if ( $scope.awardsSettings[award.award].track ) {
                        award.color = $scope.awardsSettings[award.award].color;
                        fAwards.push( award );
                    }
                } else
                    fAwards.push( award );
            });
            dx.awards = fAwards;
        }
        dx.noAwards = dx.awards.length == 0;
    }

   

    $scope.etag = null;
    loadDX();

    $interval( loadDX, 1000 );

    $scope.news = { 'lm': $window.localStorage.getItem( 'adxcluster-news' ),
        'html': null };

    $http.get( '/news.txt', { cache: false } ).then( function( response ) {
        if ( $scope.news.lm != response.headers( 'last-modified' ) ) {
            $scope.news.lm = response.headers( 'last-modified' );
            if ( response.data.length > 10 )
                $scope.news.html = response.data;
        }
    });


    $scope.news.close = function() {
        $window.localStorage['adxcluster-news'] = $scope.news.lm;
        $scope.news.html = null;
    }

    function updateTime() {
        var n = new Date();
        var min = n.getUTCMinutes();
        if ( min < 10 ) min = "0" + min;
        var hr = n.getUTCHours();
        if ( hr < 10 ) hr = "0" + hr;
        $scope.time = hr + ':' + min;
        $timeout( updateTime, ( 60 - n.getUTCSeconds() ) * 1000 );
    }
    updateTime();

/*    function checkStatus() {
//        $scope.connectionStatus = "testing";
        $http.get( "/clusterConnection.json", { cache: false } ).then( function( response ) {
            $scope.connectionStatus = response.data.status;
        } );
    }
    $scope.connectionStatus = "testing";
    $interval( checkStatus, 1000 );*/
} );

