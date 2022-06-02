
const { mixfix } = require('./mixfix.js');
const { tacit, implement, override, NoImplError } = require('./tacits.js');

const assert = require('chai').assert;

describe('tacits', () => {

  describe('implementations', () => {

    const Foldable = tacit('foldr');

    implement(Array, {
      [Foldable.foldr](ar, f, z) {
        return ar.reduce(f, z);
      },
    });

    implement(Set, {
      [Foldable.foldr](xs, f, z) {
        return [...xs].reduce(f, z);
      },
    });

    const add = (a, b) => a + b;
    const sum_f = f => f[Foldable.foldr](add, 0);
    const sum_m = mixfix(sum_f);

    describe('works', () => {
      it('plain', () => assert.equal(sum_f([1, 2, 3]), 6));
      it('prefix', () => assert.equal(sum_m([1, 2, 3]), 6));
      it('infix', () => assert.equal([1, 2, 3][sum_m](), 6));
    });

    describe('throws on missing impl', () => {
      it('plain', () => assert.throws(() => sum_f("ohno")(), NoImplError));
      it('prefix', () => assert.throws(() => sum_m("ohno")(), NoImplError));
      it('infix', () => assert.throws(() => "ohno"[sum_m](), NoImplError));
    });

    it('does not pick up an impl from a non-immediate prototype', () => {

      const T = tacit('get');
      class A { }
      implement(A, { [T.get]() { return 'ok'; } });
      class B extends A { }

      const a = new A();
      const b = new B();

      assert.equal(a[T.get](), 'ok');
      assert.throws(() => T.get(b), NoImplError);
      assert.throws(() => b[T.get](), NoImplError);

    });

    it('supports static syntax', () => {
      const T = tacit('t');
      class C { }
      implement(C, { [T.t](x) { return x; } });
      assert.equal(C[T.t]('ok'), 'ok');
    });

  });

  describe.skip('overrides', () => {

    const Show = tacit('show');

    it('works on non-primitives', () => {

      class Class { }

      implement(Class, {
        [Show.show](_) {
          return 'shown';
        }
      });

      const ov = {
        [Show.show](_) {
          return '!!';
        }
      };

      const c1 = new Class;
      const c2 = new Class;
      override(c2, ov);

      assert.equal(Show.show(c1), 'shown');
      assert.equal(Show.show(c2), '!!');
      assert.ok(c2 instanceof Class);

    });

    it('works on primitives', () => {

      implement(Number, {
        [Show.show](n) {
          return '' + n;
        }
      });

      const ov = {
        [Show.show](_) {
          return '!!';
        }
      };

      const n1 = 12;
      const n2 = override(12, ov);

      assert.equal(Show.show(n1), '12');
      assert.equal(Show.show(n2), '!!');
      assert.equal(n2 + 1, 13);  // still a number

    });

  });

});
