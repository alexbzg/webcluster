angular
    .module( 'adxcApp' )
    .factory( 'UserAwardFactory', UserAwardFactory );

UserAwardFactory.$inject = [ '$rootScope', 'User', 'DxConst' ];
   

function UserAwardFactory( $rootScope, User, DxConst ) {


    return createUserAward;

    function createUserAward( award, value, band, mode, skipSave ) {
        
        var cfmTypes = award.cfmTypes ? award.cfmTypes : DxConst.cfm;
        var cfm = [];
        cfmTypes.forEach( function( item ) {
            cfm.push( item[1] );
        });

        var ua = { award: award,
            value: value,
            band: band,
            mode: mode,
            worked: true,
            save: save,
            remove: remove,
            copy: copy,
            cfm: {}
        };

        init();
        return ua;


        function init() {
            var saveFl = false;

            ua.prnt = award.list_id ?
                User.data.listsAwards[award.list_id] :
                User.data.awards[award.name];
            if ( award.byBand ) {
                if ( !ua.prnt[value] )
                    ua.prnt[value] = {};
                if ( !ua.prnt[value][band] )
                    ua.prnt[value][band] = {};
                ua.prnt = ua.prnt[value][band];
            }
            ua.key = award.byBand ? mode : value; 
            if ( !ua.prnt[ua.key] ) {
                ua.prnt[ua.key] = { cfm: {} };
                saveFl = true;
                cfm.forEach( function( cfmType ) {
                    ua.prnt[ua.key].cfm[cfmType] = false;
                });
            }
            ua.data = ua.prnt[ua.key];

            Object.defineProperty( ua, 'workedCS', { 
                get: function() {
                    return ua.data.workedCS;
                                },
                set: function( val ) {
                    if ( ua.data.workedCS != val ) {
                        ua.data.workedCS = val;
                        save();
                    }
            } });

            cfm.forEach( function( type ) {
                Object.defineProperty( ua.cfm, type, { 
                    get: function() {
                        return ua.data.cfm[type];
                                    },
                   set: function( val ) {
                        if ( ua.data.cfm[type] != val ) {
                            ua.data.cfm[type] = val;
                            save();
                        }
                } });
            });

            if ( saveFl && !skipSave )
                save();
        }

        function copy( data ) {
            ua.workedCS = data.workedCS;
            for ( var type in data.cfm )
                ua.cfm[type] = data.cfm[type];
        }

        function postData() {
            var data = User.awardPostData( award );
            data.value = value;
            if ( award.byBand ) {
                data.band = band;
                data.mode = mode;
            }
            return data;
        }

        function remove() {
            var data = postData();
            data.delete = true;
            delete ua.prnt[ua.key];
            User.saveData( data );
            $rootScope.$emit('user-awards-stats-change');

        }

        function save() {
            var data = postData();
            data.worked_cs = ua.workedCS;
            data.cfm = {};
            cfm.forEach( function( type ) {
                data.cfm[type] = ua.cfm[type];
            });
            User.saveData( data );
            $rootScope.$emit('user-awards-stats-change');

        }

    }


        
}

