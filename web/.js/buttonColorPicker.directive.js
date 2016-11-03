angular
    .module('adxcApp')
    .directive('buttonColorPicker', buttonColorPicker );

function buttonColorPicker() {
    return {
        restrict: 'E',
        scope: { 
            value: '=',
            change: '&'
        },
        templateUrl: '/.tmplts/buttonColorPicker.html',
    };

}
