import test from 'ava';
import { Pointer } from '../src/kuliso.js';

test.beforeEach(() => {
    global.window = {
        visualViewport: {},
        addEventListener: function () {},
        removeEventListener: function () {}
    };
    global.document = {
        removeEventListener: function () {}
    };
})

test('Pointer constructor sanity test', t => {
    const pointer = new Pointer({
        scenes: [
            { effect: () => {} }
        ]
    });

    t.is(typeof pointer._measure, 'function');
});

test('Pointer.start() sanity test', t => {
    const pointer = new Pointer({
        scenes: [
            { effect: () => {} }
        ]
    });

    pointer.start();

    t.is(typeof pointer.effect.tick, 'function');
});

test('Pointer.destroy() sanity test', t => {
    const pointer = new Pointer({
        scenes: [
            { effect: () => {} }
        ]
    });

    pointer.start();
    pointer.destroy();

    t.is(pointer.effect, null);
});

test('Pointer.tick() sanity test', t => {
    let x = 0;
    let y = 0;
    const pointer = new Pointer({
        scenes: [
            {
                effect(scene, progress) {
                    x = progress.x;
                    y = progress.y;
                }
            }
        ]
    });

    pointer.start();
    pointer.config.rect.width = 400;
    pointer.config.rect.height = 200;
    pointer.progress.x = 100;
    pointer.progress.y = 100;
    pointer.tick();

    t.is(x, 0.25);
    t.is(y, 0.5);
});
