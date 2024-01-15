import { getController } from './gyroController.js';
import { frameThrottle, clamp } from './utilities.js';

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
export class Gyro {
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
