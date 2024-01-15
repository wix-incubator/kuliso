/**
 * Initialize and return a gyroscope controller.
 *
 * @private
 * @param {GyroConfig} config
 * @return {{tick: function, destroy: function}}
 */
export function getController (config) {
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
  }

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
