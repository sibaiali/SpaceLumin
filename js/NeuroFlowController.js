/**
 * NeuroFlowController.js  —  Lumin Flow 2.0 / Project Antigravity
 *
 * TEMPORAL BRIDGE + FLOW STATE GATING + GENE CLAMPING
 * ----------------------------------------------------
 * Bridges the 5-second TRIBE v2 hemodynamic lag to the 50ms game tick
 * using a Kalman AR(2) filter + Catmull-Rom interpolation.
 *
 * Consumes:
 *   - TRIBE v2 φ estimates  via onTribeObservation(phi)
 *   - KernelMapper KLR state via kernelMapper.classify(...)
 *   - TelemetryService jerk / playstyle data
 *
 * Emits:
 *   - φ̂(t): real-time cortical activation estimate [0,1]
 *   - flowBand: 'FLOW' | 'OVER' | 'UNDER'
 *   - Gene clamp coeffs for EnemyDNA.spawnNextGenDNA()
 *   - Sector multiplier modifier for DifficultySystem
 *
 * Technical derivation: lumin_flow_2_research.md  §§3–5
 *
 * ⚠ Pure JS, zero external deps. All matrix ops are 2×2 → O(1) per tick.
 */

class NeuroFlowController {
    constructor() {
        // ============================================================
        // FLOW STATE BOUNDARIES  (Csikszentmihalyi Flow Channel)
        // ============================================================
        this.PHI_UNDER = 0.40;        // φ < 0.40 → boredom/disengagement
        this.PHI_OVER  = 0.80;        // φ > 0.80 → over-stimulation
        this.BETA      = 0.35;        // Neuro-attenuation coefficient

        // ============================================================
        // DIFFICULTY CURVE PARAMETERS
        //   f(L) = BASE_MULT^(L-1)   (§5.1)
        //   Upgraded from 1.35 (original DifficultySystem) to 1.55
        // ============================================================
        this.BASE_MULT = 1.55;

        // ============================================================
        // KALMAN FILTER STATE  (AR(2) model of φ, §4.3 Stage 2)
        // State z = [φ_t, φ_{t-1}]^T
        // ============================================================
        this.a1 = 0.90;               // AR coefficient 1
        this.a2 = -0.10;              // AR coefficient 2
        this.F  = [[this.a1, this.a2], [1.0, 0.0]];   // Transition matrix
        this.H  = [1.0, 0.0];         // Observation row

        // State estimate and covariance (2×1, 2×2)
        this.zHat = [0.5, 0.5];       // [φ, φ_prev]
        this.P    = [[0.1, 0], [0, 0.1]];

        // Noise parameters
        this.Q = [[0.005, 0], [0, 0.005]];   // Process noise
        this.R = 0.05;                        // Observation noise (TRIBE error)

        // ============================================================
        // CATMULL-ROM HISTORY  (CRF §4.3 Stage 3)
        // ============================================================
        this.phiHistory = [0.5, 0.5, 0.5, 0.5];   // Last 4 Kalman extrapolates
        this.currentPhi = 0.5;

        // ============================================================
        // TRIBE OBSERVATION BUFFER
        // Observations arrive ~every 100ms with 5s lag already handled
        // by the Python sidecar's Kalman extrapolation.
        // ============================================================
        this.pendingObservation = null;   // { phi: number, ts: number }
        this.lastObservationTs  = 0;

        // ============================================================
        // AUTO-LABELLING: Feed KernelMapper training samples
        // Label based on φ: φ>0.7→FLOW, φ<0.35→BOREDOM, else→FRUSTRATION
        // ============================================================
        this.LABEL_INTERVAL_MS = 500;   // Label every 500ms
        this.lastLabelTs       = 0;

        // ============================================================
        // OUTPUT STATE
        // ============================================================
        this.flowBand      = 'FLOW';   // 'FLOW' | 'OVER' | 'UNDER'
        this.diffMult      = 1.0;      // Modifier to apply to f(L)
        this.spawnAdjust   = 1.0;      // Multiplier for SpawnBudget
        this.aggroAdjust   = 1.0;      // Multiplier for EnemyDNA aggro gene
        this.mutationGate  = 0.15;     // KLR-gated mutation strength

        // Tick counter for Kalman timing
        this.tickCount = 0;

        console.log('[NeuroFlowController] Initialised – Lumin Flow 2.0');
    }

    // ================================================================
    // PUBLIC API — CALLED BY Game.js EACH TICK (50ms)
    // ================================================================

    /**
     * Main update. Call once per 50ms game tick.
     *
     * @param {number} nowMs     - performance.now()
     * @param {number} sector    - current game sector (1–20)
     */
    update(nowMs, sector) {
        this.tickCount++;

        // --- Kalman predict (every tick) ---
        this._kalmanPredict();

        // --- Kalman update if a TRIBE observation arrived ---
        if (this.pendingObservation !== null) {
            this._kalmanUpdate(this.pendingObservation.phi);
            this.pendingObservation = null;
        }

        // --- Move phi_history forward (keep last 4 for CRF) ---
        const phiNow = this._getKalmanPhi();
        this.phiHistory.push(phiNow);
        if (this.phiHistory.length > 4) this.phiHistory.shift();
        this.currentPhi = phiNow;

        // --- Derive flow band ---
        this.flowBand = this._classifyBand(phiNow);

        // --- Compute difficulty modifiers ---
        this._updateDifficultyModifiers(phiNow, sector);

        // --- Auto-label for KernelMapper training ---
        if (nowMs - this.lastLabelTs > this.LABEL_INTERVAL_MS) {
            this._autoLabel(nowMs, phiNow);
            this.lastLabelTs = nowMs;
        }
    }

    /**
     * Per-frame interpolation. Call in the Three.js render loop.
     *
     * @param {number} tau - normalised position within current tick [0, 1]
     *                       tau = (frameTime % tickDuration) / tickDuration
     * @returns {number} Smooth φ̂(t) for this frame
     */
    interpolate(tau) {
        return this._catmullRom(tau, this.phiHistory);
    }

    /**
     * Receive a TRIBE v2 cortical activation estimate.
     * Called by the WebSocket handler when the Python sidecar emits.
     *
     * @param {number} phi - logistic-normalised ROI activation [0,1]
     */
    onTribeObservation(phi) {
        const clamped = Math.max(0, Math.min(1, phi));
        this.pendingObservation = { phi: clamped, ts: performance.now() };
        this.lastObservationTs  = performance.now();
    }

    // ================================================================
    // GENE CLAMPING API — USED BY EnemyDNA.spawnNextGenDNA()
    // ================================================================

    /**
     * Apply Flow-state gene clamping to freshly generated DNA.
     * Implements §5.3 of the research document.
     *
     * @param {Object} dna    - EnemyDNA gene object {speed, aggro, scale, emissive}
     * @param {number} sector - current sector for f(L) computation
     * @returns {Object} clamped & neuro-modulated dna
     */
    clampDNA(dna, sector) {
        const phi   = this.currentPhi;
        const fL    = this._difficultyMultiplier(sector);
        const fTild = fL * (1 - this.BETA * (1 - phi));  // §5.1 neuro-attenuation

        // Cube-root compression so gene values stay within their ranges
        const compress = Math.pow(fTild, 1/3);

        // Gene clamp with mutation gate from KernelMapper
        const gate  = typeof kernelMapper !== 'undefined'
            ? kernelMapper.getMutationGate()
            : 0.15;

        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        const modulate = (gene, lo, hi) => clamp(gene * compress * (1 + (Math.random()*2-1) * gate), lo, hi);

        return {
            ...dna,
            speed:    modulate(dna.speed,    0.6, 1.8) * this.spawnAdjust,
            aggro:    modulate(dna.aggro,    0.5, 2.5) * this.aggroAdjust,
            scale:    dna.scale,       // Scale not neuro-modulated (visual only)
            emissive: dna.emissive
        };
    }

    /**
     * Returns a difficulty modifier to blend into DifficultySystem.sectorMult().
     * Range: [0.65, 1.00]. Multiply into the DifficultySystem enemy HP / spawn rate.
     */
    getDifficultyModifier() {
        return this.diffMult;
    }

    // ================================================================
    // KALMAN FILTER (2×2, §4.3 Stage 2)
    // ================================================================

    _kalmanPredict() {
        // z_{t|t-1} = F · z_{t-1|t-1}
        const z0 = this.zHat[0], z1 = this.zHat[1];
        this.zHat = [
            this.F[0][0]*z0 + this.F[0][1]*z1,
            this.F[1][0]*z0 + this.F[1][1]*z1
        ];

        // P_{t|t-1} = F·P_{t-1}·F^T + Q  (all 2×2)
        this.P = _mat2Add(_mat2Mul(_mat2Mul(this.F, this.P), _mat2T(this.F)), this.Q);
    }

    _kalmanUpdate(y) {
        // Innovation: ν = y - H·z
        const nu = y - (this.H[0]*this.zHat[0] + this.H[1]*this.zHat[1]);

        // S = H·P·H^T + R  (scalar)
        const S = this.P[0][0] + this.R;

        // Kalman gain: K = P·H^T / S  (2×1)
        const Kg = [this.P[0][0] / S, this.P[1][0] / S];

        // Update state
        this.zHat = [this.zHat[0] + Kg[0]*nu, this.zHat[1] + Kg[1]*nu];

        // Update covariance: P = (I - K·H)·P
        const IP = [
            [1 - Kg[0]*this.H[0], -Kg[0]*this.H[1]],
            [-Kg[1]*this.H[0],    1 - Kg[1]*this.H[1]]
        ];
        this.P = _mat2Mul(IP, this.P);
    }

    _getKalmanPhi() {
        return Math.max(0, Math.min(1, this.zHat[0]));
    }

    // ================================================================
    // CATMULL-ROM CRF INTERPOLATION (§4.3 Stage 3)
    // ================================================================

    /**
     * Four-point Catmull-Rom spline interpolation.
     * Guarantees C¹ continuity between tick knots — no difficulty "pops".
     *
     * @param {number} tau     - [0, 1] fractional tick position
     * @param {number[]} pts   - [p0, p1, p2, p3] knot values
     * @returns {number}
     */
    _catmullRom(tau, pts) {
        const [p0, p1, p2, p3] = pts;
        const t2 = tau * tau;
        const t3 = t2  * tau;
        const v  = 0.5 * (
            (-t3 + 2*t2 - tau)      * p0 +
            ( 3*t3 - 5*t2 + 2)      * p1 +
            (-3*t3 + 4*t2 + tau)    * p2 +
            ( t3 - t2)              * p3
        );
        return Math.max(0, Math.min(1, v));
    }

    // ================================================================
    // FLOW BAND & DIFFICULTY MODIFIERS (§5.1–5.2)
    // ================================================================

    _classifyBand(phi) {
        if (phi > this.PHI_OVER)  return 'OVER';
        if (phi < this.PHI_UNDER) return 'UNDER';
        return 'FLOW';
    }

    /**
     * f(L) = 1.55^(L-1)   (§5.1)
     */
    _difficultyMultiplier(sector) {
        return Math.pow(this.BASE_MULT, Math.max(1, sector) - 1);
    }

    /**
     * Map φ and flow band to difficulty/spawn/aggro adjusters (§5.2).
     */
    _updateDifficultyModifiers(phi, sector) {
        // Base attenuation: reduces multiplier when player is disengaged
        const fL       = this._difficultyMultiplier(sector);
        const fTild    = fL * (1 - this.BETA * (1 - phi));
        this.diffMult  = Math.max(0.65, Math.min(1.0, fTild / fL));

        switch (this.flowBand) {
            case 'OVER':
                // Over-stimulated: ease spawning, keep aggro
                this.spawnAdjust = 0.85;
                this.aggroAdjust = 1.00;
                break;
            case 'UNDER':
                // Under-stimulated: push aggro, keep spawning
                this.spawnAdjust = 1.00;
                this.aggroAdjust = 1.10;
                break;
            default:   // 'FLOW'
                this.spawnAdjust = 1.00;
                this.aggroAdjust = 1.00;
                break;
        }

        // KLR state refines further
        if (typeof kernelMapper !== 'undefined') {
            this.mutationGate = kernelMapper.getMutationGate();
        }
    }

    // ================================================================
    // AUTO-LABELLING FOR KernelMapper
    // ================================================================

    _autoLabel(nowMs, phi) {
        if (typeof telemetryService === 'undefined') return;
        if (typeof kernelMapper    === 'undefined') return;

        const p = telemetryService;
        let label;
        if      (phi > 0.70) label = kernelMapper.FLOW;
        else if (phi < 0.35) label = kernelMapper.BOREDOM;
        else                 label = kernelMapper.FRUSTRATION;

        const pos = p.positionHistory[p.positionHistory.length - 1] || { x: 400, y: 300 };
        const jerk = p.jerkHistory.length > 0
            ? p.jerkHistory[p.jerkHistory.length - 1].j
            : 0;

        kernelMapper.addSample(pos.x, pos.y, jerk, label);
    }

    // ================================================================
    // DEBUG
    // ================================================================

    getDebugInfo() {
        return {
            phi:          this.currentPhi.toFixed(3),
            flowBand:     this.flowBand,
            diffMult:     this.diffMult.toFixed(3),
            spawnAdjust:  this.spawnAdjust.toFixed(2),
            aggroAdjust:  this.aggroAdjust.toFixed(2),
            mutationGate: this.mutationGate.toFixed(3),
            kalmanState:  [this.zHat[0].toFixed(3), this.zHat[1].toFixed(3)],
            kalmanCov:    this.P[0][0].toFixed(4),
            kernel:       typeof kernelMapper !== 'undefined' ? kernelMapper.getDebugInfo() : null
        };
    }

    reset() {
        this.zHat        = [0.5, 0.5];
        this.P           = [[0.1, 0], [0, 0.1]];
        this.phiHistory  = [0.5, 0.5, 0.5, 0.5];
        this.currentPhi  = 0.5;
        this.flowBand    = 'FLOW';
        this.diffMult    = 1.0;
        this.spawnAdjust = 1.0;
        this.aggroAdjust = 1.0;
        this.tickCount   = 0;
        if (typeof kernelMapper !== 'undefined') kernelMapper.reset();
    }
}

// ====================================================================
// 2×2 MATRIX ARITHMETIC HELPERS (global, pure functions)
// ====================================================================

/** Matrix multiply: (2×2) · (2×2) → (2×2) */
function _mat2Mul(A, B) {
    return [
        [A[0][0]*B[0][0] + A[0][1]*B[1][0],  A[0][0]*B[0][1] + A[0][1]*B[1][1]],
        [A[1][0]*B[0][0] + A[1][1]*B[1][0],  A[1][0]*B[0][1] + A[1][1]*B[1][1]]
    ];
}

/** Matrix add: (2×2) + (2×2) → (2×2) */
function _mat2Add(A, B) {
    return [
        [A[0][0]+B[0][0], A[0][1]+B[0][1]],
        [A[1][0]+B[1][0], A[1][1]+B[1][1]]
    ];
}

/** Transpose: (2×2)^T */
function _mat2T(A) {
    return [[A[0][0], A[1][0]], [A[0][1], A[1][1]]];
}

// Global singleton — load AFTER KernelMapper.js, BEFORE Game.js
const neuroFlow = new NeuroFlowController();
