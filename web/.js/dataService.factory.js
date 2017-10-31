angular
    .module('adxcApp')
    .factory('DataServiceFactory', DataServiceFactory);

DataServiceFactory.$inject = ['$http', '$rootScope', 'Notify' ];

function DataServiceFactory( $http, $rootScope, Notify ) {
    return createDataService;

    function createDataService() {
        var s = { lasModified: null,
                            load: load,
                            data: null,
                            url: null,
                            eventName: null,
                            processData: function() {},
                            onUpdate: onUpdate };


        return s;
    

        function onUpdate( callback, scope ) {
            Notify.notify( s.eventName, callback, scope );
            if ( s.data )
                callback();
        }


        function load() {
            return $http.get( s.url )
                .then(loadComplete)
                .catch(loadFailed);

            function loadComplete(response) {
                if ( s.lastModified != response.headers( 'last-modified' ) ) {
                    s.lastModified =  response.headers( 'last-modified' );
                    s.data = response.data;
                    s.processData();
                    $rootScope.$emit(s.eventName);
                }
                return response.data;
            }

            function loadFailed(error) {
                console.log( s.url + ' XHR Failed: ' + error.data);
            }
        }
    }
}
