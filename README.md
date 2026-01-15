#  PROTOCOL: ADAPT

**A Neural Survival Simulation with Adaptive AI**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Technology: Vanilla JS](https://img.shields.io/badge/Technology-Vanilla%20JS-F7DF1E.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Technology: Canvas API](https://img.shields.io/badge/Technology-Canvas%20API-red.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

##  Technical Highlights

This project is a deep dive into complex browser-based engineering, focusing on performance optimization, pathfinding algorithms, and procedural synthesis.

###  A* Pathfinding AI
The enemies utilize a custom implementation of the **A* Search Algorithm**, optimized for the 2D grid:
- **Heuristic**: Manhattan Distance for grid-based efficiency.
- **Optimization**: The algorithm is throttled to run every 30 ticks per enemy to maintain 60FPS even on low-end mobile devices.
- **Metrics**: Real-time "Nodes Searched" tracking available in the Technical Overlay.

###  Web Audio API Synthesis
Unlike static MP3s, the sound effects are procedurally generated:
- **Tone Synthesis**: Uses `OscillatorNode` with various waveforms (Sine, Sawtooth, Triangle).
- **Dynamic Envelopes**: Implements exponential ramp volume envelopes to prevent audio clicking and create punchy "8-bit" sounds.
- **Noise Generation**: Custom white noise buffers for hit/damage effects.

###  Technical Depth
- **Adaptive Maze Logic**: The labyrinth itself evolves. Every 150 ticks, a subset of walls toggle based on a per-cell "adaptability" score, forced to maintain at least one solvable path using a pathfinding check.
- **PWA (Progressive Web App)**: Full offline support via Service Workers and a manifest for a native app feel on mobile.
- **Performance**: Rendered via the **2D Canvas API** with manual state management for maximum control over the draw loop.

##  Mobile Experience
- **Responsiveness**: Dynamic scaling system ensure the game area fills the screen while maintaining aspect ratio.
- **Haptic Feedback**: Integrates the **Vibration API** for immersive physical feedback during combat.
- **Dual Control Paths**: Keyboard (WASD/Space) for Desktop and Virtual D-Pad for Mobile.

##  Engineering Best Practices
- **Persistence**: LocalStorage integration for high scores.
- **Accessibility**: ARIA labels and semantic structure for screen readers.
- **Clean Architecture**: Modular configuration objects and segregated state management.


