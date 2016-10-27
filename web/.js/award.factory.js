angular
    .module( 'adxcApp' )
    .factory( 'UserAwardFactory', UserAwardFactory );

function UserAwardFactory( User, DxConst ) {

    return createUserAward;

    function createUserAward( award, value, band, mode ) {
        var ua = { award: award,
            value: value,
            band: band,
            mode: mode,
            worked: true
        };
        ua.hash = award.list_id ?
            User.data.listsAwards[award.list_id] :
            User.data.awards[award.name];
        if ( award.byBand ) {
            if ( !ua.hash[value] )
                ua.hash[value] = {};
            if ( !ua.hash[value][band] )
                ua.hash[value][band] = {};
            ua.hash = ua.hash[value][band];
        }
        ua.key = award.byBand ? mode : value; 

        Object.defineProperty( ua, "workedCS", { 
            get: function() {
                return ua.hash[key].workedCS;
                            },
            set: function( val ) {
                ua.hash[key].workedCS = val
            } });

        Object.defineProperty( ua, "confirmed", {
            get: function() {
                for ( var co = 0; co < DxConst.cfmCount; co++ )
                    if ( vm.cfm[co].enabled && av[vm.cfm[co].field] ) {
                        av.confirmed = true;
                        return true;
                    }
                av.confirmed = false;



        
}

