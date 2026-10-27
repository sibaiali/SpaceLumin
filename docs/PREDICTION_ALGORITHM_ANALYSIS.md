# Prediction Algorithm Analysis
**File:** `js/PredictiveAI.js` (285 lines, verified)  
**Supporting files:** TelemetryService.js, KernelMapper.js, NeuroFlowController.js, NystromKernel.js, CognitiveOverloadDetector.js

---

## System Overview

The project implements a **multi-layer prediction and adaptation stack**. This is NOT a single algorithm — it is a pipeline of five distinct systems. This analysis covers all five layers.

```
LAYER 0: RAW SIGNAL
  TelemetryService.js — Position derivatives (velocity, acceleration, jerk)

LAYER 1: MARKOV CHAIN PREDICTOR (primary prediction algorithm)
  PredictiveAI.js — 36-state Markov chain

LAYER 2: FLOW STATE KERNEL CLASSIFIER
  KernelMapper.js — Gaussian RBF KLR (FLOW / FRUSTRATION / BOREDOM)

LAYER 3: TEMPORAL BRIDGE
  NeuroFlowController.js — Kalman AR(2) filter + Catmull-Rom interpolation

LAYER 4: COGNITIVE OVERLOAD DETECTOR
  NystromKernel.js + CognitiveOverloadDetector.js — Nystrom KLR + Lasso attribution

LAYER 5: ADAPTIVE OUTPUTS
  Director.js, EnemyDNA.js — Gene mutation + difficulty multipliers
```

---

## Layer 0: TelemetryService — Raw Signal Extraction

**File:** `js/TelemetryService.js`

### What it measures
The 3rd derivative of player position (**jerk magnitude**) — a measure of movement "sharpness":

```
Position x(t)
→ Velocity vx = dx/dt
→ Acceleration ax = dvx/dt
→ Jerk jx = dax/dt
→ jerkMagnitude = sqrt(jx² + jy²)
```

### Additional signals
- **Shot entropy:** Shannon entropy H = -Σ p(x) log₂(p(x)) over a rolling 20-shot window
- **Chaos factor:** 0.7 × (jerkScore/50) + 0.3 × (entropyScore/50)
- **Playstyle classification:** Chaotic (jerkScore > 65) / Precise (< 35) / Balanced

### Data fed to PredictiveAI every frame:
```javascript
predictiveAI.recordEvent('position', {
    hp, maxHP, nearbyEnemies,
    jerk: last jerkHistory entry
});
predictiveAI.recordEvent('shot', { hit: boolean });
```

---

## Layer 1: PredictiveAI — Markov Chain Predictor (CORE ORIGINAL ALGORITHM)

**File:** `js/PredictiveAI.js`

### What is predicted?
The player's **next behavioral state** — specifically whether the player is about to:
- **collisionRisk:** Enter a dense enemy cluster (next state: zone = dense)
- **panicRisk:** Make a panic-dodge (next state: jerk = panic)
- **missedBurstRisk:** Enter a spray-fire burst (derived from rolling miss rate)

### State Encoding (Verified from source)

Each game tick maps to a discrete integer state encoding 3 dimensions:

```
State = hpBracket × (ZONE_LEVELS × JERK_LEVELS) + zoneBracket × JERK_LEVELS + jerkBracket

HP Brackets (4):   [0-25%] [26-50%] [51-75%] [76-100%]
Zone Brackets (3): [safe ≤2 enemies] [moderate 3-5] [dense ≥6]
Jerk Brackets (3): [calm <200] [active 200-800] [panic ≥800]

Total states: 4 × 3 × 3 = 36
```

### Transition Matrix

```javascript
this.transitions = Array(36).fill().map(() => Array(36).fill(0));
// transitions[fromState][toState]++ each frame
```

### Prediction Logic

```
Given currentState S:
  row = transitions[S]          // Count vector (length 36)
  total = sum(row)              // Total observed transitions from S

  For each nextState s in [0..35]:
    prob = row[s] / total
    if decoded(s).zone == 2: rawCollision += prob   // Dense cluster next
    if decoded(s).jerk == 2: rawPanic += prob        // Panic next

  missedBurstRisk = recentMisses / SHOT_WINDOW (5)  // Rolling window

  EWM smoothing (alpha=0.3):
    collisionRisk = 0.3 × rawCollision + 0.7 × collisionRisk
    panicRisk     = 0.3 × rawPanic     + 0.7 × panicRisk
```

### Complexity Analysis

| Operation | Time Complexity | Space Complexity |
|---|---|---|
| recordEvent('position') | O(1) | O(36²) = O(1296) |
| recordEvent('shot') | O(SHOT_WINDOW) = O(5) | O(5) |
| predict() | O(TOTAL_STATES) = O(36) | O(1) |
| _encodeState() | O(1) | O(1) |
| Total per frame | O(36) | O(1296) integers |

**Memory:** 36×36 integer matrix = 1296 integers ≈ 5 KB. Negligible.  
**CPU per frame:** O(36) loop — unmeasurable overhead.

### Algorithm Classification

**VERIFIED: Rule-based + First-order Markov chain + Probabilistic**

- NOT machine learning (no gradient descent)
- NOT neural network
- IS a finite-state Markov chain trained online from gameplay
- IS pure JavaScript with no external libraries
- IS genuinely original in its application context (player behavior prediction)

### What it does NOT predict
- The exact enemy the player will collide with
- The specific position of panic
- Long-horizon future states (it's first-order only — Markov property: next state depends only on current state)

### Assumptions
1. The 36-state discretization captures meaningful behavioral variation
2. Jerk magnitude > 800 is a reliable panic indicator (thresholds are hard-coded, not learned)
3. 20 transitions minimum before predictions are reliable (MIN_TRANSITIONS = 20)
4. The Markov property holds — behavioral patterns depend only on current state, not history

### Where it can fail
1. **Cold start:** First 20 transitions produce no output — ~5-10 seconds of play
2. **Sparse states:** Rare state combinations may have zero observed transitions
3. **Non-Markovian behavior:** Players with complex memory-dependent patterns (e.g., always panic-dodge after collecting a pickup) will be poorly modeled
4. **Fixed thresholds:** Jerk/zone thresholds are tuned for "typical" gameplay but not calibrated per-player
5. **Recentness problem:** Old transitions are never decayed — a player's early gameplay permanently influences predictions

### Positive reinforcement mechanism
```javascript
feedPositiveVector() {
    // When player performs well, reinforce transitions to safe/calm states
    transitions[currentState][safeState] += 5;
}
```
This is a novel addition: manual bias injection toward positive states.

---

## Layer 2: KernelMapper — Gaussian RBF Kernel Logistic Regression

**File:** `js/KernelMapper.js`

### Purpose
Classifies player into flow state: **FLOW / FRUSTRATION / BOREDOM**

### Input vector
```
x = [x_pos/800, y_pos/600, jerkMag/1000]  (3D, normalized)
```

### Kernel
```
k(a, b) = exp(-||a-b||² / 2σ²)   // Gaussian RBF
σ updated via median heuristic: σ = sqrt(median{||xi-xj||²})
```

### Training
One-vs-Rest KLR using Gaussian elimination on the Gram matrix:
```
K_reg = K + λn·I    (λ = 1e-3)
α_c = K_reg⁻¹ · y_c    (per class)
```
Training triggered after every 40 labelled samples.

### Auto-labelling (from NeuroFlowController)
```
phi > 0.70  → FLOW
phi < 0.35  → BOREDOM
else        → FRUSTRATION
```

### Output
```
{ state: 'FLOW'|'FRUSTRATION'|'BOREDOM', flowProb, proba: [3] }
```

### Integration
- FLOW probability → `getMutationGate()` → constrains EnemyDNA mutation range
- State → NeuroFlowController difficulty modifiers

---

## Layer 3: NeuroFlowController — Kalman AR(2) + Catmull-Rom Interpolation

**File:** `js/NeuroFlowController.js`

### Purpose
Bridges the 5-second TRIBE v2 hemodynamic lag to the 50ms game tick. In practice (no real hardware): provides smooth φ estimates from auto-labelled flow state.

### Kalman Filter (2×2)
```
State: z = [φ_t, φ_{t-1}]^T
F = [[0.90, -0.10], [1.0, 0.0]]   // AR(2) coefficients
Q = [[0.005, 0], [0, 0.005]]      // Process noise
R = 0.05                           // Observation noise
```

### Catmull-Rom Interpolation
Smooth per-frame φ from 4 Kalman knots — guarantees C¹ continuity (no difficulty "pops").

### Difficulty modulation
```
f(L) = 1.55^(L-1)              // Exponential sector scaling
f~(L) = f(L) × (1 - β(1-φ))   // Neuro-attenuation (β=0.35)
diffMult = clamp(f~/f, 0.65, 1.0)
```

---

## Layer 4: Nystrom Kernel + Cognitive Overload Detector

**Files:** `js/NystromKernel.js`, `js/CognitiveOverloadDetector.js`

### NystromKernel — Low-Rank Approximation

**12-dimensional input phenotype:**
```
[vx, vy, |a|, jerk, t_react, accuracy,    // 6 kinematics
 enemyDensity, bulletCoverage, audioPeak,  // 6 stimuli
 visibleMeshes, aggressionMult, waveTimerRatio]
```

**Nystrom approximation:**
```
K~ = K_nm · K_mm^{-1} · K_nm^T    (rank-m, O(nm) memory)

Feature map: φ~(x) = K_mm^{-1/2} · k_m(x) ∈ R^60

Landmark selection: k-means++ seeding
Bandwidth: median heuristic σ² = median(||xi-xj||²)
Eigendecomposition: Jacobi method (40 sweeps, O(m³) fit-time)
```

**Budget (from comments, unverified):** 0.004ms per tick (m=60, d=12), ~180ms async fit.

### CognitiveOverloadDetector — KLR Overload Classifier

Operates in the 60-dimensional Nystrom feature space:
```
P(Overload | x_t) = σ(w^T φ~(x_t) + bias)
```

**Overload Index:**
```
OI(t) = φ_attn(t) - φ_dmn(t)
Overload when: OI < 0.15 AND dOI/dt < -0.03/s
```

**Kernelized Lasso attribution:**
```
min_α 1/(2n)||y - Φ~α||² + λ||α||₁
Identifies WHICH stimulus dimension (enemyDensity, bulletCoverage, etc.)
is causing predicted overload.
```

**Intervention dispatch (verified from source):**
| Cause | Intervention |
|---|---|
| enemyDensity | director.spawnDensityMult × 0.80 |
| bulletCoverage | player.activateShield() for 2.5s |
| audioPeakDb | audioSystem.setMasterVolume × 0.6 for 4s |
| visibleMeshes | difficultySystem hazardStrengthMult × 0.7 |
| aggressionMult | director.enemySpeedMult × 0.85 for 3s |
| waveTimerRatio | spawnBudget.extendBudget(+5s) |

---

## Prediction-Gameplay Integration

```
Per frame (60fps):
  TelemetryService.recordPosition() → PredictiveAI.recordEvent('position')
  → Markov transitions[from][to]++

Per shot:
  TelemetryService.recordShot() → PredictiveAI.recordEvent('shot')
  → Rolling miss window updated

Every 50ms:
  CognitiveOverloadDetector.update() → NystromKernel.observe()
  → KLR inference → overload detection → intervention

Every 1 second:
  Director.update() → telemetryService.getPrediction()
  → PredictiveAI.predict()
  → Reads: collisionRisk, missedBurstRisk, panicRisk
  → Adjusts: enemySpeedMult, eliteChance, spawnDensityMult

Per enemy spawn:
  EnemyDNA.spawnNextGenDNA() → predictiveAI.getEnemyHint()
  → aggroMult, speedMult adjust new enemy genes
  → neuroFlow.clampDNA() → final gene pass
```

---

## Pseudocode: Full Prediction Cycle

```
EVERY FRAME:
  jerk = d³(position)/dt³
  state = encode(hpBracket, zoneBracket, jerkBracket)
  transitions[prevState][state]++

EVERY 50ms:
  phenotype = [vx, vy, accel, jerk, reactTime, accuracy,
               enemyDensity, bulletCount, audio, meshes, aggro, wave]
  phi = NystromKernel.featureVector(phenotype)
  overloadProb = sigmoid(w^T × phi)
  IF overloadProb > 0.65 AND OI declining:
    causativeStimulus = Lasso.argmax(attrScores)
    DISPATCH intervention for causativeStimulus

EVERY 1 SECOND:
  FOR each nextState s in [0..35]:
    prob = transitions[currentState][s] / totalFromCurrent
    IF s.zone == dense: collisionRisk += prob
    IF s.jerk == panic: panicRisk += prob
  missedBurstRisk = misses / 5
  IF collisionRisk > 0.70: enemySpeed × 0.90
  IF missedBurstRisk > 0.60: eliteChance + 10%
  IF panicRisk > 0.70: spawnDensity × 0.85

PER ENEMY SPAWN:
  hint = PredictiveAI.getEnemyHint()
  newEnemy.aggro × hint.aggroMult
  newEnemy.speed × hint.speedMult
  neuroFlow.clampDNA(newEnemy, sector)
```

---

## What Appears Genuinely Original

**Verified as non-library, non-tutorial code:**

1. **The 36-state behavioral Markov chain** — the specific state encoding (HP × zone × jerk) and its application to pre-emptive enemy tuning appears to be the author's own design
2. **The Nystrom kernel implementation** — full Jacobi eigendecomposition, k-means++ landmark selection, and online normalization in pure JavaScript
3. **The Cognitive Overload Index formula** (OI = φ_attn - φ_dmn) and its gating condition
4. **The Kernelized Lasso attribution-to-intervention routing** — identifying the specific stimulus causing predicted overload and dispatching a targeted game adjustment
5. **feedPositiveVector()** — manual transition reinforcement toward safe states (unusual design)
6. **Catmull-Rom C¹ continuity for difficulty transitions** — prevents abrupt difficulty changes

---

## Evidence Needed to Prove Effectiveness

1. Prediction accuracy measurement: correct / total predictions (see EVALUATION_PLAN.md)
2. Comparison against random baseline (random 0/1 for each risk flag)
3. Comparison against frequency baseline (always predict most common next state)
4. Comparison against player performance WITH vs. WITHOUT prediction active
5. Session survival time correlation with prediction accuracy
6. Player experience survey: "Did difficulty feel fair?" scored with vs. without system
