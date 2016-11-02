angular
    .module( 'adxcApp', ['ui.router', 'colorpicker.module', 'vcRecaptcha'] )
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
        templateUrl: '/.tmplts/stats.html',
        controller: 'statsController',
        controllerAs: 'vm',
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
        url: '/list_setup/:id',
        templateUrl: '/.tmplts/list_setup.html',
        controller: 'listSetupController',
        controllerAs: 'vm',
    };
  
    var profileState = {
        name: 'profile',
        url: '/profile',
        templateUrl: '/.tmplts/profile.html',
        controller: 'profileController',
        controllerAs: 'vm',
    };

    var loginState = {
        name: 'login',
        url: '/login',
        templateUrl: '/.tmplts/login.html',
        controller: 'loginController',
        controllerAs: 'vm',
    };

    var contactState = {
        name: 'contact',
        url: '/contact',
        templateUrl: '/.tmplts/contact.html',
        controller: 'contactController',
        controllerAs: 'vm',
    };

    var infoState = {
        name: 'info',
        url: '/info',
        templateUrl: '/.tmplts/info.html'
    };

    $stateProvider.state( loginState );
    $stateProvider.state( mainState );
    $stateProvider.state( statsState );
    $stateProvider.state( awardsState );
    $stateProvider.state( listSetupState );
    $stateProvider.state( profileState );
    $stateProvider.state( contactState );
    $stateProvider.state( infoState );


}
