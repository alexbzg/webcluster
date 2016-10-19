angular
    .module( 'adxcApp' )
    .controller( 'menuController', menuController );

function menuController( User ) {
    var mv = this;
    mv.user = User;
    mv.user.fromStorage();
}
