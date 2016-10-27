var awardsApp = angular.module( 'awardsApp', ['colorpicker.module', 'ngSanitize'] );

awardsApp.controller( 'bodyCtrl', function( $scope, $http, $window ) {

    if ( !( $scope.user = getUserData() ) )    
        $window.location.href = "http://adxcluster.com/login.html";

    if ( !$scope.user.awardsSettings )
        $scope.user.awardsSettings = {};

    if ( !$scope.user.awards )
        $scope.user.awards = {};

    if ( !$scope.user.lists )
        $scope.user.lists = [];
 
    if ( !$scope.user.listsAwards )
        $scope.user.listsAwards = {};
  
    $scope.params = {};
    location.search.substr(1).split("&").forEach(function(item) 
            {$scope.params[item.split("=")[0]] = 
                decodeURIComponent( item.split("=")[1] )});


    $scope.logout = function() {
        logoutUser();
        $window.location.href = "http://adxcluster.com/login.html";
    }

    $scope.saveUserSettings = function() {
        saveUserData( $scope.user );
        $http.post( '/uwsgi/userSettings',
            { 'token': $scope.user.token,
                'award_value_worked_color': $scope.user.awardValueWorkedColor,
                'award_value_confirmed_color': 
                    $scope.user.awardValueConfirmedColor                
            } ).then( function( response ) {
                console.log( response.data );
            } );
    };
    
    $scope.const = { 
        'bands': [ '1.8', '3.5', '7', '10', '14', '18', '21', '24', '28', '50', 
            '144' ],
        'modes': [ 'CW', 'SSB', 'RTTY', 'PSK31', 'PSK63', 'PSK125', 'JT65' ] };
    $scope.stats = {};

    $scope.modesFilter = {};
    $scope.const.modes.forEach( function( mode ) {
        $scope.modesFilter[mode] = true;
    });

    $scope.cfm = [ { field: 'cfm_paper', display: 'Paper', enabled: true },
                { field: 'cfm_eqsl', display: 'eQSL', enabled: true },
                { field: 'cfm_lotw', display: 'LOTW', enabled: true } ];
    $scope.cfmTypesCount = $scope.cfm.length;

    function isConfirmed( av ) {
        if ( 'byMode' in av ) {
            for ( var mode in av.byMode )
                if ( $scope.modesFilter[mode] && isConfirmed( av.byMode[mode] ) )
                    return true;
        } else {
            for ( var co = 0; co < $scope.cfmTypesCount; co++ )
                if ( $scope.cfm[co].enabled && av[$scope.cfm[co].field] ) {
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
                if ( $scope.modesFilter[mode] && av.byMode[mode].worked )
                    return true;
            return false;
        } else 
            return av.worked;
    }

    function copyCfm( src, dst ) {
        for ( var co = 0 ; co < $scope.cfmTypesCount; co++ )
            dst[$scope.cfm[co].field] = typeof(src) === "boolean" ? 
                src : src[$scope.cfm[co].field];
    }

    function findActiveList() {
        return $scope.user.lists.find( 
            function( list ) { return list.id == $scope.activeAward.list_id; } );
    }


    function createPostData() {
        var data =  { 'token': $scope.user.token }
        if ( $scope.activeAward.list_id )
            data.list_id = $scope.activeAward.list_id;
        else
            data.award = $scope.activeAward.name;
        return data;
    }

    $scope.cfmChanged = function( noSave ) {
        var award = $scope.activeAward;
        if ( award.byBand ) {
            $scope.const.bands.forEach( function( band ) {
                $scope.stats[band] = { worked: 0, confirmed: 0 }
                $scope.activeAward.values.forEach( function( av ) {
                    if ( av.byBand && band in av.byBand ) {
                        var avb = av.byBand[band];
                        if ( avb.worked = isWorked( avb ) )
                            $scope.stats[band].worked++;
                        if ( avb.confirmed = isConfirmed( avb ) )
                            $scope.stats[band].confirmed++;
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
            $scope.cfm.forEach( function( type ) {
                statsSettings.cfm[type.field] = type.enabled; 
            });
            var award = $scope.activeAward.name;
            if ( $scope.activeAward.list_id ) {
                var activeList = findActiveList();
                activeList.stats_settings = statsSettings;
            } else {
                if ( !( award in $scope.user.awardsSettings ) )
                    $scope.user.awardsSettings[award] = {};
                $scope.user.awardsSettings[award].stats_settings = statsSettings;
            }
            saveUserData( $scope.user );
            var data = createPostData();
            data.stats_settings = statsSettings;
            if ( award ) {
                $http.post( '/uwsgi/userSettings', data
                    ).then( function( response ) {
                        console.log( response.data );
                    } );
            }
        }

    };

    $scope.activeAwardChanged = function() {
        $scope.activeValue = null;
        $scope.activeBand = null;
        $scope.activeMode = null;
        $scope.searchValue = null;

        $scope.modesFilter = {};
        $scope.const.modes.forEach( function( mode ) {
            $scope.modesFilter[mode] = true;
        });
        $scope.cfm = [ { field: 'cfm_paper', display: 'Paper', enabled: true },
                    { field: 'cfm_eqsl', display: 'eQSL', enabled: true },
                    { field: 'cfm_lotw', display: 'LOTW', enabled: true } ];
        if ( $scope.activeAward.name in $scope.user.awardsSettings ||
                $scope.activeAward.list_id ) {
            var as = $scope.activeAward.list_id ? findActiveList() : 
                $scope.user.awardsSettings[$scope.activeAward.name];
            if ( 'stats_settings' in as && as.stats_settings != null ) {
                var ss = as.stats_settings;
                if ( 'cfm' in ss && ss.cfm != null ) 
                    $scope.cfm.forEach( function( type ) {
                        if ( type.field in ss.cfm )
                            type.enabled = ss.cfm[type.field];
                    });
                if ( 'modesFilter' in ss && ss.modesFilter != null )
                    $scope.modesFilter = angular.extend( {}, ss.modesFilter );
            }
        }
        $scope.cfmChanged( true );
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

    $scope.setActive = function ( value, band, mode ) {
        $scope.activeValue = value;
        $scope.activeBand = band;
        $scope.activeMode = mode;
    }
   

    $scope.awardsValues = [];
    var listCo = 1;
    $scope.user.lists.forEach( function( list ) {
        var listAV = { fullName: 'List #' + listCo++, name: list.title, byBand: true,
            stats_settings: list.stats_settings, values: [], list_id: list.id, country: 'Aaaa' };
        $scope.awardsValues.push( listAV );
        var active = {};
        if ( $scope.params.list_id == list.id )
            active.award = listAV;
        if ( list.items ) 
            list.items.forEach( function( item ) {
                var itemAV = { value: item.callsign + ( item.pfx ? '*' : '' ),
                    'byBand': {} };
                listAV.values.push( itemAV );
                if ( active.award && active.award == listAV && 
                        $scope.params.value == item.callsign )
                    active.value = itemAV;
                if ( list.id in $scope.user.listsAwards && 
                    item.callsign in $scope.user.listsAwards[list.id] )
                    fillAwardValue( $scope.user.listsAwards[list.id][item.callsign],
                            itemAV.byBand );
            });
        if ( active.award ) {
            $scope.activeAward = active.award;
            $scope.activeAwardChanged();
        }
        if ( active.value )
            $scope.setActive( active.value, $scope.params.band, $scope.params.mode );
               
 
    });
    

    $scope.loading = true;
    var url = testing ? '/debug/awardsValues.json' : '/awardsValues.json';
    $http.get( url ).then( function( response ) {
            var active = {};
            $scope.loading = false;
            response.data.forEach( function( award ) {
                $scope.awardsValues.push( award );
                award.worked = 0;
                award.confirmed = 0;
                if ( $scope.params.award == award.name )
                    active.award = award;
                if ( !( award.name in $scope.user.awardsSettings ) )
                    $scope.user.awardsSettings[award.name] = 
                        { 'track': true, 'color': '#770000' };
                if ( !( award.name in $scope.user.awards ) )
                    $scope.user.awards[award.name] = {};
                award.values.forEach( function( av ) {
                    if ( av.value in $scope.user.awards[award.name] ) {
                        var uav = $scope.user.awards[award.name][av.value];
                        if ( award.byBand ) {
                            av.byBand = {};
                            fillAwardValue( uav, av.byBand );
                        } else {
                            angular.extend( av, uav );
                            av.worked = true;
                            award.worked++;
                        }
                    }
                    if ( active.award == award && $scope.params.value == av.value )
                        active.value = av;
                });
                if ( active.award ) {
                    $scope.activeAward = active.award;
                    $scope.activeAwardChanged();
                }
                if ( active.value )
                    $scope.setActive( active.value, $scope.params.band, $scope.params.mode );
            });
           
    });

    $scope.findValue = function() {
        var search = $scope.searchExpr.toUpperCase().replace( /\s/g, '' ).replace( /\u00D8/g, '0' );
        var eg = $scope.activeAward.values[0].value;
        if ( !search.includes( '-' ) && eg.includes( '-' ) ) {
            var hpos = eg.indexOf( '-' );
            search = [search.slice( 0, hpos ), '-', search.slice( hpos )].join('');
        } else if ( search.includes( '-' ) && !eg.includes( '-' ) )
            search = search.replace( /-/g, '' );
        if ( found = $scope.activeAward.values.find( 
            function( x ) { return x.value === search; } ) ) {
            $scope.setActiveValue( found );
            $scope.searchValue = null;
        }
    };


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
        if ( $scope.activeAward.list_id ) {
            var lid = $scope.activeAward.list_id;
            if ( !( lid in $scope.user.listsAwards ) )
                $scope.user.listsAwards[lid] = {};
        }
        var ua = $scope.activeAward.list_id ?
            $scope.user.listsAwards[$scope.activeAward.list_id] :
            $scope.user.awards[$scope.activeAward.name];
        if ( !( $scope.activeValue.value in ua ) )
            ua[$scope.activeValue.value] = {};
        var uav = ua[$scope.activeValue.value];
        if ( $scope.activeAward.byBand ) {
            if ( !( $scope.activeBand in uav ) )
                uav[$scope.activeBand] = {};
            if ( !( $scope.activeMode in uav[$scope.activeBand] ) )
                uav[$scope.activeBand][$scope.activeMode] = {};
            uav = uav[$scope.activeBand][$scope.activeMode];
        } 
        uav.workedCS = '';
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
         return $scope.activeAward.byBand ? 
            $scope.activeValue.byBand[$scope.activeBand].byMode[$scope.activeMode] :
            $scope.activeValue;
    }

    function getUAV() {
        var uav;
        if ( $scope.activeAward.list_id ) {
            uav = $scope.user.listsAwards[$scope.activeAward.list_id][$scope.activeValue.value
                ][$scope.activeBand][$scope.activeMode];
        } else {
            var uav = $scope.user.awards[$scope.activeAward.name][$scope.activeValue.value];
            if ( $scope.activeAward.byBand )
                uav = uav[$scope.activeBand][$scope.activeMode];
        }
        return uav;
    }

    function updateIVState() {
        var iv = $scope.activeAward.byBand ? $scope.activeValue.byBand[$scope.activeBand] :
            $scope.activeValue;
        var state = { 'worked': isWorked( iv ), 'confirmed': isConfirmed( iv ) };
        for ( var field in state ) {
            if ( !( field in iv ) )
                iv[field] = false;
            if ( state[field] != iv[field] ) {
                iv[field] = state[field];
                if ( $scope.activeAward.byBand ) {
                    if ( iv[field] )
                        $scope.stats[$scope.activeBand][field]++;
                    else
                        $scope.stats[$scope.activeBand][field]--;
               } else {
                   if ( iv[field] )
                       $scope.activeAward[field]++;
                   else
                       $scope.activeAward[field]--;
               }

            }
        }
    }

    $scope.modifyActiveValue = function( param ) {
        var iv = getIV();
        if ( param == 'worked') {
            if ( iv.worked ) {
                createAward();
                copyCfm( false, iv );
                if ( !$scope.activeAward.byBand )
                    $scope.activeAward.worked++;
                saveUserAwards();
            } else {
                deleteAward();
                copyCfm( {}, iv );
                iv.workedCS = null;
                if ( !$scope.activeAward.byBand )
                    $scope.activeAward.worked--;
           }
        } else {
            if ( !iv.worked ) {
                iv.worked = true;
                createAward();                
                if ( !$scope.activeAward.byBand )
                    $scope.activeAward.worked++;
           }
            copyCfm( iv, getUAV() );
            saveUserAwards();
        }
        updateIVState();
    }



} );

