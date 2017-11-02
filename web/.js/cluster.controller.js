angular
    .module( 'adxcApp' )
    .controller( 'clusterController', clusterController );

clusterController.$inject = [ '$interval', '$timeout', '$scope',
    'Storage', 'DxConst', 'DX', 'Head', 'News', 'User' ];
   

function clusterController( $interval, $timeout, $scope,
        Storage, DxConst, DX, Head, News, User ) {

    var vm = this;
    var selectorKey = 'adxcluster-selector';
    var sound = new Audio( '/note.mp3' );
    var firstLoad = true;
    var lastCs = null;
    var lastTs = null;

    vm.dx = DX;
    vm.news = News;
    vm.dxFiltered = [];
    vm.replace0 = replace0;
    vm.selectorChange = selectorChange;
    vm.soundChange = soundChange;
    vm.selectorInit = selectorInit;

    DX.onUpdate( function() { dxFilter(); }, $scope );

    activate();

    return vm;

    function activate() {
        Head.setTitle( 'Awards DX Cluster by R7AB' );

        DX.load();
        vm.dxReload = $interval( DX.load, 1000 );

        updateTime();

        $scope.$on( '$destroy', onDestroy );
    }

    function selectorInit( $selector ) {
        vm.selector = $selector;
        dxFilter( true );
    }

    function onDestroy() {
        if ( angular.isDefined( vm.dxReload ) ) {
            $interval.cancel( vm.dxReload );
            vm.dxReload = undefined;
        }
        if ( angular.isDefined( vm.updateTime ) ) {
            $timeout.cancel( vm.updateTime );
            vm.updateTime = undefined;
        }
    }
   

    function selectorChange() {
        dxFilter( true );
    }

    function soundChange() {
        if ( vm.selector.sound )
            playSound();
    }

    function playSound() {
        sound.play();
    }

    function dxFilter( noSound ) {
        if ( !vm.selector )
            return;
        var tmpTs = lastTs;
        var tmpCs = null;
        var soundFl = false;
        vm.dxFiltered = [];


        var dxl = DX.items.length;
        var dxfl = 0;
        for ( var co = 0; co < dxl; co++ )
        {
            var dx = DX.items[co];
            
            if ( vm.selector.spotFilter( dx ) ) {
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
                if ( ++dxfl > 199 )
                    break;
            }
        }
        if ( vm.dxFiltered.length > 500 )
            vm.dxFiltered.length = 500;

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
        vm.updateTime = $timeout( updateTime, ( 60 - n.getUTCSeconds() ) * 1000 );
    }
   
}




