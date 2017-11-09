angular
    .module( 'adxcApp' )
    .controller( 'historyController', historyController );

historyController.$inject = [ '$scope', 'User', 'Head', 'Awards', 'History', 'LoadingScreen',
    'SpotAwards', 'DxConst'  ];

function historyController( $scope, User, Head, Awards, History, LoadingScreen, SpotAwards, DxConst ) {    
    var vm = this;
    vm.activeAwardChanged = activeAwardChanged;
    vm.activeAward = null;
    vm.dxFiltered = [];
    vm.replace0 = replace0;
    vm.awardsLoaded = false;
//    vm.selectorChange = selectorChange;
//    vm.selectorInit = selectorInit;

    User.onLogIO( activate, $scope );

    activate();
    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - History' );

        vm.awards = [];

        

        var listCo = 1;
        User.data.lists.forEach( function( list ) {
            if ( list.track ) {
                var listAV = { fullName: list.full_title ? list.full_title : 
                        'List #' + listCo, 
                    name: list.title, byBand: true,
                    stats_settings: list.stats_settings, 
                    values: [], list_id: list.id, country: 'Aaaa' };
                vm.awards.push( listAV );
            }
            listCo++;
        });

        vm.awards = vm.awards.sort( function( a, b ) {
            if ( a.special && !b.special )
                return 1;
            else if ( b.special && !a.special )
                return -1;
            else 
                return a.list_id - b.list_id;
        });
       
        Awards.load() 
            .then( function(data) {
                if ( vm.awardsLoaded )
                    return;
                else
                    vm.awardsLoaded = true;
                data.forEach( function(award) {
                    if ( User.data.awardsSettings[award.name].track )
                        vm.awards.push( award );
                });
            });

        LoadingScreen.on();
        History.load()
            .then( function( data ) {
                data.forEach( function( spot ) {
                    spot._awards = spot.awards;
                });
                LoadingScreen.off();
            });
    }

    function replace0( str ) {
        return str == null ? null : str.replace( /0/g, '\u00D8' );
    }   
/*   
    function selectorInit( $selector ) {
        vm.selector = $selector;
        dxFilter();
    }

    function selectorChange() {
        dxFilter();
    }
    

    function dxFilter() {
        if ( !vm.selector )
            return;
        vm.dxFiltered = vm.dx.filter( vm.selector.spotFilter );
    }
*/
    function activeAwardChanged() {
        var callsigns = {};
        var lists = [];
        var awards = [];
        var bands = {};
        var bandsLength = DxConst.bands.length;
        for ( var c = 0; c < bandsLength; c++ )
            bands[ DxConst.bands[c] ] = c;
        if ( vm.activeAward.list_id )
            lists = [ User.data.lists.find( 
                function( list ) { return list.id == vm.activeAward.list_id; } ) ];
        else
            awards = [ vm.activeAward.name ];
        History.data.forEach( function( spot ) {
            if ( ( awards.length > 0 && !( awards[0] in spot._awards ) ) 
                    || !( spot.band in bands ) )
                return;
            SpotAwards.processSpot( spot, awards, lists );
            if ( spot.awards.length > 0 ) {
                if ( !( spot.cs in callsigns ) ) 
                    callsigns[spot.cs] = {};
                if ( !( spot.band in callsigns[spot.cs] ) )
                    callsigns[spot.cs][spot.band] = {};
                var mode = spot.awards[0].mode || spot.subMode || spot.mode;
                if ( !( mode in callsigns[spot.cs][spot.band] ) )
                    callsigns[spot.cs][spot.band][mode] = [];
                if ( callsigns[spot.cs][spot.band][mode].length < 5 )
                    callsigns[spot.cs][spot.band][mode].push( spot );
            }
        });
        vm.dx = [];
        for ( var cs in callsigns ) {
            var dxItem = { cs: cs, bands: [] };
            for ( var band in callsigns[cs] ) {
                var bandItem = { band: band, dx: [] };
                for ( var mode in callsigns[cs][band] )
                    bandItem.dx = bandItem.dx.concat( callsigns[cs][band][mode] );
                bandItem.dx = bandItem.dx.sort( function( a, b ) {
                    return b.ts - a.ts; } );
                dxItem.bands.push( bandItem );
            }            
            dxItem.band = dxItem.bands.sort( function( a, b ) {
                return bands[ a.band ] - bands[ b.band ]; } );
            vm.dx.push( dxItem );
        }
        vm.dx = vm.dx.sort( function( a, b ) {
            if ( a.cs > b.cs )
                return 1;
            if ( b.cs > a.cs )
                return -1;
            return 0;
        });
    }

}
