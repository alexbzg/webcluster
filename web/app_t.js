var webDXapp = angular.module( 'webDXapp', [ 'ngSanitize' ] );

webDXapp.controller( 'bodyCtrl', function( $scope, $http, $interval, $window, $timeout ) {
    var stateAw = { 'Russia': 'RDA', 'Ukraine': 'URDA' };

    if ( $scope.user = getUserData( $scope, $window ) ) {
        $scope.awardsSettings = $scope.user.awardsSettings;
        for ( var award in $scope.awardsSettings )
            if ( $scope.awardsSettings[award].settings != null ) {
                var as = $scope.awardsSettings[award].settings;
                for ( var field in as ) 
                    if ( field != 'cfm' ) {
                        var fs = {};
                        as[field].forEach( function( item ) {
                            fs[item.name] = item.enabled;
                        });
                        as[field] = fs;
                    }
            }
                
        
            
        
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
                if ( !$scope.firstLoad && $scope.selector.sound )
                    playSound();
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

    function awards( dx ) {
        if ( $scope.user != null && ( $scope.user.awards != null || 
                    $scope.awardsSettings != null ) ) {
            fAwards = [];
            for ( var name in dx.awards ) 
                if ( dx.awards.hasOwnProperty( name ) ) {
                    var value = dx.awards[name];
                    var award = { award: name, value: value };
                    var cfm = { 'cfm_paper': 1, 'cfm_eqsl': 1, 'cfm_lotw': 1 };
                    if ( $scope.awardsSettings != null &&
                            name in $scope.awardsSettings ) {
                        var as = $scope.awardsSettings[name];
                        if ( $scope.awardsSettings[name].track ) {
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
                                as.settings.cfm.forEach( function( cfmType ) {                                    
                                    if ( !cfmType.enabled )
                                        delete cfm[cfmType.name];
                                });
                            }
                            if ( $scope.user.awards != null 
                                && name in $scope.user.awards &&
                                value in $scope.user.awards[name] ) {
                                var uav = $scope.user.awards[name][value];
                                var fl = false;
                                var byBand = $scope.awards[name].byBand;
                                if ( byBand && dx.band in uav )
                                    for ( var mode in uav[dx.band] )
                                        if ( mode == dx.mode || 
                                            ( dx.subMode && dxSubMode.indexOf( mode ) != -1 ) ) {
                                            fl = true;
                                            uav = uav[dx.band][mode];
                                            continue;
                                        }                                    
                                if ( !$scope.awards[name].byBand || fl ) {
                                    var confirmed = false;
                                    for ( var cfmType in cfm )
                                        if ( uav[cfmType] ) {
                                            confirmed = true;
                                            break;
                                        }
                                    if ( confirmed )
                                        continue;
                                    else
                                        award.worked = true;
                                }
                            }
                            award.color = $scope.awardsSettings[name].color;
                            fAwards.push( award );
                        }
                    } else
                        fAwards.push( award );
                }
            dx.awards = fAwards;
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

