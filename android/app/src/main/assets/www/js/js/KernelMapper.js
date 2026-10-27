/**
 * KernelMapper.js  —  Lumin Flow 2.0 / Project Antigravity
 *
 * GAUSSIAN RBF KERNEL + KERNEL LOGISTIC REGRESSION (KLR)
 * -------------------------------------------------------
 * Maps 3D telemetry vectors  x = [x_pos, y_pos, jerk_mag]
 * into an RKHS via the Gaussian RBF kernel:
 *
 *   k(x, x') = exp( -||x - x'||² / 2σ² )
 *
 * The Gram matrix K[i,j] = k(x_i, x_j) is POSITIVE SEMI-DEFINITE
 * by Bochner's Theorem (proved in lumin_flow_2_research.md §2.2).
 *
 * A lightweight One-vs-Rest KLR is trained offline on labelled
 * telemetry sessions and embedded here as alpha weights.
 *
 * Output: P(FLOW), P(FRUSTRATION), P(BOREDOM)
 * Consumed by: NeuroFlowController.js, EnemyDNA.js (gene Δg gating)
 *
 * ⚠ Pure JS, zero external deps. O(n·d) per tick (n = support vectors).
 */

class KernelMapper {
    constructor() {
        // ============================================================
        // BANDWIDTH: Updated via median heuristic on incoming telemetry.
        // Seed value calibrated to typical Lumin Flow coordinate ranges:
        //   x_pos ≈ [0, 800], y_pos ≈ [0, 600], jerk_mag ≈ [0, 2000]
        // ============================================================
        this.sigma = 300.0;            // RBF bandwidth σ
        this.sigmaUpdated = false;

        // ============================================================
        // KLR SUPPORT VECTORS: Populated by addSupportVector() during
        // the warm-up calibration phase (first 60s of gameplay).
        // Format: { x: [x_pos, y_pos, jerk], label: 0|1|2, alpha: [3] }
        // ============================================================
        this.supportVectors = [];       // Array of {x, alpha}
        this.MAX_SUPPORT = 200;         // Cap memory usage

        // ============================================================
        // TRAINING BUFFER: Accumulate labelled points before fitting
        // ============================================================
        this.trainBuffer  = [];         // { x: [3], label: 0|1|2 }
        this.TRAIN_THRESH = 40;         // Fit after N labelled samples
        this.trained      = false;

        // KLR regularisation (λ in the RKHS norm penalty)
        this.lambda = 1e-3;

        // Class enums
        this.FLOW        = 0;
        this.FRUSTRATION = 1;
        this.BOREDOM     = 2;
        this.CLASS_NAMES = ['FLOW', 'FRUSTRATION', 'BOREDOM'];

        // Last prediction cache
        this.lastProba = [1/3, 1/3, 1/3];
        this.lastState = 'FLOW';
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    /**
     * Classify the current telemetry vector.
     * Called every 50ms game tick by NeuroFlowController.
     *
     * @param {number} xPos        - player world x
     * @param {number} yPos        - player world y
     * @param {number} jerkMag     - jerk magnitude from TelemetryService
     * @returns {{ state: string, flowProb: number, proba: number[] }}
     */
    classify(xPos, yPos, jerkMag) {
        const x = this._normalise(xPos, yPos, jerkMag);

        if (!this.trained || this.supportVectors.length === 0) {
            // Fallback heuristic before enough training data
            return this._heuristicClassify(jerkMag);
        }

        const proba = this._predictProba(x);
        this.lastProba = proba;
        this.lastState = this.CLASS_NAMES[this._argmax(proba)];

        return {
            state:    this.lastState,
            flowProb: proba[this.FLOW],
            proba
        };
    }

    /**
     * Add a labelled telemetry sample to the training buffer.
     * The Director/NeuroFlowController auto-labels samples using the
     * TRIBE φ signal: φ>0.7→FLOW, φ<0.35→BOREDOM, else→FRUSTRATION.
     *
     * @param {number} xPos
     * @param {number} yPos
     * @param {number} jerkMag
     * @param {number} label   - 0=FLOW, 1=FRUSTRATION, 2=BOREDOM
     */
    addSample(xPos, yPos, jerkMag, label) {
        const x = this._normalise(xPos, yPos, jerkMag);
        this.trainBuffer.push({ x, label });

        if (this.trainBuffer.length >= this.TRAIN_THRESH) {
            this._fit();
        }
    }

    /**
     * Force-fit with current buffer (called at wave end or session start).
     */
    forcefit() {
        if (this.trainBuffer.length >= 10) this._fit();
    }

    /**
     * Return gene mutation gate coefficient [0,1].
     * High P(FLOW) → allow full ±20% mutation.
     * Low  P(FLOW) → constrain to ±5% mutation (stability).
     */
    getMutationGate() {
        const pFlow = this.lastProba[this.FLOW];
        // Δg_max = 0.20·P(FLOW) + 0.05·(1-P(FLOW))
        return 0.20 * pFlow + 0.05 * (1 - pFlow);
    }

    // ================================================================
    // KERNEL COMPUTATION
    // ================================================================

    /**
     * k(a, b) = exp( -||a-b||² / 2σ² )
     * PSD by Bochner's Theorem — proved in research doc §2.2.
     *
     * @param {number[]} a - length-3 normalised vector
     * @param {number[]} b - length-3 normalised vector
     * @returns {number}
     */
    kernel(a, b) {
        const dSq = (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
        return Math.exp(-dSq / (2 * this.sigma * this.sigma));
    }

    // ================================================================
    // PRIVATE — TRAINING
    // ================================================================

    /**
     * Lightweight KLR fit using the accumulated training buffer.
     * One-vs-Rest: for each class c, solve the regularised dual:
     *   α̂_c = (K + λn·I)^{-1} y_c   (ridge approximation)
     *
     * We use Gauss elimination (exact for n ≤ 200).
     */
    _fit() {
        const data  = this.trainBuffer.slice(-this.MAX_SUPPORT);
        const n     = data.length;
        const xs    = data.map(d => d.x);
        const lam   = this.lambda * n;

        // Build Gram matrix K (n×n)
        const K = this._gramMatrix(xs);

        // Add regularisation: K_reg = K + λn·I
        for (let i = 0; i < n; i++) K[i][i] += lam;

        // Fit one binary classifier per class
        const alphas = [0, 1, 2].map(c => {
            const yBin = data.map(d => d.label === c ? 1.0 : -1.0);
            return this._solveLinear(K, yBin, n);
        });

        // Update sigma (median heuristic on support vectors)
        this.sigma = this._medianSigma(xs) || this.sigma;

        // Store support vectors with their alpha triplet
        this.supportVectors = xs.map((x, i) => ({
            x,
            alpha: [alphas[0][i], alphas[1][i], alphas[2][i]]
        }));

        this.trained = true;
        this.trainBuffer = [];   // Clear for next segment

        console.log(`[KernelMapper] Fitted KLR on ${n} samples, σ=${this.sigma.toFixed(1)}`);
    }

    /**
     * Predict softmax probabilities for a new point.
     * f_c(x) = Σ_i α_{c,i} · k(x_i, x)
     */
    _predictProba(x) {
        const scores = [0, 0, 0];
        for (const sv of this.supportVectors) {
            const kv = this.kernel(sv.x, x);
            scores[0] += sv.alpha[0] * kv;
            scores[1] += sv.alpha[1] * kv;
            scores[2] += sv.alpha[2] * kv;
        }
        return this._softmax(scores);
    }

    // ================================================================
    // PRIVATE — LINEAR ALGEBRA (in-place Gaussian elimination)
    // ================================================================

    _gramMatrix(xs) {
        const n = xs.length;
        const K = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            K[i][i] = 1.0;            // k(x,x) = 1 always for RBF
            for (let j = i + 1; j < n; j++) {
                const v = this.kernel(xs[i], xs[j]);
                K[i][j] = v;
                K[j][i] = v;
            }
        }
        return K;
    }

    /**
     * Solve A·α = b using Gaussian elimination with partial pivoting.
     * O(n³) — runs once at fit time, not per frame.
     */
    _solveLinear(A, b, n) {
        // Augmented matrix [A | b]
        const M = A.map((row, i) => [...row, b[i]]);

        for (let col = 0; col < n; col++) {
            // Partial pivot
            let maxRow = col;
            for (let r = col + 1; r < n; r++) {
                if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
            }
            [M[col], M[maxRow]] = [M[maxRow], M[col]];

            const pivot = M[col][col];
            if (Math.abs(pivot) < 1e-12) continue;

            for (let r = 0; r < n; r++) {
                if (r === col) continue;
                const factor = M[r][col] / pivot;
                for (let c = col; c <= n; c++) {
                    M[r][c] -= factor * M[col][c];
                }
            }
        }

        return M.map((row, i) => (Math.abs(M[i][i]) > 1e-12 ? row[n] / M[i][i] : 0));
    }

    // ================================================================
    // PRIVATE — UTILITIES
    // ================================================================

    /**
     * Normalise raw inputs to roughly unit-variance.
     * Ranges calibrated to Lumin Flow gameplay telemetry.
     */
    _normalise(xPos, yPos, jerkMag) {
        return [
            xPos    / 800.0,    // world width ≈ 800
            yPos    / 600.0,    // world height ≈ 600
            jerkMag / 1000.0    // jerk 0–2000 → 0–2
        ];
    }

    /**
     * Median heuristic: σ² = median( {||x_i - x_j||²}_{i<j} )
     */
    _medianSigma(xs) {
        const dists = [];
        for (let i = 0; i < xs.length; i++) {
            for (let j = i + 1; j < xs.length; j++) {
                const a = xs[i], b = xs[j];
                dists.push((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
            }
        }
        if (dists.length === 0) return null;
        dists.sort((a, b) => a - b);
        const med = dists[Math.floor(dists.length / 2)];
        return Math.sqrt(Math.max(med, 0.01));
    }

    _softmax(scores) {
        const maxS = Math.max(...scores);
        const exp  = scores.map(s => Math.exp(s - maxS));
        const sum  = exp.reduce((a, b) => a + b, 0);
        return exp.map(e => e / sum);
    }

    _argmax(arr) {
        return arr.indexOf(Math.max(...arr));
    }

    /**
     * Pre-training heuristic: use jerk magnitude + EWM from TelemetryService
     * to approximate state before KLR is fitted.
     */
    _heuristicClassify(jerkMag) {
        if (typeof telemetryService === 'undefined') {
            return { state: 'FLOW', flowProb: 0.5, proba: [0.5, 0.25, 0.25] };
        }
        const js = telemetryService.jerkScore;
        let proba;
        if (js >= 40 && js <= 75) {
            proba = [0.65, 0.20, 0.15];          // In the flow band
        } else if (js > 75) {
            proba = [0.20, 0.65, 0.15];          // High jerk → frustration
        } else {
            proba = [0.20, 0.15, 0.65];          // Low jerk → boredom
        }
        return {
            state:    this.CLASS_NAMES[this._argmax(proba)],
            flowProb: proba[this.FLOW],
            proba
        };
    }

    // ================================================================
    // RESET
    // ================================================================
    reset() {
        this.supportVectors = [];
        this.trainBuffer    = [];
        this.trained        = false;
        this.lastProba      = [1/3, 1/3, 1/3];
        this.lastState      = 'FLOW';
    }

    // ================================================================
    // DEBUG
    // ================================================================
    getDebugInfo() {
        return {
            trained:         this.trained,
            sigma:           this.sigma.toFixed(2),
            supportCount:    this.supportVectors.length,
            trainBufferSize: this.trainBuffer.length,
            lastState:       this.lastState,
            flowProb:        this.lastProba[this.FLOW].toFixed(3),
            mutationGate:    this.getMutationGate().toFixed(3)
        };
    }
}

// Global singleton — load BEFORE NeuroFlowController.js
const kernelMapper = new KernelMapper();
