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
      scrollOffsets.scrollHandler();
    }
  });
}

let listeners = 0;
const pointers = new Set();

function initScrollendPolyfill () {
  const touchStartHandler = e => {
    for (let touch of e.changedTouches) {
      pointers.add(touch.identifier);
    }
  };
  const touchEndHandler = e => {
    for (let touch of e.changedTouches) {
      pointers.delete(touch.identifier);
    }
  };
  // Track if any pointer is active
  document.addEventListener('touchstart', touchStartHandler, {passive: true});
  document.addEventListener('touchend', touchEndHandler, {passive: true});

  return function () {
    pointers.clear();
    document.removeEventListener('touchstart', touchStartHandler);
    document.removeEventListener('touchend', touchEndHandler);
  };
}

function addScrollendListener (target, listener) {
  if ('onscrollend' in window) {
    target.addEventListener('scrollend', listener);

    return function () {
      target.removeEventListener('scrollend', listener);
    };
  }

  let timeout = 0;
  let removeScrollendPolyfill;

  if (!listeners) {
    removeScrollendPolyfill = initScrollendPolyfill();
  }

  listeners += 1;

  function scrollListener (evt) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (pointers.size) {
        // if pointer(s) are down, wait longer
        setTimeout(scrollListener, 100);
      }
      else {
        // dispatch
        listener(evt);
        timeout = 0;
      }
    }, 100);
  }

  target.addEventListener('scroll', scrollListener);

  return function () {
    target.removeEventListener('scroll', scrollListener);
    listeners -= 1;

    if (!listeners) {
      removeScrollendPolyfill();
    }
  };
}

/**
 * Return new progress for {x, y} for the farthest-side formula ("cover").
 *
 * @param {Object} target
 * @param {number} target.left
 * @param {number} target.top
 * @param {number} target.width
 * @param {number} target.height
 * @param {Object} root
 * @param {number} root.width
 * @param {number} root.height
 * @param {{x: number, y: number}} scrollPosition
 * @returns {{x: (x: number) => number, y: (y: number) => number}}
 */
function centerToTargetFactory (target, root, scrollPosition) {
  // we store reference to the arguments and do all calculation on the fly
  // so that target dims, scroll position, and root dims are always up-to-date
  return {
    x (x1) {
      const layerCenterX = target.left - scrollPosition.x + target.width / 2;
      const isXStartFarthest = layerCenterX >= root.width / 2;

      const xDuration = (isXStartFarthest ? layerCenterX : root.width - layerCenterX) * 2;
      const x0 = isXStartFarthest ? 0 : layerCenterX - xDuration / 2;

      return (x1 - x0) / xDuration;
    },
    y (y1) {
      const layerCenterY = target.top - scrollPosition.y + target.height / 2;
      const isYStartFarthest = layerCenterY >= root.height / 2;

      const yDuration = (isYStartFarthest ? layerCenterY : root.height - layerCenterY) * 2;
      const y0 = isYStartFarthest ? 0 : layerCenterY - yDuration / 2;

      return (y1 - y0) / yDuration;
    }
  };
}

/**
 * Updates scroll position on scrollend.
 * Used when root is entire viewport and centeredOnTarget=true.
 */
function scrollendCallback (tick, lastProgress) {
  this.x = window.scrollX;
  this.y = window.scrollY;

  requestAnimationFrame(() => tick && tick(lastProgress));
}

/**
 * Update root rect when root is entire viewport.
 *
 * @param {PointerConfig} config
 */
function windowResize (config) {
  config.rect.width = window.document.documentElement.clientWidth;
  config.rect.height = window.document.documentElement.clientHeight;
}

/**
 * Observe and update root rect when root is an element.
 *
 * @param {PointerConfig} config
 * @returns {ResizeObserver}
 */
function observeRootResize (config) {
  const observer = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      config.rect.width = entry.borderBoxSize[0].inlineSize;
      config.rect.height = entry.borderBoxSize[0].blockSize;
    });
  });

  observer.observe(config.root, { box: 'border-box' });

  return observer;
}

/**
 * Initialize and return a pointer controller.
 *
 * @private
 * @param {PointerConfig} config
 * @return {{tick: function, destroy: function}}
 */
function getController$1 (config) {
  let hasCenteredToTarget = false;
  let lastProgress = {x: config.rect.width / 2, y: config.rect.height / 2, vx: 0, vy: 0};
  let tick, resizeObserver, windowResizeHandler, scrollendHandler, removeScrollendListener;

  const scrollPosition = {x: 0, y: 0};

  /*
   * Prepare scenes data.
   */
  config.scenes.forEach((scene) => {
    if (scene.target && scene.centeredToTarget) {
      scene.transform = centerToTargetFactory(getRect(scene.target), config.rect, scrollPosition);

      hasCenteredToTarget = true;
    }

    if (config.root) {
      resizeObserver = observeRootResize(config);
    }
    else {
      windowResizeHandler = windowResize.bind(null, config);
      window.addEventListener('resize', windowResizeHandler);
    }
  });

  /**
   * Updates progress in all scene effects.
   *
   * @private
   * @param {Object} progress
   * @param {number} progress.x
   * @param {number} progress.y
   * @param {number} progress.vx
   * @param {number} progress.vy
   */
  tick = function (progress) {
    for (let scene of config.scenes) {
      if (!scene.disabled) {
        // get scene's progress
        const normalizedX = scene.transform?.x(progress.x) || progress.x / config.rect.width;
        const normalizedY = scene.transform?.y(progress.y) || progress.y / config.rect.height;

        const x = +clamp(0, 1, normalizedX).toPrecision(4);
        const y = +clamp(0, 1, normalizedY).toPrecision(4);

        const velocity = {x: progress.vx, y: progress.vy};

        if (config.allowActiveEvent) {
          progress.active = (normalizedX <= 1 && normalizedY <= 1 && normalizedX >= 0 && normalizedY >= 0);
        }

        // run effect
        scene.effect(scene, {x, y}, velocity, progress.active);
      }
    }

    Object.assign(lastProgress, progress);
  };

  if (hasCenteredToTarget) {
    scrollendHandler = scrollendCallback.bind(scrollPosition, tick, lastProgress);
    removeScrollendListener = addScrollendListener(document, scrollendHandler);
  }

  /**
   * Removes all side effects and deletes all objects.
   */
  function destroy () {
    config.scenes.forEach(scene => scene.destroy?.());

    removeScrollendListener?.();

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    else {
      window.removeEventListener('resize', windowResizeHandler);
      windowResizeHandler = null;
    }

    tick = null;
    lastProgress = null;
  }

  /**
   * Mouse controller.
   */
  return {
    tick,
    destroy
  };
}

const MOVEMENT_RESET_DELAY = 1e3 / 60 * 3; // == 50 (3 frames in 60fps)
let shouldFixSynthPointer;

function scrollHandler () {
  scrollOffsets.x = window.scrollX;
  scrollOffsets.y = window.scrollY;
}
const scrollOffsets = { x: 0, y: 0, scrollHandler, fixRequired: undefined };

/**
 * @class Pointer
 * @param {PointerConfig} config
 *
 * @example
 * import { Pointer } from 'kuliso';
 *
 * const pointer = new Pointer({
 *     scenes: [...]
 * });
 *
 * pointer.start();
 */
class Pointer {
  constructor (config = {}) {
    this.config = { ...config };

    this.effect = null;
    this._nextTick = null;
    this._nextTransitionTick = null;
    this._startTime = 0;

    let trigger;

    if (this.config.transitionDuration) {
      trigger = this.config.noThrottle
        ? () => this.transition()
        : frameThrottle(() => this.transition());
    }
    else {
      trigger = this.config.noThrottle
        ? () => {
          this.tick();
          return null;
        }
        : frameThrottle(() => {
          this.tick();
        });
    }

    // in no root then use the viewport's size
    this.config.rect = this.config.root
      ? {
        width: this.config.root.offsetWidth,
        height: this.config.root.offsetHeight
      }
      : {
        width: window.document.documentElement.clientWidth,
        height: window.document.documentElement.clientHeight
      };


    this.progress = {
      x: this.config.rect.width / 2,
      y: this.config.rect.height / 2,
      vx: 0,
      vy: 0
    };
    this.previousProgress = { ...this.progress };
    this.currentProgress = null;

    const _measure = (event) => {
      const newX = this.config.root ? event.offsetX : event.x;
      const newY = this.config.root ? event.offsetY : event.y;
      this.progress.vx = newX - this.progress.x;
      this.progress.vy = newY - this.progress.y;
      this.progress.x = newX;
      this.progress.y = newY;
      this._nextTick = trigger();
    };

    this._pointerLeave = () => {
        this.progress.active = false;
        this.progress.vx = 0;
        this.progress.vy = 0;
        this._nextTick = trigger();
    };

    this._pointerEnter = () => {
      this.progress.active = true;
      this._nextTick = trigger();
    };

    if (this.config.root) {
      shouldFixSynthPointer = typeof shouldFixSynthPointer === 'boolean' ? shouldFixSynthPointer : testPointerOffsetDprBug();
      const DPR = shouldFixSynthPointer ? window.devicePixelRatio : 1;

      if (typeof scrollOffsets.fixRequired === 'undefined') {
        testScrollOffsetsForWebKitPointerBug(scrollOffsets);
      }

      this._measure = (e) => {
        if (e.target !== this.config.root) {
          const event = new PointerEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            clientX: e.x * DPR + scrollOffsets.x,
            clientY: e.y * DPR + scrollOffsets.y,
          });

          e.stopPropagation();

          this.config.root.dispatchEvent(event);
        } else {
          _measure(e);
        }
      };
    } else {
      this._measure = _measure;
    }
  }

  /**
   * Setup event and effect, and reset progress and frame.
   */
  start () {
    this.setupEffect();
    this.setupEvent();
  }

  /**
   * Removes event listener.
   */
  pause () {
    this.removeEvent();
  }

  /**
   * Handle animation frame work.
   */
  tick () {
    this.effect.tick(this.progress);
  }

  /**
   * Starts a transition from the previous progress to the current progress.
   *
   * @returns {number} the requestAnimationFrame id for the transition tick.
   */
  transition () {
    const duration = this.config.transitionDuration;
    const easing = this.config.transitionEasing || ((p) => p);
    const now = performance.now();
    let resetMovement = false;

    const tick = (time) => {
      const p = (time - this._startTime) / duration;
      const t = easing(Math.min(1, p));

      if (resetMovement) {
        this.progress.vx = 0;
        this.progress.vy = 0;
        resetMovement = false;
      }

      this.currentProgress = Object.entries(this.progress).reduce((acc, [key, value]) => {
        if (key === 'active') {
          acc[key] = value;
        } else {
          acc[key] = this.previousProgress[key] + (value - this.previousProgress[key]) * t;
        }
        return acc;
      }, this.currentProgress || {});

      if (p < 1) {
        this._nextTransitionTick = requestAnimationFrame(tick);

        // reset movement on next frame
        resetMovement = time - this._startTime > MOVEMENT_RESET_DELAY;
      }

      this.effect.tick(this.currentProgress);
    };

    if (this._startTime) {
      this._nextTransitionTick && cancelAnimationFrame(this._nextTransitionTick);

      Object.assign(this.previousProgress, this.currentProgress);

      this._startTime = now;

      tick(now);
    } else {
      this._startTime = now;
    }

    return this._nextTransitionTick;
  }

  /**
   * Stop the event and effect, and remove all DOM side effects.
   */
  destroy () {
    this.pause();
    this.removeEffect();
    this._nextTick && cancelAnimationFrame(this._nextTick);
    this._nextTransitionTick && cancelAnimationFrame(this._nextTransitionTick);
  }

  /**
   * Register to pointermove for triggering update.
   */
  setupEvent () {
    this.removeEvent();
    const element = this.config.root || window;
    element.addEventListener('pointermove', this._measure, {passive: true});

    if (this.config.eventSource) {
      this.config.eventSource.addEventListener('pointermove', this._measure, {passive: true});
    }

    if (this.config.allowActiveEvent) {
      element.addEventListener('pointerleave', this._pointerLeave, {passive: true});
      element.addEventListener('pointerenter', this._pointerEnter, {passive: true});

      if (this.config.eventSource) {
        this.config.eventSource.addEventListener('pointerleave', this._pointerLeave, {passive: true});
        this.config.eventSource.addEventListener('pointerenter', this._pointerEnter, {passive: true});
      }
    }
  }

  /**
   * Remove pointermove handler.
   */
  removeEvent () {
    const element = this.config.root || window;
    element.removeEventListener('pointermove', this._measure);

    if (this.config.eventSource) {
      this.config.eventSource.removeEventListener('pointermove', this._measure);
    }

    if (this.config.allowActiveEvent) {
      element.removeEventListener('pointerleave', this._pointerLeave);
      element.removeEventListener('pointerenter', this._pointerEnter);

      if (this.config.eventSource) {
        this.config.eventSource.removeEventListener('pointerleave', this._pointerLeave);
        this.config.eventSource.removeEventListener('pointerenter', this._pointerEnter);
      }
    }
  }

  /**
   * Reset registered effect.
   */
  setupEffect () {
    this.removeEffect();
    this.effect = getController$1(this.config);
  }

  /**
   * Remove registered effect.
   */
  removeEffect () {
    this.effect && this.effect.destroy();
    this.effect = null;
  }
}

/**
 * @typedef {object} PointerConfig
 * @property {PointerScene[]} scenes list of effect scenes to perform during pointermove.
 * @property {HTMLElement} [root] element to use as hit area for pointermove events. Defaults to entire viewport.
 * @property {{width: number, height: number}} [rect] created automatically on Pointer construction.
 * @property {boolean} [noThrottle] whether to disable throttling the effect by framerate.
 * @property {number} [transitionDuration] duration of transition effect in milliseconds.
 * @property {function} [transitionEasing] easing function for transition effect.
 * @property {boolean} [allowActiveEvent] whether to track timeline activation events.
 * @property {HTMLElement} [eventSource] an alternative source element to attach event handlers and retarget to root.
 */

/**
 * @typedef {Object} PointerScene
 * @desc A configuration object for a scene. Must be provided an effect function.
 * @example { effects: (scene, p) => { animation.currentTime = p.x; } }
 * @property {PointerEffectCallback} effect the effect to perform.
 * @property {boolean} [centeredToTarget] whether this scene's progress is centered on the target's center.
 * @property {HTMLElement} [target] target element for the effect.
 * @property {boolean} [disabled] whether this scene is disabled.
 * @property {function} [destroy] a function clean up the scene when it's controller is destroyed.
 */

/**
 * @typedef {function(scene: PointerScene, progress: {x: number, y: number}, velocity: {x: number, y: number}): void} PointerEffectCallback
 * @param {PointerScene} scene
 * @param {{x: number, y: number}} progress
 * @param {{x: number, y: number}} velocity
 */

/**
 * Initialize and return a gyroscope controller.
 *
 * @private
 * @param {GyroConfig} config
 * @return {{tick: function, destroy: function}}
 */
function getController (config) {
  let tick;

  /**
   * Updates progress in all scene effects.
   *
   * @private
   * @param {Object} progress
   * @param {number} progress.x
   * @param {number} progress.y
   * @param {number} progress.vx
   * @param {number} progress.vy
   */
  tick = function (progress) {
    for (let scene of config.scenes) {
      if (!scene.disabled) {
        const velocity = {x: progress.vx, y: progress.vy};

        // run effect
        scene.effect(scene, progress, velocity);
      }
    }
  };

  /**
   * Removes all side effects and deletes all objects.
   */
  function destroy () {
    config.scenes.forEach(scene => scene.destroy?.());
    tick = null;
  }

  /**
   * Gyroscope controller.
   */
  return {
    tick,
    destroy
  };
}

/**
 * @private
 * @type {GyroConfig}
 */
const DEFAULTS = {
  samples: 3,
  maxBeta: 15,
  maxGamma: 15
};

/**
 * @class Gyro
 * @param {GyroConfig} config
 *
 * @example
 * import { Gyro } from 'kuliso';
 *
 * const gyro = new Gyro({
 *     scenes: [...]
 * });
 *
 * gyro.start();
 */
class Gyro {
  constructor (config = {}) {
    this.config = { ...config };

    this.effect = null;
    this._nextTick = null;

    const trigger = frameThrottle(() => {
      this.tick();
    });

    this.progress = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0
    };

    this.samples = typeof this.config.samples == 'number' ? this.config.samples : DEFAULTS.samples;
    this.maxBeta = this.config.maxBeta || DEFAULTS.maxBeta;
    this.maxGamma = this.config.maxGamma || DEFAULTS.maxGamma;
    const totalAngleX = this.maxGamma * 2;
    const totalAngleY = this.maxBeta * 2;

    let lastGammaZero = 0, lastBetaZero = 0, gammaZero = 0, betaZero = 0, samples = this.samples;

    this._measure = (event) => {
      if (event.gamma === null || event.beta === null) {
        return;
      }

      // initial angles calibration
      if (samples > 0) {
        lastGammaZero = gammaZero;
        lastBetaZero = betaZero;

        if (gammaZero == null) {
          gammaZero = event.gamma;
          betaZero = event.beta;
        } else {
          gammaZero = (event.gamma + lastGammaZero) / 2;
          betaZero = (event.beta + lastBetaZero) / 2;
        }

        samples -= 1;
      }

      this.progress.x = +clamp(0, 1, (event.gamma - gammaZero + this.maxGamma) / totalAngleX).toPrecision(4);
      this.progress.y = +clamp(0, 1, (event.beta -  betaZero + this.maxBeta) / totalAngleY).toPrecision(4);

      this._nextTick = trigger();
    };
  }

  /**
   * Setup event and effect, and reset progress and frame.
   */
  start () {
    this.setupEffect();
    this.setupEvent();
  }

  /**
   * Removes event listener.
   */
  pause () {
    this.removeEvent();
  }

  /**
   * Handle animation frame work.
   */
  tick () {
    // update effect
    this.effect.tick(this.progress);
  }

  /**
   * Stop the event and effect, and remove all DOM side-effects.
   */
  destroy () {
    this.pause();
    this.removeEffect();
    this._nextTick && cancelAnimationFrame(this._nextTick);
  }

  /**
   * Register to deviceorientation for triggering update.
   */
  setupEvent () {
    this.removeEvent();
    window.addEventListener('deviceorientation', this._measure, {passive: true});
  }

  /**
   * Remove deviceorientation handler.
   */
  removeEvent () {
    window.removeEventListener('deviceorientation', this._measure);
  }

  /**
   * Reset registered effect.
   */
  setupEffect () {
    this.removeEffect();
    this.effect = getController(this.config);
  }

  /**
   * Remove registered effect.
   */
  removeEffect () {
    this.effect && this.effect.destroy();
    this.effect = null;
  }
}

/**
 * @typedef {object} GyroConfig
 * @property {GyroScene[]} scenes list of effect scenes to perform on deviceorientation event.
 * @property {number} [samples] number of samples to take for initial calibration.
 * @property {number} [maxBeta] maximum beta angle.
 * @property {number} [maxGamma] maximum gamma angle.
 */

/**
 * @typedef {Object} GyroScene
 * @desc A configuration object for a scene. Must be provided an effect function.
 * @example { effects: (scene, p) => { animation.currentTime = p.x; } }
 * @property {GyroEffectCallback} effect the effect to perform.
 * @property {boolean} [disabled] whether this scene is disabled.
 * @property {function} [destroy] a function clean up the scene when it's controller is destroyed.
 */

/**
 * @typedef {function(scene: GyroScene, progress: {x: number, y: number}, velocity: {x: number, y: number}): void} GyroEffectCallback
 * @param {GyroScene} scene
 * @param {{x: number, y: number}} progress
 * @param {{x: number, y: number}} velocity
 */

export { Gyro, Pointer };
