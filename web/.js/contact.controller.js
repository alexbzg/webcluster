angular
    .module( 'adxcApp' )
    .controller( 'contactController', contactController );

function contactController( vcRecaptchaService, User, Head, $http ) {    
    var vm = this;
    vm.user = User;
    vm.sendEmail = sendEmail;
    vm.rcExpired = rcExpired;
    vm.sendButtonVisible = sendButtonVisible;
    vm.email = { from: '', text: '', recaptcha: '' };
    vm.sending = false;

    return vm;


    function sendEmail() {
        vm.sending = true;
        $http.post( '/uwsgi/contact', vm.email )
            .then( function( response ) {
                if ( response.data == 'OK' ) {
                    alert( 'Your message is sent.' );
                    vm.email.text = '';
                } else
                    alert( 'Your message could not be sent. Please try again later.' );
                
            })
            .catch( function( response ) {
                alert( 'Your message could not be sent. Please try again later.' );
            })
            .finally( function() {
                vcRecaptchaService.reload(vm.widgetId);
                vm.email.recaptcha = '';
                vm.sending = false;
            });
    }

    function rcExpired() {
        vcRecaptchaService.reload(vm.widgetId);
        vm.email.recaptcha = '';
    }


    function sendButtonVisible() {
        return vm.email.recaptcha != '' &&
            validateEmail( vm.email.from ) &&
            vm.email.text != '' &&
            !vm.sending;
    }

}

