var loginApp = angular.module( 'loginApp', [] );
var rcCallback;
var rcExpired;

function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

loginApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

    if ( $scope.user = getUserData() )    
        $window.location.href = "http://adxcluster.com";


    $scope.user = { 'callsign': '', 'password': '', 'register': false,
        'recaptcha': false, 'email': '' };
    $scope.remember = false;

    rcCallback = function( response ) {
        $scope.user.recaptcha = response;
        $scope.$apply();
    }

    rcExpired = function() {
        $scope.user.recaptcha = '';
        $scope.$apply();
    }

    $scope.login = function() {
        $http.post( '/uwsgi/login', $scope.user ).then( function( response ) {
            userData = response.data;
            userData['remember'] = $scope.remember;
            saveUserData( userData );
            $window.location.href = "http://adxcluster.com";
        }, function( response ) {
            grecaptcha.reset();
            alert( response.data);
       });
    }
   

    $scope.loginBtnVsbl = function() {
        if ( $scope.user.register )
            return $scope.user.recaptcha != '' &&
                validateEmail( $scope.user.email ) &&
                $scope.user.callsign.length > 2 && 
                $scope.user.password.length > 5;
        else {
            return $scope.user.callsign.length > 2;
        }
    }


} );

