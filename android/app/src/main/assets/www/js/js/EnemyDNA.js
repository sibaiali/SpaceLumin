/**
 * EnemyDNA.js - Genetic Algorithm for Adaptive Enemy Evolution
 * Enemies have DNA genes that evolve based on player telemetry
 * Selection/Crossover runs at wave end - survivors pass genes forward
 */

class EnemyDNA {
    constructor() {
        // ========================================
        // GENE POOL: Store DNA of all active enemies
        // ========================================
        this.genePool = [];
        this.survivorPool = [];    // Top 10% longest survivors
        this.generation = 1;

        // ========================================
        // MUTATION CONSTANTS
        // ========================================
        this.MUTATION_RATE = 0.15;       // 15% chance per gene
        this.MUTATION_STRENGTH = 0.20;   // ±20% variation
        this.SURVIVOR_PERCENT = 0.10;    // Top 10% pass genes
        this.CHAOS_SPEED_BOOST = 0.15;   // +15% speed if player is chaotic

        // ========================================
        // BASE GENE RANGES
        // ========================================
        this.geneRanges = {
            speed: { min: 0.6, max: 1.8, default: 1.0 },
            aggro: { min: 0.5, max: 2.5, default: 1.0 },
            scale: { min: 0.7, max: 1.5, default: 1.0 },
            emissive: { min: 0.1, max: 1.0, default: 0.3 }
        };

        // ========================================
        // ELEMENTAL MODIFIERS (per sector type)
        // ========================================
        this.elementalModifiers = {
            ICE: { speed: 0.85, aggro: 0.9, separation: 40 },      // Sectors 1-5
            FIRE: { speed: 1.1, aggro: 2.0, separation: 50 },      // Sectors 6-10
            NATURE: { speed: 0.95, aggro: 1.0, separation: 80 },   // Sectors 11-15
            WIND: { speed: 1.2, aggro: 1.3, separation: 60 }       // Sectors 16-20
        };
    }

    // ========================================
    // CREATE NEW DNA: Random or from parents
    // ========================================
    createDNA(parentA = null, parentB = null) {
        if (parentA && parentB) {
            return this.crossover(parentA, parentB);
        }

        // Random initial DNA
        return {
            speed: this.randomInRange(this.geneRanges.speed),
            aggro: this.randomInRange(this.geneRanges.aggro),
            scale: this.randomInRange(this.geneRanges.scale),
            emissive: this.randomInRange(this.geneRanges.emissive),
            spawnTime: performance.now(),
            survivalTime: 0
        };
    }

    // ========================================
    // CROSSOVER: Blend genes from two parents
    // ========================================
    crossover(parentA, parentB) {
        const child = {
            speed: Math.random() < 0.5 ? parentA.speed : parentB.speed,
            aggro: Math.random() < 0.5 ? parentA.aggro : parentB.aggro,
            scale: Math.random() < 0.5 ? parentA.scale : parentB.scale,
            emissive: Math.random() < 0.5 ? parentA.emissive : parentB.emissive,
            spawnTime: performance.now(),
            survivalTime: 0
        };

        // Apply mutations
        return this.mutate(child);
    }

    // ========================================
    // MUTATION: Random gene variations
    // ========================================
    mutate(dna) {
        const mutated = { ...dna };

        for (const gene of ['speed', 'aggro', 'scale', 'emissive']) {
            if (Math.random() < this.MUTATION_RATE) {
                const range = this.geneRanges[gene];
                const variation = 1 + (Math.random() * 2 - 1) * this.MUTATION_STRENGTH;
                mutated[gene] = this.clamp(mutated[gene] * variation, range.min, range.max);
            }
        }

        return mutated;
    }

    // ========================================
    // TELEMETRY ADAPTATION: Boost genes based on player chaos
    // ========================================
    adaptToTelemetry(dna) {
        if (typeof telemetryService === 'undefined') return dna;

        const adapted = { ...dna };

        // If player is chaotic, increase speed pressure
        if (telemetryService.isChaotic()) {
            adapted.speed *= (1 + this.CHAOS_SPEED_BOOST);
            adapted.speed = this.clamp(adapted.speed,
                this.geneRanges.speed.min,
                this.geneRanges.speed.max);
        }

        // Scale aggression with chaos factor
        adapted.aggro *= telemetryService.chaosFactor;
        adapted.aggro = this.clamp(adapted.aggro,
            this.geneRanges.aggro.min,
            this.geneRanges.aggro.max);

        return adapted;
    }

    // ========================================
    // ELEMENTAL ADAPTATION: Apply sector modifiers
    // ========================================
    applyElementalModifiers(dna, sector) {
        const element = this.getElement(sector);
        const mods = this.elementalModifiers[element];
        if (!mods) return dna;

        return {
            ...dna,
            speed: dna.speed * mods.speed,
            aggro: dna.aggro * mods.aggro
        };
    }

    // ========================================
    // GET ELEMENT: Map sector to element type
    // ========================================
    getElement(sector) {
        if (sector <= 5) return 'ICE';
        if (sector <= 10) return 'FIRE';
        if (sector <= 15) return 'NATURE';
        return 'WIND';
    }

    // ========================================
    // GET SEPARATION DISTANCE: For Boids steering
    // ========================================
    getSeparationDistance(sector) {
        const element = this.getElement(sector);
        return this.elementalModifiers[element]?.separation || 50;
    }

    // ========================================
    // REGISTER ENEMY: Add to gene pool
    // ========================================
    registerEnemy(enemy) {
        if (!enemy.dna) {
            enemy.dna = this.createDNA();
        }
        this.genePool.push(enemy);
    }

    // ========================================
    // RECORD DEATH: Track survival time
    // ========================================
    recordDeath(enemy) {
        if (!enemy.dna) return;

        enemy.dna.survivalTime = performance.now() - enemy.dna.spawnTime;

        // Remove from active pool
        const idx = this.genePool.indexOf(enemy);
        if (idx !== -1) this.genePool.splice(idx, 1);
    }

    // ========================================
    // WAVE END: Selection & Evolution
    // ========================================
    evolve(deadEnemies = []) {
        // Combine gene pool with dead enemies for selection
        const allGenes = [...this.genePool, ...deadEnemies]
            .filter(e => e.dna && e.dna.survivalTime > 0)
            .map(e => e.dna);

        if (allGenes.length < 5) {
            this.generation++;
            return; // Not enough data for evolution
        }

        // Sort by survival time (longest first)
        allGenes.sort((a, b) => b.survivalTime - a.survivalTime);

        // Select top 10%
        const survivorCount = Math.max(2, Math.floor(allGenes.length * this.SURVIVOR_PERCENT));
        this.survivorPool = allGenes.slice(0, survivorCount);

        // Clear gene pool for next generation
        this.genePool = [];
        this.generation++;

        console.log(`[EnemyDNA] Generation ${this.generation}: ${survivorCount} survivors selected`);
    }

    // ========================================
    // SPAWN NEXT GEN: Create evolved DNA for new enemy
    // ========================================
    spawnNextGenDNA(sector) {
        let dna;

        if (this.survivorPool.length >= 2) {
            // Breed from survivors
            const parentA = this.survivorPool[Math.floor(Math.random() * this.survivorPool.length)];
            const parentB = this.survivorPool[Math.floor(Math.random() * this.survivorPool.length)];
            dna = this.crossover(parentA, parentB);
        } else {
            // Random DNA
            dna = this.createDNA();
        }

        // Apply telemetry adaptation (reactive, backward-looking)
        dna = this.adaptToTelemetry(dna);

        // Apply elemental modifiers
        dna = this.applyElementalModifiers(dna, sector);

        // ============================================================
        // PREDICTIVE AI HINTS: Forward-looking gene adjustment.
        // Newly spawned enemies are shaped to counter the player's
        // *predicted* next behavior, not just their past actions.
        // ============================================================
        if (typeof predictiveAI !== 'undefined') {
            const hint = predictiveAI.getEnemyHint();
            dna.aggro = this.clamp(dna.aggro * hint.aggroMult,
                this.geneRanges.aggro.min, this.geneRanges.aggro.max);
            dna.speed = this.clamp(dna.speed * hint.speedMult,
                this.geneRanges.speed.min, this.geneRanges.speed.max);
        }

        // ============================================================
        // NEURO-FLOW CLAMPING (Lumin Flow 2.0):
        // Final gene pass — applies TRIBE v2 cortical φ signal via
        // NeuroFlowController.clampDNA(). Ensures Flow State is maintained
        // per §5.3 of the research doc (f(L)=1.55^{L-1} + neuro-attenuation).
        // ============================================================
        if (typeof neuroFlow !== 'undefined') {
            dna = neuroFlow.clampDNA(dna, sector);
        }

        return dna;
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================
    randomInRange(range) {
        return range.min + Math.random() * (range.max - range.min);
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // ========================================
    // DEBUG OUTPUT
    // ========================================
    getStats() {
        const avgGenes = { speed: 0, aggro: 0, scale: 0 };

        if (this.genePool.length > 0) {
            for (const enemy of this.genePool) {
                if (enemy.dna) {
                    avgGenes.speed += enemy.dna.speed;
                    avgGenes.aggro += enemy.dna.aggro;
                    avgGenes.scale += enemy.dna.scale;
                }
            }
            avgGenes.speed /= this.genePool.length;
            avgGenes.aggro /= this.genePool.length;
            avgGenes.scale /= this.genePool.length;
        }

        return {
            generation: this.generation,
            poolSize: this.genePool.length,
            survivorCount: this.survivorPool.length,
            averageGenes: {
                speed: avgGenes.speed.toFixed(2),
                aggro: avgGenes.aggro.toFixed(2),
                scale: avgGenes.scale.toFixed(2)
            }
        };
    }

    // ========================================
    // RESET: For new run
    // ========================================
    reset() {
        this.genePool = [];
        this.survivorPool = [];
        this.generation = 1;
    }
}

// Global singleton
const enemyDNA = new EnemyDNA();
