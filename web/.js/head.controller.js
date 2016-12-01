angular
    .module( 'adxcApp' )
    .controller( 'headController', headController );

function headController( Head ) {
    var vm = this;
    vm.head = Head;
    return vm;
}
