/**
 * Director.js - Adaptive Difficulty System
 * Tracks player skill and adjusts game parameters in real-time
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
        
        // Computed skill score
        this.skillScore = 50;
        this.lastUpdate = 0;
        
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
            const avgJerk = this.movementSamples.reduce((a,b) => a+b, 0) / this.movementSamples.length;
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
        const avg = this.reactionSamples.reduce((a,b) => a+b, 0) / this.reactionSamples.length;
        // Fast reaction (< 1s) = skill 100, slow (> 5s) = skill 0
        this.reactionTime = Math.max(0, Math.min(100, 100 - (avg - 1000) / 40));
    }
    
    // Main update - call once per second
    update(time, sector) {
        if (time - this.lastUpdate < 1.0) return;
        this.lastUpdate = time;
        
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
        
        // Derive difficulty multipliers
        let normalized = this.skillScore / 100; // 0-1
        
        // At L11 (max aggression): lock to maximum difficulty
        if (maxAggression) {
            normalized = 1.0;
        } else if (!canReduce && normalized < 0.5) {
            // At L6+: cannot reduce below baseline
            normalized = 0.5;
        }
        
        this.enemySpeedMult = 0.8 + normalized * 0.4; // 0.8x - 1.2x
        this.spawnDensityMult = 0.7 + normalized * 0.6; // 0.7x - 1.3x
        this.eliteChance = 0.05 + normalized * 0.15; // 5% - 20%
        this.hazardFrequency = 0.5 + normalized * 1.0; // 0.5x - 1.5x
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
            skillScore: this.skillScore
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
        // Keep skill estimate between runs for adaptive starting difficulty
    }
}
