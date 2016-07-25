var awardsApp = angular.module( 'awardsApp', [] );

awardsApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

    if ( !( $scope.user = getUserData() ) )    
        $window.location.href = "http://adxcluster.com/login.html";

    if ( 'awardsSettings' in $scope.user )
        $scope.awardsSettings = $scope.user.awardsSettings;
    else
        $scope.awardsSettings = {};

    if ( 'awards' in $scope.user )
        $scope.userAwards = $scope.user.awards;
    else
        $scope.userAwards = {};

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
                award.workedCount = 0;
                award.confirmedCount = 0;
                if ( !( award.name in $scope.awardsSettings ) )
                    $scope.awardsSettings[award.name] = 
                        { 'track': true, 'color': '#770000' };
                if ( !( award.name in $scope.userAwards ) )
                    $scope.userAwards[award.name] = {};
                award.values.forEach( function( av ) {
                    if ( av.value in $scope.userAwards[award.name] ) {
                        av.worked = true;
                        award.workedCount++;
                        av.confirmed = $scope.userAwards[award.name][av.value];
                        if ( av.confirmed )
                            award.confirmedCount++;
                    }
                });
                        
            });
    });

    $scope.setActiveValue = function( value ) {
        if ( typeof value == 'object' )
            $scope.activeValue = value;
        else if ( found = $scope.activeAward.values.find( 
                function( x ) { return x.value === value; } ) ) {
            $scope.activeValue = found;
            $scope.searchValue = null;
        }
    };

    $scope.modifyActiveValue = function( param ) {
        var aw = $scope.userAwards[$scope.activeAward.name];
        if ( param == 'worked' && !$scope.activeValue.worked ) {
            if ( $scope.activeValue.confirmed ) {
                $scope.activeAward.confirmedCount--;
                $scope.activeValue.confirmed = false;
            }
            $scope.activeAward.workedCount--;
            delete aw[$scope.activeValue.value];
            $http.post( '/uwsgi/userSettings',
            { 'token': $scope.user.token,
                'award': $scope.activeAward.name,
                'value': $scope.activeValue.value,
                'delete': true
            } );
       } else {
            if ( param == 'worked' ) {
                aw[$scope.activeValue.value] = false;
                $scope.activeAward.workedCount++;
            } else {
                if ( !$scope.activeValue.worked ) {
                    $scope.activeValue.worked = true;
                    $scope.activeAward.workedCount++;
                }
                if ( $scope.activeValue.confirmed )
                    $scope.activeAward.confirmedCount++;
                else
                    $scope.activeAward.confirmedCount--;
            }
            $http.post( '/uwsgi/userSettings',
            { 'token': $scope.user.token,
                'award': $scope.activeAward.name,
                'value': $scope.activeValue.value,
                'confirmed': $scope.activeValue.confirmed == true
            } );
        }
        $scope.user.awards = $scope.userAwards;
        saveUserData( $scope.user );
    }

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

