angular
    .module( 'adxcApp' )
    .controller( 'statsController', statsController );

function statsController( $stateParams, DxConst, User, Head ) {    
    var vm = this;
    vm.user = User;

    activate();
    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - Stats' );

    }
}
