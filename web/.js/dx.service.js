angular
    .module( 'adxcApp' )
    .service( 'DX', DXService );

function DXService( $rootScope, $http, $interval, User, Awards, Notify ) {
    var url = '/dxdata.json';
    var lastModified = null;
    var lastItem = null;
    var dxpeditionModified = null;
    var user = User.data;
    var awards = {};
    var cfm = {};

    var dx = { 
        items: [],
        load: load,
        updateAwards: updateAwards,
        onUpdate: onUpdate
    };

    init();
    return dx;

    function init() {
        User.onLogIO( function() {
            user = User.data;
            updateAwards(); 
        } );

        User.onAwardsStatsChange( updateAwards );
        Awards.onUpdate( loadAwardsList );
    }

    function loadAwardsList() {
        Awards.data.forEach( function( award ) {
            var a = angular.extend( {}, award );
            a.cfm = createCfm( user.awardsSettings[award.name] );
            awards[award.name] = a;
        });
        updateAwards();
    }

    function onUpdate( callback, scope ) {
        Notify.notify( 'dx-update', callback, scope );
    }

    function load() {
        return $http.get( url, { cache: false } )
            .then( function( response ) {
                if ( ( lastModified != response.headers( 'last-modified' ) ) && 
                        response.data ) {
                    var lastRespItemIdx = response.data.length - 1;
                    for ( var co = 0; co <= lastRespItemIdx; co++ ) {
                        var item = response.data[lastRespItemIdx - co];
                        if ( co < dx.items.length && dx.items[co].cs == item.cs && 
                                dx.items[co].freq == item.freq && 
                                dx.items[co].ts == item.ts )
                                break;
                        for ( var coDup = co; coDup < dx.items.length; coDup++ )
                            if ( dx.items[coDup].cs == item.cs &&
                                ( dx.items[coDup].freq - item.freq < 1 &&
                                  item.freq - dx.items[coDup].freq < 1 ) ) {
                                dx.items.splice( coDup, 1 );
                                coDup--;
                            }
                        item._awards = angular.extend( {}, item.awards );
                        updateItemAwards( item );            
                        dx.items.splice( co, 0, item );
                    }
                    if ( dx.items.length > 200 )
                        dx.items.length = 200;
                    lastModified =  response.headers( 'last-modified' );
                    $rootScope.$emit( 'dx-update' );
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
        dx.items.forEach( updateItemAwards );
        $rootScope.$emit( 'dx-update' );
    }

    function updateItemAwards( item ) {
        item.awards = [];
        itemAwards( item );
        if ( item.special && 
                !User.data.specialLists.Special.items.find( function( listItem ) {
            return item.cs == listItem.callsign; }) ) 
            User.data.specialLists.Special.items.push( { callsign: item.cs } );
        itemListAwards( item );
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
            var a = { award: aN, value: aV, sound: false, 
                noStats: awards[aN].noStats };
            var byBand = awards[aN].byBand;
            if ( user.awards || user.awardsSettings ) {
                if ( user.awardsSettings != null &&
                        aN in user.awardsSettings ) {
                    var as = user.awardsSettings[aN];
                    if ( as.track ) {
                        if ( as.settings != null ) {
                            if ( item.band in as.settings.bands && 
                                    !as.settings.bands[item.band] )
                                continue;
                            if ( item.mode in as.settings.modes &&
                                    !as.settings.modes[item.mode] )
                                continue;
                            if ( item.subMode in as.settings.modes &&
                                    !as.settings.modes[item.subMode] )
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
                    if ( byBand && ( fl = checkAward( uav, item ) ) )
                        uav = fl;
                    if ( !byBand || fl ) {
                        if ( checkAwardCfm( uav, awards[aN].cfm ) )
                            continue;
                        else
                            a.worked = true;
                    }
                }

                if ( byBand && awards[aN].modes ) {
                    if ( awards[aN].modes.indexOf( item.mode ) != -1 )
                        a.mode = item.mode;
                    else a.mode = item.subMode;
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
                    if ( listItem.settings ) {
                        if ( listItem.settings.hide )
                            return;
                        if ( item.band in listItem.settings.bands && 
                                !listItem.settings.bands[item.band] )
                            return;
                        if ( item.mode in listItem.settings.modes &&
                                !listItem.settings.modes[item.mode] )
                            return;
                        if ( item.subMode in listItem.settings.modes &&
                                !listItem.settings.modes[item.subMode] )
                            return;
                    }
                    if ( listItem.callsign == item.cs || ( listItem.pfx && 
                                item.cs.indexOf( listItem.callsign ) == 0 ) ) {
                        var worked = false;
                        if ( list.id in user.listsAwards && listItem.callsign in 
                            user.listsAwards[list.id] ) {
                            var uav = user.listsAwards[list.id][listItem.callsign];
                            if ( uav = checkAward( uav, item ) ) {
                                var cfm = createCfm( listItem );
                                if ( checkAwardCfm( uav, cfm ) )
                                    return;
                                else
                                    worked = true;
                            }

                        }
                        item.awards.push( { award: list.title, 
                            value: listItem.callsign,
                            dtEnd: listItem.dt_end,
                            link: listItem.link,
                            descr: listItem.descr,
                            worked: worked, list_id: list.id, color: list.color,
                            sound: ( worked && 
                                    ( !listItem.settings || 
                                      listItem.settings.sound.wkd ) ) || 
                                ( !worked && 
                                  ( !listItem.settings || 
                                    listItem.settings.sound.not ) )
                        } );
                        
                    }
                });
        });
       
    }
}

