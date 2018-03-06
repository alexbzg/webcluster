angular
    .module( 'adxcApp' )
    .controller( 'statsController', statsController );

statsController.$inject = [ '$scope', '$stateParams', 'DxConst', 'User', 
    'Head', 'Awards', 'UserAwardFactory', 'LoadingScreen' ];   

function statsController( $scope, $stateParams, DxConst, User, Head, 
        Awards, UserAwardFactory, LoadingScreen ) {    
    var vm = this;
    vm.user = User;
    vm.const = DxConst;
    vm.cfmChanged = cfmChanged;
    vm.activeAwardChanged = activeAwardChanged;
    vm.modifyActiveValue = modifyActiveValue;
    vm.setActive = setActive;
    vm.findValue = findValue;
    vm.bandConfirmed = bandConfirmed;
    vm.bandWorked = bandWorked;
    vm.openEmailForm = openEmailForm;
    vm.emailSend = emailSend;
    vm.emailUpdateAddress = emailUpdateAddress;
    vm.stats = {};
    vm.email = {};

    User.onLogIO( activate, $scope );

    activate();
    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - Stats' );

        vm.awards = [];
        vm.stationCsList = [ User.data.callsign ];
        if (User.data.msc && User.data.msc.additionalCs) {
            vm.stationCsList = vm.stationCsList.concat( 
                    User.data.msc.additionalCs );
        }
        vm.emailList = [ User.data.email ];
        vm.emailByCs = {};
        if (User.data.msc && User.data.msc.emails) {
            for ( var email in User.data.msc.emails ) {
                var cs = User.data.msc.emails[email].cs;
                if (vm.emailList.indexOf(email) == -1)
                    vm.emailList.push(email);
                if ( !(cs in vm.emailByCs) )
                    vm.emailByCs[cs] = email;
            }
        }

        var listCo = 1;
        User.data.lists.forEach( function( list ) {
            if ( list.noStats )
                return;
            var listAV = { fullName: list.full_title ? list.full_title : 
                    'List #' + listCo, 
                name: list.title, byBand: true,
                stats_settings: list.stats_settings, 
                values: [], list_id: list.id, country: 'Aaaa' };
            listCo++;
            vm.awards.push( listAV );
            if ( list.items ) 
                list.items.forEach( function( item ) {
                    if ( item.settings && item.settings.hide )
                        return;
                    var itemAV = { value: item.callsign + ( item.pfx ? '*' : '' ),
                        'byBand': {} };
                    listAV.values.push( itemAV );
                    if ( list.id in User.data.listsAwards && 
                        item.callsign in User.data.listsAwards[list.id] ) {
                        var ulav = User.data.listsAwards[list.id][item.callsign];
                        for ( var band in ulav ) {
                            itemAV[band] = {};
                            for ( var mode in ulav[band] ) 
                                itemAV[band][mode] = 
                                    UserAwardFactory( listAV, itemAV.value, 
                                            band, mode );
                        }
                    }
                });
        });

        vm.awards = vm.awards.sort( function( a, b ) {
            if ( a.special && !b.special )
                return 1;
            else if ( b.special && !a.special )
                return -1;
            else 
                return a.list_id - b.list_id;
        });
       
    
        LoadingScreen.on();
        Awards.loadValues()
            .then( function( data ) {
                LoadingScreen.off();
                if ( vm.awardsLoaded )
                    return;
                else
                    vm.awardsLoaded = true;
                data.forEach( function( award ) {
                    vm.awards.push( award );
                    award.worked = 0;
                    award.confirmed = 0;
                    award.country = award.displayCountry || award.country || 'Aaab';
                    award.values.forEach( function( av ) {
                        if ( User.data.awards[award.name][av.value] ) {
                            var uav = User.data.awards[award.name][av.value];
                            if ( award.byBand ) {
                                for ( var band in uav ) {
                                    av[band] = {};
                                    for ( var mode in uav[band] ) 
                                        av[band][mode] = 
                                            UserAwardFactory( award, av.value, 
                                                    band, mode );
                                }
                            } else {
                                av.userAward = 
                                        UserAwardFactory( award, av.value );
                                award.worked++;
                            }
                        }
                    });

                });
                if ( $stateParams.award || $stateParams.list_id ) {
                    const award = vm.awards.find( function( award ) {
                        return ( $stateParams.list_id && 
                                ( award.list_id == $stateParams.list_id ) ) ||
                            ( !$stateParams.list_id && 
                            ( award.name == $stateParams.award ) );
                    });
                    if ( award ) {
                        vm.activeAward = award;
                        activeAwardChanged();
                        if ( $stateParams.value ) {
                            var value = award.values.find( function( av ) {
                                return av.value == $stateParams.value;
                            });
                            if ( value ) {
                                setActive( value, $stateParams.band, 
                                        $stateParams.mode );
                                setTimeout( function() {
                                    var valRect = getValueRect( value );
                                    var val0Rect = getValueRect( vm.activeAward.values[0] );              
                                    var offset = valRect.height * 
                                        ( vm.activeAward.byBand ? 0.5 : 1.5 );
                                    window.scrollBy( 0, valRect.y - val0Rect.y + offset );
                                });
                            }
                        }
                    }
                }

            });
    }

    function getValueRect( value ) {
        return document.getElementById( 'value_' + value.value )
            .getBoundingClientRect();
    }

    function findActiveList() {
        return User.data.lists.find( 
            function( list ) { return list.id == vm.activeAward.list_id; } );
    }
   

    function valueConfirmed( av ) {
        var cfmCount = vm.cfm.length;
        for ( var co = 0; co < cfmCount; co++ )
            if ( vm.cfm[co].enabled && av.cfm[vm.cfm[co].field] ) 
                return true;
        return false;
    }

    function bandConfirmed( band ) {
        var fl = false;
        for ( var co = 0; co < vm.modesCount; co++ ) {
            var mode = vm.modes[co];
            if ( band[mode] && 
                    ( band[mode].confirmed = vm.modesFilter[mode] && 
                      valueConfirmed( band[mode] ) ) ) 
                fl = true;
        }
        return fl;
    }

    function bandWorked( band ) {
        for ( var co = 0; co < vm.modesCount; co++ ) {
            var mode = vm.modes[co];
            if ( vm.modesFilter[mode] && band[mode] )
                return true;
        }
        return false;
    }

    function cfmChanged( noSave ) {
        var award = vm.activeAward;
        if ( award.byBand ) {
            DxConst.bands.forEach( function( band ) {
                vm.stats[band] = { worked: 0, confirmed: 0 }
                vm.activeAward.values.forEach( function( av ) {
                    if ( av[band] ) {
                        if ( av[band].worked = bandWorked( av[band] ) )
                            vm.stats[band].worked++;
                        if ( av[band].confirmed = bandConfirmed( av[band] ) )
                            vm.stats[band].confirmed++;
                    }
                });
            });

        } else {
            award.confirmed = 0;
            award.values.forEach( function( av ) {
                if ( av.userAward && 
                        ( av.confirmed = valueConfirmed( av.userAward ) ) )
                    award.confirmed++;
            });
        }
        if ( !noSave ) {
            const statsSettings = { cfm: {}, mixMode: vm.mixMode,
                modesFilter: angular.extend( {}, vm.modesFilter ) };
            vm.cfm.forEach( function( type ) {
                statsSettings.cfm[type.field] = type.enabled; 
            });
            vm.activeAward.stats_settings = statsSettings;
            var awardName = vm.activeAward.name;
            if ( vm.activeAward.list_id ) {
                award = findActiveList();
                award.stats_settings = statsSettings;
            } else {
                if ( !( awardName in User.data.awardsSettings ) )
                    User.data.awardsSettings[awardName] = {};
                award = User.data.awardsSettings[awardName];
                award.stats_settings = statsSettings;
            }
            User.saveAwardStatsSettings(vm.activeAward);
        }

    }

    function activeAwardChanged() {
        vm.activeValue = null;
        vm.activeBand = null;
        vm.activeMode = null;
        vm.searchValue = null;
        if ( !vm.activeAward )
            return;

        vm.modesFilter = {};
        vm.modes = vm.activeAward.modes ? vm.activeAward.modes : DxConst.modesSuper;
        vm.modesCount = vm.modes.length;
        vm.modes.forEach( function( mode ) {
            vm.modesFilter[mode] = true;
        });

        vm.cfm = [];
        if ( vm.activeAward.list_id )
            DxConst.cfm.forEach( function( item ) {
                vm.cfm.push( { field: item[1], display: item[0], enabled: true } );
            });
        else
            User.data.awardsSettings[vm.activeAward.name].settings.cfm.forEach( 
                function( item ) {
                    vm.cfm.push( { field: item.name, display: item.display,
                        enabled: true
                    } );
                });
        
        var as;
        if ( as = vm.activeAward.list_id ? findActiveList() : 
                User.data.awardsSettings[vm.activeAward.name] ) {
            if ( 'stats_settings' in as && as.stats_settings != null ) {
                var ss = as.stats_settings;
                if ( 'cfm' in ss && ss.cfm != null ) 
                    vm.cfm.forEach( function( type ) {
                        if ( type.field in ss.cfm )
                            type.enabled = ss.cfm[type.field];
                    });
                if ( 'modesFilter' in ss && ss.modesFilter != null )
                    vm.modesFilter = angular.extend( {}, ss.modesFilter );
                vm.mixMode = ss.mixMode;
            }
        }
        cfmChanged( true );
    };

    function setActive( value, band, mode ) {
        vm.activeValue = value;
        vm.activeBand = band;
        vm.activeMode = mode;
    }
   
    function findValue() {
        var eg = vm.activeAward.values[0].value;
        var search = vm.searchExpr.toUpperCase().replace( /\u00D8/g, '0' );
        if ( search.includes( ' ' ) && !eg.includes( ' ' ) )
            search = search.replace( / /g, '' );
        if ( !search.includes( '-' ) && eg.includes( '-' ) ) {
            var hpos = eg.indexOf( '-' );
            search = [search.slice( 0, hpos ), '-', search.slice( hpos )].join('');
        } else if ( search.includes( '-' ) && !eg.includes( '-' ) )
            search = search.replace( /-/g, '' );
        if ( found = vm.activeAward.values.find( 
            function( x ) { 
                return x.value.toUpperCase() === search || 
                   ( x.desc && x.desc.toUpperCase() === search ); } ) ) {
            vm.setActive( found );
            vm.searchValue = null;
        }
    }

    function createAward( skipSave ) {
        var data = activeUserAward();
        var ua = UserAwardFactory( vm.activeAward, vm.activeValue.value,
                        vm.activeBand, vm.activeMode, skipSave ); 
        ua.copy( data );
        if ( vm.activeAward.byBand )
            vm.activeValue[vm.activeBand][vm.activeMode] = ua;
        else
            vm.activeValue.userAward = ua;
    }

    function deleteAward() {
        if ( vm.activeAward.byBand ) {
            vm.activeValue[vm.activeBand][vm.activeMode].remove();
            delete vm.activeValue[vm.activeBand][vm.activeMode];
        } else {
            vm.activeValue.userAward.remove();
            delete vm.activeValue.userAward;
        }
    }

    function activeUserAward() {
         if ( vm.activeAward.byBand ) 
             return vm.activeValue[vm.activeBand] ? 
                 vm.activeValue[vm.activeBand][vm.activeMode] : null;
         else
             return vm.activeValue.userAward;
    }

    function updateIVState() {
        var iv;
        var state;
        if ( vm.activeAward.byBand ) {
            iv = vm.activeValue[vm.activeBand];
            state = { 'worked': bandWorked( iv ), 
                'confirmed': bandConfirmed( iv ) };
        } else {
            iv = vm.activeValue;
            state = { 'confirmed': 'userAward' in iv && iv.userAward && 
                valueConfirmed( iv.userAward ) };
        }
        for ( var field in state ) {
            if ( !( field in iv ) )
                iv[field] = false;
            if ( state[field] != iv[field] ) {
                iv[field] = state[field];
                if ( vm.activeAward.byBand ) {
                    if ( iv[field] )
                        vm.stats[vm.activeBand][field]++;
                    else
                        vm.stats[vm.activeBand][field]--;
               } else {
                   if ( iv[field] )
                       vm.activeAward[field]++;
                   else
                       vm.activeAward[field]--;
               }

            }
        }
    }

    function modifyActiveValue( param ) {
        var ua = activeUserAward();
        if ( param == 'worked') {
            if ( ua.worked ) {
                createAward();
                if ( !vm.activeAward.byBand )
                    vm.activeAward.worked++;
            } else {
                deleteAward();
                if ( !vm.activeAward.byBand )
                    vm.activeAward.worked--;
           }
        } else {
            if ( !ua.worked ) {
                createAward( true );                
                if ( !vm.activeAward.byBand )
                    vm.activeAward.worked++;
           }
        }
        updateIVState();
    }

    function openEmailForm() {
        if ( !vm.email.stationCs ) {
            if ( User.data.msc && User.data.msc.defaultCs )
                vm.email.stationCs = User.data.msc.defaultCs;
            else
                vm.email.stationCs = User.data.callsign;
        }
        emailUpdateAddress();
        var now = moment.utc();
        vm.email.date = now.format( 'MM-DD-YYYY' );
        vm.email.time = now.format( 'HH:mm' ) + 'z';

        if (vm.activeAward.byBand)
            vm.email.freq = DxConst.bandFreq[vm.activeBand];
        else
            vm.email.freq = 14;

        vm.email.workedCs = vm.activeAward.byBand ?
            vm.activeValue[vm.activeBand][vm.activeMode].workedCS :
            vm.activeValue.userAward.workedCS;

        vm.email.comments = '';

        vm.showEmailForm = true;
    }

    function emailSend() {
        vm.email.stationCs = vm.email.stationCs.toUpperCase();
        if ( vm.stationCsList.indexOf( vm.email.stationCs ) == -1 ) {
            vm.stationCsList.splice( 1, 0, vm.email.stationCs );
            User.data.msc.additionalCs.splice( 
                    0, 0, vm.email.stationCs );
        }
        if ( vm.emailList.indexOf( vm.email.to ) == -1 ) 
            vm.emailList.splice( 1, 0, vm.email.to );
        vm.emailByCs[vm.email.stationCs] = vm.email.to;
        User.data.msc.defaultCs = vm.email.stationCs;
        User.data.msc.emails[vm.email.to] = { cs: vm.email.stationCs };
        if ( vm.activeAward.byBand ) {
            vm.email.band = vm.activeBand;
            vm.email.mode = vm.activeMode;
        } else {
            vm.email.band = null;
            vm.email.mode = null;
        }
        User.saveData( { 'email': vm.email, 
            award: vm.activeAward.name + ' ' + vm.activeValue.value } );
        vm.showEmailForm = false;
    }

    function emailUpdateAddress() {
        vm.email.to = vm.email.stationCs in vm.emailByCs ? 
            vm.emailByCs[vm.email.stationCs] :
            User.data.email;
    }


   
}
