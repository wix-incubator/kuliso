import { debounce, defaultTo } from './utilities.js';
import { getTransformedScene } from './view.js';

const VIEWPORT_RESIZE_INTERVAL = 100;

/**
 * @private
 * @type {scrollConfig}
 */
const DEFAULTS = {
  observeViewportEntry: true,
  viewportRootMargin: '7% 7%',
  observeViewportResize: false,
  observeSourcesResize: false
};

/*
 * Utilities for scroll controller
 */

/**
 * Utility for calculating effect progress.
 *
 * @private
 * @param {number} p current scroll position
 * @param {number} start start position
 * @param {number} end end position
 * @param {number} duration duration of effect in scroll pixels
 * @return {number} effect progress, between 0 and 1
 */
function calcProgress (p, start, end, duration) {
  let progress = 0;

  if (p >= start && p <= end) {
    progress = duration ? (p - start) / duration : 1;
  }
  else if (p > end) {
    progress = 1;
  }

  return progress;
}

/**
 *
 * @param {Window|HTMLElement} root
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getViewportSize (root, isHorizontal) {
  if (root === window) {
    return window.visualViewport
      ? isHorizontal
        ? window.visualViewport.width
        : window.visualViewport.height
      : isHorizontal
        ? window.document.documentElement.clientWidth
        : window.document.documentElement.clientHeight;
  }

  return isHorizontal ? root.clientWidth : root.clientHeight;
}

function getAbsoluteOffsetContext () {
  // TODO: re-calc on viewport resize
  return {
    viewportWidth: window.visualViewport.width,
    viewportHeight: window.visualViewport.height
  };
}

/*
 * Pointer controller factory
 */

/**
 * Initialize and return a pointer controller.
 *
 * @private
 * @param {scrollConfig} config
 * @return {{tick: function, destroy: function}}
 */
export function getController (config) {
  const _config = defaultTo(config, DEFAULTS);
  const root = _config.root;
  const scenesByElement = new WeakMap();
  let viewportSize = getViewportSize(root, horizontal);

  let lastP;
  let viewportObserver, rangesResizeObserver, viewportResizeHandler, scrollportResizeObserver;
  const rangesToObserve = [];
  const absoluteOffsetContext = getAbsoluteOffsetContext()

  /*
   * Prepare scenes data.
   */
  _config.scenes = config.scenes.map((scene, index) => {
    scene.index = index;

    if (scene.viewSource && (typeof scene.duration === 'string' || scene.start?.name)) {
      scene = getTransformedScene(scene, root, viewportSize, horizontal, absoluteOffsetContext);

      if (_config.observeSourcesResize) {
        rangesToObserve.push(scene);
      }
    }
    else if (scene.end == null) {
      scene.end = scene.start + scene.duration;
    }

    if (scene.duration == null) {
      scene.duration = scene.end - scene.start;
    }

    return scene;
  });

  if (rangesToObserve.length) {
    if (window.ResizeObserver) {
      const targetToScene = new Map();

      rangesResizeObserver = new window.ResizeObserver(function (entries) {
        entries.forEach(entry => {
          const scene = targetToScene.get(entry.target);
          // TODO: try to optimize by using `const {blockSize, inlineSize} = entry.borderBoxSize[0]`
          _config.scenes[scene.index] = getTransformedScene(scene, root, viewportSize, horizontal, absoluteOffsetContext);

          // replace the old object from the cache with the new one
          rangesToObserve.splice(rangesToObserve.indexOf(scene), 1, _config.scenes[scene.index]);
        })
      });

      rangesToObserve.forEach(scene => {
        rangesResizeObserver.observe(scene.viewSource, {box: 'border-box'});
        targetToScene.set(scene.viewSource, scene);
      });
    }

    if (_config.observeViewportResize) {
      viewportResizeHandler = debounce(function () {
        viewportSize = getViewportSize(root, horizontal);

        const newRanges = rangesToObserve.map(scene => {
          const newScene = getTransformedScene(scene, root, viewportSize, horizontal, absoluteOffsetContext);

          _config.scenes[scene.index] = newScene;

          return newScene;
        });

        // reset cache
        rangesToObserve.length = 0;
        rangesToObserve.push(...newRanges);
      }, VIEWPORT_RESIZE_INTERVAL);

      if (root === window) {
        (window.visualViewport || window).addEventListener('resize', viewportResizeHandler);
      }
      else if (window.ResizeObserver) {
        scrollportResizeObserver = new window.ResizeObserver(viewportResizeHandler);
        scrollportResizeObserver.observe(root, {box: 'border-box'});
      }
    }
  }

  /*
   * Observe entry and exit of scenes into view
   */
  if (_config.observeViewportEntry && window.IntersectionObserver) {
    viewportObserver = new window.IntersectionObserver(function (intersections) {
      intersections.forEach(intersection => {
        (scenesByElement.get(intersection.target) || []).forEach(scene => {
          scene.disabled = !intersection.isIntersecting;
        });
      });
    }, {
      root: root === window ? window.document : root,
      rootMargin: _config.viewportRootMargin,
      threshold: 0
    });

    _config.scenes.forEach(scene => {
      if (scene.viewSource) {
        let scenesArray = scenesByElement.get(scene.viewSource);

        if (!scenesArray) {
          scenesArray = [];
          scenesByElement.set(scene.viewSource, scenesArray);

          viewportObserver.observe(scene.viewSource);
        }

        scenesArray.push(scene);
      }
    });
  }

  /**
   * Updates progress in all scene effects.
   *
   * @private
   * @param {Object} progress
   * @param {number} progress.p
   * @param {number} progress.vp
   */
  function tick (progress) {
    const x = +progress.x.toFixed(1)
    const y = +progress.y.toFixed(1)

    const velocityX = +progress.vx.toFixed(4);
    const velocityY = +progress.vy.toFixed(4);

    // if nothing changed bail out
    if (x === lastP.x && y === lastP.y) return;

    /*
     * Perform scene progression.
     */
    for (let scene of _config.scenes) {
      // if active
      if (!scene.disabled) {
        const {startX, startY, endX, endY, durationX, durationY} = scene;

        // calculate scene's progress
        const progressX = calcProgress(x, startX, endX, durationX); 
        const progressY = calcProgress(y, startY, endY, durationY);
        const currentProgress = {x: progressX, y: progressY}

        const velocity = {vx: velocityX, vy: velocityY} // eh??

        // run effect
        scene.effect(scene, currentProgress, velocity);
      }
    }

    // cache last position
    lastP = { x, y };
  }

  /**
   * Removes all side effects and deletes all objects.
   */
   function destroy () {

    if (rangesResizeObserver) {
      rangesResizeObserver.disconnect();
      rangesResizeObserver = null;
    }

    if (viewportResizeHandler) {
      if (scrollportResizeObserver) {
        scrollportResizeObserver.disconnect();
        scrollportResizeObserver = null;
      }
      else {
        (window.visualViewport || window).removeEventListener('resize', viewportResizeHandler);
      }
    }
  }

  /**
   * Mouse controller.
   */
  return {
    tick,
    destroy
  };
}