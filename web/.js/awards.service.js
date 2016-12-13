angular
    .module('adxcApp')
    .service('Awards', AwardsService);

AwardsService.$inject = ['$http', '$rootScope', 'Notify' ];

function AwardsService( $http, $rootScope, Notify ) {
    var s = { lasModified: null,
                    load: load,
                    awards: null,
                    onUpdate: onUpdate };
    return s;

    function onUpdate( callback, scope ) {
        Notify.notify( 'awards-list-updated', callback, scope );
    }


    function load( values ) {
        var url = values ? '/awardsValues.json' : '/awards.json';
        return $http.get( url )
            .then(getAwardsComplete)
            .catch(getAwardsFailed);

        function getAwardsComplete(response) {
            if ( !values && 
                    ( s.lastModified != response.headers( 'last-modified' ) ) ) {
                s.lastModified =  response.headers( 'last-modified' );
                s.awards = response.data;
                $rootScope.$emit('awards-list-updated');
            }
            return response.data;
        }

        function getAwardsFailed(error) {
            console.log('Awards XHR Failed: ' + error.data);
        }
    }
}
