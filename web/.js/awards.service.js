angular
    .module('adxcApp')
    .service('Awards', AwardsService);

AwardsService.$inject = ['$http', 'DataServiceFactory' ];

function AwardsService( $http, DataServiceFactory ) {
    var s = DataServiceFactory();
    s.url = '/awards.json';
    s.eventName = 'awards-list-updated';
    s.loadValues = loadValues;
    return s;

    function loadValues() {
        return $http.get( '/awardsValues.json' )
            .then(loadValuesComplete)
            .catch(loadValuesFailed);

        function loadValuesComplete(response) {
            return response.data;
        }

        function loadValuesFailed(error) {
            console.log('Awards values XHR Failed: ' + error.data);
        }
    }
}
