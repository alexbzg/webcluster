angular
    .module( 'adxcApp' )
    .controller( 'dxpeditionController', dxpeditionController );

function dxpeditionController( User, Head ) {    
    var vm = this;
    vm.user = User;
    vm.insertItem = insertItem;
    vm.deleteItem = deleteItem;

    activate();
    return vm;

    function activate() {

        vm.dxpedition = User.data.dxpedition;

        Head.setTitle( 'ADXCluster.com - DXpedition settings' );
    }

    function deleteItem( item ) {
        User.deleteItem( item, vm.dxpedition );
    }

    function insertItem() {
        var newItem = { callsign: vm.newCallsign, desc: vm.newDesc,
            dtBegin: vm.newDtBegin, dtEnd: vm.newDtEnd };
        vm.dxpedition.items.push( newItem );
        User.toStorage();
        DXpedition.saveItem( item );
    }
     
}

