angular
    .module( 'adxcApp' )
    .controller( 'menuController', menuController );

menuController.$inject = [ 'User', '$state' ];
   
function menuController( User, $state ) {
    var vm = this;
    vm.user = User;
    vm.user.fromStorage();
    vm.state = $state;

    return vm;
}
