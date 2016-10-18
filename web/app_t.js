var webDXapp = angular.module( 'webDXapp', [ 'ngSanitize' ] );

webDXapp.controller( 'bodyCtrl', function( $scope, $http, $interval, $window, $timeout ) {
    var stateAw = { 'Russia': 'RDA', 'Ukraine': 'URDA' };

    if ( $scope.user = getUserData( $scope, $window ) ) {
        for ( var award in $scope.user.awardsSettings )
            if ( $scope.user.awardsSettings[award].settings != null ) {
                var as = $scope.user.awardsSettings[award].settings;
                for ( var field in as ) 
                    if ( field != 'cfm' && field != 'sound' ) {
                        var fs = {};
                        as[field].forEach( function( item ) {
                            fs[item.name] = item.enabled;
                        });
                        as[field] = fs;
                    }
                if ( !('sound' in as) || as.sound == null ) 
                    as.sound = { wkd: true, not: true };
            }
                
        if ( !$scope.user.lists )
            $scope.user.lists = [];

        if ( !$scope.user.listsAwards )
            $scope.user.listsAwards = {};
            
        
    }

    var r = null;
    if ( r = window.localStorage.getItem('adxcluster-selector') ) {
        try {
            r = JSON.parse( r );
            if ( !Array.isArray( r.bands ) || !Array.isArray( r.modes ) )
                r = null;
        } catch( err ) {
            r = null;
        }
    }
    $scope.selector = r;
   

    if ( !$scope.selector )
        $scope.selector = { bands: [], modes: [] };
    var selector = { bands: [ '1.8', '3.5', '7', '10', '14', '18', '21', '24', '28', '50', '144', 'UHF' ],
        modes: [ 'CW', 'SSB', 'DIGI' ] };
    for ( field in selector ) 
        if ( selector.hasOwnProperty( field ) ) {

            $scope.selector[field] = $scope.selector[field].filter( function( item ) {
                return selector[field].indexOf( item.name ) != -1;
            } );

            selector[field].forEach( function( value ) {
                if ( !$scope.selector[field].find( function( item ) { 
                    return item.name == value; } ) )
                    $scope.selector[field].push( { name: value, enabled: true } );
            } );
        }

    $scope.selectorChange = function() {
        window.localStorage['adxcluster-selector'] = JSON.stringify( $scope.selector );
    };

    $scope.sound = new Audio( '/note.mp3' );

    function playSound() {
        $scope.sound.play();
    }

    $scope.soundChange = function() {
        if ( $scope.selector.sound )
            playSound();
        $scope.selectorChange();
    }

    $scope.lastDx = { cs:'', ts: 0 };

    $scope.dxFilter = function( dx ) {
        var r = false;
        if ( dx.awards.length > 0 ){
            var band =  $scope.selector.bands.find( function( band ) {
                return band.name == dx.band; } );
            if ( !band || band.enabled ) {
                var mode =  $scope.selector.modes.find( function( mode ) {
                    return mode.name == dx.mode; } );
                if ( !mode || mode.enabled )
                    r = true;
            }
        } 
        if ( r && dx.ts > $scope.lastDx.ts ) {
            $scope.lastDx.ts = dx.ts;
            if ( dx.cs != $scope.lastDx.cs ) {
                $scope.lastDx.cs = dx.cs;
                if ( !$scope.firstLoad && $scope.selector.sound ) {
                    var al = dx.awrds.length;
                    for ( var co = 0; co < al; co++ )
                        if ( dx.awards[co].sound ) {
                            playSound();
                            break;
                        }
                }
            }
        }
        return r;
    };


    function loadDX() {
        $scope.firstLoad = $scope.dxlm == null;
        var url = testing ? '/debug/dxdata.json' : '/dxdata.json';
        $http.get( url, { cache: false } ).then( function( response ) {
            if ( $scope.dxlm != response.headers( 'last-modified' ) ) {
                $scope.dxItems = response.data.reverse();
                $scope.dxItems.forEach( awards );
                $scope.dxlm = response.headers( 'last-modified' );
            }
        } );
    }

    $scope.replace0 = function( str ) {
        return str == null ? null : str.replace( /0/g, '\u00D8' );
    }

    $scope.logout = function() {
        logoutUser();
        $window.location.reload();
    }

    function checkAward( uav, dx ) {
        var fl = false;
        if ( dx.band in uav )
            for ( var mode in uav[dx.band] )
                if ( mode == dx.mode || 
                    ( dx.subMode != null && dx.subMode.indexOf( mode ) != -1 ) ) {
                    fl = true;
                    uav = uav[dx.band][mode];
                    break;
                }        
        return fl;
    }

    function checkAwardCfm( uav, cfm ) {
        var confirmed = false;
        for ( var cfmType in cfm )
            if ( uav[cfmType] ) {
                confirmed = true;
                break;
            }
        return confirmed;
    }

    function createCfm( as ) {
        var cfm = { 'cfm_paper': 1, 'cfm_eqsl': 1, 'cfm_lotw': 1 };
        if ( as.settings.cfm )
            as.settings.cfm.forEach( function( cfmType ) {                                    
                if ( !cfmType.enabled )
                    delete cfm[cfmType.name];
            });
    }

    function awards( dx ) {
        if ( $scope.user != null && ( $scope.user.awards != null || 
                    $scope.user.awardsSettings != null ) ) {
            fAwards = [];
            for ( var name in dx.awards ) 
                if ( dx.awards.hasOwnProperty( name ) ) {
                    var value = dx.awards[name];
                    var award = { award: name, value: value };
                    if ( $scope.user.awardsSettings != null &&
                            name in $scope.user.awardsSettings ) {
                        var as = $scope.user.awardsSettings[name];
                        if ( $scope.user.awardsSettings[name].track ) {
                            if ( as.settings != null ) {
                                if ( dx.band in as.settings.bands && 
                                        !as.settings.bands[dx.band] )
                                    continue;
                                if ( dx.mode in as.settings.modes &&
                                        !as.settings.modes[dx.mode] )
                                    continue;
                                if ( dx.subMode in as.settings.modes &&
                                        !as.settings.modes[dx.subMode] )
                                    continue;
                                var cfm = createCfm( as );
                            }
                            if ( $scope.user.awards != null 
                                && name in $scope.user.awards &&
                                value in $scope.user.awards[name] ) {
                                var uav = $scope.user.awards[name][value];
                                var fl = false;
                                var byBand = $scope.awards[name].byBand;
                                if ( byBand )
                                    var fl = checkAward( uav, dx );
                                if ( !$scope.awards[name].byBand || fl ) {
                                    if ( checkAwardCfm( uav, cfm ) )
                                        continue;
                                    else
                                        award.worked = true;
                                }
                            }
                            award.color = $scope.user.awardsSettings[name].color;
                            if ( ( award.worked && as.settings.sound.wkd ) || 
                                    ( !award.worked && as.settings.sound.not ) )
                                award.sound = true;
                            fAwards.push( award );
                        }
                    } else
                        fAwards.push( award );
                }
            dx.awards = fAwards;
            $scope.user.lists.forEach( function( list ) {
                if ( list.track )
                    list.items.forEach( function( item ) {
                        if ( dx.band in item.settings.bands && 
                                !item.settings.bands[dx.band] )
                            return;
                        if ( dx.mode in item.settings.modes &&
                                !item.settings.modes[dx.mode] )
                            return;
                        if ( dx.subMode in item.settings.modes &&
                                !item.settings.modes[dx.subMode] )
                            return;
                        if ( item.callsign == dx.cs || ( item.pfx && dx.cs.indexOf( item.callsign ) == 0 ) ) {
                            var worked = false;
                            if ( list.id in $scope.user.listsAwards && item.callsign in 
                                $scope.user.listsAwards[list.id] ) {
                                var uav = $scope.user.listsAwards[list.id][item.callsign];
                                if ( checkAward( uav, dx ) ) {
                                    var cfm = createCfm( item );
                                    if ( checkAwardCfm( uav, cfm ) )
                                        return;
                                    else
                                        worked = true;
                                }

                            }
                            dx.awards.push( { award: list.title, value: item.callsign,
                                worked: worked, list_id: list.id, color: list.color,
                                sound: ( worked && item.setting.sound.wkd ) || 
                                    ( !worked && item.settings.sound.not )
                            } );
                           
                        }
                    });
            });
         } else {
            fAwards = [];
            for ( var name in dx.awards ) 
                if ( dx.awards.hasOwnProperty( name ) ) 
                    fAwards.push( { award: name, value: dx.awards[name] } );
            dx.awards = fAwards;
        }
    }

   

    $scope.dxlm = null;
    var urlAwards = testing ? '/debug/awards.json' : '/awards.json';
    $http.get( urlAwards ).then( function( response ) {
        $scope.awards = {}
        response.data.forEach( function( item ) {
            $scope.awards[item.name] = item;
        });
        loadDX();

        $interval( loadDX, 1000 );
    });

    $scope.news = { 'lm': $window.localStorage.getItem( 'adxcluster-news' ),
        'html': null };

    $http.get( '/news.txt', { cache: false } ).then( function( response ) {
        if ( $scope.news.lm != response.headers( 'last-modified' ) ) {
            $scope.news.lm = response.headers( 'last-modified' );
            if ( response.data.length > 10 )
                $scope.news.html = response.data;
        }
    });


    $scope.news.close = function() {
        $window.localStorage['adxcluster-news'] = $scope.news.lm;
        $scope.news.html = null;
    }

    function updateTime() {
        var n = new Date();
        var min = n.getUTCMinutes();
        if ( min < 10 ) min = "0" + min;
        var hr = n.getUTCHours();
        if ( hr < 10 ) hr = "0" + hr;
        $scope.time = hr + ':' + min;
        $timeout( updateTime, ( 60 - n.getUTCSeconds() ) * 1000 );
    }
    updateTime();

/*    function checkStatus() {
//        $scope.connectionStatus = "testing";
        $http.get( "/clusterConnection.json", { cache: false } ).then( function( response ) {
            $scope.connectionStatus = response.data.status;
        } );
    }
    $scope.connectionStatus = "testing";
    $interval( checkStatus, 1000 );*/
} );

