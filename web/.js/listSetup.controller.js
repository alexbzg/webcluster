angular
    .module( 'adxcApp' )
    .controller( 'listSetupController', listSetupController );

listSetupController.$inject = [ '$state', '$stateParams', '$window', 'DxConst', 
    'User', 'Head' ];   
   

function listSetupController( $state, $stateParams, $window, DxConst, User, Head ) {    
    var vm = this;
    var titleCache = { title: '', full_title: '' };
    vm.user = User;
    vm.switchesList = { bands: DxConst.bands, modes: DxConst.modes };
    vm.switches = {};
    vm.updateItems = updateItems;
    vm.checkTitle = checkTitle;
    vm.itemChanged = itemChanged;
    vm.switch = _switch;
    vm.deleteItem = deleteItem;

    activate();
    return vm;

    function activate() {
        fillSwitches( vm.switches );

        if ( $stateParams.id ) 
            vm.list = User.data.lists.find( 
                function( item ) { return $stateParams.id == item.id; } );

        if ( vm.list ) {
            vm.list.no = User.data.lists.indexOf( vm.list ) + 1;
            if ( !vm.list.items )
                vm.list.items = [];
            updateAllSwitches();        
            vm.list.items.forEach( function( item ) {
                if ( !item.settings ) {
                    item.settings = {};
                    fillSwitches( item.settings );
                }
            });
        } else {
            User.createList()
                .then( function( id ) {
                    if ( id )
                        $state.go( 'listSetup', { id: id } );
                    else
                        $state.go( 'awards' );
                });
            return;
        }
        for ( var field in titleCache )
            titleCache[field] = vm.list[field];

        Head.setTitle( 'ADXCluster.com - List # ' + vm.list.no + ' - settings' );
    }

    function fillSwitches( dst ) {
        for ( var field in vm.switchesList ) {
            if ( !( field in dst ) )
                dst[field] = {};
            vm.switchesList[field].forEach( function( item ) {
                dst[field][item] = item in vm.switches[field] ? 
                    vm.switches[field][item] : true;
            });
        }
        for ( var n in { 'sound': 1, 'mobile': 1 } )
            dst[n] = { 'wkd': true, 'not': true };
    }

    function updateSwitch( field, value ) {
        const csl = vm.list.items.length;
        const setSwitchValue = function( swVal ) {
            if ( field === 'mixMode' )
                vm.switches.mixMode = swVal;
            else
                vm.switches[field][value] = swVal;
        };
        setSwitchValue( true );
        for ( var co = 0; co < csl; co++ )
            if ( vm.list.items[co].settings && !vm.list.items[co].settings.hide &&
                    !( ( field === 'mixMode' && vm.list.items[co].settings.mixMode ) ||
                    ( field !== 'mixMode'  && vm.list.items[co].settings[field][value] ) ) ) {
                setSwitchValue( false )
                break;
            }
    }

    function updateAllSwitches() {
        for ( var field in vm.switches )
            for ( var value in vm.switches[field] )
                updateSwitch( field, value );
    }

    function checkTitle() {
        if ( vm.list.title == 'DXpedition' || vm.list.title == 'Special' ) {
            $window.alert( 'This list title is reserved by system. Please choose any other title' );
            vm.list.title = '';
            return;
        }
        var fl = false;
        for ( var field in titleCache )
            if ( titleCache[field] != vm.list[field] ) {
                titleCache[field] = vm.list[field];
                fl = true;
            }
        if (fl)
            User.saveList( vm.list );
    }

    function updateItems() {
        var css = vm.callsigns.split( /[,; ]+/ );
        css.forEach( function( cs ) {
            cs = cs.trim().toUpperCase();            
            if ( cs != '' && 
                    !vm.list.items.find( function( item ) { 
                        return item.callsign == cs } ) ) {
                var listItem = { callsign: cs, settings: {} };
                fillSwitches( listItem.settings );
                vm.list.items.push( listItem );
                User.saveListItem( listItem, vm.list );
            }
        });
        vm.callsigns = '';
    }

    function deleteItem( item ) {
        if ( $window.confirm( 'Do you really want to remove callsign ' + 
            item.callsign + ( item.pfx ? '*' : '' ) + ' from the list?' ) ) {
            if ( vm.list.special ) {
                item.settings.hide = true;
                User.saveListItem( item, vm.list );
            } else 
                User.deleteListItem( item, vm.list );
            updateAllSwitches();
        }
    }


    function itemChanged( item, field, value ) {
        User.saveListItem( item, vm.list );
        if (field === 'mixMode') {
            if (item.settings.mixMode)
                updateSwitch( 'mixMode' );
            else
                vm.switches.mixMode = false;
        } else {
            if ( item.settings[field][value] )
                updateSwitch( field, value );
            else
                vm.switches[field][value] = false;
        }
    }

    function _switch( field, value ) {
        vm.list.items.forEach( function( item ) {
            if ( !item.settings.hide ) {
                if ( field === 'mixMode' ) {
                    if ( item.settings[field][value] != vm.switches[field][value] ) 
                        item.settings[field][value] = vm.switches[field][value];
                } else {
                    if ( item.settings.mixMode != vm.switches.mixMode ) 
                        item.settings.mixMode = vm.switches.mixMode;
                }
            }
        });
        User.saveAllListItems( vm.list );
       
    }
  
}

