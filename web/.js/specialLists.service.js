angular
    .module( 'adxcApp' )
    .service( 'SpecialLists', SpecialListsService );


SpecialListsService.$inject = [ 'DataServiceFactory' ];

function SpecialListsService( DataServiceFactory ) {
    var s = DataServiceFactory();
    s.url = '/specialLists.json';
    s.eventName = 'special-lists-updated';
    s.lists = { DXpedition: { fullTitle: 'Updated DXpeditions List', admin: true, 
                    color: '#f600df' },
        Special: { fullTitle: 'Autoupdating special calls list', color: '#ffa700'
        }
    };
    s.processData = processData;
    return s;

    function processData() {
        s.data.DXpedition = s.data.DXpedition.filter( function( item ) {
            return moment( item.dt_end ).add( 1, 'weeks' ) > moment();
        });
    }

}   
 
