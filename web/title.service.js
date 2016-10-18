angular
    .module( 'adxcApp' )
    .service( 'Head', headService );

function headService() {
    var title = 'Awards DX Cluster by R7AB';
    return {
        title: function() { return title; },
        setTitle: function(newTitle) { title = newTitle; }
    };    
}
