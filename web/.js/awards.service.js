angular
    .module('adxcApp')
    .service('Awards', AwardsService);

AwardsService.$inject = ['$http'];

function AwardsService($http) {
    return {
        getAwards: getAwards
    };

    function getAwards( values ) {
        var url = values ? '/awardsValues.json' : '/awards.json';
        return $http.get( url )
            .then(getAwardsComplete)
            .catch(getAwardsFailed);

        function getAwardsComplete(response) {
            return response.data;
        }

        function getAwardsFailed(error) {
            console.log('Awards XHR Failed for getAvengers.' + error.data);
        }
    }
}
