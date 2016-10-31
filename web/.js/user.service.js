angular
    .module( 'adxcApp' )
    .service( 'User', UserService );

function UserService( $http, $window, Storage, Awards, DxConst  ) {
    var storageKey = 'adxcluster-user';
    var defaultColor = '#770000';
    var user = { 
        login: login,
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
        saveData: saveData
    };
    return user;

    function login( loginData ) {
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
            user.loggedIn = Boolean( user.data.token );
        }
        init();
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

        user.data.lists.forEach( function( list ) {
            if ( !user.data.listsAwards[list.id] )
                user.data.listsAwards[list.id] = {};
        });

        Awards.getAwards()
            .then( function( data ) {
                data.forEach( function( award ) {
                    if ( !user.data.awards[award.name] )
                        user.data.awards[award.name] = {};
                    if ( !user.data.awardsSettings[award.name] ) 
                        user.data.awardsSettings[award.name] = 
                            { 'track': true, 'color': defaultColor };
                    if ( !user.data.awardsSettings[award.name].settings ) {
                        user.data.awardsSettings[award.name].settings = {};
                        var s = user.data.awardsSettings[award.name].settings;
                        var st =
                        { bands: DxConst.bands,
                            modes: DxConst.modes,
                            cfm: DxConst.cfm
                        };
                        for ( var field in st ) {
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
    }

    function listChanged( list ) {
        toStorage();
        if ( list.id )
            toServer( { 
                        'list_id': list.id,
                        'track': list.track,
                        'color': list.color,
            } );
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
        }

    }

    function saveList( list ) {
        toStorage();
        if ( user.loggedIn )
        return toServer( {
                'list_id': list.id ? list.id : 'new',
                'full_title': list.full_title,
                'title': list.title } )
            .then( function( data ) { 
                if ( !list.id ) {
                    if ( 'list_id' in data ) {
                        list.id = data.list_id;
                        return list.id;
                    }
                    else {
                        serverError();
                        return false;
                    }

                }
            });

    };

    function saveListItem( item, list ) {
        toStorage();
        if ( list.id )
            toServer( {
                    'list_id': list.id,
                    'callsign': item.callsign,
                    'settings': item.settings,
                    'pfx': item.pfx
            } );
    };
   
    function createList() {
        var no = user.data.lists.length + 1;
        var list = { 
            title: 'LIST' + no, 
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



    function saveAwardStatsSettings( award ) {
        var data = awardPostData( award )
        data.stats_settings = award.statsSettings;
        saveData( data );
    }

    function saveData( data ) {
        toStorage();
        toServer( data );
            

    }
}

