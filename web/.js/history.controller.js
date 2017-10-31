angular
    .module( 'adxcApp' )
    .controller( 'historyController', historyController );

historyController.$inject = [ '$scope', 'User', 'Head', 'Awards', 'History', 'LoadingScreen',
    'SpotAwards' ];

function historyController( $scope, User, Head, Awards, History, LoadingScreen, SpotAwards ) {    
    var vm = this;
    vm.activeAwardChanged = activeAwardChanged;
    vm.activeAward = null;
    vm.dxFiltered = [];
    vm.replace0 = replace0;

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
   

    function activeAwardChanged() {
        vm.dxFiltered = [];
        var lists = [];
        var awards = [];
        if ( vm.activeAward.list_id )
            lists = [ User.data.lists.find( 
                function( list ) { return list.id == vm.activeAward.list_id; } ) ];
        else
            awards = [ vm.activeAward.name ];
        History.data.forEach( function( spot ) {
            if ( awards.length > 0 && !(awards[0] in spot._awards ) )
                return;
            SpotAwards.processSpot( spot, awards, lists );
            if ( spot.awards.length > 0 )
                vm.dxFiltered.push( spot );
        });
    }

}
