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

export function addScrollendListener (target, listener) {
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
