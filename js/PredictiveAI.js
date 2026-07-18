/**
 * PredictiveAI.js - Markov Chain Mistake Predictor
 *
 * Observes the player's behavioral state every frame and builds a
 * transition probability table.  Given the current state it forecasts
 * the player's NEXT state and emits three risk signals (0-1):
 *
 *   collisionRisk  — player is heading into a dense enemy cluster
 *   missedBurstRisk — a spray-fire / missed-shot burst is coming
 *   panicRisk       — a panic-dodge (jerk spike) is imminent
 *
 * These signals are consumed by Director.js (pre-emptive difficulty)
 * and EnemyDNA.js (next-spawn gene hints).
 *
 * No external libraries — pure lightweight math.
 */

class PredictiveAI {
    constructor() {
        // ============================================================
        // STATE ENCODING
        // Each game tick is mapped to a discrete integer state:
        //   [hpBracket (0-3)] [zoneRisk (0-2)] [jerkLevel (0-2)]
        //   Total states = 4 * 3 * 3 = 36
        // ============================================================
        this.HP_BRACKETS = 4;   // 0-25%, 26-50%, 51-75%, 76-100%
        this.ZONE_LEVELS = 3;   // safe / moderate / dense-cluster
        this.JERK_LEVELS = 3;   // calm / active / panic
        this.TOTAL_STATES = this.HP_BRACKETS * this.ZONE_LEVELS * this.JERK_LEVELS; // 36

        // Markov transition counts [fromState][toState]
        this.transitions = this._makeMatrix(this.TOTAL_STATES);

        // Last observed state
        this.lastState = -1;

        // ============================================================
        // RAW INPUTS (updated each frame via recordEvent)
        // ============================================================
        this.playerHP = 100;
        this.playerMaxHP = 100;
        this.nearbyEnemies = 0;    // count of enemies within 200px
        this.jerkMagnitude = 0;    // latest jerk from TelemetryService
        this.recentMisses = 0;    // rolling 5-shot miss count

        // Rolling miss window
        this.shotWindow = [];
        this.SHOT_WINDOW = 5;

        // ============================================================
        // SMOOTHED PREDICTIONS (EWM, alpha = 0.3)
        // ============================================================
        this.collisionRisk = 0;
        this.missedBurstRisk = 0;
        this.panicRisk = 0;
        this.EWM_ALPHA = 0.3;

        // Calibration constants (tuned to typical gameplay values)
        this.JERK_CALM_THRESH = 200;   // below = calm
        this.JERK_PANIC_THRESH = 800;   // above = panic
        this.ENEMY_SAFE_THRESH = 2;     // ≤ this = safe zone
        this.ENEMY_DENSE_THRESH = 6;     // ≥ this = dense cluster

        // Minimum samples before we start predicting
        this.MIN_TRANSITIONS = 20;
        this.totalTransitions = 0;
    }

    // ==============================================================
    // PUBLIC API — called from TelemetryService each frame/shot
    // ==============================================================

    /**
     * Record a game event.  'type' is one of:
     *   'position'  — data: { hp, maxHP, nearbyEnemies, jerk }
     *   'shot'      — data: { hit: boolean }
     */
    recordEvent(type, data) {
        if (type === 'position') {
            this.playerHP = data.hp ?? this.playerHP;
            this.playerMaxHP = data.maxHP ?? this.playerMaxHP;
            this.nearbyEnemies = data.nearbyEnemies ?? this.nearbyEnemies;
            this.jerkMagnitude = data.jerk ?? this.jerkMagnitude;

            const currentState = this._encodeState();
            if (this.lastState !== -1 && currentState !== -1) {
                this.transitions[this.lastState][currentState]++;
                this.totalTransitions++;
            }
            this.lastState = currentState;

        } else if (type === 'shot') {
            this.shotWindow.push(data.hit ? 0 : 1); // 1 = miss
            if (this.shotWindow.length > this.SHOT_WINDOW) {
                this.shotWindow.shift();
            }
            this.recentMisses = this.shotWindow.reduce((a, b) => a + b, 0);
        }
    }

    /**
     * Compute and return risk predictions.
     * Call once per second or on demand.
     * Returns: { collisionRisk, missedBurstRisk, panicRisk }
     */
    predict() {
        if (this.totalTransitions < this.MIN_TRANSITIONS) {
            // Not enough data yet — return neutral
            return { collisionRisk: 0, missedBurstRisk: 0, panicRisk: 0 };
        }

        const currentState = this._encodeState();
        if (currentState === -1) {
            return { collisionRisk: 0, missedBurstRisk: 0, panicRisk: 0 };
        }

        // Get probability distribution over next states
        const row = this.transitions[currentState];
        const total = row.reduce((a, b) => a + b, 0);
        if (total === 0) {
            return { collisionRisk: 0, missedBurstRisk: 0, panicRisk: 0 };
        }

        // Sum probabilities that lead to dangerous next states
        let rawCollision = 0;   // next state has zone = dense (2)
        let rawMissed = 0;   // current miss rate high AND jerk dropping (focusing)
        let rawPanic = 0;   // next state has jerk = panic (2)

        for (let s = 0; s < this.TOTAL_STATES; s++) {
            if (row[s] === 0) continue;
            const prob = row[s] / total;
            const decoded = this._decodeState(s);

            if (decoded.zone === 2) rawCollision += prob;
            if (decoded.jerk === 2) rawPanic += prob;
        }

        // Missed burst risk: derived from rolling shot window
        rawMissed = this.SHOT_WINDOW > 0
            ? this.recentMisses / this.SHOT_WINDOW
            : 0;

        // Exponentially weighted smoothing to prevent jitter
        this.collisionRisk = this.EWM_ALPHA * rawCollision + (1 - this.EWM_ALPHA) * this.collisionRisk;
        this.missedBurstRisk = this.EWM_ALPHA * rawMissed + (1 - this.EWM_ALPHA) * this.missedBurstRisk;
        this.panicRisk = this.EWM_ALPHA * rawPanic + (1 - this.EWM_ALPHA) * this.panicRisk;

        return {
            collisionRisk: parseFloat(this.collisionRisk.toFixed(3)),
            missedBurstRisk: parseFloat(this.missedBurstRisk.toFixed(3)),
            panicRisk: parseFloat(this.panicRisk.toFixed(3))
        };
    }

    /**
     * Returns DNA gene hints for the next enemy spawn.
     * When collision risk is high → enemies should slow down slightly
     * (give the player a beating but fair challenge).
     * When missed-burst risk is high → boost aggro (punish spray).
     * When panic risk is high → reduce speed (don't overwhelm).
     */
    getEnemyHint() {
        const { collisionRisk, missedBurstRisk, panicRisk } = this.predict();

        let aggroMult = 1.0;
        let speedMult = 1.0;

        if (missedBurstRisk > 0.6) aggroMult += 0.15;   // player is spraying, punish it
        if (collisionRisk > 0.7) speedMult -= 0.10;   // don't insta-kill, keep tension
        if (panicRisk > 0.7) speedMult -= 0.12;   // ease slightly during predicted panic

        // Clamp
        aggroMult = Math.max(0.8, Math.min(1.5, aggroMult));
        speedMult = Math.max(0.7, Math.min(1.2, speedMult));

        return {
            aggroMult,
            speedMult,
            collisionRisk,
            missedBurstRisk,
            panicRisk
        };
    }

    // ==============================================================
    // INTERNAL: State encoding / decoding
    // State = hpBracket * (ZONE * JERK) + zoneBracket * JERK + jerkBracket
    // ==============================================================

    _encodeState() {
        const hp = this._hpBracket();
        const zone = this._zoneBracket();
        const jerk = this._jerkBracket();
        if (hp === -1 || zone === -1 || jerk === -1) return -1;
        return hp * (this.ZONE_LEVELS * this.JERK_LEVELS) + zone * this.JERK_LEVELS + jerk;
    }

    _decodeState(state) {
        const jerk = state % this.JERK_LEVELS;
        const rest = Math.floor(state / this.JERK_LEVELS);
        const zone = rest % this.ZONE_LEVELS;
        const hp = Math.floor(rest / this.ZONE_LEVELS);
        return { hp, zone, jerk };
    }

    _hpBracket() {
        const ratio = this.playerMaxHP > 0
            ? this.playerHP / this.playerMaxHP
            : 0.5;
        if (ratio <= 0.25) return 0;
        if (ratio <= 0.50) return 1;
        if (ratio <= 0.75) return 2;
        return 3;
    }

    _zoneBracket() {
        if (this.nearbyEnemies <= this.ENEMY_SAFE_THRESH) return 0;
        if (this.nearbyEnemies < this.ENEMY_DENSE_THRESH) return 1;
        return 2;
    }

    _jerkBracket() {
        if (this.jerkMagnitude < this.JERK_CALM_THRESH) return 0;
        if (this.jerkMagnitude < this.JERK_PANIC_THRESH) return 1;
        return 2;
    }

    // ==============================================================
    // HELPERS
    // ==============================================================

    _makeMatrix(n) {
        return Array.from({ length: n }, () => new Array(n).fill(0));
    }

    // ==============================================================
    // DEBUG
    // ==============================================================
    getDebugInfo() {
        return {
            totalTransitions: this.totalTransitions,
            currentState: this._encodeState(),
            decoded: this._decodeState(Math.max(0, this._encodeState())),
            prediction: this.predict(),
            enemyHint: this.getEnemyHint()
        };
    }

    /**
     * Feed positive metrics into the PredictiveAI matrix, reinforcing transitions to safe, calm states.
     */
    feedPositiveVector() {
        const currentState = this._encodeState();
        if (currentState !== -1) {
            const hp = this._hpBracket();
            // zone = 0 (safe), jerk = 0 (calm)
            const safeState = hp * (this.ZONE_LEVELS * this.JERK_LEVELS);
            this.transitions[currentState][safeState] += 5;
            this.totalTransitions += 5;
            console.log(`[PredictiveAI] Positive vector fed: transitions from ${currentState} to safe state ${safeState} reinforced.`);
        }
    }

    // ==============================================================
    // RESET: Call at the start of each new run
    // ==============================================================
    reset() {
        this.transitions = this._makeMatrix(this.TOTAL_STATES);
        this.lastState = -1;
        this.playerHP = 100;
        this.playerMaxHP = 100;
        this.nearbyEnemies = 0;
        this.jerkMagnitude = 0;
        this.recentMisses = 0;
        this.shotWindow = [];
        this.collisionRisk = 0;
        this.missedBurstRisk = 0;
        this.panicRisk = 0;
        this.totalTransitions = 0;
    }
}

// Global singleton — must load BEFORE TelemetryService.js
const predictiveAI = new PredictiveAI();
