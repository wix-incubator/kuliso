import test from 'ava';
import { Gyro } from '../src/Gyro.js';

let orientationHandler;

test.beforeEach(() => {
  global.window = {
    addEventListener (type, handler) {
      if (type === 'deviceorientation') {
        orientationHandler = handler;
      }
    },
    removeEventListener () {},
    requestAnimationFrame () {}
  };
})

test('Gyro.constructor :: sanity test', t => {
  const gyro = new Gyro({
    scenes: [
      { effect: () => {} }
    ]
  });

  t.is(typeof gyro._measure, 'function');
});

test('Gyro.start() :: sanity test', t => {
  const gyro = new Gyro({
    scenes: [
      { effect: () => {} }
    ]
  });

  gyro.start();

  t.is(typeof gyro.effect.tick, 'function');
});

test('Gyro.destroy() :: sanity test', t => {
  const gyro = new Gyro({
    scenes: [
      { effect: () => {} }
    ]
  });

  gyro.start();
  gyro.destroy();

  t.is(gyro.effect, null);
});

test('Gyro.destroy() :: destroy scene', t => {
  let destroyed = false;
  const gyro = new Gyro({
    scenes: [
      {
        effect() {},
        destroy() { destroyed = true; }
      }
    ]
  });

  gyro.start();
  gyro.destroy();

  t.is(gyro.effect, null);
  t.is(destroyed, true);
});

test('Gyro.tick() :: sanity test', t => {
  let x = 0;
  let y = 0;
  const gyro = new Gyro({
    samples: 0,
    scenes: [
      {
        effect(scene, progress) {
          x = progress.x;
          y = progress.y;
        }
      }
    ]
  });

  gyro.start();

  orientationHandler({gamma: 10, beta: -10});

  gyro.tick();

  t.is(x, +((10 + 15) / (15 * 2)).toPrecision(4));
  t.is(y, +((-10 + 15) / (15 * 2)).toPrecision(4));
});
