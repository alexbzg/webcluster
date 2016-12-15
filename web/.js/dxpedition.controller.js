angular
    .module( 'adxcApp' )
    .controller( 'dxpeditionController', dxpeditionController );

function dxpeditionController( User, Head, DXpedition, DXpeditionAdmin, $q ) {    
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
        vm.newCallsign = vm.newCallsign.toUpperCase();
        var css = vm.newCallsign.split( /[,; ]+/ );
        var chain = $q.when();
        css.forEach( function( callsign ) {
            var newItem = { callsign: callsign,
                descr: vm.newDescr, 
                link: vm.newLink,
                dt_begin: vm.newDtBegin ? moment( vm.newDtBegin ).format( 'L' ) : null, 
                dt_end: vm.newDtEnd ? moment( vm.newDtEnd ).format( 'L' ) : null };
            chain = chain.then( function() {
                return DXpeditionAdmin.saveItem( newItem );
            });
        });
        chain = chain.then( function() {
                    vm.newCallsign = null;
                    vm.newDescr = null;            
                    vm.newLink = null;
                    load();
                } );
    }
     
}

