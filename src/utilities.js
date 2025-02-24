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

function testPointerOffsetScrollBug () {
  return new Promise((resolve) => {
    const startY = window.scrollY;
    let fixRequired = false;
    let currentY;

    function sampleOffsetY () {
      document.body.addEventListener('pointerdown', (e) => {
        if (currentY === undefined) {
          currentY = e.offsetY;
        } else {
          // when dispatching on BODY in different scroll it gives the same offsetY value only on WebKit
          fixRequired = e.offsetY === currentY;
        }
      }, { once: true });

      const event = new PointerEvent('pointerdown', {
        clientY: 500
      });

      document.body.dispatchEvent(event);
    }

    function scrollHandler () {
      if (window.scrollY !== startY) {
        window.removeEventListener('scroll', scrollHandler);
        sampleOffsetY();
        resolve(fixRequired);
      }
    }

    sampleOffsetY();

    window.addEventListener('scroll', scrollHandler);

    if (window.scrollY > 0) {
      window.scrollBy(0, -1);
    }
  });
}

/**
 * @see https://bugs.webkit.org/show_bug.cgi?id=287799
 */
function testScrollOffsetsForWebKitPointerBug (scrollOffsets) {
  testPointerOffsetScrollBug().then((fixRequired) => {
    scrollOffsets.fixRequired = fixRequired;

    if (fixRequired) {
      window.addEventListener('scroll', scrollOffsets.scrollHandler);
    }
  });
}

export {
  getRect,
  clamp,
  frameThrottle,
  testPointerOffsetDprBug,
  testScrollOffsetsForWebKitPointerBug
};
