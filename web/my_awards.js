var awardsApp = angular.module( 'awardsApp', [] );

awardsApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

    if ( !( $scope.user = getUserData() ) )    
//        console.log( "no user data" );
        $window.location.href = "http://adxcluster.com/login.html";

    if ( 'awardsSettings' in $scope.user )
        $scope.awardsSettings = $scope.user.awardsSettings;
    else
        $scope.awardsSettings = {};

    $scope.logout = function() {
        logoutUser();
        $window.location.href = "http://adxcluster.com/login.html";
    }

    $scope.saveUserSettings = function() {
        saveUserData( $scope.user );
        $http.post( '/uwsgi/userSettings',
            { 'token': $scope.user.token,
                'award_value_worked_color': $scope.user.awardValueWorkedColor,
                'award_value_confirmed_color': $scope.user.awardValueConfirmedColor 
            } ).then( function( response ) {
                console.log( response.data );
            } );
    };


    $http.get( '/awardsValues.json' ).then( function( response ) {
            $scope.awardsValues = response.data;
            $scope.awardsValues.forEach( function( award ) {
            if ( !( award.name in $scope.awardsSettings ) )
                $scope.awardsSettings[award.name] = { 'track': true, 'color': '#770000' };
            });

        }
    );

    $scope.setActiveValue = function( value ) {
        if ( typeof value == 'object' )
            $scope.activeValue = value;
        else if ( found = $scope.activeAward.values.find( 
                function( x ) { return x.value === value; } ) ) {
            $scope.activeValue = found;
            $scope.searchValue = null;
        }
    };

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

