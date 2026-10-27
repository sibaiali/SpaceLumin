/*!
 * Copyright (c) 2026 Lumin Flow Studios. All Rights Reserved.
 * LUMIN FLOW: UTOPIA RUN (SPACELUMIN) — PROPRIETARY & CONFIDENTIAL
 * Protected Intellectual Property: PredictiveAI, NystromKernel, NeuroFlow, KernelMapper, Director.
 * Unauthorized copying, reverse-engineering, scraping, or redistribution is strictly prohibited.
 */
/**
 * Director.js - Adaptive Difficulty & Predictive AI Escalation System
 * Tracks player skill, playtime progression, and 36-State Markov Chain
 * predictions (PredictiveAI) to adapt game parameters and enemy species in real-time.
 * No ML libraries - pure lightweight math
 */

class Director {
    constructor() {
        // Skill metrics (0-100)
        this.accuracy = 50;
        this.survivalSkill = 50;
        this.reactionTime = 50;
        this.movementSkill = 50;

        // Tracking
        this.shotsFired = 0;
        this.shotsHit = 0;
        this.damagesTaken = 0;
        this.enemiesKilled = 0;
        this.lastDamageTime = 0;
        this.reactionSamples = [];
        this.movementSamples = [];

        // Computed skill score & playtime escalation
        this.skillScore = 50;
        this.lastUpdate = 0;
        this.runStartTime = null;
        this.playTimeElapsed = 0;

        // Latest PredictiveAI risk state
        this.lastPrediction = {
            collisionRisk: 0,
            missedBurstRisk: 0,
            panicRisk: 0
        };

        // Output multipliers
        this.enemySpeedMult = 1.0;
        this.spawnDensityMult = 1.0;
        this.eliteChance = 0.1;
        this.hazardFrequency = 1.0;
    }

    // Called when player fires
    recordShot() {
        this.shotsFired++;
    }

    // Called when bullet hits enemy
    recordHit() {
        this.shotsHit++;
        this.updateAccuracy();
    }

    // Called when player takes damage
    recordDamage(time) {
        this.damagesTaken++;
        const timeSinceLast = time - this.lastDamageTime;
        this.lastDamageTime = time;

        // If damage came quickly, survival skill drops
        if (timeSinceLast < 2) {
            this.survivalSkill = Math.max(0, this.survivalSkill - 3);
        } else {
            this.survivalSkill = Math.max(0, this.survivalSkill - 1);
        }
    }

    // Called when enemy killed - reactionMs is time from spawn to kill
    recordKill(reactionMs) {
        this.enemiesKilled++;

        // Track reaction time (time from spawn to kill)
        if (reactionMs > 0 && reactionMs < 10000) {
            this.reactionSamples.push(reactionMs);
            if (this.reactionSamples.length > 20) this.reactionSamples.shift();
            this.updateReactionSkill();
        }

        // Survival improves with kills
        this.survivalSkill = Math.min(100, this.survivalSkill + 0.5);
    }

    // Called each frame with player movement jerk magnitude
    recordMovement(jerkMagnitude) {
        this.movementSamples.push(jerkMagnitude);
        if (this.movementSamples.length > 60) this.movementSamples.shift();

        // High jerk = reactive/skilled movement
        if (this.movementSamples.length > 10) {
            const avgJerk = this.movementSamples.reduce((a, b) => a + b, 0) / this.movementSamples.length;
            this.movementSkill = Math.min(100, avgJerk * 0.5);
        }
    }

    updateAccuracy() {
        if (this.shotsFired > 10) {
            this.accuracy = Math.round((this.shotsHit / this.shotsFired) * 100);
        }
    }

    updateReactionSkill() {
        if (this.reactionSamples.length < 5) return;
        const avg = this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length;
        // Fast reaction (< 1s) = skill 100, slow (> 5s) = skill 0
        this.reactionTime = Math.max(0, Math.min(100, 100 - (avg - 1000) / 40));
    }

    // Main update - call once per second
    update(time, sector = 1) {
        if (this.runStartTime === null) {
            this.runStartTime = time;
        }
        if (time - this.lastUpdate < 1.0) return;
        this.lastUpdate = time;
        this.playTimeElapsed = Math.max(0, time - this.runStartTime);

        // Compute weighted skill score
        this.skillScore = Math.round(
            this.accuracy * 0.3 +
            this.survivalSkill * 0.3 +
            this.reactionTime * 0.2 +
            this.movementSkill * 0.2
        );

        // Check if difficulty lock is active (L6+ cannot reduce difficulty)
        const canReduce = typeof difficultySystem !== 'undefined'
            ? difficultySystem.canDirectorReduce()
            : true;
        const maxAggression = typeof difficultySystem !== 'undefined'
            ? difficultySystem.getParams().directorMaxAggression
            : false;

        // Derive difficulty multipliers from skill + continuous playtime + sector phase
        let normalized = this.skillScore / 100; // 0-1

        // Progressive time & phase escalation: the longer you play and the more phases you unlock,
        // the higher the baseline pressure rises while remaining responsive to player skill
        const timeEscalation = Math.min(0.65, this.playTimeElapsed / 180); // +0.65 over 3 minutes
        const phaseEscalation = Math.min(0.75, Math.max(0, (sector - 1) * 0.06));

        // At L11 (max aggression): lock to maximum difficulty
        if (maxAggression) {
            normalized = 1.0;
        } else if (!canReduce && normalized < 0.5) {
            // At L6+: cannot reduce below baseline
            normalized = 0.5;
        }

        this.enemySpeedMult = 0.85 + normalized * 0.45 + timeEscalation * 0.25 + phaseEscalation * 0.25;
        this.spawnDensityMult = 0.80 + normalized * 0.65 + timeEscalation * 0.45 + phaseEscalation * 0.40;
        this.eliteChance = Math.min(0.85, 0.08 + normalized * 0.22 + timeEscalation * 0.18 + phaseEscalation * 0.20);
        this.hazardFrequency = 0.6 + normalized * 1.0 + timeEscalation * 0.4;

        // ============================================================
        // PREDICTIVE AI: Pre-emptive difficulty micro-adjustments
        // Read risk signals from PredictiveAI via TelemetryService.
        // Applied ON TOP of the skill & playtime values above.
        // ============================================================
        if (typeof telemetryService !== 'undefined') {
            const evaluator = typeof window !== 'undefined'
                ? window.game?.predictionEvaluator
                : null;
            const evaluationEnabled = evaluator &&
                typeof window.invokePredictionEvaluatorSafely === 'function';
            const predictionStartedAt = evaluationEnabled ? performance.now() : null;
            const prediction = telemetryService.getPrediction();

            if (evaluationEnabled) {
                window.invokePredictionEvaluatorSafely('director.prediction-opportunity', () => {
                    evaluator.openPredictionOpportunity({
                        predictionLatencyMs: performance.now() - predictionStartedAt,
                        sector,
                        gameTime: this.playTimeElapsed
                    });
                });
            }

            const { collisionRisk, missedBurstRisk, panicRisk } = prediction;
            this.lastPrediction = {
                collisionRisk: collisionRisk || 0,
                missedBurstRisk: missedBurstRisk || 0,
                panicRisk: panicRisk || 0
            };

            // Player is about to collide with a cluster → ease speed slightly so
            // they can still react, keeping tension high but fair.
            if (collisionRisk > 0.70) {
                this.enemySpeedMult *= 0.90;
            } else if (collisionRisk < 0.25 && this.skillScore > 55) {
                // Player is comfortably evading threats → Predictive AI ramps pursuit speed!
                this.enemySpeedMult *= 1.12;
                this.spawnDensityMult *= 1.10;
            }

            // Player is spraying / about to miss a burst → raise elite & alien/goblin
            // chance to challenge the predicted inaccuracy.
            if (missedBurstRisk > 0.60) {
                this.eliteChance = Math.min(0.95, this.eliteChance + 0.12);
            }

            // Player is about to panic-dodge → thin the spawn slightly
            // so the difficulty stays intense but not unfair.
            if (panicRisk > 0.70) {
                this.spawnDensityMult *= 0.85;
            }
        }
    }

    /**
     * Selects an enemy species to spawn based on the unlocked Phase/Sector and
     * the player's real-time Predictive AI profile + skill score.
     * Every unlocked phase introduces new Goblins, Aliens, Creatures, and Archons!
     */
    selectEnemyType(sector = 1, forceElite = false) {
        const pred = this.lastPrediction || { collisionRisk: 0, missedBurstRisk: 0, panicRisk: 0 };
        const isHighSkill = this.skillScore >= 58 || forceElite || Math.random() < this.eliteChance;

        // Build weighted species pool unlocked at current sector/phase
        const pool = [
            { type: 'normal', weight: sector <= 2 ? 1.8 : 0.9 },
            { type: 'goblin', weight: 1.5 + Math.min(1.5, sector * 0.2) + (pred.panicRisk > 0.4 ? 0.6 : 0) },
            { type: 'fast',   weight: 1.2 }
        ];

        // Phase 2+ (Sector 2+): Psionic UFO Aliens & Abyssal Shooters join the invasion
        if (sector >= 2) {
            pool.push({
                type: 'alien',
                weight: 1.6 + Math.min(1.4, (sector - 1) * 0.25) + (pred.missedBurstRisk > 0.4 ? 0.8 : 0)
            });
            pool.push({
                type: 'shooter',
                weight: 1.1 + (isHighSkill ? 0.4 : 0)
            });
        }

        // Phase 3+ (Sector 3+): Bioluminescent Tentacle Creatures & Obsidian Golems unlock
        if (sector >= 3) {
            pool.push({
                type: 'creature',
                weight: 1.65 + Math.min(1.5, (sector - 2) * 0.25) + (isHighSkill ? 0.6 : 0)
            });
            pool.push({
                type: 'tanky',
                weight: 1.15 + (pred.collisionRisk < 0.35 ? 0.45 : 0)
            });
        }

        // Phase 5+ (Sector 5+): Eldritch Seraphim Archons descend with predictive velocity interception
        if (sector >= 5) {
            pool.push({
                type: 'archon',
                weight: 1.45 + Math.min(1.8, (sector - 4) * 0.3) + (isHighSkill ? 0.75 : 0)
            });
        }

        const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const item of pool) {
            roll -= item.weight;
            if (roll <= 0) return item.type;
        }
        return pool[pool.length - 1].type;
    }

    // For UI display
    getSkillTier() {
        if (this.skillScore < 30) return 'Novice';
        if (this.skillScore < 50) return 'Adept';
        if (this.skillScore < 70) return 'Veteran';
        if (this.skillScore < 90) return 'Elite';
        return 'Legendary';
    }

    // Get current difficulty parameters for spawning
    getDifficultyParams() {
        return {
            enemySpeedMult: this.enemySpeedMult,
            spawnDensityMult: this.spawnDensityMult,
            eliteChance: this.eliteChance,
            hazardFrequency: this.hazardFrequency,
            skillScore: this.skillScore,
            playTimeElapsed: this.playTimeElapsed
        };
    }

    // Reset for new run
    reset() {
        this.shotsFired = 0;
        this.shotsHit = 0;
        this.damagesTaken = 0;
        this.enemiesKilled = 0;
        this.reactionSamples = [];
        this.movementSamples = [];
        this.runStartTime = null;
        this.playTimeElapsed = 0;
        // Keep skill estimate between runs for adaptive starting difficulty
    }
}
