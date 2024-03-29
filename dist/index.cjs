'use strict';

const supported = typeof window == 'undefined' ? true : "onscrollend" in window;

if (!supported) {
  const scrollendEvent = new Event('scrollend');
  const pointers = new Set();

  // Track if any pointer is active
  document.addEventListener('touchstart', e => {
    for (let touch of e.changedTouches)
      pointers.add(touch.identifier);
  }, {passive: true});

  document.addEventListener('touchend', e => {
    for (let touch of e.changedTouches)
      pointers.delete(touch.identifier);
  }, {passive: true});

  // Map of scroll-observed elements.
  let observed = new WeakMap();

  // Forward and observe calls to a native method.
  function observe(proto, method, handler) {
    let native = proto[method];
    proto[method] = function() {
      let args = Array.prototype.slice.apply(arguments, [0]);
      native.apply(this, args);
      args.unshift(native);
      handler.apply(this, args);
    };
  }

  function onAddListener(originalFn, type, handler, options) {
    // Polyfill scrollend event on any element for which the developer listens
    // to 'scrollend' explicitly or 'scroll' (so that adding a scrollend listener
    // from within a scroll listener works).
    if (type != 'scroll' && type != 'scrollend')
      return;

    let scrollport = this;
    let data = observed.get(scrollport);
    if (data === undefined) {
      let timeout = 0;
      data = {
        scrollListener: (evt) => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            if (pointers.size) {
              // if pointer(s) are down, wait longer
              setTimeout(data.scrollListener, 100);
            }
            else {
              // dispatch
              if (scrollport) {
                scrollport.dispatchEvent(scrollendEvent);
              }
              timeout = 0;
            }
          }, 100);
        },
        listeners: 0, // Count of number of listeners.
      };
      originalFn.apply(scrollport, ['scroll', data.scrollListener]);
      observed.set(scrollport, data);
    }
    data.listeners++;
  }

  function onRemoveListener(originalFn, type, handler) {
    if (type != 'scroll' && type != 'scrollend')
      return;
    let scrollport = this;
    let data = observed.get(scrollport);

    // Mismatched addEventListener / removeEventListener
    // TODO: Should we explicitly track added listeners to prevent this?
    if (data === undefined)
      return;

    data[type]--;
    // If there are still listeners, nothing more to do.
    if (--data.listeners > 0)
      return;

    // Otherwise, remove the added listeners.
    originalFn.apply(scrollport, ['scroll', data.scrollListener]);
    observed.delete(scrollport);
  }

  observe(Element.prototype, 'addEventListener', onAddListener);
  observe(window, 'addEventListener', onAddListener);
  observe(document, 'addEventListener', onAddListener);
  observe(Element.prototype, 'removeEventListener', onRemoveListener);
  observe(window, 'removeEventListener', onRemoveListener);
  observe(document, 'removeEventListener', onRemoveListener);
  // TODO: Polyfill onscroll, onscrollend as well?
}

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
 * returns the requestAnimationFrame id so it can be cancelled
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
 * @returns {{x: (x: number) => number, y: (y: number) => number}}
 */
function centerToTargetFactory (target, root) {
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

const scrollPosition = {x: 0, y: 0};

/**
 * Updates scroll position on scrollend.
 * Used when root is entire viewport and centeredOnTarget=true.
 */
function scrollendCallback (tick, lastProgress) {
  scrollPosition.x = window.scrollX;
  scrollPosition.y = window.scrollY;

  requestAnimationFrame(() => tick && tick(lastProgress));
}

/**
 * Update root rect when root is entire viewport.
 *
 * @param {PointerConfig} config
 */
function windowResize (config) {
  config.rect.width = window.visualViewport.width;
  config.rect.height = window.visualViewport.height;
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
  let tick, resizeObserver, windowResizeHandler, scrollendHandler;

  /*
   * Prepare scenes data.
   */
  config.scenes.forEach((scene) => {
    if (scene.target && scene.centeredToTarget) {
      scene.transform = centerToTargetFactory(getRect(scene.target), config.rect);

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
        const x = +clamp(0, 1, scene.transform?.x(progress.x) || progress.x / config.rect.width).toPrecision(4);
        const y = +clamp(0, 1, scene.transform?.y(progress.y) || progress.y / config.rect.height).toPrecision(4);

        const velocity = {x: progress.vx, y: progress.vy};

        // run effect
        scene.effect(scene, {x, y}, velocity);
      }
    }

    Object.assign(lastProgress, progress);
  };

  if (hasCenteredToTarget) {
    scrollendHandler = scrollendCallback.bind(null, tick, lastProgress);
    document.addEventListener('scrollend', scrollendHandler);
  }

  /**
   * Removes all side effects and deletes all objects.
   */
  function destroy () {
    config.scenes.forEach(scene => scene.destroy?.());

    document.removeEventListener('scrollend', scrollendHandler);

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

    const trigger = frameThrottle(() => {
      this.tick();
    });

    // in no root then use the viewport's size
    this.config.rect = this.config.root
      ? {
        width: this.config.root.offsetWidth,
        height: this.config.root.offsetHeight
      }
      : {
        width: window.visualViewport.width,
        height: window.visualViewport.height
      };


    this.progress = {
      x: this.config.rect.width / 2,
      y: this.config.rect.height / 2,
      vx: 0,
      vy: 0
    };

    this._measure = (event) => {
      this.progress.x = this.config.root ? event.offsetX : event.x;
      this.progress.y = this.config.root ? event.offsetY : event.y;
      this.progress.vx = event.movementX;
      this.progress.vy = event.movementY;
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
   * Register to pointermove for triggering update.
   */
  setupEvent () {
    this.removeEvent();
    const element = this.config.root || window;
    element.addEventListener('pointermove', this._measure, {passive: true});
  }

  /**
   * Remove pointermove handler.
   */
  removeEvent () {
    const element = this.config.root || window;
    element.removeEventListener('pointermove', this._measure);
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

exports.Gyro = Gyro;
exports.Pointer = Pointer;
