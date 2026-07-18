/**
 * DifficultySystem.js - Aggressive Sector-Based Difficulty Scaling
 * Sector 11 is intentionally near-impossible for humans ("only the computer can win")
 */

class DifficultySystem {
    constructor() {
        // Base multiplier curve: 1.55^(L-1)
        this.baseMultiplier = 1.55;
        
        // Cached sector difficulty for current sector
        this.currentSector = 1;
        this.cachedParams = this.computeParams(1);
    }
    
    /**
     * Core difficulty multiplier: aggressive exponential
     * L1=1.00, L2=1.55, L3=2.40, L4=3.72, L5=5.77, L6=8.95, L7=13.88, L8=21.51, L9=33.34, L10=51.67, L11=80.10
     */
    sectorMult(sector) {
        const L = Math.min(Math.max(sector, 1), 11);
        return Math.pow(this.baseMultiplier, L - 1);
    }
    
    /**
     * Compute all difficulty parameters for a given sector
     */
    computeParams(sector) {
        const L = Math.min(Math.max(sector, 1), 11);
        const mult = this.sectorMult(L);
        
        return {
            sector: L,
            sectorMult: mult,
            
            // Enemy HP: clamp(sectorMult, 1, 120)
            enemyHPMult: Math.min(120, mult),
            
            // Enemy Speed: linear ramp (1 + 0.18*(L-1))
            enemySpeedMult: 1 + 0.18 * (L - 1),
            
            // Spawn Rate: clamp(sectorMult^0.55, 1, 18)
            spawnRateMult: Math.min(18, Math.max(1, Math.pow(mult, 0.55))),
            
            // Projectile Speed: (1 + 0.10*(L-1))
            projectileSpeedMult: 1 + 0.10 * (L - 1),
            
            // Elite Chance: clamp(0.05 + 0.08*(L-1), 0, 0.90)
            eliteChance: Math.min(0.90, Math.max(0, 0.05 + 0.08 * (L - 1))),
            
            // Hazard Strength: clamp(sectorMult^0.7, 1, 25)
            hazardStrengthMult: Math.min(25, Math.max(1, Math.pow(mult, 0.7))),
            
            // Unfair mechanics (enabled at L6+)
            microDodge: L >= 6,           // Enemies dodge when hit
            homingShots: L >= 7,          // Mild tracking bullets
            swarmCoordination: L >= 8,    // Formation spawns
            multiPhaseElites: L >= 9,     // Shield + core phases
            bulletHellGaps: L >= 10,      // Tighter bullet patterns + EMP
            machineRealm: L === 11,       // Maximum aggression
            
            // Healing nerfs
            hpDropFreqMult: this.getHPDropMultiplier(L),
            shieldDurabilityMult: L >= 10 ? 0.5 : 1.0,
            maxHPDropsPerMinute: L === 11 ? 0.02 : (L >= 9 ? 0.5 : (L >= 7 ? 1.0 : 3.0)),
            
            // Director lock (prevents adaptive softening at high sectors)
            directorLocked: L >= 6,
            directorMaxAggression: L === 11,
            
            // Display tier
            difficultyTier: this.getDifficultyTier(L),
            sectorMessage: this.getSectorMessage(L)
        };
    }
    
    getHPDropMultiplier(L) {
        if (L === 11) return 0.05;   // Effectively disabled
        if (L >= 9) return 0.25;     // 75% reduction
        if (L >= 7) return 0.50;     // 50% reduction
        return 1.0;
    }
    
    getDifficultyTier(L) {
        if (L <= 2) return 'Tutorial';
        if (L <= 4) return 'Normal';
        if (L <= 6) return 'Hard';
        if (L <= 8) return 'Insane';
        if (L <= 10) return 'Nightmare';
        return 'SINGULARITY';
    }
    
    getSectorMessage(L) {
        const messages = {
            1: 'Initializing...',
            2: 'Training Complete',
            3: 'Resistance Detected',
            4: 'Combat Engaged',
            5: 'Difficulty Rising',
            6: '⚠ Adaptive Countermeasures Active',
            7: '⚠ Human Limit Approaching',
            8: '⚡ Swarm Intelligence Engaged',
            9: '💀 Machine Pressure',
            10: '🔥 Beyond Human Reaction',
            11: '☠ ONLY THE COMPUTER WINS'
        };
        return messages[L] || '';
    }
    
    /**
     * Set current sector and recompute parameters
     */
    setSector(sector) {
        this.currentSector = sector;
        this.cachedParams = this.computeParams(sector);
        return this.cachedParams;
    }
    
    /**
     * Get current difficulty parameters
     */
    getParams() {
        return this.cachedParams;
    }
    
    /**
     * Apply HP multiplier to enemy base HP
     */
    scaleEnemyHP(baseHP) {
        return Math.round(baseHP * this.cachedParams.enemyHPMult);
    }
    
    /**
     * Apply speed multiplier to enemy base speed
     */
    scaleEnemySpeed(baseSpeed) {
        return baseSpeed * this.cachedParams.enemySpeedMult;
    }
    
    /**
     * Apply spawn rate multiplier
     */
    scaleSpawnRate(baseRate) {
        return baseRate * this.cachedParams.spawnRateMult;
    }
    
    /**
     * Apply projectile speed multiplier
     */
    scaleProjectileSpeed(baseSpeed) {
        return baseSpeed * this.cachedParams.projectileSpeedMult;
    }
    
    /**
     * Check if elite should spawn based on sector elite chance
     */
    shouldSpawnElite() {
        return Math.random() < this.cachedParams.eliteChance;
    }
    
    /**
     * Check if HP drop is allowed (rate limited at high sectors)
     */
    shouldAllowHPDrop() {
        return Math.random() < this.cachedParams.hpDropFreqMult;
    }
    
    /**
     * Check if Director is allowed to reduce difficulty
     * Returns false for L6+, true otherwise
     */
    canDirectorReduce() {
        return !this.cachedParams.directorLocked;
    }
    
    /**
     * Debug: print difficulty table
     */
    debugPrintTable() {
        console.log('=== DIFFICULTY ESCALATION TABLE ===');
        for (let L = 1; L <= 11; L++) {
            const p = this.computeParams(L);
            console.log(`L${L}: mult=${p.sectorMult.toFixed(2)}, HP=${p.enemyHPMult.toFixed(1)}x, ` +
                `Speed=${p.enemySpeedMult.toFixed(2)}x, Spawn=${p.spawnRateMult.toFixed(2)}x, ` +
                `Elite=${(p.eliteChance*100).toFixed(0)}%, Tier=${p.difficultyTier}`);
        }
    }
}

// Global instance
const difficultySystem = new DifficultySystem();
