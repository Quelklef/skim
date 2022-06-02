
const { fromPlain, toPlain } = require('./asPlain.js');

const assert = require('chai').assert;

describe('asPlain', () => {

  describe('roundtrips', () => {

    function roundtrip(...args) {
      const v = args.pop();
      const [T, ...TS] = args;

      const p = v[toPlain]();
      const w = T[fromPlain].apply( null, TS.concat([p]) );
      assert.deepEqual(v, w.valueOf());
    }

    it('string', () => {
      roundtrip(String, '');
      roundtrip(String, 'abc');
    });

    it('number', () => {
      roundtrip(Number, 0);
      roundtrip(Number, 1000);
      roundtrip(Number, Math.PI);
      roundtrip(Number, Infinity);
    });

    it('array', () => {
      roundtrip(Array, Number, [1, 2, 3]);
      roundtrip(Array, Number, [4, [5], [[6, 7]]]);
    });

  });

});
