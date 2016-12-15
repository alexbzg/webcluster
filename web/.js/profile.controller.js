angular
    .module( 'adxcApp' )
    .controller( 'profileController', profileController );

function profileController( $scope, User, Head, Awards, LoadingScreen ) {    
    var vm = this;
    vm.user = User;
    vm.adifFileChanged = adifFileChanged;
    vm.validateEmail = validateEmail;
    vm.uploadADIF = uploadADIF;
    vm.changeEmail = changeEmail;
    vm.changePassword = changePassword;
    vm.adifUpdateSelectAllAwards = adifUpdateSelectAllAwards;
    vm.adifToggleSelectAllAwards = adifToggleSelectAllAwards;
    vm.email = User.data.email;
    vm.adif = { file: null, awards: [] };


    activate();

    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - Profile' );
        Awards.onUpdate( adifAwards );
        if ( Awards.awards )
            adifAwards();
    }

    function adifAwards() {
        vm.adif.awards = [];
        Awards.awards.forEach( function( award ) {
            if ( !award.noStats )
                vm.adif.awards.push(
                    { name: award.name, 
                        title: award.fullName + ' (' + award.name + ')',
                        country: award.country,
                        enabled: User.data.awardsSettings[award.name].adif
                        });
        });
        adifUpdateSelectAllAwards();
    }

    

    function validateEmail() {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(vm.email);
    }

    function adifUpdateSelectAllAwards() {
        var l = vm.adif.awards.length;
        vm.adif.selectAllAwards = true;
        for ( var co = 0; co < l; co++ )
            if ( !vm.adif.awards[co].enabled ) {
                vm.adif.selectAllAwards = false;
                break;
            }
    }

    function adifToggleSelectAllAwards() {
        vm.adif.awards.forEach( function( award ) {
            award.enabled = vm.adif.selectAllAwards;
        });
    }


    function adifFileChanged( changeEvent ) {
        var reader = new FileReader();
        reader.onload = function (loadEvent) {
            $scope.$apply(function () {
                vm.adif.file = loadEvent.target.result;
           });
        }
        reader.readAsDataURL(changeEvent.target.files[0]);        
    };

    function uploadADIF() {
        vm.loading = true;
        LoadingScreen.on();
        User.uploadADIF( vm.adif )
            .then( function( newAwards ) {
                if ( newAwards )
                    alert( 'ADIF log was loaded successfully!' );
                else 
                    alert( 'No new callsigns for supported awards were found!' );                
            })
            .catch( function() { alert( 'Error while loading ADIF log!' ) } )
            .finally( function() { LoadingScreen.off() } );
    }

    function changeEmail() {
        User.changeEmail( vm.email )
            .then( function( r ) { if ( r ) alert( 'Email changed successfully' ); } );
    }

    function changePassword() {
        User.changePassword( vm.newPwd, vm.oldPwd )
            .then( function( r ) {
                if ( r ) alert( 'Password changed successfully' );
            } )
            .catch( function( response ) {
                if ( response.status == "500" || response.status == "502" )
                    alert( 'Server error. Please try again later' );
                else
                    alert( response.data );
            });
               
   }


}

