'use strict';

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
function scrollend (tick, lastProgress) {
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
function getController (config) {
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
      // get scene's progress
      const x = +clamp(0, 1, scene.transform?.x(progress.x) || progress.x / config.rect.width).toPrecision(4);
      const y = +clamp(0, 1, scene.transform?.y(progress.y) || progress.y / config.rect.height).toPrecision(4);

      const velocity = {x: progress.vx, y: progress.vy};

      // run effect
      scene.effect(scene, {x, y}, velocity);
    }

    Object.assign(lastProgress, progress);
  };

  if (hasCenteredToTarget) {
    scrollendHandler = scrollend.bind(null, tick, lastProgress);
    document.addEventListener('scrollend', scrollendHandler);
  }

  /**
   * Removes all side effects and deletes all objects.
   */
  function destroy () {
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
      trigger();
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
 * @typedef {object} PointerConfig
 * @property {PointerScene[]} scenes list of effect scenes to perform during pointermove.
 * @property {HTMLElement} [root] element to use as hit area for pointermove events. Defaults to entire viewport.
 * @property {{width: number, height: number}} [rect] created automatically on Pointer construction.
 */

/**
 * @typedef {Object} PointerScene
 * @desc A configuration object for a scene. Must be provided an effect function.
 * @example { effects: (scene, p) => { animation.currentTime = p.x; } }
 * @property {EffectCallback} effect the effect to perform.
 * @property {boolean} [centeredToTarget] whether this scene's progress is centered on the target's center.
 * @property {HTMLElement} [target] target element for the effect.
 */

/**
 * @typedef {function(scene: PointerScene, progress: {x: number, y: number}, velocity: {x: number, y: number}): void} EffectCallback
 * @param {PointerScene} scene
 * @param {{x: number, y: number}} progress
 * @param {{x: number, y: number}} velocity
 */

exports.Pointer = Pointer;
