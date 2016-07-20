var chPwdApp = angular.module( 'chPwdApp', [] );



chPwdApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

    $scope.params = {};
    location.search.substr(1).split("&").forEach(function(item) 
            {$scope.params[item.split("=")[0]] = item.split("=")[1]});
   
    if ( !$scope.params.callsign || !$scope.params.token ) 
        console.log( $scope.params )
//        $window.location.href = '/passwordrecovery.html';


   $scope.changePwdClick = function() {
        $http.post( '/uwsgi/changePassword',
        { 'token': $scope.params.token,
            'password': $scope.newPwd,
            'callsign': $scope.params.callsign
        } ).then( function( response ) {
            alert( 'Password changed successfully' );
            console.log( response.data );
            $window.location.href = '/login.html';
        }, function( response ) {
            if ( response.status == "500" || response.status == "502" )
                alert( 'Server error. Please try again later' );
            else {
                alert( response.data );
                $window.location.href = "/passwordrecovery.html";
            }
        });
   }


} );

