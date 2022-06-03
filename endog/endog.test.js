
const assert = require('chai').assert;
const fs = require('fs');

const endog = require('./endog.js');
const { Endog } = endog;
const { takeWhile, span, binaryInsertIdx } = endog._testing;

describe('endog', () => {

    describe('units', () => {

      describe('takeWhile', () => {
        it('works', () => {
          assert.deepEqual(takeWhile([0, 1, 2, 3], x => x > 10), []);
          assert.deepEqual(takeWhile([0, 1, 2, 3], x => x < 2), [0, 1]);
          assert.deepEqual(takeWhile([0, 1, 2, 3], x => x < 10), [0, 1, 2, 3]);
        });
      });

      describe('span', () => {
        it('works', () => {
          assert.deepEqual(span([0, 1, 2, 3], x => x > 10), [[], [0, 1, 2, 3]]);
          assert.deepEqual(span([0, 1, 2, 3], x => x < 2), [[0, 1], [2, 3]]);
          assert.deepEqual(span([0, 1, 2, 3], x => x < 10), [[0, 1, 2, 3], []]);
        });
      });

      describe('binaryInsertIdx', () => {
        it('works', () => {
          assert.strictEqual(binaryInsertIdx([], 0), 0);
          assert.strictEqual(binaryInsertIdx([1], 0), 0);
          assert.strictEqual(binaryInsertIdx([0], 0), 1);

          assert.strictEqual(binaryInsertIdx([0, 1, 2, 3], -1), 0);
          assert.strictEqual(binaryInsertIdx([0, 1, 2, 3], .5), 1);
          assert.strictEqual(binaryInsertIdx([0, 1, 2, 3], 1.5), 2);
          assert.strictEqual(binaryInsertIdx([0, 1, 2, 3], 2.5), 3);
          assert.strictEqual(binaryInsertIdx([0, 1, 2, 3], 3.5), 4);

          assert.strictEqual(binaryInsertIdx([0, 1, 2, 3], 0), 1);
          assert.strictEqual(binaryInsertIdx([0, 1, 2, 3], 1), 2);
          assert.strictEqual(binaryInsertIdx([0, 1, 2, 3], 2), 3);
          assert.strictEqual(binaryInsertIdx([0, 1, 2, 3], 3), 4);

          assert.strictEqual(binaryInsertIdx([0, 0, 1, 1, 2, 2, 3, 3], 0), 2);
          assert.strictEqual(binaryInsertIdx([0, 0, 1, 1, 2, 2, 3, 3], 1), 4);
          assert.strictEqual(binaryInsertIdx([0, 0, 1, 1, 2, 2, 3, 3], 2), 6);
          assert.strictEqual(binaryInsertIdx([0, 0, 1, 1, 2, 2, 3, 3], 3), 8);
        });
      });

    });

    describe('endog', () => {

      function init(overrides) {
        const opts = {
          exec(state, ev) {
            state.s ??= '';
            state.s += ev.s;
          },
          getTime(ev) {
            return new Date(ev.time);
          },
          tolerance: 500,

          logloc: `/tmp/endog-log-${Date.now()}-${Math.random()}.jsona`,

          ...overrides,
        };

        return new Endog(opts);
      }

      after(async () => {
        const fnames = await fs.promises.readdir('/tmp');
        await Promise.all(
          fnames
          .filter(fname => fname.startsWith('endog-log'))
          .map(fname => fs.promises.rm(`/tmp/${fname}`))
        );
      });

      it('folds events', () => {
        const ed = init({ tolerance: 100 });
        ed.push({ s: '1', time: Date.now() });
        ed.push({ s: '2', time: Date.now() });
        ed.push({ s: '3', time: Date.now() });
        assert.deepEqual({ s: '123' }, ed.state);
      });

      it('correctly handles out-of-order events', () => {
        const ed = init({ tolerance: 100 });
        const t = Date.now();
        ed.push({ s: 'a', time: t });
        ed.push({ s: 'b', time: t - 1 });
        ed.push({ s: 'c', time: t - 2 });
        assert.deepEqual({ s: 'cba' }, ed.state);
      });

      it('flushes events in a timely manner', async () => {
        const tolerance = 30;
        const ed = init({ tolerance });
        ed.push({ s: 'a', time: Date.now() });
        ed.push({ s: 'b', time: Date.now() });
        ed.push({ s: 'c', time: Date.now() });
        assert.deepEqual({ s: 'abc' }, ed.state);
        await new Promise(resolve => setTimeout(resolve, tolerance * 1.1));
        assert.deepEqual(ed.buffer, []);
      });

      it('rejects old events', async () => {
        const tolerance = 30;
        const ed = init({ tolerance });
        assert.throws(() => ed.push({ time: Date.now() - tolerance - 1 }));
      });

      it('rejects old events atomically', async () => {
        const tolerance = 30;
        const ed = init({ tolerance });
        ed.push({ s: 'x', time: Date.now() });
        assert.throws(() => ed.push({ s: 'x', time: Date.now() - tolerance - 1 }));
        assert.deepEqual({ s: 'x' }, ed.state);
      });

      it('persists events', async () => {
        const tolerance = 30;
        const ed1 = init({ tolerance });
        ed1.push({ s: 'a', time: Date.now() });
        await new Promise(resolve => setTimeout(resolve, tolerance * 1.1));
        const ed2 = init({ tolerance, logloc: ed1.logloc });
        ed2.push({ s: 'b', time: Date.now() });
        assert.deepEqual({ s: 'ab' }, ed2.state);
      });

      it('throws if an event has no time', () => {
        const ed = init();
        assert.throws(() => ed.push({ s: 'a', time: 0/0 }));
      });

    });

});
