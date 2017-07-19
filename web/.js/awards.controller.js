angular
    .module( 'adxcApp' )
    .controller( 'awardsController', awardsController );

awardsController.$inject = [ 'DxConst', 'User', 'Awards', 'Head', 
    'SpecialLists', '$window' ];

function awardsController( DxConst, User, Awards, Head, SpecialLists, $window ) {
    var vm = this;
    vm.user = User;
    vm.specialLists = SpecialLists.lists;
    vm.awards = [];
    vm.openSetup = openSetup;
    vm.trackAllChanged = trackAllChanged;

    activate();
    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - Awards' );
        Awards.onUpdate( createAwards );
    }

    function createAwards() {
        vm.awards = [];
        Awards.data.forEach( function( award ) {
            var ac = award.displayCountry ? award.displayCountry : award.country;
            var country = vm.awards.find( function( item ) {
                return item.country == ac && 
                    item.membersList == award.membersList; } );
            if ( !country ) {
                country = { country: ac, 
                    membersList: award.membersList, 
                    awards: [] };
                vm.awards.push( country );
            }
            country.awards.push( award );
        } );
        vm.awards.forEach( function( country ) {
            if ( !country.country )
                country.country = undefined;
        });
        vm.awards.sort( function( a, b ) {
            if ( a.country && b.country ) {
                if ( a.country < b.country )
                    return -1;
                if ( a.country == b.country )
                    return 0;
                else
                    return 1;
            } 
            if ( a.country ) {
                if ( b.membersList )
                    return -1;
                else
                    return 1;
            }
            if ( b.country ) {
                if ( a.membersList )
                    return 1;
                else
                    return -1;
            }
            if ( a.membersList ) {
                if ( b.membersList )
                    return 0;
                else
                    return 1;
            }
            if ( b.membersList ) {
                if ( a.membersList )
                    return 0;
                else
                    return -1;
            }
            return 0;
        } );
    }


    function openSetup( award ) {
        vm.setupAward = { name: award.name, 
            settings: User.data.awardsSettings[award.name].settings };
    }

    function trackAllChanged() {
        if ( $window.confirm( 
                    "This change will affect track settings of ALL awards." +  
                    "Do you really want to proceed?" ) ) {
            Awards.data.forEach( function( award ) {
                User.data.awardsSettings[award.name].track = vm.trackAll;
            });
            User.data.lists.forEach( function( list ) {
                list.track = vm.trackAll;
            });
        }
    }
   
}

