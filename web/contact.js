var contactApp = angular.module( 'contactApp', [ 'ngSanitize' ] );
var rcCallback;
var rcExpired;

function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

contactApp.controller( 'bodyCtrl', function( $scope, $http ) {

    $scope.user = getUserData();
    $scope.logout = function() {
        logoutUser();
        window.location.href = "http://adxcluster.com/login.html";
    }

    $scope.sendEmail = function() {
        $scope.sending = true;
        $http.post( '/uwsgi/contact', $scope.email ).then( function( response ) {
            if ( response.data == 'OK' ) {
                alert( 'Your message is sent.' );
                $scope.email.text = '';
            }
            else
                alert( 'Your message could not be sent. Please try again later.' );
            grecaptcha.reset();
            $scope.email.recaptcha = '';
            $scope.sending = false;
        }, function( response ) {
            alert( 'Your message could not be sent. Please try again later.' );
            grecaptcha.reset();
            $scope.email.recaptcha = '';
            $scope.sending = false;
       });
    }

    rcCallback = function( response ) {
        $scope.email.recaptcha = response;
        $scope.$apply();
    }

    rcExpired = function() {
        $scope.email.recaptcha = '';
        $scope.$apply();
    }

    $scope.email = { from: '', text: '', recaptcha: '' };
    $scope.sending = false;

    $scope.sendBtnVsbl = function() {
        return $scope.email.recaptcha != '' &&
            validateEmail( $scope.email.from ) &&
            $scope.email.text != '' &&
            !$scope.sending;
    }

} );

