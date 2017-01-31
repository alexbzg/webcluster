angular
    .module( 'adxcApp' )
    .service( 'SpecialLists', SpecialListsService );


SpecialListsService.$inject = [ 'DataServiceFactory', 'Awards', '$rootScope' ];

function SpecialListsService( DataServiceFactory, Awards, $rootScope ) {
    var s = DataServiceFactory();
    s.url = '/specialLists.json';
    s.eventName = 'special-lists-updated';
    s.lists = { DXpedition: { fullTitle: 'Updated DXpeditions List', admin: true, 
                    color: '#f600df' },
        Special: { fullTitle: 'Autoupdating special calls list', color: '#ffa700',
            'noStats': true },
        'DX': { fullTitle: 'User DX Favourites', color: '#ffa700', noStats: true }
   
    };
    s.processData = processData;

    var dxF = [];
    Awards.loadValues()
        .then( function( data ) {
            var dxcc = ( data.filter( function( award ) {
                return award.name == 'DXCC';
            }) )[0];
            dxcc.values.forEach( function( av ) {
                dxF.push( { callsign: av.value } );
            });
            if ( s.data )
                s.data['DX'] = dxF;
            $rootScope.$emit(s.eventName);
        });
   
    return s;

    function processData() {
        s.data.DXpedition = s.data.DXpedition.filter( function( item ) {
            return moment( item.dt_end ).add( 1, 'weeks' ) > moment();
        });
        s.data['DX'] = dxF;
    }

}   
 
