#!/usr/bin/python
#coding=utf-8

from dx_t import DX

print DX( text = '', cs = 'FT3EAA', freq = 50096, de = '', time = '1128z' ).toDict()
print DX( text = 'AF 68', cs = 'CNAA', freq = 50096, de = '', time = '1128z' ).toDict()

