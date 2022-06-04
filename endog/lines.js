
/*

Algorithms for reading a file lazily, chunk-by-chunk
or line-by-line.

Pros:
- Works well
- Supports multiple encodings

Cons:
- Algorithm doesn't generalize to arbitrary encodings
- Line sep is assumed to be \n
- Not strictly better than alternatives on npm

Overall, the algorithm will work for this codebase,
but I think I'd want to improve it some before considering
putting it in its own repo or publishing it.

*/

const fs = require('fs');

const maxWidthMap = {
  utf8: 4,
  'utf-8': 4,

  // utf-16 NOT supported

  latin1: 1,
  binary: 1,

  hex: 1,

  ascii: 1,
};

const supportedEncodings = Object.keys(maxWidthMap);


/* Read a UTF-8 encoded file lazily, in chunks */
const chunks =
exports.chunks =
function * chunks(floc, opts) {

  /*

  nb. This algorithm is kinda blunt intosfar as it treats the encoding as a black-box
  Pro: essentially encoding-polymorphic; only need to know the singleCharMaxByteCount
  Con: only works for some encodings. Notably, UTF-16LE is not supported

  */

  let { encoding, maxChunkSize } = opts ?? {};
  encoding ??= 'utf8';
  maxChunkSize ??= 4096;

  if (!supportedEncodings.includes(encoding))
    throw Error(`Encoding '${encoding}' not supported`);

  const singleCharMaxByteCount = maxWidthMap[encoding];

  if (maxChunkSize < singleCharMaxByteCount)
    throw Error(
      `maxChunkSize = ${maxChunkSize} is too small;`
      + ` must be at least ${singleCharMaxByteCount}`
      + ` for encoding '${encoding}'`
    );

  const buff = Buffer.alloc(maxChunkSize);

  const fd = fs.openSync(floc);
  let foffset = 0;  // file offset

  while (true) {

    const amtRead = fs.readSync(fd, buff, 0, maxChunkSize, foffset);

    if (amtRead < maxChunkSize) {
      // at eof
      // console.log('eof', buff.slice(0, amtRead).toString(encoding), buff.slice(0, amtRead).toString('hex'))
      yield buff.slice(0, amtRead).toString(encoding);
      break;
    }

    else {
      // in order to avoid splitting a codepoint across two chunks, we need to backtrack

      // for efficiency, operate on the tail of the buffer instead of the whole buffer
      const tail = buff.slice(buff.length - singleCharMaxByteCount);
      const tailStrLen = tail.toString(encoding).length;

      // choose the minimal backtrack such that
      // 1. the chunk ends in a valid codepoint; or, if that's not possible
      // 2. we drop the single invalid codepoint off the tail of the chunk
      let backtrack;
      for (backtrack = 0; ; backtrack++) {
        const slice = tail.slice(0, tail.length - backtrack).toString(encoding);
        if (!slice.endsWith('�')) break;
        if (slice.length === tailStrLen - 1) break;
      }

      /* console.log(
        'cont',
        buff.toString(encoding),
        buff.toString('hex'),
        backtrack,
        buff.slice(0, buff.length - backtrack).toString(encoding),
        buff.slice(0, buff.length - backtrack).toString('hex'),
      ); */

      yield buff.slice(0, buff.length - backtrack).toString(encoding);
      foffset += amtRead - backtrack;
    }

  }

  fs.closeSync(fd);

}


/* Read a file lazily, by lines */
const lines =
exports.lines =
function * lines(floc, ...args) {

  let parts = [];

  for (const part of chunks(floc, ...args)) {
    parts.push(part);
    if (part.includes('\n')) {
      const linesAndLeftover = parts.join('').split('\n');
      const lines = linesAndLeftover.slice(0, -1);
      const leftover = linesAndLeftover[linesAndLeftover.length - 1];
      yield * lines;
      parts = [leftover];
    }
  }
  if (parts.length > 0)
    yield* parts.join('').split('\n');

}


if (require.main === module)
  suite();

function suite() {

  const assert = require('chai').assert;

  test({ strbuf: Buffer.from(''), opts: { maxChunkSize: 4 } });
  test({ strbuf: Buffer.from('�'), opts: { maxChunkSize: 4 } });
  test({ strbuf: Buffer.from('��'), opts: { maxChunkSize: 4 } });
  test({ strbuf: Buffer.from('������������������������'), opts: { maxChunkSize: 4 } });

  const testC = 5e4;
  for (let testN = 1; testN <= testC; testN++) {

    const encoding = supportedEncodings[rand(0, supportedEncodings.length - 1)];
    const N = 1500;
    const strSize = rand(0, N);
    const maxChunkSize = Math.max(maxWidthMap[encoding], Math.round(Math.sqrt(rand(0, N * 2))));

    const strbuf = Buffer.from(
      new Array(strSize)
      .fill(null)
      .flatMap(() =>
        rand(1, 10) === 1
          ? [...Buffer.from('\n', encoding)]
          : [rand(0, 255)]
      )
    );

    console.log(`${testN} / ${testC} (${(testN / testC * 100).toFixed(0)}%)`)
    test({ strbuf, opts: { maxChunkSize, encoding } });
  }

  function test({ strbuf, opts }) {
    // console.log(`test case. enc=${opts.encoding ?? 'utf8'} maxChunkSize=${opts.maxChunkSize} strbuf=${strbuf.toString('hex')}`);
    const floc = '/tmp/lines-test-f';
    const str = strbuf.toString(opts.encoding);
    fs.writeFileSync(floc, strbuf);
    assert.deepEqual([...chunks(floc, opts)].join(''), str);
    assert.deepEqual([...lines(floc, opts)], str.split('\n'));
  }

  function rand(lo, hi) {
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

}
