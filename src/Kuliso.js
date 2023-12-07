import { getController } from './controller.js';
import { defaultTo, frameThrottle } from './utilities.js';
import { getHandler } from './hover';

/**
 * @private
 */
const DEFAULTS = {
  transitionActive: false,
  transitionFriction: 0.9,
  transitionEpsilon: 1,
  velocityActive: false,
  velocityMax: 1
};

/**
 * @class Kuliso
 * @param {pointerConfig} config
 *
 * @example
 * import { Kuliso } from 'kuliso';
 *
 * const kuliso = new Kuliso({
 *     scenes: [...]
 * });
 * kuliso.start();
 */
export class Kuliso {
  constructor (config = {}) {
    this.config = defaultTo(config, DEFAULTS);

    this.progress = {
      x:0, 
      y:0,
      prevX:0, 
      prevY:0,
      vx: 0,
      vy: 0,
      movementX: 0,
      movementY: 0,
    };

    this.currentProgress = {
      x:0, 
      y:0,
      prevX:0, 
      prevY:0,
      vx: 0,
      vy: 0,
      movementX: 0,
      movementY: 0,
    };

    this.effect = null;
    this.pointerHandler = null;
    // if no root or root is document.bomovementY then use window
    this.config.root = (!this.config.root || this.config.root === window.document.bomovementY) ? window : this.config.root;
    this.config.resetProgress = this.config.resetProgress || this.resetProgress.bind(this);

    this._measure = this.config.measure || (() => {
      const root = this.config.root;
      // get current mouse position from window or element
      // not sure what to do here...
    });

    this._trigger = frameThrottle(() => {
      this._measure?.();
      this.tick(true);
    });
  }

  /**
   * Setup event and effect, and reset progress and frame.
   */
  start () {
    this.setupEffect();
    this.setupEvent();
    this.resetProgress();
    this.tick();
  }

  /**
   * Removes event listener.
   */
  pause () {
    this.removeEvent();
  }

  /**
   * Reset progress in the DOM and inner state to given x and y.
   *
   * @param {Object} [pointerPosition]
   * @param {number} [pointerPosition.x]
   * @param {number} [pointerPosition.y]
   */
  resetProgress (pointerPosition = {}) {
    // get current pointer position (support window, element)
    const root = this.config.root;
    const x = pointerPosition.x || pointerPosition.x === 0 ? pointerPosition.x : root.scrollX || root.scrollLeft || 0;
    const y = pointerPosition.y || pointerPosition.y === 0 ? pointerPosition.y : root.scrollY || root.scrollTop || 0;
    this.progress.x = x;
    this.progress.y = y;
    this.progress.prevX = x;
    this.progress.prevY = y;
    this.progress.vx = 0;
    this.progress.vy = 0;
    this.progress.movementX = 0;
    this.progress.movementY = 0;

    if (pointerPosition) {
      this.config.root.scrollTo(x, y);
    }
  }

  /**
   * Handle animation frame work.
   *
   * @param {boolean} [clearLerpFrame] whether to cancel an existing lerp frame
   */
  tick (clearLerpFrame) {

    if (this.config.velocityActive) {
      const factorPx = this.progress.movementX < 0 ? -1 : 1;
      const factorPy = this.progress.movementY < 0 ? -1 : 1;

      this.progress.vx = Math.min(this.config.velocityMax, Math.abs(movementX)) / this.config.velocityMax * factorPx;
      this.progress.vy = Math.min(this.config.velocityMax, Math.abs(movementY)) / this.config.velocityMax * factorPy;
    }

    // update effect
    this.effect.tick(this.progress);

    this.progress.prevX = this.progress.x;
    this.progress.prevY = this.progress.y;
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
    // this.config.root.removeEventListener('pointermove', this._trigger);
    this.removeEvent();

    const tick = () => this.tick()
    // attempt usage of DeviceOrientation event
    const gyroscopeHandler = getGyroscope({
        progress: this.progress,
        samples: this.config.gyroscopeSamples,
        maxBeta: this.config.maxBeta,
        maxGamma: this.config.maxGamma
    });

    if (gyroscopeHandler) {
        this.usingGyroscope = true;
        this.tiltHandler = gyroscopeHandler;
    }
    else {
        /*
         * No deviceorientation support
         * Use pointermove event.
         */
        this.pointerHandler = getHandler({
            target: this.config.mouseTarget,
            progress: this.progress,
            callback: () => requestAnimationFrame(tick)
        });
    }

    this.pointerHandler.on();
  }

  /**
   * Remove pointermove handler.
   */
  removeEvent () {
    this.pointerHandler?.off();
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
 * @typedef {object} scrollConfig
 * @property {ScrollScene[]} scenes list of effect scenes to perform during scroll.
 * @property {boolean} [horizontal] whether to use the horizontal axis. Defaults to `false`.
 * @property {boolean} [transitionActive] whether to animate effect progress.
 * @property {number} [transitionFriction] between 0 to 1, amount of friction effect in the transition. 1 being no movement and 0 as no friction. Defaults to 0.4.
 * @property {boolean} [velocityActive] whether to calculate velocity with progress.
 * @property {number} [velocityMax] max possible value for velocity. Velocity value will be normalized according to this number, so it is kept between 0 and 1. Defaults to 1.
 * @property {boolean} [observeViewportEntry] whether to observe entry/exit of scenes into viewport for disabling/enabling them. Defaults to `true`.
 * @property {boolean} [viewportRootMargin] `rootMargin` option to be used for viewport observation. Defaults to `'7% 7%'`.
 * @property {boolean} [observeViewportResize] whether to observe resize of the visual viewport. Defaults to `false`.
 * @property {boolean} [observeSourcesResize] whether to observe resize of view-timeline source elements. Defaults to `false`.
 * @property {Element|Window} [root] the scrollable element, defaults to window.
 */

/**
 * @typedef {Object} ScrollScene
 * @desc A configuration object for a scene. Must be provided an effect function, and either a start and end, a start and duration, or a duration as RangeName.
 * @example { effects: (scene, p) => { animation.currentTime = p; }, duration: 'contain' }
 * @property {EffectCallback} effect the effect to perform.
 * @property {number|RangeOffset} start scroll position in pixels where effect starts.
 * @property {number|RangeName} [duration] duration of effect in pixels. Defaults to end - start.
 * @property {number|RangeOffset} [end] scroll position in pixels where effect ends. Defaults to start + duration.
 * @property {boolean} [disabled] whether to perform updates on the scene. Defaults to false.
 * @property {Element} [viewSource] an element to be used for observing intersection with viewport for disabling/enabling the scene, or the source of a ViewTimeline if scene start/end are provided as ranges.
 */

/**
 * @typedef {function(scene: ScrollScene, progress: number, velocity: number): void} EffectCallback
 * @param {ScrollScene} scene
 * @param {number} progress
 * @param {number} velocity
 */

/**
 * @typedef {'entry' | 'contain' | 'exit' | 'cover'} RangeName
 */

/**
 * @typedef {Object} RangeOffset
 * @property {RangeName} name
 * @property {number} offset
 * @property {CSSUnitValue} [add]
 */

/**
 * @typedef {Object} CSSUnitValue
 * @property {number} value
 * @property {'px'|'vh'|'vw'} unit
 */

/**
 * @typedef {Object} AbsoluteOffsetContext
 * @property {number} viewportWidth
 * @property {number} viewportHeight
 */
