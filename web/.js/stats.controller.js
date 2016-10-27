angular
    .module( 'adxcApp' )
    .controller( 'statsController', statsController );

function statsController( $stateParams, DxConst, User, Head ) {    
    var vm = this;
    vm.user = User.data;
    vm.const = DxConst;
    vm.cfmChanged = cfmChanged;
    vm.activeAwardChanged = activeAwardChanged;

    activate();
    return vm;

    function activate() {
        Head.setTitle( 'ADXCluster.com - Stats' );

        vm.awards = [];
        ar listCo = 1;
        User.data.lists.forEach( function( list ) {
            var listAV = { fullName: 'List #' + listCo++, 
                name: list.title, byBand: true,
                stats_settings: list.stats_settings, 
                values: [], list_id: list.id, country: 'Aaaa' };
            vm.awards.push( listAV );
            var active = {};
            if ( $stateParams.list_id == list.id )
                active.award = listAV;
            if ( list.items ) 
                list.items.forEach( function( item ) {
                    var itemAV = { value: item.callsign + ( item.pfx ? '*' : '' ),
                        'byBand': {} };
                    listAV.values.push( itemAV );
                    if ( active.award && active.award == listAV && 
                            $stateParams.value == item.callsign )
                        active.value = itemAV;
                    if ( list.id in User.data.listsAwards && 
                        item.callsign in User.data.listsAwards[list.id] )
                        fillAwardValue( 
                                User.data.listsAwards[list.id][item.callsign],
                                itemAV.byBand );
                });
            if ( active.award ) {
                vm.activeAward = active.award;
                vm.activeAwardChanged();
            }
            if ( active.value )
                vm.setActive( active.value, $scope.params.band, $scope.params.mode );
        });
    
        vm.loading = true;
        Awards.getAwards( true )
            .then( function( data ) {
                var active = {};
                data.forEach( function( award ) {
                    vm.awards.push( award );
                    award.worked = 0;
                    award.confirmed = 0;
                    if ( $stateParams.award == award.name )
                        active.award = award;
                    award.values.forEach( function( av ) {
                        if ( var uav = $scope.user.awards[award.name][av.value] ) {
                            if ( award.byBand ) {
                                av.byBand = {};
                                fillAwardValue( uav, av.byBand );
                            } else {
                                angular.extend( av, uav );
                                av.worked = true;
                                award.worked++;
                            }
                        }
                        if ( active.award == award && 
                                $stateParams.value == av.value )
                            active.value = av;
                    });
                    if ( active.award ) {
                        vm.activeAward = active.award;
                        vm.activeAwardChanged();
                    }
                    if ( active.value )
                        vm.setActive( active.value, $stateParams.band, 
                                $stateParams.mode );
            });
        });
    }

    function isConfirmed( av ) {
        if ( 'byMode' in av ) {
            for ( var mode in av.byMode )
                if ( vm.modesFilter[mode] && isConfirmed( av.byMode[mode] ) )
                    return true;
        } else {
            for ( var co = 0; co < DxConst.cfmCount; co++ )
                if ( vm.cfm[co].enabled && av[vm.cfm[co].field] ) {
                    av.confirmed = true;
                    return true;
                }
            av.confirmed = false;
        }
        return false;
    }

    function isWorked( av ) {
        if ( 'byMode' in av ) {
            for ( var mode in av.byMode )
                if ( vm.modesFilter[mode] && av.byMode[mode].worked )
                    return true;
            return false;
        } else 
            return av.worked;
    }

    function copyCfm( src, dst ) {
        for ( var co = 0 ; co < DxConst.cfmCount; co++ )
            dst[vm.cfm[co].field] = typeof(src) === "boolean" ? 
                src : src[vm.cfm[co].field];
    }

    function findActiveList() {
        return User.data.lists.find( 
            function( list ) { return list.id == vm.activeAward.list_id; } );
    }

    function cfmChanged( noSave ) {
        var award = vm.activeAward;
        if ( award.byBand ) {
            DxConst.bands.forEach( function( band ) {
                vm.stats[band] = { worked: 0, confirmed: 0 }
                vm.activeAward.values.forEach( function( av ) {
                    if ( av.byBand && band in av.byBand ) {
                        var avb = av.byBand[band];
                        if ( avb.worked = isWorked( avb ) )
                            vm.stats[band].worked++;
                        if ( avb.confirmed = isConfirmed( avb ) )
                            vm.stats[band].confirmed++;
                    }
                });
            });

        } else {
            award.confirmed = 0;
            award.values.forEach( function( av ) {
                av.confirmed = isConfirmed( av );
                if ( av.confirmed )
                    award.confirmed++;
            });
        }
        if ( !noSave ) {
            var statsSettings = { cfm: {}, 
                modesFilter: angular.extend( {}, $scope.modesFilter ) };
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

        vm.modesFilter = {};
        DxConst.modes.forEach( function( mode ) {
            vm.modesFilter[mode] = true;
        });

        vm.cfm = [];
        DxConst.cfm.forEach( function( item ) {
            vm.cfm.push( { field: item[1], display: item[0], enabled: true } );
        });
 
        if ( var as = vm.activeAward.list_id ? findActiveList() : 
                User.data.awardsSettings[$scope.activeAward.name] ) {
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

    function fillAwardValue( src, dst ) {
        for ( var band in src ) {
            dst[band] = { byMode: {} };
            for ( var mode in src[band] ) {
                dst[band].byMode[mode] = { worked: true };
                angular.extend( dst[band].byMode[mode], 
                        src[band][mode] );
            }
        }
    }

    function setActive( value, band, mode ) {
        vm.activeValue = value;
        vm.activeBand = band;
        vm.activeMode = mode;
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

    function saveUserAwards( noPost ) {
        saveUserData( $scope.user );
        var iv = getIV();
        if ( !noPost ) {
            var data = createPostData();
            data.value = $scope.activeValue.value;
            data.workedCS = iv.workedCS;
            copyCfm( iv, data );
            if ( $scope.activeAward.byBand ) {
                data.band = $scope.activeBand;
                data.mode = $scope.activeMode;
            }
            $http.post( '/uwsgi/userSettings', data );
        }
    }

    $scope.saveWorkedCS = function() {
        var iv = getIV();
        if ( iv.workedCS  ) {
/*            if ( !iv.worked ) {
                iv.worked = true;
                $scope.modifyActiveValue( 'worked' );
            } else {*/
                getUAV().workedCS = iv.workedCS;
                saveUserAwards();
           // }
        }
    }

    function createAward() {
        User.createAward( vm.activeAward, vm.activeValue.value, vm.activeBand, vm.acriveMode ); 
    }

    function deleteAward() {
        var postData = createPostData();
        postData.value = $scope.activeValue.value,
        postData.delete = true;
        if ( $scope.activeAward.byBand ) {
            var uav = $scope.activeAward.list_id ? $scope.user.listsAwards[$scope.activeAward.list_id] :
                $scope.user.awards[$scope.activeAward.name]
            delete uav [$scope.activeValue.value][$scope.activeBand][$scope.activeMode];
            postData.band = $scope.activeBand;
            postData.mode = $scope.activeMode;
        } else
            delete $scope.user.awards[$scope.activeAward.name][$scope.activeValue.value];
        $http.post( '/uwsgi/userSettings', postData );
    }

    function getIV() {
         return vm.activeAward.byBand ? 
            vm.activeValue.byBand[$scope.activeBand].byMode[$scope.activeMode] :
            vm.activeValue;
    }

    function getUAV() {
        var uav;
        if ( vm.activeAward.list_id ) {
            uav = User.data.listsAwards[vm.activeAward.list_id
                ][vm.activeValue.value];
        } else {
            uav = User.data.awards[vm.activeAward.name][vm.activeValue.value];
            if ( vm.activeAward.byBand )
                uav = uav[vm.activeBand][vm.activeMode];
        }
        return uav;
    }

    function updateIVState() {
        var iv = vm.activeAward.byBand ? vm.activeValue.byBand[vm.activeBand] :
            vm.activeValue;
        var state = { 'worked': isWorked( iv ), 'confirmed': isConfirmed( iv ) };
        for ( var field in state ) {
            if ( !( field in iv ) )
                iv[field] = false;
            if ( state[field] != iv[field] ) {
                iv[field] = state[field];
                if ( vm.activeAward.byBand ) {
                    if ( iv[field] )
                        vm.stats[$scope.activeBand][field]++;
                    else
                        vm.stats[$scope.activeBand][field]--;
               } else {
                   if ( iv[field] )
                       vm.activeAward[field]++;
                   else
                       vm.activeAward[field]--;
               }

            }
        }
    }

    function modifyActiveValue = function( param ) {
        var iv = getIV();
        if ( param == 'worked') {
            if ( iv.worked ) {
                createAward();
                copyCfm( false, iv );
                if ( !vm.activeAward.byBand )
                    vm.activeAward.worked++;
                saveUserAwards();
            } else {
                deleteAward();
                copyCfm( {}, iv );
                iv.workedCS = null;
                if ( !vm.activeAward.byBand )
                    vm.activeAward.worked--;
           }
        } else {
            if ( !iv.worked ) {
                iv.worked = true;
                createAward();                
                if ( !vm.activeAward.byBand )
                    vm.activeAward.worked++;
           }
            copyCfm( iv, getUAV() );
            saveUserAwards();
        }
        updateIVState();
    }
   
}
