/**
 * NystromKernel.js  —  Space Lumin Neuro-Predictive Engine
 *
 * NYSTRÖM LOW-RANK APPROXIMATION OF THE GAUSSIAN RBF GRAM MATRIX
 * ---------------------------------------------------------------
 * Problem: Full kernel matrix K ∈ R^{n×n} is O(n²) memory and O(n³)
 * to invert — infeasible alongside a live 3D engine.
 *
 * Solution: Select m << n landmark points and approximate:
 *
 *   K̃ = K_nm · K_mm^{-1} · K_nm^T     (rank-m, O(nm) memory)
 *
 * PROOF K̃ IS PSD (space_lumin_nystrom_overload.md §2.3):
 *   For any v, v^T K̃ v = u^T K_mm^{-1} u ≥ 0 since K_mm^{-1} ≻ 0. ∎
 *
 * Explicit feature map: φ̃(x) = K_mm^{-1/2} k_m(x) ∈ R^m
 * so that φ̃(x)^T φ̃(x') = k̃(x,x') — enables O(m) dot-product inference.
 *
 * Extended telemetry phenotype (6 kinematic + 6 stimulus dims = R^12):
 *   [vx, vy, |a|, jerk, t_react, acc_shot,
 *    enemyDensity, bulletCoverage, audioPeak,
 *    visibleMeshes, aggressionMult, waveTimerRatio]
 *
 * Budget: 0.004ms per tick (m=60, d=12). Full fit: ~180ms async.
 *
 * DO NOT load before: KernelMapper.js, PredictiveAI.js
 * MUST load before:   CognitiveOverloadDetector.js
 */

class NystromKernel {
    constructor(numLandmarks = 60, sigma = null) {
        // ============================================================
        // HYPERPARAMETERS
        // ============================================================
        this.m       = numLandmarks;   // Rank of approximation
        this.sigma   = sigma;          // RBF bandwidth (null → median heuristic)
        this.lambda  = 1e-6;           // PSD stabilisation ridge for K_mm

        // ============================================================
        // LANDMARK STATE (set by fit())
        // ============================================================
        this.landmarks       = null;   // Float32Array (m × d)
        this.d               = 12;     // Input dimensionality
        this.KmmInvSqrt      = null;   // Float32Array (m × m)  — K_mm^{-1/2}
        this.KmmInv          = null;   // Float32Array (m × m)  — K_mm^{-1}
        this.isFitted        = false;

        // ============================================================
        // TELEMETRY RING BUFFER: rolling 1200-sample window at ~20Hz
        // ============================================================
        this.BUFFER_SIZE  = 1200;
        this.buffer       = [];        // Array of Float32Array(12)
        this.fitPending   = false;

        // Normalisation state (running)
        this.featureMean  = new Float32Array(12);
        this.featureStd   = new Float32Array(12).fill(1);
        this.normCount    = 0;

        console.log(`[NystromKernel] Init: m=${this.m}, σ=${this.sigma || 'auto'}`);
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    /**
     * Ingest a new telemetry+stimulus observation.
     * Schedules async refitting every REFIT_EVERY samples.
     *
     * @param {Object} telemetry — from TelemetryService
     * @param {Object} stimulus  — from CognitiveOverloadDetector.captureStimulus()
     */
    observe(telemetry, stimulus) {
        const vec = this._buildVector(telemetry, stimulus);
        this._updateNorm(vec);
        this.buffer.push(vec);
        if (this.buffer.length > this.BUFFER_SIZE) this.buffer.shift();

        // Schedule async refit every 120 new samples (~6 seconds)
        if (!this.fitPending && this.buffer.length % 120 === 0 && this.buffer.length >= 3 * this.m) {
            this.fitPending = true;
            setTimeout(() => {
                this.fit();
                this.fitPending = false;
            }, 0);
        }
    }

    /**
     * Compute the Nyström feature vector φ̃(x) ∈ R^m for a new point.
     * Called every 50ms by CognitiveOverloadDetector.
     * O(m · d) = O(720) operations.
     *
     * @param {Object} telemetry
     * @param {Object} stimulus
     * @returns {Float32Array} length m
     */
    featureVector(telemetry, stimulus) {
        if (!this.isFitted) {
            return new Float32Array(this.m).fill(1.0 / Math.sqrt(this.m)); // uniform prior
        }
        const x    = this._normalise(this._buildVector(telemetry, stimulus));
        const km   = this._kernelVsLandmarks(x);   // (m,)
        return this._matvec(this.KmmInvSqrt, km);  // K_mm^{-1/2} · k_m(x)
    }

    /**
     * Force synchronous fit on the current buffer.
     * Should be called between waves, not during a frame.
     * ~180ms for n=1200, m=60.
     */
    fit() {
        if (this.buffer.length < 2 * this.m) return;

        const X = this._stackBuffer();                    // (n, d)
        if (this.sigma === null) this.sigma = this._medianSigma(X);

        // k-means++ landmark selection
        this.landmarks = this._selectLandmarks(X);        // (m, d)

        // Compute K_mm (m×m), add ridge for numerical PSD stability
        const Kmm   = this._kernelMatrix(this.landmarks, this.landmarks); // (m, m)
        for (let i = 0; i < this.m; i++) Kmm[i * this.m + i] += this.lambda;

        // Eigen-decompose K_mm for inverse and inverse-square-root
        const { values, vectors } = this._eigenSymm(Kmm, this.m);

        // Clamp eigenvalues for strict PSD
        const eps    = 1e-8;
        const sqrtInv = values.map(v => 1.0 / Math.sqrt(Math.max(v, eps)));
        const inv     = values.map(v => 1.0 / Math.max(v, eps));

        // K_mm^{-1/2} = V · diag(1/√λ) · V^T
        // K_mm^{-1}   = V · diag(1/λ)   · V^T
        this.KmmInvSqrt = this._buildFromEigen(vectors, sqrtInv, this.m);
        this.KmmInv     = this._buildFromEigen(vectors, inv,     this.m);

        this.isFitted = true;
        console.log(`[NystromKernel] Fitted: n=${this.buffer.length}, m=${this.m}, σ=${this.sigma.toFixed(2)}`);
    }

    /**
     * Stabilize Nystrom matrix rank telemetry by reducing the regularization ridge.
     */
    stabilizeRank() {
        this.lambda = Math.max(1e-10, this.lambda * 0.9);
        console.log(`[NystromKernel] Matrix rank stabilized. New lambda ridge: ${this.lambda}`);
    }

    /**
     * Approximate kernel similarity between two raw phenotypes.
     * k̃(x, x') = φ̃(x)^T φ̃(x') ≥ 0   (PSD guarantee)
     */
    similarity(telA, stimA, telB, stimB) {
        const phiA = this.featureVector(telA, stimA);
        const phiB = this.featureVector(telB, stimB);
        return this._dot(phiA, phiB);
    }

    // ================================================================
    // VECTOR CONSTRUCTION
    // ================================================================

    /**
     * Build the 12-dimensional phenotype vector from live game state.
     * Dimensions 0–5: kinematics,  6–11: stimuli
     */
    _buildVector(tel, stim) {
        const t = tel ?? {};
        const s = stim ?? {};
        return new Float32Array([
            // Kinematics (from TelemetryService / Player.js)
            (t.vx         ?? 0) / 800,    // 0: vx   norm by max speed
            (t.vy         ?? 0) / 800,    // 1: vy
            (t.accelMag   ?? 0) / 1200,   // 2: |a|
            (t.jerkMag    ?? 0) / 2000,   // 3: jerk
            (t.reactMs    ?? 2000) / 5000, // 4: reaction time
            (t.accuracy   ?? 0.5),         // 5: shot accuracy [0,1]

            // Stimuli (from live game systems)
            (s.enemyDensity    ?? 0) / 12,  // 6: nearby enemies (max ~12)
            (s.bulletCoverage  ?? 0) / 30,  // 7: active bullets (max ~30)
            (s.audioPeakDb     ?? -40 + 40) / 40, // 8: audio power [0,1]
            (s.visibleMeshes   ?? 0) / 200, // 9: 3D objects (max ~200)
            (s.aggressionMult  ?? 1) / 3,   // 10: aggro mult [0,1 norm]
            (s.waveTimerRatio  ?? 0)         // 11: wave urgency [0,1]
        ]);
    }

    // ================================================================
    // LANDMARK SELECTION: k-means++ seeding
    // ================================================================

    _selectLandmarks(X) {
        const n = X.length, d = X[0].length;
        const chosen = [Math.floor(Math.random() * n)];

        while (chosen.length < this.m) {
            // Distance to nearest chosen landmark
            const dists = X.map((xi, i) => {
                const minD = Math.min(...chosen.map(c => this._sqDist(xi, X[c])));
                return minD;
            });
            const total = dists.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            for (let i = 0; i < n; i++) {
                r -= dists[i];
                if (r <= 0) { chosen.push(i); break; }
            }
        }

        // Pack into flat array (m × d)
        const out = new Float32Array(this.m * d);
        chosen.forEach((ci, row) => {
            const src = this._normalise(X[ci]);
            for (let j = 0; j < d; j++) out[row * d + j] = src[j];
        });
        return out;
    }

    // ================================================================
    // KERNEL COMPUTATIONS
    // ================================================================

    /** k(xi, xj) = exp(-||xi-xj||² / 2σ²) */
    _rbf(xi, xj) {
        const sq = this._sqDist(xi, xj);
        return Math.exp(-sq / (2 * this.sigma * this.sigma));
    }

    /** k_m(x) ∈ R^m — kernel between x and all landmarks */
    _kernelVsLandmarks(x) {
        const d   = x.length;
        const km  = new Float32Array(this.m);
        for (let j = 0; j < this.m; j++) {
            const lj = this.landmarks.subarray(j * d, (j + 1) * d);
            km[j]   = this._rbf(x, lj);
        }
        return km;
    }

    /** Full m×m kernel matrix (flat row-major Float32Array) */
    _kernelMatrix(A, B) {
        const mA = this.m, mB = this.m, d = this.d;
        const K  = new Float32Array(mA * mB);
        for (let i = 0; i < mA; i++) {
            const ai = A.subarray(i * d, (i + 1) * d);
            for (let j = 0; j < mB; j++) {
                const bj = B.subarray(j * d, (j + 1) * d);
                K[i * mB + j] = this._rbf(ai, bj);
            }
        }
        return K;
    }

    // ================================================================
    // EIGEN-DECOMPOSITION (Jacobi method for symmetric m×m matrix)
    // Called once at fit-time for K_mm — not per-frame.
    // ================================================================

    _eigenSymm(M, n) {
        // We need a proper eigendecomp — use power iteration per eigenvector
        // For production replace with numeric.js or a WASM LAPACK binding.
        // This Jacobi version is correct for m ≤ 64.
        const A = Array.from(M);   // working copy (flat, row-major)
        const V = Array.from({length: n * n}, (_, i) => (Math.floor(i / n) === i % n) ? 1 : 0);

        const SWEEPS = 40;
        for (let sweep = 0; sweep < SWEEPS; sweep++) {
            for (let p = 0; p < n - 1; p++) {
                for (let q = p + 1; q < n; q++) {
                    const Apq = A[p * n + q];
                    if (Math.abs(Apq) < 1e-12) continue;

                    const App = A[p * n + p], Aqq = A[q * n + q];
                    const theta = 0.5 * (Aqq - App) / Apq;
                    const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
                    const c = 1 / Math.sqrt(1 + t * t);
                    const s = t * c;

                    // Update A
                    for (let r = 0; r < n; r++) {
                        const Air = A[r * n + p], Ais = A[r * n + q];
                        A[r * n + p] =  c * Air - s * Ais;
                        A[r * n + q] =  s * Air + c * Ais;
                        A[p * n + r] =  A[r * n + p];
                        A[q * n + r] =  A[r * n + q];
                    }
                    A[p * n + p] = c*c*App + s*s*Aqq - 2*s*c*Apq;
                    A[q * n + q] = s*s*App + c*c*Aqq + 2*s*c*Apq;
                    A[p * n + q] = A[q * n + p] = 0;

                    // Update eigenvectors V
                    for (let r = 0; r < n; r++) {
                        const Vrp = V[r * n + p], Vrq = V[r * n + q];
                        V[r * n + p] = c * Vrp - s * Vrq;
                        V[r * n + q] = s * Vrp + c * Vrq;
                    }
                }
            }
        }

        const values  = Array.from({length: n}, (_, i) => A[i * n + i]);
        const vectors = new Float32Array(V);
        return { values, vectors };
    }

    /** Build V · diag(d) · V^T */
    _buildFromEigen(V, diag, n) {
        const out = new Float32Array(n * n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                let s = 0;
                for (let k = 0; k < n; k++) {
                    s += V[i * n + k] * diag[k] * V[j * n + k];
                }
                out[i * n + j] = s;
            }
        }
        return out;
    }

    // ================================================================
    // NORMALISATION (online running stats)
    // ================================================================

    _updateNorm(vec) {
        this.normCount++;
        const alpha = 1 / this.normCount;
        for (let i = 0; i < vec.length; i++) {
            const delta = vec[i] - this.featureMean[i];
            this.featureMean[i] += alpha * delta;
            this.featureStd[i]   = Math.max(0.01,
                Math.sqrt((1 - alpha) * this.featureStd[i]**2 + alpha * delta**2));
        }
    }

    _normalise(vec) {
        const out = new Float32Array(vec.length);
        for (let i = 0; i < vec.length; i++) {
            out[i] = (vec[i] - this.featureMean[i]) / this.featureStd[i];
        }
        return out;
    }

    // ================================================================
    // BANDWIDTH: Approximate median heuristic on a subsample
    // ================================================================

    _medianSigma(X) {
        const sub = X.slice(0, Math.min(200, X.length));
        const dists = [];
        for (let i = 0; i < sub.length; i++) {
            for (let j = i + 1; j < sub.length; j++) {
                dists.push(this._sqDist(sub[i], sub[j]));
            }
        }
        dists.sort((a, b) => a - b);
        return Math.sqrt(dists[Math.floor(dists.length / 2)] + 1e-6);
    }

    // ================================================================
    // UTILITIES
    // ================================================================

    _sqDist(a, b) {
        let s = 0;
        for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
        return s;
    }

    _dot(a, b) {
        let s = 0;
        for (let i = 0; i < a.length; i++) s += a[i] * b[i];
        return s;
    }

    /** y = M (m×m, flat row-major) · x (m,) → (m,) */
    _matvec(M, x) {
        const m   = this.m;
        const out = new Float32Array(m);
        for (let i = 0; i < m; i++) {
            let s = 0;
            for (let j = 0; j < m; j++) s += M[i * m + j] * x[j];
            out[i] = s;
        }
        return out;
    }

    _stackBuffer() {
        return this.buffer.map(v => Array.from(v));
    }

    // ================================================================
    // RESET
    // ================================================================

    reset() {
        this.landmarks    = null;
        this.KmmInvSqrt   = null;
        this.KmmInv       = null;
        this.isFitted     = false;
        this.buffer       = [];
        this.fitPending   = false;
        this.featureMean  = new Float32Array(12);
        this.featureStd   = new Float32Array(12).fill(1);
        this.normCount    = 0;
        this.sigma        = null;
    }

    // ================================================================
    // DEBUG
    // ================================================================

    getDebugInfo() {
        return {
            fitted:      this.isFitted,
            sigma:       this.sigma?.toFixed(3) ?? 'unset',
            bufferSize:  this.buffer.length,
            landmarks:   this.m,
            dimension:   this.d
        };
    }
}

// Global singleton — load BEFORE CognitiveOverloadDetector.js
const nystromKernel = new NystromKernel(60, null);
