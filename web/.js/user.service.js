angular
    .module( 'adxcApp' )
    .service( 'User', UserService );

UserService.$inject = [ '$http', '$window', '$q', '$interval', 
    'Storage', 'Awards', 'DxConst', 'LoadingScreen', '$rootScope', 
    'Notify', 'SpecialLists' ];


function UserService( $http, $window, $q, $interval, Storage, Awards, DxConst, 
        LoadingScreen, $rootScope, Notify, SpecialLists ) {
    var storageKey = 'adxcluster-user';
    var defaultColor = '#770000';
    var defaultColorDXped = '#f600df';
    var updateTask = $interval( update, 300000 );
    var dxpedTask = $interval( initSpecialLists, 3600000 );
    var checkMsgTask = $interval( checkMessage, 60000 );
    var user = {
        fromStorage: fromStorage,
        toStorage: toStorage,
        awardSettingsChanged: awardSettingsChanged,
        applyUserTemplate: applyUserTemplate,
        listChanged: listChanged,
        deleteList: deleteList,
        saveList: saveList,
        saveAllListItems: saveAllListItems,
        saveListItem: saveListItem,
        createList: createList,
        deleteListItem: deleteListItem,
        saveAwardStatsSettings: saveAwardStatsSettings,
        awardPostData: awardPostData,
        saveData: saveData,
        uploadADIF: uploadADIF,
        changeEmail: changeEmail,
        changePassword: changePassword,
        login: login,
        logout: logout,
        loggedIn: loggedIn,
        saveUserSettings: saveUserSettings,
        onLogIO: onLogIO,
        onAwardsStatsChange: onAwardsStatsChange,
        loadAutoCfm: loadAutoCfm
    };
    var dxpSettings = null;
    var usrTmplt = null;
    var reUsrTmplts = /^\/(dxp)$/;

    return user;

    function update() {
        Awards.load();
        SpecialLists.load();
    }

    function onDestroy() {
        if ( angular.isDefined( updateTask ) ) {
            $interval.cancel( updateTask );
            updateTask = undefined;
        }
    }


    function onLogIO( callback, scope ) {
        Notify.notify( 'user-log-io', callback, scope );
    }

    function onAwardsStatsChange( callback, scope ) {
        Notify.notify( 'user-awards-stats-change', callback, scope );
    }

    function fromStorage() {
        var ud;
        var storages = {'local': true, 'session': false };
        for ( var storage in storages )
            if ( ud = Storage.load( storageKey, storage ) ) {
                ud['remember'] = storages[storage];
                break;
            }

        if ( ud ) {
            user.data = ud;
            getDataVersion()
                .then( function() {
                    init( true );
                });
        } else 
            init();
    }

    function getDataVersion() {
        return $http.get( '/userMetadata.json' )
            .then( function( result ) {
                user.dataVersion = result.data[user.data.callsign];
            });
    }

    function loggedIn() {
        return user.data ? ( user.data.token ? true : false )
            : false;
    }

    function init( checkVersion ) {

        //console.log( $stateParams );

        if ( !user.data )
            user.data = {};

        if ( checkVersion ) {
            if ( !user.data.version )
                user.data.version = null;
            
            if ( user.data.version !== user.dataVersion ) {
                reload();
                return;
            }
        } else if (user.data.version !== user.dataVersion ) {
            user.data.version = user.dataVersion;
            toStorage();
        }


        if ( !user.data.lists )
            user.data.lists = [];

        if ( !user.data.awards )
            user.data.awards = {};

        if ( !user.data.listsAwards )
            user.data.listsAwards = {};

        if ( !user.data.awardsSettings )
            user.data.awardsSettings = {};

        if ( user.data.token ) 
            usrTmplt = null;
        else {            
            user.data.remember = true;
            var r = reUsrTmplts.exec( window.location.pathname );
            if ( r )
                usrTmplt = r[1]; 
        } 

        if ( !user.data.msc )
            user.data.msc = {};
        if ( !user.data.msc.additionalCs )
            user.data.msc.additionalCs = [];
        if ( !user.data.msc.emails )
            user.data.msc.emails = {};


        if ( !user.data.awardValueWorkedColor )
            user.data.awardValueWorkedColor = '#0091c9';
        if ( !user.data.awardValueConfirmedColor )
            user.data.awardValueConfirmedColor = '#02b20e';

        user.data.specialLists = {};
        for ( var title in SpecialLists.lists ) {
            var listParams = SpecialLists.lists[title];
            var list = user.data.lists.find( function( item ) {
                return item.title == title;
            });
            if ( !list ) {
                list = { title: title, 
                    track: true,
                    color: listParams.color,
                    items: [] };
                user.data.lists.push( list );
            }
            if ( !list.id )
                saveList( list );
            list.full_title = listParams.fullTitle;
            list.special = true;
            list.noStats = listParams.noStats;
            user.data.specialLists[title] = list;
        }

        user.data.lists.forEach( function( list ) {
            if ( !user.data.listsAwards[list.id] )
                user.data.listsAwards[list.id] = {};
            if ( !list.color )
                list.color = defaultColor;
            if ( !list.special )
                list.special = false;
            if ( !list.items )
                list.items = [];
            if ( list.title != 'DX' )
                list.items.forEach( listItemRE );
        });

        if ( usrTmplt == 'dxp' ) {
            user.data.lists.forEach( function( list ) {
                list.track = false;
            } );
            user.data.specialLists['DXpedition'].track = true;
        }

        Awards.onUpdate( createAwardsSettings );
        if ( !Awards.data )
            Awards.load();

        SpecialLists.onUpdate( initSpecialLists );
        if ( !SpecialLists.data )
            SpecialLists.load();


        $rootScope.$emit('user-log-io');

    }

    function applyUserTemplate( usrTmplt ) {
        if ( usrTmplt == 'dxp' ) {
        }   
    }



    function initSpecialLists() {
        for ( var title in SpecialLists.data ) {
            var listData = SpecialLists.data[title];
            if ( title == 'DXpedition' )
                listsData = listData.filter( function( item ) {
                    return ( !item.dt_begin || moment( item.dt_begin ) < moment() ) 
                        && ( !item.dt_end || 
                        moment( item.dt_end ).add( 1, 'weeks' ) > moment() );
                });        
            var list = user.data.specialLists[title];
            if ( !list.items )
                list.items = [];
            list.items = 
                list.items.filter( function( listItem ) {
                    return listData.find( function( listDataItem ) {
                        return listItem.callsign == listDataItem.callsign } );
                });
            listData.forEach( function( listDataItem ) {
                var listItem;
                if ( !( listItem = list.items.find( function( listItem ) {
                    return listItem.callsign == listDataItem.callsign; } ) ) ) {
                    listItem = { callsign: listDataItem.callsign };
                    if ( title == 'DX' ) {
                        listItem.pfx = true;
                        listItem.settings = {};
                        var fields = { bands: DxConst.bands, modes: DxConst.modes };
                        for ( var field in fields ) {
                            listItem.settings[field] = {};
                            fields[field].forEach( function( fieldV ) {
                                listItem.settings[field][fieldV] = false;
                            });
                        }
                        for ( var field in { 'mobile': 1, 'sound': 1 } )
                            listItem.settings[field] = 
                                { 'wkd': false, 'not': false };
                    }
                    list.items.push( listItem );
                }
                angular.extend( listItem, listDataItem );
            });
        }
        $rootScope.$emit('user-awards-stats-change');
    }


    function createAwardsSettings() {
        Awards.data.forEach( function( award ) {
            if ( !user.data.awards[award.name] )
                user.data.awards[award.name] = {};

            if ( !user.data.awardsSettings[award.name] ) 
                user.data.awardsSettings[award.name] = 
                { 'track': !loggedIn() };
            if ( !user.data.awardsSettings[award.name].color )
                user.data.awardsSettings[award.name].color = 
                    award.color ? award.color : defaultColor;
            if ( user.data.awardsSettings[award.name].adif == null )
                user.data.awardsSettings[award.name].adif = true;
            if ( !user.data.awardsSettings[award.name].settings )
                user.data.awardsSettings[award.name].settings = {};
                var s = user.data.awardsSettings[award.name].settings;
            var st =
            { bands: DxConst.bands,
                modes: award.modes ? award.modes : DxConst.modesSuper,
                cfm: award.cfmTypes ? award.cfmTypes : DxConst.cfm 
            };
            function findMode(mode) {
                return st.modes.find( function( item ) {
                    return item == mode; } );
            }
            for ( var field in st ) {
                if ( !s[field] ) {
                    s[field] = [];
                }
                st[field].forEach( function( item ) {
                    if ( Array.isArray( item ) ) {
                        if ( cfmItem = s[field].find( function( sItem  ) {
                            return sItem.name == item[1]; }) )
                            cfmItem.display = item[0];
                        else
                            s[field].push( { name: item[1], 
                                enabled: true, display: item[0] } );
                    } else if ( !s[field].find( function( sItem ) {
                            return sItem.name == item; }))
                        s[field].push( { name: item, 
                            enabled: true, display: item } );
                });
            }
            s.cfm = s.cfm.filter( function( item ) {
                return st.cfm.find( function( stItem ) {
                    return stItem[1] == item.name; } ) } );
            s.modes = s.modes.filter( function( item ) {
                return findMode( item.name ); } );
            if ( s.stats_settings && s.stats_settings.modeFilter )
                for ( var mode in s.stats_settings.modeFilter )
                    if ( !findMode( mode ) )
                        delete s.stats_settings.modeFilter[mode];
            if ( !user.data.awardsSettings[award.name].settings.sound )
                user.data.awardsSettings[award.name].settings.sound =
                    { wkd: true, not: true };

        });
        if ( usrTmplt == 'dxp' )
            for ( var award in user.data.awardsSettings )
                user.data.awardsSettings[award].track = false;
        $rootScope.$emit('user-awards-stats-change');
    }



    function toStorage() {
        Storage.save( storageKey, user.data, 
            user.data.remember ? 'local' : 'session' );
    }

    function toServer( data ) {
        if ( data.token = user.data.token ) 
            return $http.post( '/uwsgi/userSettings', data )
                .then( function( response ) {
                    if ( response.data && response.data.version ) {
                        user.data.version = response.data.version;
                        toStorage();
                    }
                    return response.data;
                })
                .catch( serverError );
    }

    function reload() {
        if ( user.data.token )
            return toServer( { reload: 1 } )
                .then( function( data ) {
                    data.remeber = user.data.remember;
                    user.data = data;
                    init();
                    toStorage();
                } );
        else {
            user.data = {};
            user.data.version = user.dataVersion;
            init();
        }
    }

    function checkMessage() {
        if ( user.data.token )
            return toServer( { checkMessage: 1 } )
                .then( function( result ) {
                    if ( result ) {
                        if ( result.reload )
                            reload();
                        if ( result.text )
                            $window.alert( result.text );
                    }
                } );
    }

    function loadAutoCfm( award, cfmData ) {
        if ( user.data.token )
            return toServer( { loadAutoCfm: 1, award: award, cfmData: cfmData } )
                .then( function( result ) {
                    if ( result ) {
                        if ( result.reload )
                            reload();
                        if ( result.text )
                            $window.alert( result.text );
                    }
                });
       
    }


    function serverError( error ) {
        console.log('User settings XHR Failed: ' + error.data);
        if ( error.data == 'Login expired' ) {
            logout();
            $window.alert( 'Your login expired. Please relogin.' );
            $state.go( 'login' );
        } else 
            $window.alert( 'Error saving your settings to server.' + 
                'Please try again later' );
        return false;
    }


    function awardSettingsChanged( award ) {
        saveData( {
                    'award': award.name,
                    'track': user.data.awardsSettings[award.name].track,
                    'color': user.data.awardsSettings[award.name].color,
                    'settings': user.data.awardsSettings[award.name].settings
        } );
        $rootScope.$emit('user-awards-stats-change');

    }

    function saveUserSettings() {
        saveData( { 'award_value_worked_color': user.data.awardValueWorkedColor,
            'award_value_confirmed_color': user.data.awardValueConfirmedColor,
            'dxpedition': user.data.dxpedition
        });
    }
    

    function listChanged( list ) {
        function save() {
            toServer( { 
                        'list_id': list.id,
                        'track': list.track,
                        'color': list.color,
            } );          
        }
        toStorage();
        if ( list.id )
            save();
        else
            saveList( list )
                .then( function( id ) {
                    if ( id )
                        save();
                });
        $rootScope.$emit('user-awards-stats-change');
    }

    function deleteList( list ) {
        if ( $window.confirm( 'Do you really want to remove user list ' + 
                    list.title + '?' ) ) {
            var i = user.data.lists.indexOf( list );
            user.data.lists.splice( i, 1 );
            toStorage();
            if ( list.id )
                toServer( 
                    { 
                        'list_id': list.id,
                        'delete': true
                    } );
            $rootScope.$emit('user-awards-stats-change');

        }

    }

    function saveList( list ) {
        toStorage();
        if ( user.data.token )
            return toServer( {
                    'list_id': list.id ? list.id : 'new',
                    'full_title': list.full_title,
                    'title': list.title } )
                .then( function( data ) { 
                    if ( !list.id ) {
                        if ( 'list_id' in data ) {
                            list.id = data.list_id;
                            toStorage();
                            return list.id;
                        }
                        else {
                            serverError();
                            return false;
                        }

                    }
                });
        else 
            if ( !list.id ) {
                list.id = '_' + user.data.lists.length;
                toStorage();
                return $q.when( {} )
                    .then( function() { 
                        return list.id; 
                    } );
                     
            }
        $rootScope.$emit('user-awards-stats-change');


    }

    function listItemRE( item ) {
        if ( item.callsign.indexOf( '*' ) == -1 )
            item.re = null;
        else
            item.re = new RegExp( '^' + item.callsign.replace( /\*/g, '.*' 
                        ).replace( /\//g, '\\/' ) + '$' );
    }

    function saveListItem( item, list ) {
        if ( list.title != 'DX' )
            listItemRE( item );
        toStorage();
        if ( list.id )
            toServer( {
                    'list_id': list.id,
                    'callsign': item.callsign,
                    'settings': item.settings,
                    'pfx': item.pfx
            } );
        $rootScope.$emit('user-awards-stats-change');

    };

    function saveAllListItems( list ) {
        toStorage();
        if ( list.id )
            toServer( {
                    'list_id': list.id,
                    'items': list.items
            } );
        $rootScope.$emit('user-awards-stats-change');

    };


    function createList() {
        var no = user.data.lists.length + 1;
        var list = { 
            title: 'AWARD' + no, 
            full_title: 'Award #' + no,
            no: no, 
            items: [], 
            color: defaultColor, 
            track: true };
        user.data.lists.push( list );
        return saveList( list );
    }

    function deleteListItem( item, list ) {
        var i = list.items.indexOf( item );
        list.items.splice( i, 1 );
        toStorage();            
        if ( list.id ) {
            if ( list.id == 'dxpedition' )
                DXpedition.deleteItem( item );
            else   
                toServer( {
                        'list_id': list.id,
                        'callsign': item.callsign,
                        'delete': true
                } );
        }
        $rootScope.$emit('user-awards-stats-change');
        return true;
    }

    function awardPostData( award ) {
        var data = {};
        if ( award.list_id )
            data.list_id = award.list_id;
        else
            data.award = award.name;
        return data;
    }

    function changeEmail( newEmail ) {
        return saveData( { email: newEmail } )
            .then( function() {
                user.data.email = newEmail;
                return true;
            });
    }

    function changePassword( newPwd, oldPwd ) {
        if ( user.data.token ) 
            return $http.post( '/uwsgi/userSettings', 
                    { token: user.data.token,
                    password: newPwd,
                    oldPassword: oldPwd
                    })
            .then( function() {
                return true;
            })
    }
    
    function login( userData, remember ) {
        return $http.post( '/uwsgi/login', userData )
            .then( function( response ) {
                user.data = response.data;
                user.data.remember = remember;
                getDataVersion().
                    then( function() {
                        init();
                        toStorage();
                    });
                return true;
            });
    }
   
    function logout() {
        Storage.remove( storageKey, 'local' );
        Storage.remove( storageKey, 'session' );
        user.data = {};
        init();
    }

    
    function saveAwardStatsSettings( award ) {
        var data = awardPostData( award )
        data.stats_settings = award.list_id ? award.stats_settings : 
            user.data.awardsSettings[award.name].stats_settings;
        saveData( data );
    }

    function saveData( data ) {
        toStorage();
        return toServer( data );
    }

    
    function uploadADIF( adif ) {
        var awards = {}
        adif.awards.forEach( function( award ) {
            user.data.awardsSettings[award.name].adif = award.enabled;
            awards[award.name] = award.enabled;
        });
        toStorage();
        return $http({
            method: 'POST',
            url: "/uwsgi/userSettings",
            headers: { 'Content-Type': false,
                'Content-Encoding': 'gzip'},
            data: { token: user.data.token, 
                adif: { file: adif.file, awards: awards }
                }
            })
            .catch( serverError );
    };
   
}

