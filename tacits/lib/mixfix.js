
/*

let mix = mixfix(fun)

Then

fun(val, ...args)
  = mix(val, ...args)
  = val[mix](...args)

*/

/*

This function probably has horrible effects on runtime performance.

*/

const mixfix =
exports.mixfix =
function mixfix(f) {
  const sym = Symbol(f.name);

  const g = function(...args) { return f(...args); }
  Object.defineProperty(g, 'name', { value: f.name });

  Object.defineProperty(g, 'toString', { value: () => sym });
  // ^ Make it work as an object key

  Object.defineProperty(Object.prototype, sym, {
    value: function(...args) { return f(this, ...args); },
    enumerable: false,
  });

  return g;
}
