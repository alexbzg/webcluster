angular
    .module( 'adxcApp' )
    .directive( 'customChange', customChange );

function customChange() {
      return {
        restrict: 'A',
        link: function (scope, element, attrs) {
                var onChangeHandler = scope.$eval(attrs.customChange);
                element.bind('change', onChangeHandler);
            }
    };
}
