angular
    .module( 'adxcApp' )
    .service( 'DxConst', DxConstService );

function DxConstService() {
    var dxConst = { 
        bandsAll: [ '1.8', '3.5', '7', '10', '14', '18', '21', '24', '28', 
            '50', '144', 'UHF' ],
        bands: [ '1.8', '3.5', '7', '10', '14', '18', '21', '24', '28', 
            '50', '144' ],
        modes: [ 'CW', 'SSB', 'RTTY', 'PSK31', 'PSK63', 'PSK125', 'JT65' ],
        modesSuper: [ 'CW', 'SSB', 'DIGI' ],
        cfm: [ [ 'Paper', 'cfm_paper' ], 
            [ 'eQSL', 'cfm_eqsl'], ['LOTW', 'cfm_lotw'] ]
    };
    return dxConst;
}
