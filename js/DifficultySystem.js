/**
 * DifficultySystem.js - 20 Sector Elemental Odyssey with Physics Modifiers
 * Elements: ICE (1-5), FIRE (6-10), NATURE (11-15), WIND (16-20)
 * Sector 20 is the Singularity - near-impossible for humans
 */

class DifficultySystem {
    constructor() {
        // Base multiplier curve: 1.55^(L-1) for 20 sectors  [Lumin Flow 2.0 upgrade from 1.35]
        // Technical basis: f(L) = 1.55^{L-1}, §5.1 lumin_flow_2_research.md
        this.baseMultiplier = 1.55;
        this.MAX_SECTOR = 20;

        // Current sector tracking
        this.currentSector = 1;

        // ========================================
        // ELEMENTAL PHYSICS MODIFIERS
        // Must be defined BEFORE computeParams is called
        // ========================================
        this.elementalPhysics = {
            ICE: {
                name: 'ICE',
                sectors: [1, 2, 3, 4, 5],
                nebulaDrag: 0.95,           // Velocity *= 0.95 each frame
                aggressionMult: 0.8,        // Slower enemy aggression
                separationDistance: 40,     // Boids separation
                playerDrag: 0.98,           // Slight player slowdown
                visualTint: 0x88ddff,
                description: 'Frozen Nebula - Movement Dampened'
            },
            FIRE: {
                name: 'FIRE',
                sectors: [6, 7, 8, 9, 10],
                nebulaDrag: 1.0,            // Normal drag
                aggressionMult: 2.0,        // 2x enemy aggression
                separationDistance: 50,     // Normal separation
                playerDrag: 1.0,            // Normal player
                visualTint: 0xff4444,
                description: 'Solar Inferno - Maximum Aggression'
            },
            NATURE: {
                name: 'NATURE',
                sectors: [11, 12, 13, 14, 15],
                nebulaDrag: 0.98,           // Slight drag
                aggressionMult: 1.0,        // Normal aggression
                separationDistance: 80,     // Wide boids separation
                playerDrag: 1.0,            // Normal player
                visualTint: 0x22c55e,
                description: 'Bio-Organic Zone - Swarm Tactics'
            },
            WIND: {
                name: 'WIND',
                sectors: [16, 17, 18, 19, 20],
                nebulaDrag: 1.05,           // Slight speed boost
                aggressionMult: 1.5,        // Enhanced aggression
                separationDistance: 60,     // Medium separation
                playerDrag: 1.0,            // Normal drag
                impulseJoltChance: 0.03,    // 3% chance of random jolt
                impulseJoltStrength: 80,    // Jolt force magnitude
                visualTint: 0xa855f7,
                description: 'Chaos Winds - Unpredictable Forces'
            }
        };

        // Cached sector difficulty - MUST be after elementalPhysics
        this.cachedParams = this.computeParams(1);
    }

    /**
     * Core difficulty multiplier: exponential curve for 20 sectors
     * L1=1.00, L5=3.32, L10=11.03, L15=36.64, L20=121.58
     */
    sectorMult(sector) {
        const L = Math.min(Math.max(sector, 1), this.MAX_SECTOR);
        const raw = Math.pow(this.baseMultiplier, L - 1);

        // Apply NeuroFlowController difficulty modifier (Lumin Flow 2.0):
        // When TRIBE φ < PHI_UNDER (0.40), mult is attenuated up to 35%
        // to keep the player in the Flow channel. §5.1
        if (typeof neuroFlow !== 'undefined') {
            return raw * neuroFlow.getDifficultyModifier();
        }
        return raw;
    }

    /**
     * Get element type for sector
     */
    getElement(sector) {
        if (sector <= 5) return 'ICE';
        if (sector <= 10) return 'FIRE';
        if (sector <= 15) return 'NATURE';
        return 'WIND';
    }

    /**
     * Get elemental physics for sector
     */
    getElementalPhysics(sector) {
        const element = this.getElement(sector);
        return this.elementalPhysics[element];
    }

    /**
     * Compute all difficulty parameters for a given sector
     */
    computeParams(sector) {
        const L = Math.min(Math.max(sector, 1), this.MAX_SECTOR);
        const mult = this.sectorMult(L);
        const element = this.getElement(L);
        const physics = this.elementalPhysics[element];

        return {
            sector: L,
            sectorMult: mult,
            element: element,
            elementalPhysics: physics,

            // Enemy HP: clamp(sectorMult, 1, 200) - extended for 20 sectors
            enemyHPMult: Math.min(200, mult),

            // Enemy Speed: linear ramp (1 + 0.12*(L-1)) - smoother for 20 sectors
            enemySpeedMult: 1 + 0.12 * (L - 1),

            // Spawn Rate: clamp(sectorMult^0.45, 1, 25) - extended ceiling
            spawnRateMult: Math.min(25, Math.max(1, Math.pow(mult, 0.45))),

            // Projectile Speed: (1 + 0.08*(L-1))
            projectileSpeedMult: 1 + 0.08 * (L - 1),

            // Elite Chance: clamp(0.03 + 0.05*(L-1), 0, 0.95)
            eliteChance: Math.min(0.95, Math.max(0, 0.03 + 0.05 * (L - 1))),

            // Hazard Strength: clamp(sectorMult^0.6, 1, 40)
            hazardStrengthMult: Math.min(40, Math.max(1, Math.pow(mult, 0.6))),

            // ========================================
            // ELEMENTAL PHYSICS PARAMETERS
            // ========================================
            nebulaDrag: physics.nebulaDrag,
            aggressionMult: physics.aggressionMult,
            separationDistance: physics.separationDistance,
            playerDrag: physics.playerDrag,
            impulseJoltChance: physics.impulseJoltChance || 0,
            impulseJoltStrength: physics.impulseJoltStrength || 0,
            visualTint: physics.visualTint,

            // ========================================
            // ELASTIC SCALING: Fairness for low-HP players
            // ========================================
            elasticHitboxMult: 1.0,     // Increases when player HP is low
            elasticTurnRate: 1.0,       // Enemy turn rate reduction at low HP

            // ========================================
            // ELEMENTAL EFFECTS
            // ========================================
            fireFragments: element === 'FIRE',           // Enemies explode into fragments
            natureRegen: element === 'NATURE' ? 2.0 : 0, // HP/sec regen for enemies
            windTurbulence: element === 'WIND' ? 0.15 : 0, // Constant random force

            // ========================================
            // UNFAIR MECHANICS: Tiered for 20 sectors
            // ========================================
            microDodge: L >= 8,             // Enemies dodge when hit
            homingShots: L >= 10,           // Mild tracking bullets
            swarmCoordination: L >= 12,     // Formation spawns
            multiPhaseElites: L >= 14,      // Shield + core phases
            bulletHellGaps: L >= 16,        // Tighter bullet patterns + EMP
            chaosWinds: L >= 17,            // Random velocity jolts
            machineRealm: L >= 19,          // Maximum aggression
            singularity: L === 20,          // The final test

            // Healing nerfs
            hpDropFreqMult: this.getHPDropMultiplier(L),
            shieldDurabilityMult: L >= 16 ? 0.4 : (L >= 12 ? 0.6 : 1.0),
            maxHPDropsPerMinute: L >= 18 ? 0.1 : (L >= 14 ? 0.5 : (L >= 10 ? 1.0 : 3.0)),

            // Director lock (prevents adaptive softening at high sectors)
            directorLocked: L >= 10,
            directorMaxAggression: L >= 18,

            // Display info
            difficultyTier: this.getDifficultyTier(L),
            sectorMessage: this.getSectorMessage(L),
            elementDescription: physics.description
        };
    }

    getHPDropMultiplier(L) {
        if (L >= 19) return 0.02;   // Effectively disabled
        if (L >= 16) return 0.15;   // 85% reduction
        if (L >= 12) return 0.35;   // 65% reduction
        if (L >= 8) return 0.60;    // 40% reduction
        return 1.0;
    }

    getDifficultyTier(L) {
        if (L <= 3) return 'Tutorial';
        if (L <= 5) return 'Normal';          // ICE end
        if (L <= 8) return 'Hard';            // FIRE mid
        if (L <= 10) return 'Intense';        // FIRE end
        if (L <= 13) return 'Insane';         // NATURE mid
        if (L <= 15) return 'Nightmare';      // NATURE end
        if (L <= 17) return 'Apocalypse';     // WIND mid
        if (L <= 19) return 'Machine Realm';  // WIND late
        return 'SINGULARITY';                  // L20
    }

    getSectorMessage(L) {
        const messages = {
            1: '❄ Frozen Nebula - Initializing...',
            2: '❄ Ice Flow Detected',
            3: '❄ Cryogenic Zone Active',
            4: '❄ Sub-Zero Operations',
            5: '❄ ICE CORE - Element Mastered',
            6: '🔥 Solar Winds Approaching',
            7: '🔥 Thermal Spike Detected',
            8: '🔥 Inferno Zone - ⚠ Aggression Rising',
            9: '🔥 Solar Core Breach',
            10: '🔥 FIRE APEX - Maximum Heat',
            11: '🌿 Bio-Organic Contact',
            12: '🌿 Swarm Intelligence Detected',
            13: '🌿 Hive Mind Active',
            14: '🌿 Nature\'s Wrath - ⚡ Formation Spawns',
            15: '🌿 NATURE HEART - Evolution Complete',
            16: '💨 Chaos Winds Rising',
            17: '💨 Turbulence Zone - ⚠ Unpredictable',
            18: '💨 Storm Core - 💀 Machine Pressure',
            19: '💨 WIND FURY - 🔥 Beyond Human Reaction',
            20: '☠ S I N G U L A R I T Y - ONLY THE MACHINE WINS'
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
     * Returns false for L10+, true otherwise
     */
    canDirectorReduce() {
        return !this.cachedParams.directorLocked;
    }

    /**
     * Apply elemental physics to velocity vector (call each frame)
     * @param {Object} velocity - {x, y} velocity object (mutated in place)
     * @param {string} entityType - 'player' or 'enemy'
     * @returns {Object} - impulse jolt if applicable {x, y}
     */
    applyElementalPhysics(velocity, entityType = 'enemy') {
        const params = this.cachedParams;

        // Apply nebula drag (ICE sectors)
        if (entityType === 'enemy') {
            velocity.x *= params.nebulaDrag;
            velocity.y *= params.nebulaDrag;
        } else if (entityType === 'player') {
            velocity.x *= params.playerDrag;
            velocity.y *= params.playerDrag;
        }

        // Check for impulse jolt (WIND sectors)
        if (params.impulseJoltChance > 0 && Math.random() < params.impulseJoltChance) {
            return {
                x: (Math.random() - 0.5) * params.impulseJoltStrength,
                y: (Math.random() - 0.5) * params.impulseJoltStrength
            };
        }

        return null;
    }

    /**
     * Get aggression multiplier (FIRE sectors = 2x)
     */
    getAggressionMult() {
        return this.cachedParams.aggressionMult;
    }

    /**
     * Get boids separation distance (NATURE sectors = 80)
     */
    getSeparationDistance() {
        return this.cachedParams.separationDistance;
    }

    /**
     * Debug: print difficulty table
     */
    debugPrintTable() {
        console.log('=== 20 SECTOR ELEMENTAL ODYSSEY ===');
        for (let L = 1; L <= this.MAX_SECTOR; L++) {
            const p = this.computeParams(L);
            console.log(`L${L} [${p.element}]: mult=${p.sectorMult.toFixed(2)}, HP=${p.enemyHPMult.toFixed(1)}x, ` +
                `Speed=${p.enemySpeedMult.toFixed(2)}x, Aggro=${p.aggressionMult.toFixed(1)}x, ` +
                `Drag=${p.nebulaDrag}, Tier=${p.difficultyTier}`);
        }
    }
}

// Global instance
const difficultySystem = new DifficultySystem();
