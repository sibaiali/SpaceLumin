# Upgrade Roadmap
**Date:** 2026-07-18 | **Branch:** crytek-project-audit

Tasks are divided into Critical, Technical, Portfolio, and Optional tiers.
This roadmap is PROPOSED — implementation has NOT started.

---

## TIER 1: Critical Repairs
*Without these, the project cannot be reliably demonstrated.*

---

### CR-1 — Make the first git commit
**Priority:** P0 — Immediate  
**Complexity:** Trivial (5 min)  
**Prerequisites:** None  
**Affected files:** All (git commit, not code change)  
**Acceptance criteria:** `git log --oneline` shows at least one meaningful commit  
**Portfolio value:** HIGH — no git history is a disqualifier  
**Role relevance:** All roles

```powershell
git add .
git commit -m "feat: initial game implementation — Lumin Flow v4.0 Elemental Odyssey

- Markov chain behavioral predictor (PredictiveAI.js)
- Nystrom kernel + KLR cognitive overload detector
- Genetic algorithm enemy evolution (EnemyDNA.js)
- Kalman AR(2) flow state controller
- 20-sector 3D space survival game (Three.js / Tone.js)"
```

---

### CR-2 — Install Node.js and verify headless orchestrator
**Priority:** P0  
**Complexity:** Low (30 min)  
**Prerequisites:** None  
**Affected files:** js/headless_orchestrator.js  
**Acceptance criteria:** `node js/headless_orchestrator.js` runs without fatal errors  
**Portfolio value:** HIGH — unlocks all headless testing  
**Role relevance:** Game AI Programmer, General Software Engineer

```powershell
# Download Node.js LTS from https://nodejs.org
node --version   # Verify install
node js/headless_orchestrator.js
```

---

### CR-3 — Fix Director singleton availability
**Priority:** P1  
**Complexity:** Low (1 hour)  
**Prerequisites:** Source code access  
**Affected files:** js/Director.js, js/CognitiveOverloadDetector.js  
**Problem:** CognitiveOverloadDetector references `director` as a global, but Director.js does not create a global singleton. Game.js creates `this.director = new Director()`.  
**Acceptance criteria:** `typeof director !== 'undefined'` is true during gameplay  
**Portfolio value:** MEDIUM — fixes silent AI failure  
**Role relevance:** Game AI Programmer, Gameplay Programmer

---

### CR-4 — Fix icon-192x192.png reference
**Priority:** P1  
**Complexity:** Trivial (5 min)  
**Affected files:** index.html  
**Problem:** HTML references `icons/icon-192x192.png` but file is `icons/icon-192.png`  
**Acceptance criteria:** Apple touch icon loads without 404  
**Role relevance:** Games UI Engineer

---

### CR-5 — Serve the game and confirm it launches
**Priority:** P0  
**Complexity:** Low (15 min)  
**Prerequisites:** Python or Node.js  
**Affected files:** None (environment setup)  
**Acceptance criteria:** Game menu appears in browser, Play button starts gameplay  
**Portfolio value:** CRITICAL — cannot claim the game is playable without this

```powershell
python -m http.server 8080
# Open http://localhost:8080 in browser
```

---

## TIER 2: Technical Upgrades
*Architecture, algorithm measurement, testing, profiling.*

---

### TU-1 — Implement prediction accuracy measurement
**Priority:** P1  
**Complexity:** Medium (1-2 days)  
**Prerequisites:** CR-2 (Node.js), CR-5 (game launches)  
**Affected files:** js/PredictiveAI.js (add logging), new: js/PredictionEvaluator.js  
**Acceptance criteria:**
- `PredictionEvaluator` logs (prediction, confidence, timestamp) for each risk signal
- Runs on the 1000 JSONL episodes
- Exports accuracy, precision, recall, F1 for each risk type
- Includes comparison against random and frequency baselines

**Portfolio value:** CRITICAL for Game AI role — without this, you cannot defend the system in an interview  
**Role relevance:** Game AI Programmer

---

### TU-2 — Add recency decay to Markov transition matrix
**Priority:** P2  
**Complexity:** Low (2 hours)  
**Prerequisites:** None  
**Affected files:** js/PredictiveAI.js  
**Problem:** Old transitions are never discounted — early gameplay permanently influences predictions  
**Solution:** Apply exponential decay: `transitions[i][j] *= 0.999` each frame, or use a sliding window  
**Acceptance criteria:** Predictions adapt within 60 seconds to a significant behavior change  
**Portfolio value:** MEDIUM — improves algorithm quality  
**Role relevance:** Game AI Programmer

---

### TU-3 — Add prediction debug overlay (HUD)
**Priority:** P1  
**Complexity:** Medium (4 hours)  
**Prerequisites:** CR-5 (game launches)  
**Affected files:** js/UIController.js, js/GhostConsole.js  
**Acceptance criteria:** Press Ctrl+D to toggle overlay showing:
- collisionRisk, panicRisk, missedBurstRisk (live 0-1 bars)
- Current Markov state (hpBracket, zone, jerk)
- totalTransitions count
- overloadProb, OI_NOW from CognitiveOverloadDetector
- Nystrom fitted status

**Portfolio value:** HIGH — makes prediction system visible for demo recordings  
**Role relevance:** Game AI Programmer, Games UI Engineer

---

### TU-4 — Convert to ES modules with Vite
**Priority:** P2  
**Complexity:** High (2-3 days)  
**Prerequisites:** CR-2 (Node.js)  
**Affected files:** All 32 JS files  
**Acceptance criteria:**
- All files use `import`/`export`
- `npm run dev` starts Vite dev server
- `npm run build` produces a dist/ bundle
- No global singletons (use dependency injection)

**Portfolio value:** HIGH — shows modern JS engineering  
**Role relevance:** General Software Engineer, Tools Engineer

---

### TU-5 — Write unit tests for PredictiveAI
**Priority:** P1  
**Complexity:** Medium (1 day)  
**Prerequisites:** CR-2 (Node.js)  
**Affected files:** new: tests/PredictiveAI.test.js  
**Acceptance criteria:** 10 tests passing:
- _encodeState() produces values in [0, 35]
- _decodeState(_encodeState(x)) == x (round-trip)
- predict() returns 0 before MIN_TRANSITIONS
- transitions accumulate correctly after recordEvent
- getEnemyHint() clamps values within declared ranges

**Portfolio value:** HIGH — testing is table-stakes for any software engineering role  
**Role relevance:** All roles

---

### TU-6 — Move Nystrom fit to Web Worker
**Priority:** P2  
**Complexity:** Medium (1 day)  
**Prerequisites:** CR-2  
**Affected files:** js/NystromKernel.js, new: workers/nystrom.worker.js  
**Acceptance criteria:** Nystrom fit never produces frame drops > 2ms  
**Portfolio value:** MEDIUM — demonstrates performance engineering  
**Role relevance:** Game AI Programmer, Gameplay Programmer

---

### TU-7 — Add SRI integrity hashes to CDN dependencies
**Priority:** P2  
**Complexity:** Low (1 hour)  
**Affected files:** index.html  
**Acceptance criteria:** Three.js and Tone.js script tags have `integrity="sha384-..."` attributes  
**Portfolio value:** LOW (security hygiene)  
**Role relevance:** General Software Engineer

---

## TIER 3: Portfolio Upgrades
*Demo, documentation, presentation.*

---

### PU-1 — Record 90-second gameplay + prediction demo video
**Priority:** P0 (single highest-impact portfolio action)  
**Complexity:** Low (2 hours with game running)  
**Prerequisites:** CR-5 (game launches), TU-3 (debug overlay)  
**Acceptance criteria:**
- Video shows: menu → play → gameplay → prediction overlay active → overload intervention triggered
- Resolution ≥1080p, stable 60fps
- Uploaded to YouTube (unlisted) + linked in README

**Portfolio value:** CRITICAL — recruiters spend <5 minutes on GitHub before moving on  
**Role relevance:** All roles

---

### PU-2 — Deploy live demo to Netlify/GitHub Pages
**Priority:** P1  
**Complexity:** Low (1 hour)  
**Prerequisites:** CR-5  
**Acceptance criteria:** Game is accessible at a real URL, listed in README  
**Portfolio value:** HIGH — "Play it here" is the fastest credibility builder  
**Role relevance:** All roles

---

### PU-3 — Write algorithm technical case study (2 pages)
**Priority:** P1  
**Complexity:** Medium (4 hours)  
**Affected files:** new: docs/TECHNICAL_CASE_STUDY.md  
**Content:**
1. Problem statement: Why predict player behavior?
2. Algorithm choice rationale: Why Markov chain? Why 36 states?
3. Key design decisions and tradeoffs
4. Measured accuracy results (after TU-1)
5. How the same algorithm would be implemented in C++ for a Crytek-style engine
6. What I learned and what I would improve

**Portfolio value:** CRITICAL for Game AI role — technical writing is assessed in interviews  
**Role relevance:** Game AI Programmer

---

### PU-4 — Add research documents to repository
**Priority:** P1  
**Complexity:** Low (if docs exist) / High (if they must be written)  
**Affected files:** new: research/space_lumin_nystrom_overload.md, research/lumin_flow_2_research.md  
**Acceptance criteria:** All code comments referencing §sections have matching documentation  
**Portfolio value:** HIGH — proves the mathematical derivations are genuine  
**Role relevance:** Game AI Programmer

---

### PU-5 — Rewrite README as a proper portfolio README
**Priority:** P1  
**Complexity:** Low (2 hours)  
**Affected files:** README.md  
**Content:**
- Project title + one-line description
- Live demo link (after PU-2)
- Gameplay GIF (3 seconds)
- "How the AI works" section (2 paragraphs)
- Algorithm summary table
- Architecture diagram (embed ARCHITECTURE.md Mermaid)
- Build/run instructions
- Tech stack badges

**Portfolio value:** HIGH — README is the first thing GitHub visitors see  
**Role relevance:** All roles

---

### PU-6 — Add 3 screenshots to README
**Priority:** P2  
**Complexity:** Low (30 min after game launches)  
**Affected files:** README.md, new: docs/screenshots/  
**Acceptance criteria:** Screenshots show: menu, gameplay, debug AI overlay  
**Portfolio value:** MEDIUM  
**Role relevance:** All roles

---

### PU-7 — Add GitHub Actions CI
**Priority:** P2  
**Complexity:** Low (2 hours)  
**Prerequisites:** TU-4 (Vite), TU-5 (unit tests)  
**Affected files:** new: .github/workflows/ci.yml  
**Acceptance criteria:** CI runs lint + tests on every push  
**Portfolio value:** MEDIUM — shows professional development practices  
**Role relevance:** General Software Engineer, Tools Engineer

---

### PU-8 — Move tools files out of js/
**Priority:** P2  
**Complexity:** Low (1 hour)  
**Affected files:** Move: headless_orchestrator.js, mcp_server.js, static_server.js, test_mcp.js → tools/  
**Acceptance criteria:** js/ contains only game modules  
**Portfolio value:** LOW (code organization)  
**Role relevance:** All roles

---

### PU-9 — Add telemetry_factory to .gitignore
**Priority:** P2  
**Complexity:** Trivial (5 min)  
**Affected files:** .gitignore  
**Problem:** 86 MB of JSONL data should not be committed to the game repository  
**Acceptance criteria:** telemetry_factory/ excluded from git  
**Portfolio value:** LOW but removes noise from repo  
**Role relevance:** All roles

---

## TIER 4: Optional Upgrades
*Impressive but not necessary for core engineering value.*

---

### OU-1 — C++ prototype of PredictiveAI
**Priority:** Optional  
**Complexity:** High (1-2 weeks)  
**Description:** Implement the 36-state Markov chain in C++ with `std::array<std::array<int,36>,36>`. Benchmark against JS version. Include in technical case study.  
**Portfolio value:** HIGH for Crytek specifically — C++ is their language  
**Role relevance:** Game AI Programmer (Crytek)

---

### OU-2 — Behavior tree layer in Enemy.js
**Priority:** Optional  
**Complexity:** High (3 days)  
**Description:** Implement a simple behavior tree (Sequence, Selector, Action) for enemy decision-making, combining with current Boids steering. Demonstrates standard AI architecture.  
**Portfolio value:** MEDIUM  
**Role relevance:** Game AI Programmer

---

### OU-3 — Upgrade Three.js from r128 to r165+
**Priority:** Optional  
**Complexity:** Medium (1 day testing)  
**Description:** Update CDN reference, test for breaking changes. Three.js r128 → r165 has known API changes in WebGLRenderer and material classes.  
**Portfolio value:** LOW (maintenance hygiene)  
**Role relevance:** Gameplay Programmer

---

### OU-4 — TypeScript conversion
**Priority:** Optional  
**Complexity:** High (1 week)  
**Description:** Convert all JS to TypeScript with proper types for DNA, game state, prediction outputs. Run tsc --strict.  
**Portfolio value:** MEDIUM for general software roles  
**Role relevance:** General Software Engineer

---

### OU-5 — Multiplayer via Socket.io server
**Priority:** Optional  
**Complexity:** High (1+ week)  
**Description:** Complete the server/server.js integration. Enable 2-player cooperative mode where each player's Markov prediction influences shared difficulty.  
**Portfolio value:** MEDIUM (interesting design)  
**Role relevance:** Gameplay Programmer, General Software Engineer

---

## Recommended Execution Order

```
Week 1: CR-1, CR-2, CR-4, CR-5 (get it running and committed)
Week 2: CR-3, TU-3, PU-6 (fix bugs, add debug overlay, screenshots)
Week 3: TU-1, TU-5 (measure the algorithm, write tests)
Week 4: PU-1, PU-2 (video, live demo)
Week 5: PU-3, PU-4, PU-5 (technical writing)
Week 6: TU-4 (ES modules / Vite — only if time allows)
```

**Minimum viable portfolio (8 hours total):**
- CR-1 + CR-5 + PU-1 + PU-2 + PU-5 = Game running, video recorded, live URL, good README
