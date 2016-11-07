angular
    .module( 'adxcApp' )
    .controller( 'statsController', statsController );

function statsController( $scope, $stateParams, DxConst, User, Head, Awards, 
        UserAwardFactory, LoadingScreen ) {    
    var vm = this;
    vm.user = User;
    vm.const = DxConst;
    vm.cfmChanged = cfmChanged;
    vm.activeAwardChanged = activeAwardChanged;
    vm.modifyActiveValue = modifyActiveValue;
    vm.setActive = setActive;
    vm.stats = {};

    User.onLogIO( activate, $scope );

    activate();
    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - Stats' );

        vm.awards = [];

        

        var listCo = 1;
        User.data.lists.forEach( function( list ) {
            var listAV = { fullName: list.full_title ? list.full_title : 
                    'List #' + listCo, 
                name: list.title, byBand: true,
                stats_settings: list.stats_settings, 
                values: [], list_id: list.id, country: 'Aaaa' };
            listCo++;
            vm.awards.push( listAV );
            if ( list.items ) 
                list.items.forEach( function( item ) {
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
    
        LoadingScreen.on();
        Awards.getAwards( true )
            .then( function( data ) {
                data.forEach( function( award ) {
                    vm.awards.push( award );
                    award.worked = 0;
                    award.confirmed = 0;
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
            LoadingScreen.off();
            if ( $stateParams.award ) {
                var award = vm.awards.find( function( award ) {
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
                        if ( value )
                            setActive( value, $stateParams.activeBand, 
                                    $stateParams.activeMode );
                    }
                }
            }
        });
    }

    function findActiveList() {
        return User.data.lists.find( 
            function( list ) { return list.id == vm.activeAward.list_id; } );
    }
   

    function valueConfirmed( av ) {
        for ( var co = 0; co < DxConst.cfmCount; co++ )
            if ( vm.cfm[co].enabled && av[vm.cfm[co].field] ) 
                return true;
    }

    function bandConfirmed( band ) {
        var fl = false;
        for ( var co = 0; co < DxConst.modesCount; co++ ) {
            var mode = DxConst.modes[co];
            if ( band[mode] && 
                    ( band[mode].confirmed = valueConfirmed( band[mode] ) ) &&
                    vm.modesFilter[mode] )
                fl = true;
        }
        return fl;
    }

    function bandWorked( band ) {
        for ( var co = 0; co < DxConst.modesCount; co++ ) {
            var mode = DxConst.modes[co];
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
            var statsSettings = { cfm: {}, 
                modesFilter: angular.extend( {}, vm.modesFilter ) };
            vm.cfm.forEach( function( type ) {
                statsSettings.cfm[type.field] = type.enabled; 
            });
            var award = vm.activeAward.name;
            if ( vm.activeAward.list_id ) {
                var activeList = findActiveList();
                activeList.stats_settings = statsSettings;
            } else {
                if ( !( award in User.data.awardsSettings ) )
                    User.data.awardsSettings[award] = {};
                User.data.awardsSettings[award].stats_settings = statsSettings;
            }
            User.saveAwardStatsSettings();
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
        DxConst.modes.forEach( function( mode ) {
            vm.modesFilter[mode] = true;
        });

        vm.cfm = [];
        DxConst.cfm.forEach( function( item ) {
            vm.cfm.push( { field: item[1], display: item[0], enabled: true } );
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
            }
        }
        cfmChanged( true );
    };

    function setActive( value, band, mode ) {
        vm.activeValue = value;
        vm.activeBand = band;
        vm.activeMode = mode;
        if ( activeUserAward() )
            vm.workedCS = activeUserAward().workedCS;
    }
   
    function findValue() {
        var search = vm.searchExpr.toUpperCase()
            .replace( /\s/g, '' ).replace( /\u00D8/g, '0' );
        var eg = vm.activeAward.values[0].value;
        if ( !search.includes( '-' ) && eg.includes( '-' ) ) {
            var hpos = eg.indexOf( '-' );
            search = [search.slice( 0, hpos ), '-', search.slice( hpos )].join('');
        } else if ( search.includes( '-' ) && !eg.includes( '-' ) )
            search = search.replace( /-/g, '' );
        if ( found = vm.activeAward.values.find( 
            function( x ) { return x.value === search; } ) ) {
            vm.setActiveValue( found );
            vm.searchValue = null;
        }
    }

    function createAward() {
        var data = activeUserAward();
        var ua = UserAwardFactory( vm.activeAward, vm.activeValue.value,
                        vm.activeBand, vm.activeMode ); 
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
            state = { 'confirmed': iv.userAward && 
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
                createAward();                
                if ( !vm.activeAward.byBand )
                    vm.activeAward.worked++;
           }
        }
        updateIVState();
    }
   
}
