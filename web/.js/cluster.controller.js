angular
    .module( 'adxcApp' )
    .controller( 'clusterController', clusterController );

function clusterController( $interval, $timeout, Storage, DxConst, DX ) {

    var vm = this;
    var selectorKey = 'adxcluster-selector';
    var sound = new Audio( '/note.mp3' );
    var firstLoad = true;
    var lastCs = null;
    var lastTs = null;

    vm.dx = DX;
    vm.dxFiltered = [];
    vm.replace0 = replace0;
    vm.selectorChange = selectorChange;
    vm.soundChange = soundChange;

    activate();

    return vm;

    function activate() {
        vm.selector = Storage.load( selectorKey, 'local' );
        if ( !vm.selector || !vm.selector.bands || !vm.selector.modes  ) {
            var resp = { 'bands': 'bandsAll', 'modes': 'modesSuper' };
            for ( var field in resp ) {

                vm.selector[field] = [];
                DxConst[resp[field]].forEach( function( value ) {
                    vm.selector[field].push( { name: value, enabled: true } );
                } );

            }
        }

        DX.onNewData.push( dxFilter );

        DX.load();
        $interval( DX.load, 1000 );

        updateTime();
    }
   
    function saveSelector() {
        Storage.save( selectorKey, vm.selector, 'local');
    }

    function selectorChange() {
        saveSelector();
        dxFilter( true );
    }

    function soundChange() {
        if ( vm.selector.sound )
            playSound();
        saveSelector();
    }

    function playSound() {
        sound.play();
    }

    function dxFilter( noSound ) {
        var tmpTs = lastTs;
        var tmpCs = null;
        var soundFl = false;
        vm.dxFiltered = [];


        DX.items.forEach( function( dx ) {
            var fl = false;
            if ( dx.awards.length > 0 || vm.selector.allSpots ){
                var band =  vm.selector.bands.find( function( band ) {
                    return band.name == dx.band; } );
                if ( !band || band.enabled ) {
                    var mode =  vm.selector.modes.find( function( mode ) {
                        return mode.name == dx.mode; } );
                    if ( !mode || mode.enabled )
                        fl = true;
                }
            } 
            
            if ( fl ) {
                vm.dxFiltered.push( dx );
                if ( dx.ts > tmpTs ) {
                    tmpTs = dx.ts;
                    tmpCs = dx.cs
                }
                if ( !noSound && !firstLoad && !soundFl && vm.selector.sound &&
                        dx.ts > lastTs && dx.cs != lastCs ) {

                    var al = dx.awards.length;
                    for ( var co = 0; co < al; co++ )
                        if ( dx.awards[co].sound ) {
                            soundFl = true;
                            break;
                        }
                }
            }
        });

        if ( tmpTs > lastTs ) {
            lastTs = tmpTs;
            lastCs = tmpCs;
            if ( soundFl )
                playSound();
        }

        firstLoad = false;

    }

    function replace0( str ) {
        return str == null ? null : str.replace( /0/g, '\u00D8' );
    }   

    function updateTime() {
        var n = new Date();
        var min = n.getUTCMinutes();
        if ( min < 10 ) min = "0" + min;
        var hr = n.getUTCHours();
        if ( hr < 10 ) hr = "0" + hr;
        vm.time = hr + ':' + min;
        $timeout( updateTime, ( 60 - n.getUTCSeconds() ) * 1000 );
    }
   
}




