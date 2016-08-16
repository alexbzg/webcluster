var awardsApp = angular.module( 'awardsApp', ['colorpicker.module'] );

awardsApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

    if ( !( $scope.user = getUserData() ) )    
        $window.location.href = "http://adxcluster.com/login.html";

    if ( 'awardsSettings' in $scope.user )
        $scope.awardsSettings = $scope.user.awardsSettings;
    else
        $scope.awardsSettings = {};

    if ( 'awards' in $scope.user && $scope.user.awards != null )
        $scope.userAwards = $scope.user.awards;
    else
        $scope.userAwards = {};

    $scope.params = {};
    location.search.substr(1).split("&").forEach(function(item) 
            {$scope.params[item.split("=")[0]] = item.split("=")[1]});

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

    $scope.loading = true;
    $http.get( '/awardsValues.json' ).then( function( response ) {
            $scope.loading = false;
            $scope.awardsValues = response.data;
            $scope.awardsValues.forEach( function( award ) {
                award.workedCount = 0;
                award.confirmedCount = 0;
                if ( $scope.params.award == award.name )
                    $scope.activeAward = award;
                if ( !( award.name in $scope.awardsSettings ) )
                    $scope.awardsSettings[award.name] = 
                        { 'track': true, 'color': '#770000' };
                if ( !( award.name in $scope.userAwards ) )
                    $scope.userAwards[award.name] = {};
                award.values.forEach( function( av ) {
                    if ( av.value in $scope.userAwards[award.name] ) {
                        av.worked = true;
                        award.workedCount++;
                        av.confirmed = $scope.userAwards[award.name][av.value].confirmed;
                        av.workedCS = $scope.userAwards[award.name][av.value].workedCS;
                        if ( av.confirmed )
                            award.confirmedCount++;
                    }
                    if ( $scope.activeAward == award && $scope.params.value == av.value )
                        $scope.activeValue = av;
                });
            });
           
    });

    $scope.setActiveValue = function( value ) {
        if ( typeof value == 'object' )
            $scope.activeValue = value;
        else {
            var search = value.replace( /\s/g, '' ).replace( /\u00D8/g, '0' );
            var eg = $scope.activeAward.values[0].value;
            if ( !search.includes( '-' ) && eg.includes( '-' ) ) {
                var hpos = eg.indexOf( '-' );
                search = [search.slice( 0, hpos ), '-', search.slice( hpos )].join('');
            } else if ( search.includes( '-' ) && !eg.includes( '-' ) )
                search = search.replace( /-/g, '' );
            if ( found = $scope.activeAward.values.find( 
                function( x ) { return x.value === search; } ) ) {
                $scope.activeValue = found;
                $scope.searchValue = null;
            }
        }
    };

    function saveUserAwards( noPost ) {
        $scope.user.awards = $scope.userAwards;
        saveUserData( $scope.user );
        if ( !noPost )
            $http.post( '/uwsgi/userSettings',
            { 'token': $scope.user.token,
                'award': $scope.activeAward.name,
                'value': $scope.activeValue.value,
                'confirmed': $scope.activeValue.confirmed == true,
                'workedCS': $scope.activeValue.workedCS 
            } );
    }

    $scope.saveWorkedCS = function() {
        if ( $scope.activeValue.workedCS  ) {
            if ( !$scope.activeValue.worked ) {
                $scope.activeValue.worked = true;
                $scope.modifyActiveValue( 'worked' );
            } else {
                $scope.userAwards[$scope.activeAward.name][$scope.activeValue.value].workedCS = 
                    $scope.activeValue.workedCS;
                saveUserAwards();
            }
        }
    }

    $scope.modifyActiveValue = function( param ) {
        var aw = $scope.userAwards[$scope.activeAward.name];
        if ( param == 'worked' && !$scope.activeValue.worked ) {
            if ( $scope.activeValue.confirmed ) {
                $scope.activeAward.confirmedCount--;
                $scope.activeValue.confirmed = false;
            }
            $scope.activeValue.workedCS = null;
            $scope.activeAward.workedCount--;
            delete aw[$scope.activeValue.value];
            $http.post( '/uwsgi/userSettings',
            { 'token': $scope.user.token,
                'award': $scope.activeAward.name,
                'value': $scope.activeValue.value,
                'delete': true
            } );
            saveUserAwards( true );
       } else {
            if ( param == 'worked' ) {
                aw[$scope.activeValue.value] = { 'confirmed': false, 'workedCS': '' };
                $scope.activeAward.workedCount++;
            } else {
                if ( !$scope.activeValue.worked ) {
                   $scope.activeValue.worked = true;
                   $scope.activeAward.workedCount++;
                }
                if ( $scope.activeValue.confirmed ) {
                    $scope.activeAward.confirmedCount++;
                    aw[$scope.activeValue.value] = { 'confirmed': true, 
                        'workedCS': $scope.activeValue.workedCS };
                } else {
                    $scope.activeAward.confirmedCount--;
                    aw[$scope.activeValue.value].confirmed = false;
                }
            }
            saveUserAwards();
        }
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

