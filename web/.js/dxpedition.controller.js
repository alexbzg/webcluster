angular
    .module( 'adxcApp' )
    .controller( 'dxpeditionController', dxpeditionController );

dxpeditionController.$inject = [ 'User', 'Head', 'SpecialLists', 
    'DXpeditionAdmin', '$q' ];    
   

function dxpeditionController( User, Head, SpecialLists, DXpeditionAdmin, $q ) {    
    var vm = this;
    vm.insertItem = insertItem;
    vm.deleteItem = deleteItem;
    vm.openItem = openItem;

    activate();
    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - DXpedition settings' );
        load();
    }

    function load() {
        SpecialLists.load()
            .then( function() { 
                vm.dxpedition = SpecialLists.data.DXpedition;
            } );
    }

    function deleteItem( item ) {
        DXpeditionAdmin.deleteItem( item )
            .then( load );
    }

    function openItem( item ) {
        vm.newCallsign = item.callsign;
        vm.newDescr = item.descr;
        vm.newLink = item.link;
        vm.newDtBegin = item.dt_begin;
        vm.newDtEnd = item.dt_end;
    }

    function insertItem() {
        if ( vm.newLink && vm.newLink.indexOf( 'http://' ) != 0 && 
                vm.newLink.indexOf( 'https://' ) != 0 ) 
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

