angular
    .module( 'adxcApp' )
    .service( 'SpotAwards', SpotAwards );

SpotAwards.$inject = [ '$rootScope', 'User', 'Awards', 'Notify' ];

function SpotAwards( $rootScope, User, Awards, Notify ) {
    var user = User.data;
    var allAwards = {};
    var cfm = {};

    
    var sa = { 
        ready: false,
        onUpdate: onUpdate,
        processSpot: processSpot
    };

    init();
    return sa;

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
        if ( Awards.data.length > 0 ) {
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
                allAwards[award.name] = a;
            });
            sa.ready = true;
            $rootScope.$emit( 'spotAwards-update' );
        }
    }

    function onUpdate( callback, scope ) {
        Notify.notify( 'spotAwards-update', callback, scope );
    }

    function createCfm( as ) {
        var cfm = {};
        as.settings.cfm.forEach( function( cfmType ) {
            if ( cfmType.enabled )
                cfm[cfmType.name] = 1;
        });
        return cfm;
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
            if ( uav.cfm[cfmType] ) {
                confirmed = true;
                break;
            }
        return confirmed;
    }
   

    function processSpot( spot, awardsList, listsList ) {
        spot.awards = [];
        var awards = false;
        if ( awardsList ) {
            if ( awardsList.length > 0 )
                awardsList.forEach( function( item ) {
                    awards[item] = allAwards[item];
                });
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
                        if ( spot.mode in listItem.settings.modes &&
                                !listItem.settings.modes[spot.mode] )
                            return;
                        if ( spot.subMode in listItem.settings.modes &&
                                !listItem.settings.modes[spot.subMode] )
                            return;
                    }
                    if ( ( list.title != 'DX' && 
                            ( listItem.callsign == spot.cs || 
                              ( listItem.re && spot.cs.match( listItem.re ) ) ) ) || 
                          ( list.title == 'DX' && listItem.callsign == spot.pfx ) ) {
                        var worked = false;
                        if ( list.id in user.listsAwards && listItem.callsign in 
                            user.listsAwards[list.id] ) {
                            var uav = user.listsAwards[list.id][listItem.callsign];
                            if ( uav = checkAward( uav, spot ) ) {
                                var cfm = createCfm( listItem );
                                if ( checkAwardCfm( uav, cfm ) )
                                    return;
                                else
                                    worked = true;
                            }

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
                if ( aV.mode in as.modes && !as.modes[aV.mode] )
                    continue;
                a.color = ad.color;
            } else 
                continue;

            if ( aN in user.awards &&
                aV.value in user.awards[aN] ) {
                var uav = user.awards[aN][aV.value];
                var fl = false;
                if ( byBand && ( fl = checkAward( uav, spot ) ) )
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

            spot.awards.push( a );
        }
    }


}
 
