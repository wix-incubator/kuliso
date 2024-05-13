import { getRect, clamp } from './utilities.js';
import { addScrollendListener } from './scrollend.js';

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
export function getController (config) {
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
        const x = +clamp(0, 1, scene.transform?.x(progress.x) || progress.x / config.rect.width).toPrecision(4);
        const y = +clamp(0, 1, scene.transform?.y(progress.y) || progress.y / config.rect.height).toPrecision(4);

        const velocity = {x: progress.vx, y: progress.vy};

        // run effect
        scene.effect(scene, {x, y}, velocity);
      }
    }

    Object.assign(lastProgress, progress);
  }

  if (hasCenteredToTarget) {
    scrollendHandler = scrollendCallback.bind(scrollPosition, tick, lastProgress)
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
