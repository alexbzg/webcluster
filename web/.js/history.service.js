angular
    .module('adxcApp')
    .service('History', HistoryService);

HistoryService.$inject = ['$http', 'DataServiceFactory' ];

function HistoryService( $http, DataServiceFactory ) {
    var s = DataServiceFactory();
    s.url = '/history.json';
    s.eventName = 'history-updated';
    return s;
}
