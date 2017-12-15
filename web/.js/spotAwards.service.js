angular
    .module( 'adxcApp' )
    .service( 'SpotAwards', SpotAwards );

SpotAwards.$inject = [ '$rootScope', 'User', 'Awards', 'Notify', 'DxConst', 'UserAwards' ];

function SpotAwards( $rootScope, User, Awards, Notify, DxConst, UserAwards ) {
    var user = User.data;
    var allAwards = {};
    var cfm = {};
    var listCfm = {};

    
    var sa = { 
        ready: false,
        onUpdate: onUpdate,
        processSpot: processSpot
    };

    init();
    return sa;

    function init() {

        DxConst.cfm.forEach( function( item ) {
            listCfm[ item[1] ] = 1;       
        });
        
        User.onLogIO( function() {
            user = User.data;
        } );

        User.onAwardsStatsChange( function() {
            if ( Awards.data )
                loadAwardsList();
        });
    }

    function loadAwardsList() {
        if ( Awards.data.length > 0 ) {
            Awards.data.forEach( function( award ) {
                var a = angular.extend( {}, award );
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
                a.settings.mixMode = uas.settings.mixMode;
                a.settings.sound = uas.settings.sound;
                allAwards[award.name] = a;
            });
            sa.ready = true;
            $rootScope.$emit( 'spotAwards-update' );
        }
    }

    function onUpdate( callback, scope ) {
        Notify.notify( 'spotAwards-update', callback, scope );
    }

    function processSpot( spot, awardsList, listsList ) {
        spot.awards = [];
        var awards = false;
        if ( awardsList ) {
            if ( awardsList.length > 0 ) {
                awards = {};
                awardsList.forEach( function( item ) {
                    awards[item] = allAwards[item];
                });
            }
        } else 
            awards = angular.extend( {}, allAwards );
        if ( awards )
            spotAwards( spot, awards );
        if ( spot.special && 
                !User.data.specialLists.Special.items.find( function( listItem ) {
            return spot.cs == listItem.callsign; }) ) 
            User.data.specialLists.Special.items.push( { callsign: spot.cs } );
        var lists = listsList ? listsList : user.lists;
        if ( lists.length > 0 )
            spotListAwards( spot, lists );
    }
       
    function spotListAwards( spot, lists ) {
        lists.forEach( function( list ) {
            if ( list.track )
                list.items.forEach( function( listItem ) {
                    if ( listItem.settings ) {
                        if ( listItem.settings.hide )
                            return;
                        if ( spot.band in listItem.settings.bands && 
                                !listItem.settings.bands[spot.band] )
                            return;
                        if (!listItem.settings.mixMode) {
                            if ( spot.mode in listItem.settings.modes &&
                                    !listItem.settings.modes[spot.mode] )
                                return;
                            if ( spot.subMode in listItem.settings.modes &&
                                    !listItem.settings.modes[spot.subMode] )
                                return;
                        }
                    }
                    if ( ( list.title != 'DX' && 
                            ( listItem.callsign == spot.cs || 
                              ( listItem.re && spot.cs.match( listItem.re ) ) ) ) || 
                          ( list.title == 'DX' && listItem.callsign == spot.pfx ) ) {
                        let worked = false;
                        let uav = null
                        if ( uav = UserAwards.getListAward( list, listItem, spot ) ) {
                            if (uav.confirmed)
                                return;
                            else
                                worked = true;
                        }
                        spot.awards.push( { award: list.title, 
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

    function spotAwards( spot, awards ) {
        for ( const aN in spot._awards ) {
            const aV = spot._awards[aN];
            if ( !( aN in awards ) )
                continue;
            const ad = awards[aN];
            const as = ad.settings;
            const a = { award: aN, value: aV.value, sound: false, 
                noStats: as.noStats, mode: aV.mode };
            const byBand = awards[aN].byBand;

            if ( ad.track ) {
                if ( spot.band in as.bands && !as.bands[spot.band] )
                    continue;
                if ( !as.mixMode && aV.mode in as.modes && !as.modes[aV.mode] )
                    continue;
                a.color = ad.color;
            } else 
                continue;
            let ua = null;
            if ( ua = UserAwards.getAward( ad, a.value, 
                    byBand ? spot.band : null, 
                    as.mixMode ? 'Mix' : a.mode ) ) {
                if (ua.confirmed)
                    continue;
                else
                    a.worked = true;
            }
                
            if ( ( a.worked && as.sound.wkd ) || 
                    ( !a.worked && as.sound.not ) )
                a.sound = true;

            spot.awards.push( a );
        }
    }


}
 
