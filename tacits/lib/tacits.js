
const { mixfix } = require('./mixfix.js');

/*

The tacit system is essentially:
- an implementation of single-argument dynamic dispatch
- without inheritance
- using Symbols for method names instead of strings

The intent is to provide a form of ad-hoc polymorphism akin
to Haskell's typeclasses or Rust's traits. (Tacits are not as
powerful as either of these, though)


Terminology:

SKEY
  An SKEY is a value whose toString method always produces the same Symbol.

  SKEY values may be used as object keys without accidental collision
  due to implicit toString conversion.

  The NAME of a SKEY is the name of its underlying Symbol.

TACIT
  A TACIT is a value for which each enumerable own key-value pair (K, F)
  consists of an SKEY K and a DISPATCH F with respect to K.

DISPATCH
  With respect to some SKEY K, a function F is called a DISPATCH if when
  given a value V which has an IMPL for K, the invokation F(V) produces
  said IMPL.

IMPL
A value F is called an IMPL for SKEY K on value V if either:
  1. K is an enumerable own key on V and V[K] = F; or
  2. F is an IMPL for K on the prototype P of V

*/

const NoImplError =
exports.NoImplError =
class NoImplError extends Error {
  constructor(value, skey) {
    super();
    this.value = value;
    this.skey = skey;
  }

  get message() {
    const sname = this.skey.toString().toString().slice(7, -1);
    const cname = Object.getPrototypeOf(this.value).constructor.name;
    return `No impl for '${sname}' on '${cname}'`;
  }
}

const tacit =
exports.tacit =
function tacit(...names) {
  return Object.fromEntries(names.map(name => [name, makeDispatch(name)]));
}

function makeDispatch(name) {
  const dispatch = mixfix(
    Object.defineProperty(
      function(target, ...args) {
        const proto = Object.getPrototypeOf(target);
        const impl = getImpls(proto)[skey];
        if (!impl) throw new NoImplError(target, skey);
        return impl(target, ...args);
      },
      'name', { value: name },
    ),
  );

  const skey = dispatch;
  // ^ due to mixfix(), 'dispatch' is both a DISPATCH and an SKEY

  return dispatch;
}

const implement =
exports.implement =
function implement(cls, dict) {
  for (const skey of Reflect.ownKeys(dict)) {
    const impl = dict[skey];
    implement1(cls, skey, impl);
  }
}

function implement1(cls, skey, impl) {
  const { prototype } = cls;

  // Dynamic dispatch: MyTacit.f(new MyCls, ...vs)
  getImpls(prototype)[skey] = impl;

  // Static dispatch: MyCls[MyTacit.f](new MyCls, ...vs)
  Object.defineProperty(cls, skey, {
    value: impl,
    enumerable: false,
  });
}

const implsSym = Symbol('tacits.impls');
function getImpls(proto) {
  let impls = getOwnProperty(proto, implsSym);
  if (impls) return impls;

  impls = Object.create(null);
  Object.defineProperty(proto, implsSym, {
    value: impls,
    enumerable: false,
  });
  return impls;
}

function getOwnProperty(value, key) {
  const has = !!Object.getOwnPropertyDescriptor(value, key);
  if (!has) return undefined;
  return value[key];
}




const override =
exports.override =
function override(val, dict) {

  console.warn('WARN: Use of experimental feature tacits.override');

  if (typeof val === 'object') {
    const pr = Object.getPrototypeOf(val);
    const ov = Object.create(pr);
    implement({ prototype: ov }, dict);
    Object.setPrototypeOf(val, ov);
  }

  else {
    const pr = Object.create(toBoxed(val));
    implement({ prototype: pr }, dict);
    return Object.create(pr);
  }

}

function toBoxed(val) {
  return (function() { return this; }).call(val);
}
