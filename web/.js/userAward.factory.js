angular
    .module( 'adxcApp' )
    .factory( 'UserAwardFactory', UserAwardFactory );

UserAwardFactory.$inject = [ '$rootScope', 'User', 'DxConst' ];
   

function UserAwardFactory( $rootScope, User, DxConst ) {
    var props = [ 'workedCS' ];
    DxConst.cfm.forEach( function( item ) {
        props.push( item[1] );
    });


    return createUserAward;

    function createUserAward( award, value, band, mode, skipSave ) {
        

        var ua = { award: award,
            value: value,
            band: band,
            mode: mode,
            worked: true,
            save: save,
            remove: remove,
            copy: copy
        };

        init();
        return ua;

        function init() {

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
            var saveFl = false;
            if ( !ua.prnt[ua.key] ) {
                ua.prnt[ua.key] = {};
                saveFl = true;
            }
            ua.data = ua.prnt[ua.key];

            props.forEach( function( prop ) {
                Object.defineProperty( ua, prop, { 
                get: function() {
                    return ua.data[prop];
                                },
                set: function( val ) {
                    if ( ua.data[prop] != val ) {
                        ua.data[prop] = val;
                        save();
                    }
                } });
            });
            if ( saveFl && !skipSave )
                save();
        }

        function copy( data ) {
            props.forEach( function( prop ) {
                ua[prop] = data[prop];
            });
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
            props.forEach( function( prop ) {                
                data[prop] = prop == 'workedCS' ? ua[prop] :
                    Boolean( ua[prop] );
            });
            User.saveData( data );
            $rootScope.$emit('user-awards-stats-change');

        }

    }


        
}

