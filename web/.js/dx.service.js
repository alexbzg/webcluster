angular
    .module( 'adxcApp' )
    .service( 'DX', DXService );

function DXService( $rootScope, $http, User, Awards, Notify ) {
    var url = '/dxdata.json';
    var lastModified = null;
    var user = User.data;
    var awards = {};
    var cfm = {};
    Awards.getAwards()
        .then( function( data ) {
            awards = data;
            awards.forEach( function( award ) {
                award.cfm = createCfm( user.awardsSettings[award.name] );
                awards[award.name] = award;
            });
        });

    var dx = { 
        items: [],
        load: load,
        updateAwards: updateAwards,
        onUpdate: onUpdate
    };

    User.onLogIO( function() {
        user = User.data;
        updateAwards() } );

    return dx;

    function onUpdate( callback, scope ) {
        Notify.notify( 'dx-update', callback, scope );
    }

    function load() {
        return $http.get( url, { cache: false } )
            .then( function( response ) {
                if ( lastModified != response.headers( 'last-modified' ) ) {
                    dx.items = response.data.reverse();
                    dx.items.forEach( function( item ) {
                        item._awards = angular.extend( {}, item.awards );
                    });
                    lastModified =  response.headers( 'last-modified' );
                    updateAwards();
                    /*dx.onNewData.forEach( function( callback ) {
                        callback();
                    });*/
                    return true;
                } 
                return false;
            } );
    }

    function createCfm( as ) {
        var cfm = { 'cfm_paper': 1, 'cfm_eqsl': 1, 'cfm_lotw': 1 };
        if ( as && as.settings && as.settings.cfm )
            as.settings.cfm.forEach( function( cfmType ) {
                if ( !cfmType.enabled )
                    delete cfm[cfmType.name];
            });
        return cfm;
    }


    function updateAwards() {
        dx.items.forEach( function( item ) {
            item.awards = [];
            itemAwards( item );
            itemListAwards( item );
        });
        $rootScope.$emit( 'dx-update' );
    }

    function checkAward( uav, dx ) {
        if ( dx.band in uav )
            for ( var mode in uav[dx.band] )
                if ( mode == dx.mode || 
                    ( dx.subMode != null && dx.subMode.indexOf( mode ) != -1 ) ) 
                    return uav[dx.band][mode];
        return false;
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
   

    function itemAwards( item ) {
        for ( var aN in item._awards ) {
            var aV = item._awards[aN];
            var a = { award: aN, value: aV, sound: true };
            if ( user.awards || user.awardsSettings ) {
                if ( user.awardsSettings != null &&
                        aN in user.awardsSettings ) {
                    var as = user.awardsSettings[aN];
                    if ( as.track ) {
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
                        }
                        a.color = as.color;
                    } else 
                        continue;
                }
                if ( user.awards != null 
                    && aN in user.awards &&
                    aV in user.awards[aN] ) {
                    var uav = user.awards[aN][aV];
                    var fl = false;
                    var byBand = awards[aN].byBand;
                    if ( byBand && ( fl = checkAward( uav, item ) ) )
                        uav = fl;
                    if ( !awards[aN].byBand || fl ) {
                        if ( checkAwardCfm( uav, awards[aN].cfm ) )
                            continue;
                        else
                            a.worked = true;
                    }
                }
                if ( !as || !as.settings || 
                        ( a.worked && as.settings.sound.wkd ) || 
                        ( !a.worked && as.settings.sound.not ) )
                    a.sound = true;

            }
            item.awards.push( a );
        }
    }

    function itemListAwards( item ) {
        user.lists.forEach( function( list ) {
            if ( list.track )
                list.items.forEach( function( listItem ) {
                    if ( item.band in listItem.settings.bands && 
                            !listItem.settings.bands[dx.band] )
                        return;
                    if ( item.mode in listItem.settings.modes &&
                            !listItem.settings.modes[dx.mode] )
                        return;
                    if ( dx.subMode in listItem.settings.modes &&
                            !listItem.settings.modes[dx.subMode] )
                        return;
                    if ( listItem.callsign == item.cs || ( listItem.pfx && 
                                item.cs.indexOf( listItem.callsign ) == 0 ) ) {
                        var worked = false;
                        if ( list.id in user.listsAwards && listItem.callsign in 
                            user.listsAwards[list.id] ) {
                            var uav = user.listsAwards[list.id][listItem.callsign];
                            if ( checkAward( uav, item ) ) {
                                var cfm = createCfm( listItem );
                                if ( checkAwardCfm( uav, cfm ) )
                                    return;
                                else
                                    worked = true;
                            }

                        }
                        item.awards.push( { award: list.title, 
                            value: listItem.callsign,
                            worked: worked, list_id: list.id, color: list.color,
                            sound: ( worked && listItem.settings.sound.wkd ) || 
                                ( !worked && listItem.settings.sound.not )
                        } );
                        
                    }
                });
        });
       
    }
}

