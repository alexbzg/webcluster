angular
    .module( 'adxcApp' )
    .service( 'DX', DXService );

DXService.$inject = [ '$rootScope', '$http', '$interval', 'User', 'Awards', 'Notify' ];

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
       Awards.onUpdate( loadAwardsList );
       User.onLogIO( function() {
            user = User.data;
            if ( Awards.data )
                loadAwardsList(); 
        } );

        User.onAwardsStatsChange( function() {
            if ( Awards.data )
                loadAwardsList();
        });
    }

    function loadAwardsList() {
        Awards.data.forEach( function( award ) {
            var a = angular.extend( {}, award );
            a.cfm = createCfm( user.awardsSettings[award.name] );
            a.settings = { bands: {}, modes: {} };
            var uas = user.awardsSettings[award.name];
            for ( var field in a.settings )
                if ( uas.settings[field] )
                    uas.settings[field].forEach( 
                        function( item ) {
                            a.settings[field][item.name] = item.enabled;
                        });
            a.track = uas.track;
            a.color = uas.color;
            a.settings.sound = uas.settings.sound;
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
                    if ( dx.items.length > 500 )
                        dx.items.length = 500;
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
            var ad = awards[aN];
            var as = ad.settings;
            var a = { award: aN, value: aV.value, sound: false, 
                noStats: as.noStats, mode: aV.mode };
            var byBand = awards[aN].byBand;

            if ( ad.track ) {
                if ( item.band in as.bands && !as.bands[item.band] )
                    continue;
                if ( aV.mode in as.modes && !as.modes[aV.mode] )
                    continue;
                a.color = ad.color;
            } else 
                continue;

            if ( aN in user.awards &&
                aV.value in user.awards[aN] ) {
                var uav = user.awards[aN][aV.value];
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

            if ( ( a.worked && as.sound.wkd ) || 
                    ( !a.worked && as.sound.not ) )
                a.sound = true;

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
                    if ( ( list.title != 'DX' && 
                            ( listItem.callsign == item.cs || 
                              ( listItem.re && item.cs.match( listItem.re ) ) ) ) || 
                          ( list.title == 'DX' && listItem.callsign == item.pfx ) ) {
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
                            noStats: list.noStats,
                            value: listItem.callsign,
                            pfx: listItem.pfx,
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

