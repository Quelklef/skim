
const t = require('../tacits.js');
const { mixfix } = require('../mixfix.js');

/*

Tacit for converting a type to/from a PLAIN value.

A PLAIN value is one of:
- null
- undefined
- true
- false
- a number
- array of PLAIN values
- object whose prototype is Object.prototype,
  keys are strings, and values are PLAIN values

PLAIN object and arrays must not contain cyclic references

*/

const { toPlain, fromPlain } = t.tacit('toPlain', 'fromPlain');

exports.toPlain = toPlain;
exports.fromPlain = fromPlain;

const toString = mixfix(function (value) {
  const plain = value[toPlain]();
  return JSON.stringify(plain);
});

const fromString = mixfix(function (T, string) {
  const plain = JSON.parse(string);
  return T[fromPlain](plain);
});

const id = x => x;

t.implement(String, {
  [toPlain]: id,
  [fromPlain]: id,
});

t.implement(Number, {
  [toPlain]: id,
  [fromPlain]: id,
});

t.implement(Boolean, {
  [toPlain]: id,
  [fromPlain]: id,
});

t.implement(Array, {
  [toPlain]: ar => ar.map(toPlain),
  [fromPlain]: (T, ar) => ar.map(T[fromPlain]),
});

t.implement(Set, {
  [toPlain]: xs => [...xs][toPlain](),
  [fromPlain]: (T, xs) => new Set(Array[fromPlain](T, xs)),
});

// No implementation for Object.
// Use a Map!
