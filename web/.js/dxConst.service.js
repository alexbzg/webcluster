angular
    .module( 'adxcApp' )
    .constant( 'DxConst', DxConstService() );

DxConstService.$inject = [];
   

function DxConstService() {
    const dxConst = { 
        bandsAll: [ '1.8', '3.5', '7', '10', '14', '18', '21', '24', '28', 
            '50', '144', 'UHF' ],
        bands: [ '1.8', '3.5', '7', '10', '14', '18', '21', '24', '28', 
            '50', '144' ],
        modes: [ 'CW', 'SSB', 'RTTY', 'PSK31', 'PSK63', 'JT65' ],
        modesShort: { 'CW': 'CW', 'SSB': 'SSB', 'DIGI': 'DI', 'RTTY': 'RY',
            'JT65': 'JT', 'PSK63': 'P63', 'PSK31': 'P31', 'DATA': 'DT' },
        modesSuper: [ 'CW', 'SSB', 'DIGI' ],
        cfm: [ [ 'Paper', 'cfm_paper' ], 
            [ 'eQSL', 'cfm_eqsl'], ['LOTW', 'cfm_lotw'] ]        
    };
    dxConst.cfmCount = dxConst.cfm.length;
    dxConst.modesCount = dxConst.modes.length;
    return dxConst;
}
