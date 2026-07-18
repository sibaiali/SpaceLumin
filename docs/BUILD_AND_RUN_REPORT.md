# Build and Run Report
**Date:** 2026-07-18  
**Branch:** `crytek-project-audit`

---

## Environment

| Item | Status |
|---|---|
| Operating System | Windows (PowerShell) |
| Node.js | **NOT INSTALLED** (`node` not found on PATH) |
| Python | Available |
| Git | Installed (git 2.x) |
| Browser | Not tested in this audit run |

---

## Build Attempt Log

### Step 1 — Check Node.js
```powershell
> where.exe node
INFO: Could not find files for the given pattern(s).

> node --version
'node' is not recognized as a name of a cmdlet...
```
**Result: FAILED — Node.js not installed**

### Step 2 — Git Status
```powershell
> git status
On branch crytek-project-audit
No commits yet
Changes to be committed: [all source files]
Unstaged: [15 modified files]
Untracked: [AI modules, server, telemetry_factory]
```
**Result: Repository has no commits. No build history.**

### Step 3 — Dependency Check (client)
The game client has **no npm dependencies**. It loads Three.js and Tone.js from CDN.  
**Result: No installation needed for client.**

### Step 4 — Server Dependency Check
```
server/package.json — dependencies: express, socket.io, cors
server/node_modules/ — MISSING
```
**Result: Server cannot run. `npm install` in server/ needed.**

### Step 5 — Static Server Options

The README instructs:
```bash
npx serve .
```
This requires Node.js/npx — **NOT AVAILABLE**.

Alternative (Python):
```bash
python -m http.server 8080
```
Python is available on the system. This would serve the game at `http://localhost:8080`.

---

## Launch Assessment

### Does the game launch?

**UNVERIFIED in this headless audit environment.** The game is a browser application that cannot be launched from the auditor's terminal environment.

**Based on source code inspection:**

| Check | Assessment |
|---|---|
| index.html is valid HTML5 | YES — verified by reading file |
| All JS files exist on disk | YES — all 32 files confirmed |
| External CDN libraries reachable | REQUIRES network access |
| Three.js scene construction | World3D.js appears correct |
| requestAnimationFrame loop | Game.js loop confirmed |
| Singletons initialized | All AI modules have global singleton creation |
| Service Worker registered | sw.js exists, manifest.json valid |

**Assessment: The game SHOULD launch in a browser served over HTTP. It has not been verified by an actual browser execution in this audit.**

> [!IMPORTANT]
> To verify: Open a terminal with Python available, run `python -m http.server 8080` from the SpaceLumin directory, then open `http://localhost:8080` in a browser.

---

## Expected Build Commands

```bash
# No build step required.
# For the game (client):
python -m http.server 8080     # or any static server

# For the multiplayer server (requires Node.js):
cd server
npm install
npm start                      # runs server.js on configured port

# For headless tests (requires Node.js):
node js/headless_orchestrator.js

# For icon generation (Python):
cd icons
python generate_icons.py
```

---

## Known Blockers

| Blocker | Severity | Resolution |
|---|---|---|
| Node.js not installed | HIGH — blocks server, tests | Install Node.js LTS |
| No git commits | HIGH — no history | `git add . && git commit -m "initial"` |
| node_modules missing (server) | HIGH — server cannot start | `cd server && npm install` |
| CDN libraries require network | MEDIUM — offline play broken | Bundle locally or use service worker cache |
| Three.js r128 stale | LOW — functional risk minimal | Upgrade to r165+ eventually |

---

## Warnings During Inspection

None of the JavaScript files have syntax errors visible during static analysis.  
The following patterns may cause runtime warnings:
1. `typeof telemetryService !== 'undefined'` — if load order wrong, AI silently does nothing
2. `ctx.audioSystem?.setMasterVolume` — optional chaining correct, but audio may not init
3. `nystromKernel.isFitted` — many branches skip processing until fitted; first 6s of gameplay the Nystrom kernel provides no classification

---

## Reproducible Bugs (From Static Analysis)

| Bug | Evidence | Severity |
|---|---|---|
| Director created twice | `Game.js` creates `new Director()`, AND `Director.js` has no global singleton. BUT `Director.js` has no singleton pattern (unlike AI modules). The `director` global used in CognitiveOverloadDetector may be undefined. | HIGH — Director interventions may silently fail |
| icon-192x192.png 404 | HTML: `<link rel="apple-touch-icon" href="icons/icon-192x192.png">` but file is `icon-192.png` | MEDIUM — PWA install icon broken |
| metaSystem reference | CognitiveOverloadDetector references `metaSystem` for shield duration but `metaSystem` is not a global singleton (Game creates `new MetaSystem()`) | MEDIUM — shield intervention may fail |

---

## Prediction Feature Visibility

The prediction system is **not directly visible to the player**. It operates as a background adaptive AI:
- `PredictiveAI` outputs `collisionRisk`, `missedBurstRisk`, `panicRisk` (0-1 values)
- These feed into `Director` to adjust `enemySpeedMult`, `spawnDensityMult`, `eliteChance`
- `CognitiveOverloadDetector` triggers interventions (audio duck, spawn reduction, shield)
- Players perceive the effect but not the cause — the difficulty "feels fair" without knowing why

For **portfolio demonstration**, the prediction system needs a debug/visualization overlay. `GhostConsole.js` (24 KB) appears designed for this but its activation mechanism is unclear from static analysis.

---

## Genuine Playability Assessment

**CANNOT CONFIRM without browser execution.**

From code evidence, the game SHOULD be:
- Genuinely playable (complete game loop, 20 sectors, boss mechanics, full UI)
- Playable on mobile (virtual joystick, touch gestures, PWA installable)
- Playable offline (service worker cache — after first load)

**The prediction system is architecturally integrated and SHOULD function during play.** Whether it meaningfully improves gameplay experience requires measurement (see EVALUATION_PLAN.md).
