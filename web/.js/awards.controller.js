angular
    .module( 'adxcApp' )
    .controller( 'awardsController', awardsController );

function awardsController( DxConst, User, Awards, Head ) {
    var vm = this;
    vm.user = User;
    vm.awards = [];
    vm.openSetup = openSetup;

    activate();
    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - Awards' );
        Awards.getAwards()
            .then( function( data ) {
                data.forEach( function( award ) {
                    var country = vm.awards.find( function( item ) {
                        return item.country == award.country && item.membersList == award.membersList; } );
                    if ( !country ) {
                        country = { country: award.country, membersList: award.membersList, awards: [] };
                        vm.awards.push( country );
                    }
                    country.awards.push( award );
                } );
                vm.awards.forEach( function( country ) {
                    if ( !country.country )
                        country.country = undefined;
                });
            });
     }

    function openSetup( award ) {
        vm.setupAward = { name: award.name, 
            settings: User.data.awardsSettings[award.name].settings };
    }


   
}

