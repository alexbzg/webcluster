angular
    .module( 'adxcApp' )
    .controller( 'headController', headController );

function headController( Head ) {
    var mv = this;
    mv.head = Head;
}
