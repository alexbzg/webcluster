angular
    .module( 'adxcApp' )
    .service( 'DXpeditionAdmin', DXpeditionAdminService );

    DXpeditionAdminService.$inject = [ 'User' ];


function DXpeditionAdminService( User  ) {
    return {
        saveItem: saveItem,
        deleteItem: deleteItem
    };

    function toServer( data ) {
        data['dxpedition'] = 'admin';
        return User.saveData( data );
    }

    function saveItem( item ) {
        return toServer( item );
    }

    function deleteItem( item ) {
        return toServer( { 'delete': 1, 'callsign': item.callsign } );
    }

}
 
