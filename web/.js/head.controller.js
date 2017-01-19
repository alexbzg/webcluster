angular
    .module( 'adxcApp' )
    .controller( 'headController', headController );

headController.$inject = [ 'Head' ];


function headController( Head ) {
    var vm = this;
    vm.head = Head;
    return vm;
}
