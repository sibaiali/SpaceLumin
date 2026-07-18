/**
 * TelemetryService.js - Player Analytics & Neural Metrics
 * Tracks jerkiness (3rd derivative of position) and Missed Shot Entropy
 * Provides normalized scores for EnemyDNA adaptation
 */

class TelemetryService {
    constructor() {
        // ========================================
        // POSITION DERIVATIVES (for Jerkiness)
        // ========================================
        this.positionHistory = [];     // {x, y, t} samples
        this.velocityHistory = [];     // 1st derivative
        this.accelerationHistory = []; // 2nd derivative
        this.jerkHistory = [];         // 3rd derivative (target metric)

        // Sample buffer sizes
        this.MAX_SAMPLES = 60;         // ~1 second at 60fps
        this.MIN_SAMPLES_FOR_JERK = 4; // Need 4 positions for 3rd derivative

        // ========================================
        // MISSED SHOT ENTROPY
        // ========================================
        this.shotOutcomes = [];        // Array of {hit: boolean, time: number}
        this.MAX_SHOT_HISTORY = 100;
        this.entropyWindow = 20;       // Calculate entropy over last N shots

        // ========================================
        // COMPUTED METRICS (normalized 0-100)
        // ========================================
        this.jerkScore = 50;           // How "chaotic" the player moves
        this.entropyScore = 50;        // How "random" their shooting is
        this.chaosFactor = 1.0;        // Combined chaos multiplier for DNA

        // Update interval
        this.lastMetricUpdate = 0;
        this.updateInterval = 0.5;     // Recalculate every 0.5s

        // Thresholds for player classification
        this.CHAOTIC_THRESHOLD = 65;   // Above this = chaotic playstyle
        this.PRECISE_THRESHOLD = 35;   // Below this = precise playstyle
    }

    // ========================================
    // POSITION TRACKING: Call every frame
    // ========================================
    recordPosition(x, y, time, hp, maxHP, nearbyEnemies) {
        this.positionHistory.push({ x, y, t: time });

        // Maintain buffer size
        if (this.positionHistory.length > this.MAX_SAMPLES) {
            this.positionHistory.shift();
        }

        // Calculate derivatives when we have enough samples
        if (this.positionHistory.length >= this.MIN_SAMPLES_FOR_JERK) {
            this.calculateDerivatives();
        }

        // Feed PredictiveAI with current game state
        if (typeof predictiveAI !== 'undefined') {
            predictiveAI.recordEvent('position', {
                hp: hp ?? 100,
                maxHP: maxHP ?? 100,
                nearbyEnemies: nearbyEnemies ?? 0,
                jerk: this.jerkHistory.length > 0
                    ? this.jerkHistory[this.jerkHistory.length - 1].j
                    : 0
            });
        }
    }

    // ========================================
    // DERIVATIVE CHAIN: Position → Velocity → Acceleration → Jerk
    // ========================================
    calculateDerivatives() {
        const pos = this.positionHistory;
        const n = pos.length;

        // Calculate velocity (1st derivative)
        if (n >= 2) {
            const p1 = pos[n - 1];
            const p0 = pos[n - 2];
            const dt = p1.t - p0.t || 0.016;

            const vx = (p1.x - p0.x) / dt;
            const vy = (p1.y - p0.y) / dt;

            this.velocityHistory.push({ vx, vy, t: p1.t });
            if (this.velocityHistory.length > this.MAX_SAMPLES) {
                this.velocityHistory.shift();
            }
        }

        // Calculate acceleration (2nd derivative)
        const vel = this.velocityHistory;
        if (vel.length >= 2) {
            const v1 = vel[vel.length - 1];
            const v0 = vel[vel.length - 2];
            const dt = v1.t - v0.t || 0.016;

            const ax = (v1.vx - v0.vx) / dt;
            const ay = (v1.vy - v0.vy) / dt;

            this.accelerationHistory.push({ ax, ay, t: v1.t });
            if (this.accelerationHistory.length > this.MAX_SAMPLES) {
                this.accelerationHistory.shift();
            }
        }

        // Calculate jerk (3rd derivative) - THE KEY METRIC
        const acc = this.accelerationHistory;
        if (acc.length >= 2) {
            const a1 = acc[acc.length - 1];
            const a0 = acc[acc.length - 2];
            const dt = a1.t - a0.t || 0.016;

            const jx = (a1.ax - a0.ax) / dt;
            const jy = (a1.ay - a0.ay) / dt;
            const jerkMagnitude = Math.hypot(jx, jy);

            this.jerkHistory.push({ j: jerkMagnitude, t: a1.t });
            if (this.jerkHistory.length > this.MAX_SAMPLES) {
                this.jerkHistory.shift();
            }
        }
    }

    // ========================================
    // SHOT TRACKING: Call on every shot fired
    // ========================================
    recordShot(hit, time) {
        this.shotOutcomes.push({ hit, t: time });

        if (this.shotOutcomes.length > this.MAX_SHOT_HISTORY) {
            this.shotOutcomes.shift();
        }

        // Forward shot result to PredictiveAI
        if (typeof predictiveAI !== 'undefined') {
            predictiveAI.recordEvent('shot', { hit });
        }
    }

    // ========================================
    // ENTROPY CALCULATION: Shannon entropy of hit/miss pattern
    // High entropy = random shooting, Low entropy = predictable/skilled
    // ========================================
    calculateShotEntropy() {
        if (this.shotOutcomes.length < 5) return 50; // Default until enough data

        // Get recent window
        const recent = this.shotOutcomes.slice(-this.entropyWindow);
        const hits = recent.filter(s => s.hit).length;
        const misses = recent.length - hits;

        // Calculate probabilities
        const pHit = hits / recent.length;
        const pMiss = misses / recent.length;

        // Shannon entropy: -Σ p(x) * log2(p(x))
        let entropy = 0;
        if (pHit > 0) entropy -= pHit * Math.log2(pHit);
        if (pMiss > 0) entropy -= pMiss * Math.log2(pMiss);

        // Normalize to 0-100 (max entropy for binary is 1.0)
        return Math.round(entropy * 100);
    }

    // ========================================
    // JERK SCORE: Normalized chaotic movement metric
    // ========================================
    calculateJerkScore() {
        if (this.jerkHistory.length < 10) return 50; // Default

        // Calculate mean and variance of jerk magnitudes
        const jerks = this.jerkHistory.map(j => j.j);
        const mean = jerks.reduce((a, b) => a + b, 0) / jerks.length;
        const variance = jerks.reduce((a, j) => a + Math.pow(j - mean, 2), 0) / jerks.length;
        const stdDev = Math.sqrt(variance);

        // Normalize: High variance = chaotic
        // Calibrated for typical gameplay (jerk variance 0-10000)
        const normalizedVariance = Math.min(100, (stdDev / 50) * 100);

        return Math.round(normalizedVariance);
    }

    // ========================================
    // UPDATE METRICS: Call periodically (not every frame)
    // ========================================
    update(time) {
        if (time - this.lastMetricUpdate < this.updateInterval) return;
        this.lastMetricUpdate = time;

        // Recalculate scores
        this.jerkScore = this.calculateJerkScore();
        this.entropyScore = this.calculateShotEntropy();

        // Combined chaos factor for DNA mutation
        // Weight jerk more heavily (movement is more indicative of skill)
        this.chaosFactor = 0.7 * (this.jerkScore / 50) + 0.3 * (this.entropyScore / 50);

        // Clamp to reasonable range
        this.chaosFactor = Math.max(0.5, Math.min(2.0, this.chaosFactor));
    }

    // ========================================
    // PLAYER CLASSIFICATION
    // ========================================
    isChaotic() {
        return this.jerkScore > this.CHAOTIC_THRESHOLD;
    }

    isPrecise() {
        return this.jerkScore < this.PRECISE_THRESHOLD && this.entropyScore < this.PRECISE_THRESHOLD;
    }

    getPlaystyle() {
        if (this.isChaotic()) return 'Chaotic';
        if (this.isPrecise()) return 'Precise';
        return 'Balanced';
    }

    // ========================================
    // PREDICTIVE AI PROXY
    // ========================================
    getPrediction() {
        if (typeof predictiveAI !== 'undefined') {
            return predictiveAI.predict();
        }
        return { collisionRisk: 0, missedBurstRisk: 0, panicRisk: 0 };
    }

    // ========================================
    // DEBUG OUTPUT
    // ========================================
    getMetrics() {
        return {
            jerkScore: this.jerkScore,
            entropyScore: this.entropyScore,
            chaosFactor: this.chaosFactor.toFixed(2),
            playstyle: this.getPlaystyle(),
            prediction: this.getPrediction(),
            samples: {
                positions: this.positionHistory.length,
                shots: this.shotOutcomes.length,
                jerks: this.jerkHistory.length
            }
        };
    }

    // ========================================
    // RESET: For new run
    // ========================================
    reset() {
        this.positionHistory = [];
        this.velocityHistory = [];
        this.accelerationHistory = [];
        this.jerkHistory = [];
        this.shotOutcomes = [];
        this.jerkScore = 50;
        this.entropyScore = 50;
        this.chaosFactor = 1.0;
    }

    getLatestVectors() {
        const v = this.velocityHistory.length > 0 ? this.velocityHistory[this.velocityHistory.length - 1] : { vx: 0, vy: 0 };
        const a = this.accelerationHistory.length > 0 ? this.accelerationHistory[this.accelerationHistory.length - 1] : { ax: 0, ay: 0 };
        return {
            vx: v.vx,
            vy: v.vy,
            ax: a.ax,
            ay: a.ay
        };
    }
}

// Global singleton
const telemetryService = new TelemetryService();
