angular
    .module( 'adxcApp' )
    .controller( 'clusterController', clusterController );

function clusterController( $interval, $timeout, User, DX ) {
    var vm = this;
    vm.user = User;
    vm.dx = DX;
    vm.dxFilter = dxFilter;
    vm.replace0 = replace0;

    DX.load();
    $interval( DX.load, 1000 );

    updateTime();
   
    return vm;

    function dxFilter( dx ) {
        return true;
    }

    function replace0( str ) {
        return str == null ? null : str.replace( /0/g, '\u00D8' );
    }   

    function updateTime() {
        var n = new Date();
        var min = n.getUTCMinutes();
        if ( min < 10 ) min = "0" + min;
        var hr = n.getUTCHours();
        if ( hr < 10 ) hr = "0" + hr;
        vm.time = hr + ':' + min;
        $timeout( updateTime, ( 60 - n.getUTCSeconds() ) * 1000 );
    }
   
}




