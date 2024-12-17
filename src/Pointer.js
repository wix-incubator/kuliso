import { getController } from './controller.js';
import { frameThrottle } from './utilities.js';

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
export class Pointer {
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

    this._measure = (event) => {
      Object.assign(this.previousProgress, this.currentProgress || this.progress);

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

    const tick = (time) => {
      const p = (time - this._startTime) / duration;
      const t = easing(Math.min(1, p));

      this.currentProgress = Object.entries(this.progress).reduce((acc, [key, value]) => {
        acc[key] = this.previousProgress[key] + (value - this.previousProgress[key]) * t;
        return acc;
      }, this.currentProgress || {});

      if (p < 1) {
        this._nextTransitionTick = requestAnimationFrame(tick);
      } else {
        this.currentProgress.vx = 0;
        this.currentProgress.vy = 0;
      }

      this.effect.tick(this.currentProgress);
    };

    if (this._startTime) {
      this._nextTransitionTick && cancelAnimationFrame(this._nextTransitionTick);

      tick(now);
    }

    this._startTime = now;

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
 * @property {boolean} [noThrottle] whether to disable throttling the effect by framerate.
 * @property {number} [transitionDuration] duration of transition effect in milliseconds.
 * @property {function} [transitionEasing] easing function for transition effect.
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
