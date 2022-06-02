
const { mixfix } = require('./mixfix.js');

const assert = require('chai').assert;

describe('mixfix', () => {

  function impl(...args) { return args; }
  const m = mixfix(impl);

  it('has correct name', () => {
    assert.equal(m.name, impl.name);
  });

  it('works in prefix', () => {
    assert.deepEqual(m(1, 2, 3), [1, 2, 3]);
  });

  it('works in infix', () => {
    assert.deepEqual((1)[m](2, 3), [new Number(1), 2, 3]);
    // TODO: something about boxing?
  });

});

