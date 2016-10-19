angular
    .module( 'adxcApp', ['ui.router'] )
    .config( config );

function config( $stateProvider, $urlRouterProvider ) {

    $urlRouterProvider.otherwise('/');

    var mainState = {
        name: 'main',
        url: '/',
        templateUrl: '/.tmplts/index.html',
        controller: 'clusterController',
        controllerAs: 'vm'
    };

    var statsState = {
        name: 'stats',
        url: '/stats',
        template: '<h3>stats</h3>' };

    $stateProvider.state( mainState );
    $stateProvider.state( statsState );


}
