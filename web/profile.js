var profileApp = angular.module( 'profileApp', [] );

function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

profileApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

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
        } );
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
                } ).then( function( response ) {
                    console.log( response.data );
                } );
        }

    }

    $http.get( '/awards.json' ).then( function( response ) {
            $scope.awardsList = response.data;
            $scope.awardsList.forEach( awardSettings );

        }
    );

    $scope.changeEmailClick = function() {
        $http.post( '/uwsgi/userSettings',
        { 'token': $scope.user.token,
            'email': $scope.user.email
        } ).then( function( response ) {
            alert( 'Email changed successfully' );
            console.log( response.data );
        } );
   }

   $scope.changePwdClick = function() {
        $http.post( '/uwsgi/userSettings',
        { 'token': $scope.user.token,
            'password': $scope.changePwd.newPwd,
            'oldPassword': $scope.changePwd.oldPwd
        } ).then( function( response ) {
            alert( 'Password changed successfully' );
            console.log( response.data );
        }, function( response ) {
            if ( response.status == "500" )
                alert( 'Server error. Please try again later' );
            else
                alert( response.data );
        });
   }


} );

