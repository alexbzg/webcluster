angular
    .module( 'adxcApp' )
    .controller( 'dxpeditionController', dxpeditionController );

function dxpeditionController( User, Head, DXpedition, DXpeditionAdmin ) {    
    var vm = this;
    vm.insertItem = insertItem;
    vm.deleteItem = deleteItem;

    activate();
    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - DXpedition settings' );
        load();
    }

    function load() {
        DXpedition.load()
            .then( function() { 
                vm.dxpedition = DXpedition.dxpedition; 
            } );
    }

    function deleteItem( item ) {
        DXpeditionAdmin.deleteItem( item )
            .then( load );
    }

    function insertItem() {
        if ( vm.newLink && vm.newLink.indexOf( 'http://' ) != 0 )
            vm.newLink = 'http://' + vm.newLink;
        var newItem = { callsign: vm.newCallsign, descr: vm.newDescr, 
            link: vm.newLink,
            dt_begin: vm.newDtBegin ? moment( vm.newDtBegin ).format( 'L' ) : null, 
            dt_end: vm.newDtEnd ? moment( vm.newDtEnd ).format( 'L' ) : null };
        DXpeditionAdmin.saveItem( newItem )
            .then( function() {
                vm.newCallsign = null;
                vm.newDesc = null;            
                load();
            } );
    }
     
}

