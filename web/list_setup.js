var listApp = angular.module( 'listApp', [ 'ngSanitize' ] );

listApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

    if ( !( $scope.user = getUserData() ) )    
//        console.log( "no user data" );
        $window.location.href = "http://adxcluster.com/login.html";

    if ( !('lists' in $scope.user) || $scope.user.lists == null )
        $scope.user.lists = [];

    $scope.params = {};
    location.search.substr(1).split("&").forEach(function(item) 
            {$scope.params[item.split("=")[0]] = decodeURIComponent( item.split("=")[1] )});

    function fillSwitches( dst ) {
        for ( var field in $scope.const ) {
            if ( !( field in dst ) )
                dst[field] = {};
            $scope.const[field].forEach( function( item ) {
                dst[field][item] = true;
            });
        }
        for ( var n in { 'sound': 1, 'mobile': 1 } )
            dst[n] = { 'wkd': true, 'not': true };
    }


    $scope.const = { 
        'bands': [ '1.8', '3.5', '7', '10', '14', '18', '21', '24', '28', '50', '144' ],
        'modes': [ 'CW', 'SSB', 'RTTY', 'PSK31', 'PSK63', 'PSK125', 'JT65' ] };
    
    $scope.switches = {};
    fillSwitches( $scope.switches );
  
    function updateSwitch( field, value ) {
        var csl = $scope.list.items.length;
        $scope.switches[field][value] = true;
        for ( var co = 0; co < csl; co++ )
            if ( !$scope.list.items[co].settings[field][value] ) {
                $scope.switches[field][value] = false;
                break;
            }
    }

    function updateAllSwitches() {
        for ( var field in $scope.switches )
            for ( var value in $scope.switches[field] )
                updateSwitch( field, value );
    }

    function updateCallsigns() {
        $scope.callsigns = '';
        $scope.list.items.forEach( function( item ) {
            $scope.callsigns += item.callsign;
            if ( item.pfx )
                $scope.callsigns += '*';
            $scope.callsigns += ' ';
        });
    }


    if ( $scope.params.id ) 
        $scope.list = $scope.user.lists.find( 
            function( item ) { return $scope.params.id == item.id; } );

    if ( $scope.list ) {
        if ( !$scope.list.items )
            $scope.list.items = [];
        updateAllSwitches();        
        updateCallsigns();
    } else {
        var no = $scope.user.lists.length + 1;
        var list = { title: 'LIST' + no, no: no, items: [] }
        $scope.user.lists.push( list );
        $scope.list = list;
        saveList();
    }
    $scope.list.titleCache = $scope.list.title;



    function saveList() {
        saveUserData( $scope.user );
        $http.post( '/uwsgi/userSettings',
            { 'token': $scope.user.token,
                'list_id': $scope.list.id ? $scope.list.id : 'new',
                'title': $scope.list.title
            } ).then( function( response ) {
                console.log( response.data );
                if ( !$scope.list.id ) {
                    if ( 'list_id' in response.data )
                        $scope.list.id = response.data.list_id;
                    else 
                        saveError();
                }
            }, saveError );
    };

    function saveError() {
        $window.alert( 'Error saving list. Please try again later.' );
    }

    function saveItem( item ) {
        $http.post( '/uwsgi/userSettings',
            { 'token': $scope.user.token,
                'list_id': $scope.list.id,
                'callsign': item.callsign,
                'settings': item.settings,
                'pfx': item.pfx
            } ).then( function( response ) {
                console.log( response.data );
            } );
    };

    $scope.checkTitle = function() {
        if ( $scope.list.title != $scope.list.titleCache )
            saveList();
    };

    $scope.updateItems = function() {
        var css = $scope.callsigns.split( /[,; ]+/ );
        $scope.list.items = $scope.list.items.filter( 
                function( item ) { return css.indexOf( item.callsign ) > -1 } );
        css.forEach( function( cs ) {
            cs = cs.trim().toUpperCase();            
            var pfx = false;
            if ( cs.indexOf( '*' ) > -1 ) {
                cs = cs.replace( '*', '' );
                pfx = true;
            }
            if ( cs != '' && !$scope.list.items.find( function( item ) { return item.callsign == cs } ) ) {
                var listItem = { callsign: cs, pfx: pfx, settings: {} };
                fillSwitches( listItem.settings );
                $scope.list.items.push( listItem );
                saveItem( listItem );
            }
        });
    };

    $scope.deleteItem = function( listItem ) {
        if ( $window.confirm( 'Do you really want to remove callsign ' + listItem.callsign +
                ( listItem.pfx ? '*' : '' ) +
                ' from the list?' ) ) {
            var i = $scope.list.items.indexOf( listItem );
            $scope.list.items.splice( i, 1 );
            updateAllSwitches();
            updateCallsigns();
        }
      
    };


    $scope.itemChanged = function( item, field, value ) {
        if ( item.settings[field][value] )
            updateSwitch( field, value );
        else
            $scope.switches[field][value] = false;
    };

    $scope.switch = function( field, value ) {
        $scope.list.items.forEach( function( item ) {
            item.settings[field][value] = $scope.switches[field][value];
        });
    };
});
