/**
 * Clamps a value between limits.
 *
 * @private
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
 * Throttle a function to trigger once per animation frame.
 * Keeps the arguments from last call, even if that call gets ignored.
 *
 * @private
 * @param {function} fn function to throttle
 * @return {(function(): number)} a function that will trigger the throttled function on next animation frame,
 * returns the requestAnimationFrame id, so it can be cancelled
 */
function frameThrottle (fn) {
  let throttled = false;

  return function () {
    if (!throttled) {
      throttled = true;

      return window.requestAnimationFrame(() => {
        throttled = false;
        fn();
      });
    }
  };
}

/**
 * Returns an object containing the layout properties (left, top, width, and height) of the given element.
 *
 * @private
 * @param {HTMLElement} element
 * @returns {{top: number, left: number, width: number, height: number}}
 */
function getRect (element) {
  let el = element;
  let left = 0;
  let top = 0;

  if (el.offsetParent) {
    do {
      left += el.offsetLeft;
      top += el.offsetTop;
      el = el.offsetParent;
    } while (el);
  }

  return {
    left,
    top,
    width: element.offsetWidth,
    height: element.offsetHeight
  };
}

/**
 * @see https://issues.chromium.org/issues/40887601?pli=1
 */
function testPointerOffsetDprBug () {
  const DPR = window.devicePixelRatio;
  let fixRequired = false;

  if (DPR === 1) {
    // we can immediately return here, not required to fix
    return false;
  }

  document.body.addEventListener('pointerdown', (e) => {
    fixRequired = e.offsetX !== 10;
  }, { once: true });

  const event = new PointerEvent('pointerdown', {
    clientX: 10
  });

  document.body.dispatchEvent(event);

  return fixRequired;
}

export {
  getRect,
  clamp,
  frameThrottle,
  testPointerOffsetDprBug
};
