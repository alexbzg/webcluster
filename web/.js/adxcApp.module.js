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
        url: 'stats',
        templateUrl: '/.tmplts/stats.html',
        params: {
            award: null,
            value: null,
            band: null,
            mode: null,
            list_id: null }
    };

    $stateProvider.state( mainState );
    $stateProvider.state( statsState );


}
