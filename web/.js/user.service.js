angular
    .module( 'adxcApp' )
    .service( 'User', UserService );

function UserService( $http, $window, $q, $interval, Storage, Awards, DxConst, 
        LoadingScreen, $rootScope, Notify, DXpedition ) {
    var storageKey = 'adxcluster-user';
    var defaultColor = '#770000';
    var updateTask = $interval( update, 300000 );
    var dxpedTask = $interval( initDXpedition, 3600000 );
    var user = { 
        fromStorage: fromStorage,
        toStorage: toStorage,
        awardSettingsChanged: awardSettingsChanged,
        listChanged: listChanged,
        deleteList: deleteList,
        saveList: saveList,
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
        onAwardsStatsChange: onAwardsStatsChange
    };
    var dxpSettings = null;
    
    return user;

    function update() {
        Awards.load();
        DXpedition.load();
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
        }
        init();
    }

    function loggedIn() {
        return Boolean( user.data.token );
    }

    function init() {

        if ( !user.data )
            user.data = {};

        if ( !user.data.lists )
            user.data.lists = [];

        if ( !user.data.awards )
            user.data.awards = {};

        if ( !user.data.listsAwards )
            user.data.listsAwards = {};

        if ( !user.data.awardsSettings )
            user.data.awardsSettings = {};

        if ( !user.data.token )
            user.data.remember = true;

        if ( !user.data.awardValueWorkedColor )
            user.data.awardValueWorkedColor = '#0091c9';
        if ( !user.data.awardValueConfirmedColor )
            user.data.awardValueConfirmedColor = '#02b20e';

        user.data.dxpedition = user.data.lists.find( function( item ) {
            return item.title == 'DXPED';
        });
        if ( !user.data.dxpedition ) {
            user.data.dxpedition = { title: 'DXPED', 
                full_title: 'DXpedition List',
                items: [] };
            user.data.lists.push( user.data.dxpedition );
        }

        user.data.lists.forEach( function( list ) {
            if ( !user.data.listsAwards[list.id] )
                user.data.listsAwards[list.id] = {};
            if ( !list.color )
                list.color = defaultColor;
        });

        Awards.onUpdate( createAwardsSettings );
        if ( Awards.awards )
            createAwardsSettings();
        else
            Awards.load();

        DXpedition.onUpdate( initDXpedition );
        if ( DXpedition.dxpedition )
            initDXpedition();
        else
            DXpedition.load();

        $rootScope.$emit('user-log-io');

    }



    function initDXpedition() {
        var dxpList = DXpedition.dxpedition ? 
            DXpedition.dxpedition.filter( function( item ) {
                return ( !item.dt_begin || moment( item.dt_begin ) > moment() ) &&
                    (!item.dt_end || 
                     moment( item.dt_end ).add( 1, 'weeks' ) > moment() );
            }) : [];        
        user.data.dxpedition.items = 
            user.data.dxpedition.items.filter( function( settingItem ) {
                return dxpList.find( function( listItem ) {
                    return listItem.callsign == settingsItem.callsign } );
            });
        dxpList.forEach( function( item ) {
            if ( !user.data.dxpedition.items.find( function( settingsItem ) {
                return item.callsign == settingsItem.callsign; } ) )
                user.data.dxpedition.items.push( { callsign: item.callsign } );
        });
        $rootScope.$emit('user-awards-stats-change');
    }


    function createAwardsSettings() {
        Awards.awards.forEach( function( award ) {
            if ( !user.data.awards[award.name] )
                user.data.awards[award.name] = {};

            if ( !user.data.awardsSettings[award.name] ) 
                user.data.awardsSettings[award.name] = 
                { 'track': true };
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
                modes: DxConst.modes,
                cfm: DxConst.cfm
            };
            for ( var field in st ) 
                if ( !s[field] ) {
                    s[field] = [];
                    st[field].forEach( function( item ) {
                        if ( Array.isArray( item ) )
                            s[field].push( { name: item[1], 
                                enabled: true, display: item[0] } );
                        else
                            s[field].push( { name: item, 
                                enabled: true, display: item } );
                    });
                }
            if ( !user.data.awardsSettings[award.name].settings.sound )
                user.data.awardsSettings[award.name].settings.sound =
                    { wkd: true, not: true };

        });
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
                    console.log( response.data );
                    return response.data;
                })
                .catch( serverError );
    }

    function serverError( error ) {
        console.log('User settings XHR Failed: ' + error.data);
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

    function saveListItem( item, list ) {
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
   
    function createList() {
        var no = user.data.lists.length + 1;
        var list = { 
            title: 'LIST' + no, 
            full_title: 'List #' + no,
            no: no, 
            items: [], 
            color: defaultColor, 
            track: true };
        user.data.lists.push( list );
        return saveList( list );
    }

    function deleteListItem( item, list ) {
        if ( $window.confirm( 'Do you really want to remove callsign ' + 
                item.callsign + ( item.pfx ? '*' : '' ) + ' from the list?' ) ) {
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
       } else
           return false;

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
                init();
                toStorage();
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
        data.stats_settings = award.statsSettings;
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
            .then(
                function( response ) {
                    if ( response.data.awards )
                        user.data.awards = response.data.awards;
                    user.data.lastAdifLine = response.data.lastAdifLine;
                    toStorage();
                    if ( response.data.awards ) {
                        $rootScope.$emit('user-awards-stats-change');
                        return true;
                    } else return false;
                });
    };
   
}

