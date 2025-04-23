# kuliso

Tiny library for performant pointer-driven or gyroscope-driven effects

## Overview

Kuliso is a lightweight JavaScript library that provides smooth and performant pointer (mouse/touch) and gyroscope-driven effects for web applications. It offers two main controllers:

- **Pointer Controller**: Handle mouse and touch interactions with configurable scenes and effects
- **Gyroscope Controller**: Create motion-based effects using device orientation

## Documentation

- [API Reference Documentation](https://wix-incubator.github.io/kuliso/reference/)
- [Demo Examples](https://wix-incubator.github.io/kuliso/demo/)

Local documentation is available in:
- `/docs/reference/` - API reference documentation
- `/docs/demo/` - Interactive examples and demos

## Features

- 🎯 Pointer tracking with configurable hit areas
- 📱 Gyroscope support for mobile devices
- ⚡ High-performance animations
- 🎨 Flexible scene-based effects system
- 🔄 Smooth transitions
- 📏 Centered-to-target calculations
- 🛠️ Customizable configuration

## Quick Start

```javascript
import { Pointer } from 'kuliso';

const pointer = new Pointer({
    scenes: [{
        effect: (scene, progress, velocity) => {
            // Implement your animation effect here
            // progress.x and progress.y range from 0 to 1
        }
    }]
});

pointer.start();
```

## API Overview

### Pointer Controller
- `new Pointer(config: PointerConfig)`: Create a new pointer controller
- Configuration options:
  - `scenes`: Array of effect scenes
  - `root`: Target hit area element
  - `transitionDuration`: Transition effect duration
  - `noThrottle`: Disable frame rate throttling

### Gyroscope Controller
- `new Gyro(config: GyroConfig)`: Create a new gyroscope controller
- Configuration options:
  - `scenes`: Array of effect scenes
  - `samples`: Calibration samples count
  - `maxBeta`: Maximum beta angle
  - `maxGamma`: Maximum gamma angle

For detailed API documentation and examples, please visit:
- Online documentation: [Official Documentation](https://wix-incubator.github.io/kuliso/reference/)
- Local documentation: Check the `/docs` folder in the repository
