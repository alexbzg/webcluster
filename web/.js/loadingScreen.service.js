angular
    .module( 'adxcApp' )
    .service( 'LoadingScreen', loadingScreenService );

function loadingScreenService() {
    var active = false;
    return {
        active: function() { return active; },
        on: function() { active = true; },
        off: function() { active = false; }
   };    
}
