#!/usr/bin/python
#coding=utf-8

from dx_t import DX

print DX( text = '', cs = 'FT3EAA', freq = 50096, de = '', time = '1128z' ).toDict()
print DX( text = 'iota AF 68', cs = 'CNBB', freq = 50096, de = '', time = '1128z' ).toDict()
print DX( text = '', cs = 'IJ7A', freq = 50096, de = '', time = '1128z' ).toDict()

