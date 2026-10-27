# Crytek Role Match Analysis
**Date:** 2026-07-18  
**Branch:** `crytek-project-audit`

Match percentages are honest assessments. They are not inflated.

---

## Role 1: Gameplay Programmer

### Match: 38%

**Strongest evidence:**
- Complete game loop (update/render, delta time, requestAnimationFrame)
- Player entity with physics, abilities, shield, auto-fire
- Enemy AI with Boids-style flocking and boss variants
- Object pooling (BulletPool, EnemyPool)
- Input handling: mouse, touch, keyboard, gestures
- Frame-rate independent physics via THREE.Clock

**Missing requirements for Crytek:**
- C++ experience (primary language at Crytek is C++ in CryEngine)
- CryEngine or equivalent commercial engine experience
- Data-driven gameplay systems
- Console/multi-platform targets
- Shipped commercial titles
- Physics system implementation (uses Three.js — no custom physics)

**Recruiter concerns:**
- JavaScript is not a professional gameplay programming language
- No evidence of performance optimization with profiling data
- Game has not been confirmed to run
- No C++ code anywhere in the project

**Upgrades needed:**
1. Create a C++ or C# port of one core system (e.g., PredictiveAI in C++)
2. Add a Unity or Unreal prototype demonstrating the same game concepts
3. Add profiling data showing stable 60fps

**Portfolio role:** SUPPORTING (not flagship for this role)

---

## Role 2: Game AI Programmer

### Match: 58%

**Strongest evidence:**
- Markov chain behavioral prediction (direct transferable concept)
- Genetic algorithm enemy evolution (EnemyDNA.js)
- Adaptive difficulty (Director.js + DifficultySystem.js)
- Real-time behavior classification (KernelMapper: FLOW/FRUSTRATION/BOREDOM)
- Kernel methods knowledge (RBF, KLR, Nystrom approximation)
- Kalman filter for signal smoothing
- All implemented without libraries — demonstrates mathematical understanding
- Cognitive overload detection with stimulus attribution (Lasso)

**Missing requirements for Crytek:**
- C++ implementation (concepts are right, language is wrong)
- Path-finding systems (NavMesh, A*, etc.) — not present
- Behavior trees — not present
- GOAP or Utility AI — not present
- Shipped title with AI systems
- Multi-agent coordination beyond simple flocking

**Recruiter concerns:**
- Cannot demonstrate the system actually works (no accuracy measurement)
- Browser JS vs. C++ for game AI is a significant gap
- Boids implementation is standard (not novel)
- No navigation AI (only steering behaviors)

**Upgrades needed:**
1. Implement and measure prediction accuracy (even on synthetic data)
2. Write a 2-page technical case study: "How to port PredictiveAI to C++ UE5"
3. Add a behavior tree or GOAP system to Enemy.js as an additional AI layer
4. Demonstrate the Nystrom/KLR system working with performance numbers

**Portfolio role:** FLAGSHIP — this is the strongest role supported by the project

---

## Role 3: Tools Engineer

### Match: 22%

**Strongest evidence:**
- headless_orchestrator.js (906 lines) is a legitimate tool (browser stub + headless game runner)
- mcp_server.js shows tooling/integration thinking
- generate_icons.py shows scripting for asset pipeline
- GhostConsole.js is a runtime debug overlay tool

**Missing requirements for Crytek:**
- C++ editor plugins (CryEngine Sandbox extensions)
- Data import/export tools for 3D assets
- Level editor integrations
- Build system configuration (CMake, Waf, etc.)
- Profiling and debugging tools for game engines

**Recruiter concerns:**
- Very limited tooling evidence
- The headless orchestrator is functional but undocumented

**Upgrades needed:**
- This is not the right role to target with this project

**Portfolio role:** EXCLUDE (insufficient evidence)

---

## Role 4: Games UI Engineer

### Match: 45%

**Strongest evidence:**
- Complete menu system (Main, Tutorial, Story, Roadmap, Meta Lab, Settings, Pause, Results)
- HUD design (Flow bar, sector, abilities, cooldowns)
- Toast notification system
- Mobile virtual joystick (MobileControls.js)
- Floating damage labels (LabelSystem.js)
- PWA installable with custom icons (9 sizes)
- CSS animations and transitions (styles.css — 19 KB)
- Responsive design (mobile + desktop)
- Singularity cutscene (SingularitySequence.js)
- Google Fonts integration

**Missing requirements for Crytek:**
- C++ UI systems (Scaleform, Coherent UI, UMG/Slate in UE)
- Localization support
- Accessibility (keyboard navigation, screen reader)
- UI profiling / draw call budgets
- Animation curves and state machines
- No design system / component library

**Recruiter concerns:**
- HTML/CSS UI is fundamentally different from in-engine C++ UI
- No evidence of working within a UI budget (draw calls, overdraw)
- UI state machine uses string literals (not an enum state machine)

**Upgrades needed:**
1. Add keyboard-navigable UI (Tab/Arrow key focus ring)
2. Add a visible UI architecture diagram showing state machine
3. Profile the UI: measure time in UIController.update() per frame

**Portfolio role:** SUPPORTING — shows UI competence but wrong technology stack

---

## Role 5: General Software Engineer

### Match: 52%

**Strongest evidence:**
- Large, organized codebase (32 files, ~300 KB JS)
- Multiple design patterns: singleton, object pool, observer (typeof guards), strategy
- Real mathematical algorithms implemented from scratch
- PWA / cross-platform deployment
- Networking server (Express + Socket.io)
- Static file serving infrastructure
- Clean API design (recordEvent, predict, getEnemyHint)
- Graceful degradation throughout

**Missing requirements (typical tech company):**
- No unit tests (dealbreaker for most companies)
- No CI/CD
- No TypeScript (type safety)
- No package management at root
- No documented API (JSDoc / Swagger)
- Zero git commit history

**Recruiter concerns:**
- "No tests" is a hard disqualifier at most tech companies
- No git history makes development process impossible to evaluate
- The global singleton pattern is an anti-pattern in modern software engineering

**Upgrades needed:**
1. Add unit tests (minimum 20 for core logic)
2. Convert to TypeScript
3. Add a package.json at root with lint, test, build scripts
4. Make real git commits with meaningful messages

**Portfolio role:** SUPPORTING — algorithm depth helps, but missing fundamentals

---

## Primary Role Recommendation

### PRIMARY: Game AI Programmer (58%)

**Rationale:** The five-layer prediction pipeline (Markov → KLR → Kalman → Nystrom → Lasso) is directly relevant to game AI programming. The algorithms are sophisticated, implemented without libraries, and designed for real-time performance. The concepts (behavioral prediction, adaptive difficulty, player modeling) are used in shipped AAA games. This is the strongest unique differentiator in the project.

**Caveats:** The language gap (JS vs C++) must be addressed with a written translation document and ideally a small C++ or Unreal prototype.

### SECONDARY: Games UI Engineer (45%)

**Rationale:** The complete menu system, HUD, mobile controls, and PWA demonstrate genuine UI engineering competence. This is a secondary supporting role — it shows UI breadth, not depth.

---

## Honest Summary

This project demonstrates **conceptual sophistication** in game AI above the typical university project level. The Nystrom kernel approximation, Kalman AR(2) filter, and Kernelized Lasso attribution are genuinely advanced for a university final project.

However, the project has **significant portfolio presentation gaps**:
- No proof the system works (no accuracy measurements)
- No git history
- Wrong language for professional game development (JS vs C++)
- Missing research documents that justify the math

With 6–8 weeks of targeted improvements (evaluation, documentation, a C++ translation, and git history), this project could become a compelling Game AI Programmer application piece.

**Current state: Promising but unpolished. Not ready to submit.**
