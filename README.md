# 🌌 SpaceLumin (LuminFlow)

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-00ffcc?style=for-the-badge&logo=github)](https://sibaiali.github.io/SpaceLumin/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Engine: Three.js](https://img.shields.io/badge/3D%20Engine-Three.js%20r128-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![Audio: Tone.js](https://img.shields.io/badge/Audio-Tone.js-purple?style=for-the-badge)](https://tonejs.github.io/)
[![Protocol: MCP](https://img.shields.io/badge/AI%20Protocol-MCP%20Server-orange?style=for-the-badge)](https://modelcontextprotocol.io/)

> **A real-time 3D space combat engine powered by closed-loop bio-cybernetic telemetry, low-rank kernel approximations (Nyström $m=60$), Kalman AR(2) filtering, and coordinate descent LASSO cognitive state attribution.**

---

## 🎮 Play SpaceLumin

👉 **[Play Live on GitHub Pages](https://sibaiali.github.io/SpaceLumin/)**  
*(Optimized for Desktop, Mobile Touch, and Progressive Web App installation)*

---

## ✨ Key Features

- **20 Dynamic Sectors & Gravitational Singularity**: Journey through Ice, Fire, Nature, Storm, and the final Sector 20 expanding Black Hole.
- **Pattern Prediction & Landmark Dynamics**: Collect wireframe **Landmark Nodes** to stabilize matrix rank telemetry, and **Predictive Vectors** to feed positive Markov transitions.
- **Flocking Swarm Intelligence**: Reynolds Boids steering algorithm (Separation, Cohesion, Alignment) powering multi-tiered enemy swarms.
- **Sub-2ms Zero-GC Math Window**: Ultra-efficient matrix operations and preallocated typed array buffers (`Float32Array`) designed for 60 FPS tick budgets.
- **Procedural Synthesizer**: Generative reactive audio soundscapes and dynamic tempo shifts via Tone.js.
- **Model Context Protocol (MCP) Server**: Official JSON-RPC 2.0 interface exposing real-time telemetry snapshots to LLMs and analytics engines.

---

## 🧠 Bio-Cybernetic AI Architecture

SpaceLumin implements a continuous feedback loop that translates low-level kinematic telemetry into dynamic difficulty adaptations:

```
[ Player Kinematics & Gameplay Stimuli (R^12) ]
                      │
                      ▼
[ Nyström Low-Rank RBF Kernel (m=60 Landmarks) ]
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
[ Kernel Logistic Regression ]  [ Coordinate Descent LASSO ]
        │                           │ (Stimulus Friction Attribution)
        ▼                           ▼
[ Kalman AR(2) Hemodynamic Filter ]  [ Markov Chain Mistake Predictor ]
        │ (Smoothed Neuro-Flow λ)    │ (Collision / Panic Risks)
        └─────────────┬─────────────┘
                      ▼
[ Dynamic Director & Enemy DNA Gene Mutations ]
```

1. **Nyström Kernel Approximation (`NystromKernel.js`)**: Approximates the intractable $O(n^3)$ Gram matrix using $m=60$ landmarks into an explicit feature map $\tilde{\phi}(x) \in \mathbb{R}^{60}$ with strict Positive Semi-Definite (PSD) guarantees.
2. **Kalman AR(2) Filter (`NeuroFlowController.js`)**: Filters cognitive classification noise into a smooth Neuro-Flow Coefficient ($\lambda \in [0, 1]$).
3. **Sparse LASSO Attribution (`CognitiveOverloadDetector.js`)**: Employs coordinate descent with soft-thresholding to isolate which stimulus (bullet density, enemy clustering, visual clutter) drives player panic.
4. **Markov Chain Forecasting (`PredictiveAI.js`)**: 36-state discrete probability transition matrix forecasting collision and panic-dodge risks before they occur.

---

## 🕹️ Controls & Abilities

| Input (Desktop) | Input (Mobile) | Action |
| :--- | :--- | :--- |
| **Mouse Cursor / Touch** | Virtual Joystick / Touch | Navigate Ship (Newtonian physics) |
| **Left Click / Hold** | Auto-fire / Tap | Fire Plasma Lasers |
| **F Key** | ❄️ Button | **Cryo Freeze**: Time-locks surrounding enemies |
| **R Key** | 🌀 Button | **Resonance Aura**: Vaporizes nearby projectiles & swarms |
| **Spacebar** | 👤 Button | **Holographic Decoy**: Deploys a phantom target |

---

## 📁 Repository Architecture

```
SpaceLumin/
├── index.html                   # WebGL canvas entry point & HUD UI
├── styles.css                   # Responsive layout & cybernetic aesthetic
├── manifest.json / sw.js        # Offline PWA service worker & app manifest
├── js/
│   ├── Game.js                  # Main game controller & collision loop
│   ├── World3D.js               # Three.js scene setup & camera rigs
│   ├── Player.js                # Ship physics & weapon systems
│   ├── Enemy.js / EnemyPool.js  # Boids flocking AI & elite boss behaviors
│   ├── Node.js                  # Gates & Sector 20 Gravitational Singularity
│   ├── Collectible.js           # Landmark Nodes & Predictive Vectors
│   ├── NystromKernel.js         # Nyström low-rank Gram matrix kernel (m=60)
│   ├── CognitiveOverloadDetector.js # LASSO coordinate descent solver
│   ├── NeuroFlowController.js   # Kalman AR(2) filter
│   ├── PredictiveAI.js          # Markov chain mistake predictor
│   ├── headless_orchestrator.js # 2,000-episode headless simulation runner
│   ├── mcp_server.js            # Model Context Protocol (MCP) server
│   └── static_server.js         # Local HTTP static server
├── telemetry_factory/           # 200,000-tick telemetry dataset & report
└── server/                      # Multiplayer WebSocket backend
```

---

## 🚀 Quickstart & Local Execution

### 1. Run the Game Locally
```bash
# Start the zero-dependency static server
node js/static_server.js

# Or use any static file server
npx serve .
```
Visit `http://localhost:3000` in your web browser.

### 2. Run Headless Telemetry Simulation
```bash
# Runs 2,000 automated episodes across 3 synthetic player phenotypes
node js/headless_orchestrator.js
```

### 3. Run & Test the MCP Server
```bash
# Verify JSON-RPC 2.0 protocol and sub-3.3ms telemetry snapshot lookup
node js/test_mcp.js
```

---

## 📜 License & Acknowledgments

Distributed under the **MIT License**. Built with [Three.js](https://threejs.org/) and [Tone.js](https://tonejs.github.io/).

