angular
    .module( 'adxcApp', ['ui.router', 'colorpicker.module'] )
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

     var awardsState = {
        name: 'awards',
        url: '/awards',
        templateUrl: '/.tmplts/awards.html',
        controller: 'awardsController',
        controllerAs: 'vm'
    };

    var listSetupState = {
        name: 'listSetup',
        url: '/list_setup',
        templateUrl: '/.tmplts/list_setup.html',
        controller: 'listSetupController',
        controllerAs: 'vm',
        params: { id: null }
    };
  

    $stateProvider.state( mainState );
    $stateProvider.state( statsState );
    $stateProvider.state( awardsState );
    $stateProvider.state( listSetupState );


}
