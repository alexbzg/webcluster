angular
    .module( 'adxcApp' )
    .controller( 'loginController', loginController );

var rcCallback;
var rcExpired;

function profileController( $scope, $state, User, Head ) {    
    var vm = this;    
    rcCallback = _rcCallback;
    rcExpired = _rcExpired;
    vm.login = login;
    vm.loginButtonVisible = loginButtonVisible;

    init();
    return vm;

    function init() {
        if ( User.loggedIn ) {
            $state.go( 'main' );
            return;
        }

        vm.user = { 'callsign': '', 'password': '', 'register': false,
                    'recaptcha': false, 'email': '' };
        vm.remember = false;
    }

    function _rcCallback( response ) {
        vm.user.recaptcha = response;
        $scope.$apply();
    }

    function _rcExpired = function() {
        vm.user.recaptcha = '';
        $scope.$apply();
    }

    function login() {
        User.login( vm.user )
            .then( function( r ) {
                if ( r )
                    $state.go( 'main' );
                else
                    grecaptcha.reset();
            });

        $http.post( '/uwsgi/login', $scope.user ).then( function( response ) {
            userData = response.data;
            userData['remember'] = $scope.remember;
            saveUserData( userData );
            $window.location.href = "http://adxcluster.com";
        }, function( response ) {
            grecaptcha.reset();
             if ( response.status == "500" || response.status == "502" )
                alert( 'Server error. Please try again later' );
            else
                alert( response.data );
       });
    }
   

    function loginButtonVisible() {
        if ( vm.user.register )
            return vm.user.recaptcha != '' &&
                validateEmail( vm.user.email ) &&
                vm.user.callsign.length > 2 && 
                vm.user.password.length > 5;
        else 
            return vm.user.callsign.length > 2;
    }


}

