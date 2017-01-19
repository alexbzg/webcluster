angular
    .module( 'adxcApp' )
    .controller( 'awardsController', awardsController );

awardsController.$inject = [ 'DxConst', 'User', 'Awards', 'Head', 
    'SpecialLists' ];

function awardsController( DxConst, User, Awards, Head, SpecialLists ) {
    var vm = this;
    vm.user = User;
    vm.specialLists = SpecialLists.lists;
    vm.awards = [];
    vm.openSetup = openSetup;

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
    }


    function openSetup( award ) {
        vm.setupAward = { name: award.name, 
            settings: User.data.awardsSettings[award.name].settings };
    }


   
}

