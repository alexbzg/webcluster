var awardsApp = angular.module( 'awardsApp', ['colorpicker.module', 'ngSanitize' ] );

awardsApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

    if ( !( $scope.user = getUserData() ) )    
//        console.log( "no user data" );
        $window.location.href = "http://adxcluster.com/login.html";

    if ( !$scope.user.awardsSettings )
        $scope.user.awardsSettings = {};

    if ( !$scope.user.lists )
        $scope.user.lists = [];

    function awardSettings( country ) {
        country.awards.forEach( function( award ) {
            if ( !( award.name in $scope.user.awardsSettings ) )
                $scope.user.awardsSettings[award.name] = { 'track': true, 'color': '#770000' };
            if ( !( 'settings' in $scope.user.awardsSettings[award.name] ) || 
                    $scope.user.awardsSettings[award.name].settings == null) {
                $scope.user.awardsSettings[award.name].settings = {};
                var s = $scope.user.awardsSettings[award.name].settings;
                var st =
                { bands: [ '1.8', '3.5', '7', '10', '14', '18', '21', '24', '28', '50', '144' ],
                    modes: [ 'CW', 'SSB', 'RTTY', 'PSK31', 'PSK63', 'PSK125', 'JT65' ],
                    cfm: [ [ 'Paper', 'cfm_paper' ], [ 'eQSL', 'cfm_eqsl'], ['LOTW', 'cfm_lotw'] ],
                    sound: { wkd: true, not: true }
                };
                for ( var field in st )
                    if ( st.hasOwnProperty( field ) ) {
                        st[field] = [];
                        st[field].forEach( function( item ) {
                            if ( Array.isArray( item ) )
                                s[field].push( { name: item[1], enabled: true, display: item[0] } );
                            else
                                s[field].push( { name: item, enabled: true, display: item } );
                        });
                    }
            }
            if ( !$scope.user.awardsSettings[award.name].settings.sound )
                $scope.user.awardsSettings[award.name].settings.sound =
                    { wkd: true, not: true };


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
        saveUserData( $scope.user );
        if ( award ) {
            $http.post( '/uwsgi/userSettings',
                { 'token': $scope.user.token,
                    'award': award,
                    'track': $scope.user.awardsSettings[award].track,
                    'color': $scope.user.awardsSettings[award].color,
                    'settings': $scope.user.awardsSettings[award].settings,
                } ).then( function( response ) {
                    console.log( response.data );
                } );
        }

    }

    $scope.listChanged = function( list ) {
        saveUserData( $scope.user );
        if ( list ) {
            $http.post( '/uwsgi/userSettings',
                { 'token': $scope.user.token,
                    'list_id': list.id,
                    'track': list.track,
                    'color': list.color,
                } ).then( function( response ) {
                    console.log( response.data );
                } );
        }

    }

    $scope.deleteList = function( list ) {
        if ( $window.confirm( 'Do you really want to remove user list ' + list.title + '?' ) ) {
            $http.post( '/uwsgi/userSettings',
                { 'token': $scope.user.token,
                    'list_id': list.id,
                    'delete': true
                } ).then( function( response ) {
                    console.log( response.data );
                } );
            var i = $scope.user.lists.indexOf( list );
            $scope.user.lists.splice( i, 1 );
            saveUserData( $scope.user );
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

