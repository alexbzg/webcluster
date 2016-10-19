angular
    .module( 'adxcApp' )
    .controller( 'clusterController', clusterController );

function clusterController( User ) {
    var mv = this;
    mv.user = User;

    return mv;
}

