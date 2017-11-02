angular
    .module( 'adxcApp' )
    .component( 'dxSelector', 
            {
                templateUrl: '.tmplts/dxSelector.html',
                bindings: {
                    disableSoundSwitch: '<',
                    disableAllSpotsSwitch: '<',
                    storageKey: '<',
                    onSoundChange: '&',
                    onSelectorChange: '&',
                    afterInit: '&'
                },
                controller: DXSelectorController
            }
    );

DXSelectorController.$inject = [ 'DxConst', 'Storage' ];

function DXSelectorController( DxConst, Storage ) {
    var ctrl = this;
    ctrl._onSoundChange = _onSoundChange;
    ctrl._onSelectorChange = _onSelectorChange;
    ctrl.$onInit = init;

    function init() {
        ctrl.selector = Storage.load( ctrl.storageKey, 'local' );
        if ( !ctrl.selector )
            ctrl.selector = {};
        if ( !ctrl.selector.bands || !ctrl.selector.modes  ) {
            var resp = { 'bands': 'bandsAll', 'modes': 'modesSuper' };
            for ( var field in resp ) {

                ctrl.selector[field] = [];
                DxConst[resp[field]].forEach( function( value ) {
                    ctrl.selector[field].push( { name: value, enabled: true } );
                } );

            }
        }
        ctrl.selector.spotFilter = spotFilter;
//        applySelector();
        ctrl.afterInit( { $selector: ctrl.selector } );
    }

    function saveSelector() {
        Storage.save( ctrl.storageKey, ctrl.selector, 'local');
    }

    function _onSelectorChange() {
        saveSelector();
        //applySelector();
        ctrl.onSelectorChange();
    }
/*
    function applySelector() {
        [ 'bands', 'modes' ].forEach( function( field ) {
            vm.selector[field].forEach( function( item ) {
                selector[field][item.name] = item.enabled;
            });
        });
    }
*/
    function _onSoundChange() {
        saveSelector();
        ctrl.onSoundChange();
    }

    function spotFilter( dx ) {
        if ( ctrl.selector.allSpots || dx.awards.length > 0 ) {
            var band = ctrl.selector.bands.find( function( item ) {
                return  item.name == dx.band; } );
            if ( !band || band.enabled ) {
                var mode = ctrl.selector.modes.find( function( item ) {
                    return  item.name == dx.mode; } );
                if ( !mode ||  mode.enabled )
                    return true;
            }
        }
        return false;
    }
}

