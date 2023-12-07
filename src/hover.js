import { clamp } from './utilities.js';

export function getHandler ({target, progress, callback}) {
  let rect;

  if (target && target !== window) {
    rect = { ...target.getBoundingClientRect().toJSON() };
  }
  else {
    target = window;
    rect = {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  const {width, height, left, top} = rect;

  function handler (event) {
    const {x, y, movementX, movementY} = event;

    // percentage of position progress
    const clampedX = clamp(0, 1, (x - left) / width);
    const clampedY = clamp(0, 1, (y - top) / height);

    progress.x = +clampedX.toPrecision(4);
    progress.y = +clampedY.toPrecision(4);
    progress.h = height;
    progress.w = width;
    progress.movementX = movementX;
    progress.movementY = movementY;

    callback();
  }

  function on (config) {
    target.addEventListener('pointermove', handler, config || false);
  }

  function off (config) {
    target.removeEventListener('pointermove', handler, config || false);
  }

  return {
    on,
    off,
    handler
  };
}
