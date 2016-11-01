angular
    .module('adxcApp')
    .directive('loadingScreen', loadingScreen );

function loadingScreen() {
    return {
        restrict: 'E',
        templateUrl: '/.tmplts/loadingScreen.html',
        controller: loadingScreenCtrl,
        controllerAs: 'dvm',
        bindToController: true
    };

    function loadingScreenCtrl( LoadingScreen ) {
        var vm = this;
        vm.loading = LoadingScreen;

        return vm;
    }
}
