# Architecture Document — SpaceLumin / Lumin Flow
**Date:** 2026-07-18 | **Branch:** crytek-project-audit

---

## System Overview

SpaceLumin is a browser-native 3D space survival game built without a game engine.
Its defining technical feature is a multi-layer prediction-and-adaptation AI stack
operating in real time alongside the game loop.

---

## High-Level Architecture Diagram

```mermaid
graph TB
    subgraph Browser["Browser (Single HTML Page)"]
        subgraph GameLoop["Game Loop (60fps rAF)"]
            GL[Game.js<br/>Main Controller]
        end

        subgraph Rendering["Rendering"]
            W3D[World3D.js<br/>Three.js Scene]
        end

        subgraph Input["Input"]
            IH[InputHandler.js<br/>Mouse / Touch / Keys]
            MC[MobileControls.js<br/>Virtual Joystick]
        end

        subgraph Entities["Game Entities"]
            PLR[Player.js]
            ENM[Enemy.js<br/>Boids + Steering]
            BUL[BulletPool]
            COL[Collectible.js]
        end

        subgraph Adaptive["Adaptive Systems"]
            DIR[Director.js<br/>Skill-based Difficulty]
            DNA[EnemyDNA.js<br/>Genetic Algorithm]
            DIF[DifficultySystem.js]
            SB[SpawnBudget.js]
        end

        subgraph PredictionStack["Prediction Stack"]
            TEL[TelemetryService.js<br/>Position Derivatives]
            PAI[PredictiveAI.js<br/>Markov Chain]
            KM[KernelMapper.js<br/>RBF KLR]
            NFC[NeuroFlowController.js<br/>Kalman + Catmull-Rom]
            NK[NystromKernel.js<br/>Low-Rank Approximation]
            COD[CognitiveOverloadDetector.js<br/>KLR + Lasso]
        end

        subgraph UI["UI Layer"]
            UIC[UIController.js]
            AUD[AudioSystem.js<br/>Tone.js]
            GHO[GhostConsole.js<br/>Debug Overlay]
        end

        subgraph Meta["Meta / Persistence"]
            MET[MetaSystem.js<br/>Upgrades / localStorage]
        end
    end

    subgraph Server["Optional Server (Node.js)"]
        SRV[server.js<br/>Express + Socket.io]
    end

    GL --> W3D
    GL --> PLR
    GL --> ENM
    GL --> DIR
    GL --> UIC
    IH --> GL
    MC --> IH
    TEL --> PAI
    TEL --> KM
    PAI --> DIR
    PAI --> DNA
    KM --> NFC
    NFC --> DNA
    NK --> COD
    COD --> DIR
    COD --> SB
    DIR --> ENM
    DNA --> ENM
    SRV -.->|WebSocket| GL
```

---

## Prediction Data Flow Diagram

```mermaid
flowchart LR
    subgraph Input ["Raw Signals (per frame)"]
        POS["Player Position x,y"]
        HP["Player HP"]
        NE["Nearby Enemy Count"]
        SH["Shot hit/miss"]
    end

    subgraph Tel ["TelemetryService.js"]
        JRK["Jerk = d³pos/dt³\n(3rd derivative)"]
        ENT["Shot Entropy\n(Shannon H)"]
        CHA["Chaos Factor\n0.7×jerk + 0.3×entropy"]
    end

    subgraph Mark ["PredictiveAI.js (Markov Chain)"]
        ENC["Encode State\nhpBracket × zone × jerk\n36 states total"]
        TRN["transitions[from][to]++"]
        PRD["predict()\nsum probs → dense/panic next"]
        RSK["3 Risk Signals\ncollisionRisk 0-1\npanicRisk 0-1\nmissedBurstRisk 0-1"]
    end

    subgraph KLR ["KernelMapper.js (RBF KLR)"]
        KVE["x = [xPos, yPos, jerk]\nnormalized 3D"]
        KFT["Gram matrix K\nGauss elimination\nfit every 40 samples"]
        KPR["P(FLOW) P(FRUSTRATION) P(BOREDOM)"]
        MGT["mutationGate = 0.2×P(FLOW) + 0.05×(1-P(FLOW))"]
    end

    subgraph Kal ["NeuroFlowController.js"]
        KAL["Kalman AR(2)\nz=[φ,φ_prev]\npredict + update"]
        CRF["Catmull-Rom\nC¹ smooth φ̂(t)"]
        FLW["flowBand: FLOW/OVER/UNDER"]
        DMG["Gene clamp\nf(L)=1.55^(L-1)\nneuro-attenuation β=0.35"]
    end

    subgraph Nys ["NystromKernel.js"]
        BUF["Ring buffer\n1200 samples\n12D phenotype"]
        LND["k-means++ landmarks\nm=60 points"]
        EIG["Jacobi eigen\nKmm^-1/2 computed"]
        PHI["φ̃(x) = Kmm^-1/2 · km(x)\nR^60 feature vector"]
    end

    subgraph COD ["CognitiveOverloadDetector.js"]
        OVL["P(Overload|x) = σ(w^T φ̃)"]
        OI["OI = φ_attn - φ_dmn\nOverload if OI < 0.15"]
        LAS["Kernelized Lasso\nattr per stimulus dim"]
        INT["Intervention dispatch\nenemy/bullet/audio/mesh/aggro/wave"]
    end

    subgraph Out ["Adaptive Outputs"]
        DS["Director.js\nenemySpeedMult\nspawnDensityMult\neliteChance"]
        GA["EnemyDNA.js\naggroMult × hint\nspeedMult × hint\nneuroFlow.clampDNA()"]
    end

    POS & HP & NE --> Tel
    SH --> ENT
    JRK --> ENC
    NE --> ENC
    HP --> ENC
    ENC --> TRN --> PRD --> RSK

    POS & JRK --> KVE --> KFT --> KPR --> MGT
    KPR --> KAL --> CRF --> FLW
    CRF --> DMG

    POS & JRK & SH & HP & NE --> BUF --> LND --> EIG --> PHI
    PHI --> OVL --> OI
    PHI --> LAS --> INT

    RSK --> DS
    RSK --> GA
    MGT --> GA
    FLW & DMG --> GA
    OI & INT --> DS
    INT --> Out
```

---

## Repository Map (Concise)

```
SpaceLumin/
├── index.html          HTML shell — all script tags, all UI overlays
├── styles.css          19 KB — UI styling
├── sw.js               PWA service worker
├── manifest.json       PWA install metadata
│
├── js/                 Game source (32 files)
│   ├── GAME SYSTEMS
│   │   ├── Game.js (1374 ln) — main controller, game loop
│   │   ├── World3D.js       — Three.js scene
│   │   ├── Player.js        — player entity
│   │   ├── Enemy.js         — enemy + Boids AI
│   │   ├── InputHandler.js  — all input
│   │   └── UIController.js  — all UI
│   │
│   ├── PREDICTION STACK (the original contribution)
│   │   ├── TelemetryService.js    — raw signal extraction
│   │   ├── PredictiveAI.js        — Markov chain (CORE)
│   │   ├── KernelMapper.js        — RBF KLR flow classifier
│   │   ├── NeuroFlowController.js — Kalman AR(2) bridge
│   │   ├── NystromKernel.js       — low-rank kernel approx
│   │   └── CognitiveOverloadDetector.js — KLR + Lasso
│   │
│   ├── ADAPTIVE SYSTEMS
│   │   ├── Director.js      — skill-based difficulty
│   │   ├── EnemyDNA.js      — genetic algorithm
│   │   └── DifficultySystem.js
│   │
│   └── TOOLS (should be in tools/)
│       ├── headless_orchestrator.js
│       ├── mcp_server.js
│       ├── static_server.js
│       └── GhostConsole.js
│
├── server/             Multiplayer backend (optional)
├── icons/              PWA icons (9 sizes)
└── telemetry_factory/  Synthetic data (1000+ JSONL, ~86 MB)
```

---

## Module Dependency Graph

```mermaid
graph TD
    KM[KernelMapper.js] --> NFC[NeuroFlowController.js]
    TEL[TelemetryService.js] --> NFC
    TEL --> PAI[PredictiveAI.js]
    NK[NystromKernel.js] --> COD[CognitiveOverloadDetector.js]
    NFC --> COD
    PAI --> COD

    KM --> DNA[EnemyDNA.js]
    PAI --> DNA
    NFC --> DNA
    TEL --> DNA
    TEL --> DIR[Director.js]

    DIR --> G[Game.js]
    DNA --> G
    COD --> G

    style PAI fill:#ff9900,color:#000
    style NK fill:#ff9900,color:#000
    style COD fill:#ff9900,color:#000
    style NFC fill:#ff9900,color:#000
    style KM fill:#ff9900,color:#000
    style TEL fill:#ff9900,color:#000
```

*Orange = prediction stack modules*

---

## State Machine (Game States)

```mermaid
stateDiagram-v2
    [*] --> menu
    menu --> tutorial
    menu --> meta
    menu --> settings
    menu --> onboard : first run
    onboard --> roadmap
    tutorial --> menu
    meta --> menu
    settings --> menu
    roadmap --> story : first run
    roadmap --> playing
    story --> playing
    playing --> paused
    paused --> playing
    playing --> results : game over
    results --> playing : restart
    results --> menu
    playing --> singularity : sector 20 complete
    singularity --> menu
```

---

## Game Loop Timing

```
requestAnimationFrame (target: 60fps = 16.67ms)
├── dt = THREE.Clock.getDelta()
├── Update all entities (Player, Enemy, Bullet, Collectible)
├── Telemetry.recordPosition() [per frame]
├── [Every 50ms] CognitiveOverloadDetector.update()
│   ├── NystromKernel.observe()
│   ├── KLR predict → overloadProb
│   └── If overload gate: Lasso + intervention
├── [Every 1s] Director.update()
│   ├── PredictiveAI.predict() → 3 risk signals
│   └── Adjust: enemySpeedMult, spawnDensityMult, eliteChance
├── [Per spawn] EnemyDNA.spawnNextGenDNA()
│   ├── PredictiveAI.getEnemyHint() → aggroMult, speedMult
│   └── neuroFlow.clampDNA() → final gene pass
└── world3D.render()
```
