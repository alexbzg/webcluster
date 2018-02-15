angular
    .module( 'adxcApp' )
    .service( 'SpotAwards', SpotAwards );

SpotAwards.$inject = [ '$rootScope', 'User', 'Awards', 'Notify', 'DxConst' ];

function SpotAwards( $rootScope, User, Awards, Notify, DxConst ) {
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
            if ( Awards.data )
                loadAwardsList();
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
        if ( spot.special && User.data.specialLists.Special.items && 
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
                        var worked = false;
                        var uav = null;
                        if ( uav = getListAward( list, listItem, spot ) ) {
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
        for ( var aN in spot._awards ) {
            var aV = spot._awards[aN];
            if ( !( aN in awards ) )
                continue;
            var ad = awards[aN];
            var as = ad.settings;
            var a = { award: aN, value: aV.value, sound: false, 
                noStats: as.noStats, mode: aV.mode };
            var byBand = awards[aN].byBand;

            if ( ad.track ) {
                if ( spot.band in as.bands && !as.bands[spot.band] )
                    continue;
                if ( !as.mixMode && aV.mode in as.modes && !as.modes[aV.mode] )
                    continue;
                a.color = ad.color;
            } else 
                continue;
            var ua = null;
            if ( ua = getAward( ad, a.value, 
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

    function getAward( award, value, band, mode ) {

        var ua = null;
        if ( award.name in user.awards && value in user.awards[award.name] ) {
            if (band) {
                if (band in user.awards[award.name][value]) {
                    if (mode === 'Mix') 
                        ua = user.awards[award.name][value][band];
                    else
                        ua = user.awards[award.name][value][band][mode];
                }
            } else 
                ua = user.awards[award.name][value];
        }
        if (ua) {
            var cfm = user.awardsSettings[award.name].settings.cfm;
            var isConfirmed = function( _ua ) {
                var cfmLength = cfm.length;
                for ( var c = 0; c < cfmLength; c++ ) 
                    if ( cfm[c].enabled && _ua.cfm[cfm[c].name] )
                        return true;
                return false;
            };
            if ( mode === 'Mix' ) {
                for ( var _mode in ua )
                    if ( isConfirmed( ua[_mode] ) )
                        return { confirmed: true };
                return { confirmed: false };
            } else
                return { confirmed: isConfirmed( ua ) };
        }
        return false;
    }

    function isConfirmedList( ua ) {
        for (var cfmType in listCfm)
            if (  ua[cfmType] )
                return true;
        return false;
    }

    function getListAward( list, item, spot ) {
        if ( list.id in user.listsAwards && 
            item.callsign in user.listsAwards[list.id] && 
            spot.band in user.listsAwards[list.id][item.callsign] ) {
            var ua = user.listsAwards[list.id][item.callsign][spot.band];
            if (item.settings && item.settings.mixMode) {
                for (var mode in ua)
                    if (isConfirmedList( ua[mode] ))
                        return { 'confirmed': true };
                return { 'confirmed': false };
            } else {
                var mode = null;
                if ( spot.subMode && spot.subMode in ua )
                    mode = spot.subMode;
                if ( spot.mode in ua )
                    mode = spot.mode;
                if (mode)
                    return { 'confirmed': isConfirmedList(ua[mode]) };
            }
        }
        return false;
    }
                    

}
 
