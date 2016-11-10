angular
    .module( 'adxcApp' )
    .service( 'User', UserService );

function UserService( $http, $window, $q, Storage, Awards, DxConst, 
        LoadingScreen, $rootScope, Notify  ) {
    var storageKey = 'adxcluster-user';
    var defaultColor = '#770000';
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
    return user;

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


        user.data.lists.forEach( function( list ) {
            if ( !user.data.listsAwards[list.id] )
                user.data.listsAwards[list.id] = {};
            if ( !list.color )
                list.color = defaultColor;
        });

        Awards.getAwards()
            .then( function( data ) {
                data.forEach( function( award ) {
                    if ( !user.data.awards[award.name] )
                        user.data.awards[award.name] = {};
                    if ( !user.data.awardsSettings[award.name] ) 
                        user.data.awardsSettings[award.name] = 
                            { 'track': true, 
                            'color': award.color ? award.color : defaultColor };
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
        });
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
                    'settings': user.data.awardsSettings[award.name].settings,
        } );
        $rootScope.$emit('user-awards-stats-change');

    }

    function saveUserSettings() {
        saveData( { 'award_value_worked_color': user.data.awardValueWorkedColor,
            'award_value_confirmed_color': user.data.awardValueConfirmedColor });
    }
    

    function listChanged( list ) {
        toStorage();
        if ( list.id )
            toServer( { 
                        'list_id': list.id,
                        'track': list.track,
                        'color': list.color,
            } );
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
            if ( list.id )
                toServer( {
                        'list_id': list.id,
                        'callsign': item.callsign,
                        'delete': true
                } );
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
                $rootScope.$emit('user-log-io');
                return true;
            });
    }
   
    function logout() {
        Storage.remove( storageKey, 'local' );
        Storage.remove( storageKey, 'session' );
        user.data = {};
        init();
        $rootScope.$emit('user-log-io');
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

    
    function uploadADIF( file ) {
        return $http({
            method: 'POST',
            url: "/uwsgi/userSettings",
            headers: { 'Content-Type': false,
                'Content-Encoding': 'gzip'},
            data: { token: user.data.token, adif: file }})
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

