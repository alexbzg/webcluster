angular
    .module( 'adxcApp' )
    .controller( 'listSetupController', listSetupController );

function listSetupController( $stateParams, DxConst, User, Head ) {    
    var vm = this;
    vm.user = User;
    vm.switchesList = { bands: DxConst.bands, modes: DxConst.modes };
    vm.switches = {};

    activate();
    return vm;

    function activate() {
        fillSwitches( vm.switches );

        if ( $stateParams.id ) 
            vm.list = user.data.lists.find( 
                function( item ) { return $stateParams.id == item.id; } );

        if ( vm.list ) {
            vm.list.no = vm.user.lists.indexOf( $scope.list ) + 1;
            if ( !vm.list.items )
                vm.list.items = [];
            updateAllSwitches();        
        } else 
            vm.list = User.createList();
        vm.titleCache = vm.list.title;

        Head.setTitle( 'ADXCluster.com - List # ' + vm.list.no + ' - settings' );
    }

    function fillSwitches( dst ) {
        for ( var field in vm.switchesList ) {
            if ( !( field in dst ) )
                dst[field] = {};
            vm.switchesList[field].forEach( function( item ) {
                dst[field][item] = true;
            });
        }
        for ( var n in { 'sound': 1, 'mobile': 1 } )
            dst[n] = { 'wkd': true, 'not': true };
    }

    function updateSwitch( field, value ) {
        var csl = vm.list.items.length;
        vm.switches[field][value] = true;
        for ( var co = 0; co < csl; co++ )
            if ( !vm.list.items[co].settings[field][value] ) {
                vm.switches[field][value] = false;
                break;
            }
    }

    function updateAllSwitches() {
        for ( var field in vm.switches )
            for ( var value in vm.switches[field] )
                updateSwitch( field, value );
    }

    function checkTitle() {
        if ( vm.list.title != vm.titleCache ) {
            vm.titleCache = vm.list.title;
            User.saveList( vm.list );
        }
    };

    function updateItems() {
        var css = vm.callsigns.split( /[,; ]+/ );
        css.forEach( function( cs ) {
            cs = cs.trim().toUpperCase();            
            var pfx = false;
            if ( cs.indexOf( '*' ) > -1 ) {
                cs = cs.replace( '*', '' );
                pfx = true;
            }
            if ( cs != '' && 
                    !vm.list.items.find( function( item ) { 
                        return item.callsign == cs } ) ) {
                var listItem = { callsign: cs, pfx: pfx, settings: {} };
                angular.extend( listItem.settings, vm.switches );
                vm.list.items.push( listItem );
                User.saveItem( listItem );
            }
        });
        vm.callsigns = '';
    };

    function deleteItem( item ) {
        if ( User.deleteListItem( item, vm.list ) )
            updateAllSwitches();
    };


    function itemChanged( item, field, value ) {
        User.saveListItem( item, vm.list );
        if ( item.settings[field][value] )
            updateSwitch( field, value );
        else
            vm.switches[field][value] = false;
    };

    function _switch( field, value ) {
        vm.list.items.forEach( function( item ) {
            if ( item.settings[field][value] != vm.switches[field][value] ) {
                item.settings[field][value] = vm.switches[field][value];
                User.saveListItem( item, vm.list );
            }
        });
    };
  
}

