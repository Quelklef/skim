const fs = require('fs');

exports.Endog =
class Endog {

  /**

  logloc : string
  The logfile path

  exec : (state, event) -> void
  Mutatively applies an event to the current state
  This function MUST NOT have side-effects besides mutating the given state
  This function MAY throw

  getTime : event -> Date
  Maps an event to its timestamp
  This function MUST NOT have side-effects and MUST NOT throw

  tolerance : integer number of milliseconds
  How late an event is allowed to come in before it is rejected

  */
  constructor({ logloc, exec, getTime, tolerance }) {
    this.logloc = logloc;
    this.exec = exec;
    this.getTime = getTime;
    this.tolerance = tolerance;

    // --

    this.rstate = null;
      // ^ Current state. "right state"
    this.buffer = [];
      // ^ Event buffer for the last ${tolerance} seconds
    this.lstate = null;
      // ^ State ${tolerance} seconds ago. "left state"
    this.prevSweepTime = 0;
      // ^ Most recent time the buffer was swept

    this._initialize();
  }


  getTimestamp(event) {
    return +this.getTime(event);
  }


  /*

  Push all events from the log.
  NOT ATOMIC!

  */
  _initialize() {

    if (!fs.existsSync(this.logloc))
      fs.writeFileSync(this.logloc, '');

    // This is not memory-efficient! Should read the file lazily
    // Assumption: eventlog is in chronological order
    const events = fs.readFileSync(this.logloc).toString().split('\n').filter(ln => !!ln).map(ln => JSON.parse(ln));

    const now = Date.now();
    this.prevSweepTime = now - this.tolerance;
    const isRecent = ev => this.getTimestamp(ev) > this.prevSweepTime;
    const [oldEvents, newEvents] = span(events, ev => !isRecent(ev));

    // Init state
    this.rstate = {};

    // Execute old events
    for (const ev of oldEvents)
      // Not recent so bypass buffer and execute directly
      this.exec(this.rstate, ev);

    // Execute new events
    this.lstate = clone(this.rstate);
    for (const ev of newEvents)
      this.push(ev);
  }


  /**

  Push an event, updating the current state.

  If the event is rejected as too old, or if it fails to execute,
  the endog state will remain unchanged.

  */
  push(event) {

    if (this.getTimestamp(event) <= this.prevSweepTime)
      throw Error('Rejecting event as too old');

    const idx = binaryInsertIdx(this.buffer, event, ev => this.getTimestamp(ev));

    // Event is most recent, apply to rstate and add to buffer
    if (idx === this.buffer.length) {
      const rstate = clone(this.rstate);
      this.exec(rstate, event);
      this.rstate = rstate;
      this.buffer.push(event);
    }

    // Event is in the past, insert into buffer and recompute rstate
    else {
      this.buffer.splice(idx, 0, event);
      const rstate = clone(this.lstate)
      for (const ev of this.buffer)
        this.exec(rstate, ev);
      this.rstate = rstate;
    }

    // Sweep event once it dies
    const lifetime = (this.getTimestamp(event) + this.tolerance) - Date.now();
    setTimeoutStrong(
      () => this._sweep(),
      lifetime + 1,  // plus 1 so that the lifetime is over
    );

  }


  /*

  Commit old events

  This function is technically not atomic; however, it should not throw
  unless the user is doing something really wrong like directly
  mutating the endog state or deleting the statefile.

  If this function does throw, you are in deep shit!

  */
  _sweep() {
    const now = Date.now();
    const isRecent = ev => this.getTimestamp(ev) >= now - this.tolerance;
    const toSweep = takeWhile(this.buffer, ev => !isRecent(ev));

    const lstate = clone(this.lstate);
    for (const ev of toSweep)
      this.exec(lstate, ev);
    this.lstate = lstate;
    this.prevSweepTime = now;
    this.buffer.splice(0, toSweep.length);
    fs.appendFileSync(this.logloc, toSweep.map(JSON.stringify).map(ln => ln + '\n').join('\n'));
  }


  /** Return the current state. Callers MUST NOT mutate this value. */
  get state() {
    return this.rstate;
  }

}



function clone(v) {
  return JSON.parse(JSON.stringify(v));
}


function takeWhile(iterable, pred) {
  const took = [];

  for (const item of iterable) {
    if (!pred(item)) break;
    took.push(item);
  }

  return took;
}


function span(iterable, pred) {
  const left = [];
  const right = [];

  let target = left;

  for (const item of iterable) {
    if (!pred(item)) target = right;
    target.push(item);
  }

  return [left, right];
}


/*

Like setTimeout, but guarantees that the callback is not called before the scheduled time

As of right now (node v18.3.0), such a guarantee is not natively made:

> Node.js makes no guarantees about the exact timing of when callbacks will fire, nor of their ordering
(https://nodejs.org/docs/v18.3.0/api/timers.html#settimeoutcallback-delay-args)

*/
function setTimeoutStrong(func, delay) {
  delay = Math.max(1, delay);
  const target = Date.now() + delay;
  impl();

  function impl() {
    if (Date.now() >= target) {
      func();
    } else {
      setTimeout(impl, target - Date.now());
    }
  }
}


function binaryInsertIdx(array, needle, keyf = (x => x)) {
  // invariant: lo <= result <= hi

  let lo = 0;
  let hi = array.length;

  const needlekey = keyf(needle);

  while (true) {
    if (lo === hi) return lo;
    let mid = (lo + hi) >> 1;
    let midkey = keyf(array[mid]);
    if (midkey < needlekey) {
      lo = mid + 1;
    } else if (midkey > needlekey) {
      hi = mid;
    } else {
      // linear search
      do {
        mid++;
      } while (mid < array.length && keyf(array[mid]) === needlekey);
      return mid;
    }
  }
}

exports._testing = { takeWhile, span, binaryInsertIdx };
