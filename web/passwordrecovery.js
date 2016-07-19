var pwdRecApp = angular.module( 'pwdRecApp', [] );
var rcCallback;
var rcExpired;

pwdRecApp.controller( 'bodyCtrl', function( $scope, $http ) {

    $scope.send = function() {
        $scope.sending = true;
        $http.post( '/uwsgi/recoverPassword', 
                { 'callsign': $scope.callsign, 'recaptcha': $scope.recaptcha }  
                ).then( function( response ) {
            alert( 'Message with password change token was sent to your email' );
            grecaptcha.reset();
            $scope.recaptcha = '';
            $scope.sending = false;
        }, function( response ) {
            if ( response.status == '500' || response.status == "502")
                alert( 'Server error. Please try again later.' );
            else
                alert( response.data );
            grecaptcha.reset();
            $scope.recaptcha = '';
            $scope.sending = false;
       });
    }

    rcCallback = function( response ) {
        $scope.recaptcha = response;
        $scope.$apply();
    }

    rcExpired = function() {
        $scope.recaptcha = '';
        $scope.$apply();
    }

    $scope.recaptcha = '';
    $scope.callsign = '';
    $scope.sending = false;


} );

