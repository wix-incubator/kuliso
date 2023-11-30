/**
 * Clamps a value between limits.
 *
 * @param {number} min lower limit
 * @param {number} max upper limit
 * @param {number} value value to clamp
 * @return {number} clamped value
 *
 * @example
 * const x = clamp(0, 1, 1.5); // returns 1
 */
function clamp (min, max, value) {
  return Math.min(Math.max(min, value), max);
}

/**
 * Returns a new Object with the properties of the first argument
 * assigned to it, and the second argument as its prototype, so
 * its properties are served as defaults.
 *
 * @param {Object} obj properties to assign
 * @param {Object|null} defaults
 * @return {Object}
 */
function defaultTo (obj, defaults) {
  return Object.assign(Object.create(defaults), obj);
}

/**
 * Copies all given objects into a new Object.
 *
 * @param {...Object} objects
 * @return {Object}
 */
function clone (...objects) {
  return Object.assign({}, ...objects);
}

/**
 * Interpolate from a to b by the factor t.
 *
 * @param {number} a start point
 * @param {number} b end point
 * @param {number} t interpolation factor
 * @return {number}
 */
function lerp (a, b, t) {
  return a * (1 - t) + b * t;
}

/**
 * Throttle a function to trigger once per animation frame.
 * Keeps the arguments from last call, even if that call gets ignored.
 *
 * @param {function} fn function to throttle
 * @return {(function(): void)}
 */
function frameThrottle (fn) {
  let throttled = false;

  return function () {
    if (!throttled) {
      throttled = true;

      window.requestAnimationFrame(() => {
        throttled = false;
        fn();
      });
    }
  };
}

function map (x, a, b, c, d) {
  return (x - a) * (d - c) / (b - a) + c;
}

export {
  map,
  clamp,
  clone,
  defaultTo,
  lerp,
  frameThrottle
};
