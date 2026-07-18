# SpaceLumin — Project Audit Report
**Branch:** `crytek-project-audit`  
**Audit Date:** 2026-07-18  
**Auditor Role:** Senior Game Engineer / Game AI Engineer / Technical Recruiter

---

## 1. Repository Identity

| Field | Value |
|---|---|
| Game Title | Lumin Flow: Utopia Run |
| Version Tag | v4.0 · Elemental Odyssey (HTML) / v3.0 (README) |
| Repository State | Initial commit staged, **zero actual git commits** |
| Git branch | `master` (no history); audit branch: `crytek-project-audit` |

> **WARNING:** The repository has **no commit history**. All files exist as staged new-files or unstaged modifications from a single initial `git init`. This means the project has no version control provenance, making it impossible to trace changes, co-author contributions, or demonstrate iterative development — a significant portfolio weakness.

---

## 2. Programming Languages

| Language | Usage |
|---|---|
| **JavaScript (ES6+)** | 100% of game logic — classes, arrow functions, Float32Array |
| **HTML5** | index.html (455 lines) — complete single-page game shell |
| **CSS3** | styles.css (19 KB) — game UI, overlays, animations |
| **JSON** | manifest.json, twa-manifest.json, package.json |
| **Python** | icons/generate_icons.py — offline icon generator only |
| **JSONL** | telemetry_factory/ — 1000+ synthetic episode files (~86 MB total) |

**No compiled language present.** No TypeScript. No Rust. No C++.

---

## 3. Game Engine / Framework

| System | Technology | Source |
|---|---|---|
| **3D Rendering** | Three.js r128 | CDN: cdnjs.cloudflare.com |
| **Audio** | Tone.js 14.7.77 | CDN: cdnjs.cloudflare.com |
| **Core Loop** | requestAnimationFrame + THREE.Clock | js/Game.js |
| **Networking** | Socket.io 4.6.1 | server/package.json (server-side only) |
| **PWA** | Service Worker (sw.js) + manifest.json | Root |

**No game engine.** Everything is hand-rolled on top of Three.js. The game is a **browser-native PWA** deployable as a static site.

---

## 4. Dependency Versions (Verified)

### Client (CDN only — no package.json at root)
| Library | Version |
|---|---|
| Three.js | r128 (2021 — 3 years stale) |
| Tone.js | 14.7.77 |
| Google Fonts | Cinzel 400/700, Inter 400/600/700 |

### Server (server/package.json)
| Dependency | Version |
|---|---|
| express | ^4.18.2 |
| socket.io | ^4.6.1 |
| cors | ^2.8.5 |

**NODE.JS IS NOT INSTALLED on this machine.** Server cannot be run locally. The game itself runs via static file serving.

---

## 5. Build and Launch Process

```
# No build step — pure static files

# Option A: Python (available on this system)
python -m http.server 8080
# then visit http://localhost:8080

# Option B: npx serve (requires Node.js — NOT INSTALLED)
npx serve .

# Option C: Open index.html directly in browser
# (may have CORS issues with service worker)
```

---

## 6. Repository Structure (Complete Map)

```
SpaceLumin/
├── index.html                    <- Single-page game shell (455 lines)
├── styles.css                    <- All game UI styling (19 KB)
├── sw.js                         <- PWA Service Worker
├── manifest.json                 <- PWA manifest
├── twa-manifest.json             <- Android TWA manifest
├── _redirects                    <- Netlify routing rules
├── README.md                     <- Basic project description
├── PLAYSTORE_GUIDE.md            <- Play Store guide
├── privacy.html                  <- Privacy policy
│
├── js/ (32 files)
│   ├── Game.js                   <- Main controller / game loop (1374 lines)
│   ├── World3D.js                <- Three.js scene (29 KB)
│   ├── Player.js                 <- Player ship entity (20 KB)
│   ├── Enemy.js                  <- Enemy entity + Boids AI (18 KB)
│   ├── InputHandler.js           <- Input system (18 KB)
│   ├── UIController.js           <- UI rendering (22 KB)
│   ├── AudioSystem.js            <- Procedural audio (14 KB)
│   │
│   ├── [PREDICTION SYSTEM]
│   ├── PredictiveAI.js           <- Markov chain predictor (285 lines)
│   ├── TelemetryService.js       <- Position derivative analytics (281 lines)
│   ├── KernelMapper.js           <- KLR: FLOW/FRUSTRATION/BOREDOM (353 lines)
│   ├── NeuroFlowController.js    <- Kalman AR(2) + Catmull-Rom (399 lines)
│   ├── NystromKernel.js          <- Nystrom low-rank approximation (429 lines)
│   ├── CognitiveOverloadDetector.js <- KLR overload + Lasso (510 lines)
│   │
│   ├── [ADAPTIVE SYSTEMS]
│   ├── Director.js               <- Skill-based difficulty (196 lines)
│   ├── EnemyDNA.js               <- Genetic algorithm (309 lines)
│   ├── DifficultySystem.js       <- Sector parameters
│   ├── EnemyPool.js              <- Object pool (17 KB)
│   ├── SpawnBudget.js            <- Wave budget
│   ├── MetaSystem.js             <- Meta progression
│   │
│   ├── [TOOLS / DEBUG - should be moved]
│   ├── headless_orchestrator.js  <- Node.js headless runner (906 lines)
│   ├── mcp_server.js             <- MCP AI integration (13 KB)
│   ├── static_server.js          <- Dev file server
│   ├── test_mcp.js               <- MCP tests
│   └── GhostConsole.js           <- Debug overlay (24 KB)
│
├── server/                       <- Multiplayer backend
│   ├── server.js                 <- Express + Socket.io (8 KB)
│   └── package.json
│
├── icons/                        <- PWA icons (9 sizes)
│
└── telemetry_factory/            <- SYNTHETIC DATA (~86 MB)
    └── episode_0001-1000+.jsonl  <- 1000+ synthetic sessions
```

---

## 7. Module Load Order (Critical — Global Singleton Pattern)

```
Required load order:
1. KernelMapper.js           (no deps)
2. TelemetryService.js       (no deps)
3. PredictiveAI.js           (no deps)
4. NystromKernel.js          (no deps)
5. NeuroFlowController.js    (needs: KernelMapper, TelemetryService)
6. CognitiveOverloadDetector.js (needs: NystromKernel, NeuroFlowController, PredictiveAI)
7. Director.js               (needs: TelemetryService, DifficultySystem)
8. EnemyDNA.js               (needs: TelemetryService, PredictiveAI, NeuroFlowController)
9. [Other entities]
10. Game.js                  (needs: all above)
```

All modules communicate via **global variables** checked with `typeof X !== 'undefined'`.

---

## 8. Game Loop (Verified)

- **Driver:** `requestAnimationFrame` bound in `Game` constructor
- **Delta time:** `THREE.Clock.getDelta()` — frame-rate independent
- **AI tick:** 50ms intervals (CognitiveOverloadDetector)
- **Director update:** 1 second
- **Telemetry:** Every frame (position), every shot

---

## 9. Player Input System (Verified from InputHandler.js)

| Input | Implementation |
|---|---|
| Mouse move | mousemove -> world coordinates |
| Touch drag | Virtual joystick (MobileControls) |
| Hold to shoot | AUTO_PULSE_INTERVAL = 0.2s |
| F/R/Space | Freeze/Aura/Decoy abilities |
| Tap to kill | TAP_MAX_DURATION = 200ms |
| Long press | LONG_PRESS_DURATION = 500ms -> freeze |

**Jerk (3rd derivative of position)** is the primary raw signal for all prediction systems — computed in TelemetryService.calculateDerivatives().

---

## 10. Code Quality Problems (Verified)

### Critical
1. **Zero git commits** — no development history
2. **Global singleton pattern** — all AI modules (`const predictiveAI = new PredictiveAI()`)
3. **No module system** — no ES modules, no bundler, load-order fragility
4. **Node.js not installed** — blocks server, headless tests
5. **No error boundaries** — silent failures via `typeof x !== 'undefined'`

### Moderate
6. Three.js r128 (2021) stale by 3 years
7. CDN dependencies — no lock file, no SRI integrity hashes
8. telemetry_factory/ (~86 MB) committed to repo
9. No JSDoc on Game.js (1374 lines)
10. Magic numbers without named constants
11. GhostConsole.js (24 KB debug tool) in production code path
12. mcp_server.js, test_mcp.js mixed into js/ alongside game code

### Minor
13. README links to placeholder Netlify URL
14. Version mismatch: README "v3.0" vs game "v4.0"
15. icon-192x192.png referenced in HTML but file named icon-192.png

---

## 11. Performance Risks (Verified)

| Risk | Severity |
|---|---|
| Nystrom fit ~180ms (async but still event loop) | Medium |
| Jacobi eigendecomposition O(n^3), 40 sweeps, 60x60 matrix | Low (fit-time only) |
| Lasso coordinate descent 30 iters x 60 dims per warning | Low |
| Three.js scene.children.length used as stimulus proxy | Medium |
| telemetry_factory ~86 MB in repo | Repo size |
| Global singletons — no cleanup across runs | Medium |

---

## 12. Missing Files / Broken Configuration

| Item | Status |
|---|---|
| Node.js runtime | NOT INSTALLED |
| node_modules/ (server) | Missing — npm install needed |
| Research docs referenced in code | MISSING: space_lumin_nystrom_overload.md, lumin_flow_2_research.md |
| Unit tests | NONE |
| CI/CD config | NONE |
| Source maps | NONE |
| Favicon | MISSING |

**CRITICAL:** The algorithm implementation comments reference external research documents that do not exist in the repository. If these contain original mathematical derivations, their absence is a major portfolio gap.

---

## 13. Generated / Unnecessary Artifacts

| Item | Action |
|---|---|
| telemetry_factory/*.jsonl (1000+ files, ~86 MB) | Move to .gitignore or data repo |
| js/mcp_server.js, js/test_mcp.js | Move to tools/ |
| js/static_server.js | Move to tools/ |
| js/GhostConsole.js | Gate behind debug flag |
| icons/generate_icons.py | Move to tools/ |

---

## 14. Questions for the Original Developer

1. Do the research docs (`space_lumin_nystrom_overload.md`, `lumin_flow_2_research.md`) exist? Where?
2. Which parts of the Nystrom kernel implementation are entirely your own vs. adapted?
3. Was TRIBE v2 ever connected to real hardware (fNIRS/EEG) or always simulated?
4. What were the university deliverables — report, demo video, supervisor feedback?
5. Which version was submitted to university vs. what is in this repository?
6. Are the 1000+ JSONL episodes from real gameplay or synthetic generation?
7. Was mcp_server.js part of the university project or added afterward?
8. Which files are entirely your original work vs. started from tutorials?
9. How many players playtested the prediction system?
10. Was the Markov chain ever compared against a random baseline?
