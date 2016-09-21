var awardsApp = angular.module( 'awardsApp', ['colorpicker.module', 'ngSanitize' ] );

awardsApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

    if ( !( $scope.user = getUserData() ) )    
//        console.log( "no user data" );
        $window.location.href = "http://adxcluster.com/login.html";

    if ( 'awardsSettings' in $scope.user )
        $scope.awardsSettings = $scope.user.awardsSettings;
    else
        $scope.awardsSettings = {};

    function awardSettings( country ) {
        country.awards.forEach( function( award ) {
            if ( !( award.name in $scope.awardsSettings ) )
                $scope.awardsSettings[award.name] = { 'track': true, 'color': '#770000' };
            if ( !( 'settings' in $scope.awardsSettings[award.name] ) || 
                    $scope.awardsSettings[award.name].settings == null) {
                $scope.awardsSettings[award.name].settings = {};
                var s = $scope.awardsSettings[award.name].settings;
                var st =
                { bands: [ '1.8', '3.5', '7', '10', '14', '18', '21', '24', '28', '50', '144' ],
                    modes: [ 'CW', 'SSB', 'RTTY', 'PSK31', 'PSK63', 'PSK125', 'JT65' ],
                    cfm: [ [ 'Paper', 'cfm_paper' ], [ 'eQSL', 'cfm_eqsl'], ['LOTW', 'cfm_lotw'] ] };
                for ( var field in st )
                    if ( st.hasOwnProperty( field ) ) {
                        s[field] = [];
                        st[field].forEach( function( item ) {
                            if ( Array.isArray( item ) )
                                s[field].push( { name: item[1], enabled: true, display: item[0] } );
                            else
                                s[field].push( { name: item, enabled: true, display: item } );
                        });
                    }
            }
        } );
    }

    $scope.setupAward = null;
    $scope.openSetup = function( award ) {
        $scope.setupAward = award == null ? null : award.name;
    }

    $scope.logout = function() {
        logoutUser();
        $window.location.href = "http://adxcluster.com/login.html";
    }

    $scope.awardSettingsChanged = function( award ) {
        $scope.user.awardsSettings = $scope.awardsSettings;
        saveUserData( $scope.user );
        if ( award ) {
            $http.post( '/uwsgi/userSettings',
                { 'token': $scope.user.token,
                    'award': award,
                    'track': $scope.awardsSettings[award].track,
                    'color': $scope.awardsSettings[award].color,
                    'settings': $scope.awardsSettings[award].settings,
                } ).then( function( response ) {
                    console.log( response.data );
                } );
        }

    }

    var url = testing ? '/debug/awards.json' : '/awards.json';
    $http.get( url ).then( function( response ) {
        $scope.awardsList = [];
        response.data.forEach( function( award ) {
            var country = $scope.awardsList.find( function( item ) {
                return item.country == award.country; } );
            if ( !country ) {
                country = { country: award.country, awards: [] };
                $scope.awardsList.push( country );
            }
            country.awards.push( award );
            $scope.awardsList.forEach( awardSettings );
        } );
    } );


} );

