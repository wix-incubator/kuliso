import test from 'ava';
import { Pointer } from '../src/Pointer.js';

class ResizeObserver {
    constructor (callback) {
        this.callback = callback;
        global.resizeObserver = this;
    }
    observe (element) {
        this.target = element;
    }
    disconnect () {}
    trigger ({width, height}) {
        this.target.offsetWidth = width;
        this.target.offsetHeight = height;

        const entries = [{
            borderBoxSize: [
                {
                    inlineSize: width,
                    blockSize: height,
                }
            ]
        }];

        this.callback(entries);
    }
}

function generateElement ({width, height}) {
    return {
        offsetWidth: width,
        offsetHeight: height,
        addEventListener (type, handler) {},
        removeEventListener () {}
    };
}

test.beforeEach(() => {
    let resizeHandler, scrollendHandler;

    global.window = {
        visualViewport: {
            width: 400,
            height: 200
        },
        addEventListener (type, handler) {
            if (type === 'resize') {
                resizeHandler = handler;
            }
        },
        removeEventListener () {},
        resize (width, height) {
            this.visualViewport.width = width;
            this.visualViewport.height = height;
            resizeHandler?.();
        },
        scrollTo (x, y) {
            this.scrollY = y;
            this.scrollX = x;
            scrollendHandler?.();
        }
    };
    global.document = {
        addEventListener (type, handler) {
            if (type === 'scrollend') {
                scrollendHandler = handler;
            }
        },
        removeEventListener () {}
    };
    global.ResizeObserver = ResizeObserver;
    global.requestAnimationFrame = function () {};
})

test('Pointer.constructor :: sanity test', t => {
    const pointer = new Pointer({
        scenes: [
            { effect: () => {} }
        ]
    });

    t.is(typeof pointer._measure, 'function');
});

test('Pointer.start() :: sanity test', t => {
    const pointer = new Pointer({
        scenes: [
            { effect: () => {} }
        ]
    });

    pointer.start();

    t.is(typeof pointer.effect.tick, 'function');
});

test('Pointer.destroy() :: sanity test', t => {
    const pointer = new Pointer({
        scenes: [
            { effect: () => {} }
        ]
    });

    pointer.start();
    pointer.destroy();

    t.is(pointer.effect, null);
});

test('Pointer.destroy() :: destroy scene', t => {
    let destroyed = false;
    const pointer = new Pointer({
        scenes: [
            {
              effect() {},
              destroy() { destroyed = true; }
            }
        ]
    });

    pointer.start();
    pointer.destroy();

    t.is(pointer.effect, null);
    t.is(destroyed, true);
});

test('Pointer.tick() :: sanity test :: viewport as root', t => {
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
    pointer.progress.x = 100;
    pointer.progress.y = 100;
    pointer.tick();

    t.is(x, 0.25);
    t.is(y, 0.5);
});

test('Pointer.tick() :: sanity test :: element as root', t => {
    let x = 0;
    let y = 0;
    const root = generateElement({width: 100, height: 100});
    const pointer = new Pointer({
        root,
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
    pointer.progress.x = 20;
    pointer.progress.y = 50;
    pointer.tick();

    t.is(x, 20 / 100);
    t.is(y, 50 / 100);
});

test('Pointer.tick() :: update on resize :: element as root', t => {
    let x = 0;
    let y = 0;
    const root = generateElement({width: 100, height: 100});
    const pointer = new Pointer({
        root,
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
    pointer.progress.x = 20;
    pointer.progress.y = 50;
    pointer.tick();

    t.is(x, 20 / 100);
    t.is(y, 50 / 100);

    global.resizeObserver.trigger({width: 200, height: 200});
    pointer.tick();

    t.is(x, 20 / 200);
    t.is(y, 50 / 200);
});

test('Pointer.tick() :: update on window.resize', t => {
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
    pointer.progress.x = 100;
    pointer.progress.y = 100;
    pointer.tick();

    t.is(x, 0.25);
    t.is(y, 0.5);

    window.resize(600, 400);
    pointer.tick();

    t.is(x, +(100 / 600).toPrecision(4));
    t.is(y, 100 / 400);
});

test('Pointer.tick() :: centeredToTarget=true :: update on window.scrollend', t => {
    let x = 0;
    let y = 0;
    const target = generateElement({width: 100, height: 100});
    const pointer = new Pointer({
        scenes: [
            {
                target,
                centeredToTarget: true,
                effect(scene, progress) {
                    x = progress.x;
                    y = progress.y;
                }
            }
        ]
    });

    pointer.start();
    pointer.progress.x = 50;
    pointer.progress.y = 50;
    pointer.tick();

    t.is(x, 0.5);
    t.is(y, 0.5);

    global.window.scrollTo(0, 50);
    pointer.tick();

    t.is(x, 0.5);
    t.is(y, 250 / 400);
});
