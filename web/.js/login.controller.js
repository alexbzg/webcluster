angular
    .module( 'adxcApp' )
    .controller( 'loginController', loginController );

loginController.$inject = [ '$scope', '$state', 'vcRecaptchaService', 'User', 
    'Head' ];   


function loginController( $scope, $state, vcRecaptchaService, User, Head ) {    
    var vm = this;    
    rcExpired = rcExpired;
    vm.login = login;
    vm.loginButtonVisible = loginButtonVisible;

    init();
    return vm;

    function init() {
        if ( User.loggedIn() ) {
            $state.go( 'main' );
            return;
        }

        vm.user = { 'callsign': '', 'password': '', 'register': false,
                    'recaptcha': false, 'email': '' };
        vm.remember = true;
        Head.setTitle( 'ADXCluster.com - Login' );
    }

    function rcExpired() {
        vm.user.recaptcha = '';
        vcRecaptchaService.reload(vm.widgetId);
    }

    function login() {
        User.login( vm.user, vm.remember )
            .then( function( r ) {
                if ( r )
                    $state.go( 'main' );
            })
            .catch( function( r ) {
                vcRecaptchaService.reload(vm.widgetId);
                if ( r.status == "500" || r.status == "502" )
                    alert( 'Server error. Please try again later' );
                else
                    alert( r.data );
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

