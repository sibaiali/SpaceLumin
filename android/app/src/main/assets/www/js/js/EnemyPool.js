/**
 * EnemyPool.js - Instanced Rendering for High-Performance Swarm
 * Uses THREE.InstancedMesh for 500+ units at 60FPS on mobile
 * Implements Boids steering (Separation, Alignment, Cohesion)
 */

class EnemyPool {
    constructor(scene) {
        this.scene = scene;

        // ========================================
        // POOL CONFIGURATION
        // ========================================
        this.MAX_INSTANCES = 500;
        this.activeCount = 0;

        // Enemy data arrays (parallel to instance indices)
        this.enemies = new Array(this.MAX_INSTANCES).fill(null);
        this.matrices = new Array(this.MAX_INSTANCES);
        this.colors = new Array(this.MAX_INSTANCES);

        // Reusable Three.js objects for matrix updates
        this.tempMatrix = new THREE.Matrix4();
        this.tempPosition = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
        this.tempScale = new THREE.Vector3();
        this.tempColor = new THREE.Color();

        // ========================================
        // BOIDS STEERING CONSTANTS
        // ========================================
        this.SEPARATION_DISTANCE = 50;      // Min distance between units
        this.ALIGNMENT_RADIUS = 100;        // Radius for velocity averaging
        this.COHESION_RADIUS = 150;         // Radius for center-of-mass
        this.SEPARATION_WEIGHT = 1.5;
        this.ALIGNMENT_WEIGHT = 0.8;
        this.COHESION_WEIGHT = 0.5;
        this.MAX_STEER_FORCE = 200;

        // ========================================
        // CREATE INSTANCED MESH
        // ========================================
        this.createInstancedMesh();
    }

    // ========================================
    // CREATE INSTANCED MESH: Pre-allocate 500 unit buffer
    // ========================================
    createInstancedMesh() {
        // Enemy geometry - icosahedron for menacing look
        const geometry = new THREE.IcosahedronGeometry(12, 1);

        // Material with per-instance color support
        const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x000000,
            shininess: 30,
            flatShading: true
        });

        // Create instanced mesh
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.MAX_INSTANCES);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Enable per-instance colors
        this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(this.MAX_INSTANCES * 3),
            3
        );
        this.instancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

        // Hide all instances initially (scale to 0)
        const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < this.MAX_INSTANCES; i++) {
            this.instancedMesh.setMatrixAt(i, hideMatrix);
            this.instancedMesh.setColorAt(i, new THREE.Color(0x000000));
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.instancedMesh.instanceColor.needsUpdate = true;

        this.scene.add(this.instancedMesh);

        // Create glow mesh (additive blending for emissive effect)
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });

        this.glowMesh = new THREE.InstancedMesh(
            new THREE.IcosahedronGeometry(15, 0),
            glowMaterial,
            this.MAX_INSTANCES
        );
        this.glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Hide glow instances
        for (let i = 0; i < this.MAX_INSTANCES; i++) {
            this.glowMesh.setMatrixAt(i, hideMatrix);
        }
        this.glowMesh.instanceMatrix.needsUpdate = true;

        this.scene.add(this.glowMesh);
    }

    // ========================================
    // SPAWN ENEMY: Get slot and initialize
    // ========================================
    spawn(x, y, type = 'normal', sector = 1) {
        // Find free slot
        let slot = -1;
        for (let i = 0; i < this.MAX_INSTANCES; i++) {
            if (this.enemies[i] === null) {
                slot = i;
                break;
            }
        }

        if (slot === -1) {
            console.warn('[EnemyPool] No free slots!');
            return null;
        }

        // Get DNA from genetic system
        const dna = typeof enemyDNA !== 'undefined'
            ? enemyDNA.spawnNextGenDNA(sector)
            : { speed: 1.0, aggro: 1.0, scale: 1.0, emissive: 0.3, spawnTime: performance.now(), survivalTime: 0 };

        // Create enemy data object
        const enemy = {
            slot,
            x, y, z: 0,
            vx: 0, vy: 0,
            type,
            sector,
            dna,
            hp: this.getBaseHP(type) * dna.scale,
            maxHP: this.getBaseHP(type) * dna.scale,
            baseSpeed: this.getBaseSpeed(type) * dna.speed,
            state: 'idle',
            stateTimer: 0,
            color: this.getTypeColor(type),
            spawnTime: performance.now() / 1000,
            active: true
        };

        // Register with DNA system
        if (typeof enemyDNA !== 'undefined') {
            enemyDNA.registerEnemy(enemy);
        }

        // Store in pool
        this.enemies[slot] = enemy;
        this.activeCount++;

        // Update instance matrix
        this.updateInstanceMatrix(enemy);

        return enemy;
    }

    // ========================================
    // KILL ENEMY: Return slot to pool
    // ========================================
    kill(enemy) {
        if (!enemy || !enemy.active) return;

        // Record death in DNA system
        enemy.dna.survivalTime = performance.now() - enemy.dna.spawnTime;
        if (typeof enemyDNA !== 'undefined') {
            enemyDNA.recordDeath(enemy);
        }

        // Hide instance
        const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
        this.instancedMesh.setMatrixAt(enemy.slot, hideMatrix);
        this.glowMesh.setMatrixAt(enemy.slot, hideMatrix);

        // Clear slot
        enemy.active = false;
        this.enemies[enemy.slot] = null;
        this.activeCount--;

        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.glowMesh.instanceMatrix.needsUpdate = true;
    }

    // ========================================
    // UPDATE: Main loop - apply steering & update matrices
    // ========================================
    update(dt, playerPos, decoyPos, frozen, time, sector) {
        if (this.activeCount === 0) return [];

        // Update separation distance based on element
        if (typeof enemyDNA !== 'undefined') {
            this.SEPARATION_DISTANCE = enemyDNA.getSeparationDistance(sector);
        }

        const results = [];

        // First pass: Calculate steering forces
        for (let i = 0; i < this.MAX_INSTANCES; i++) {
            const enemy = this.enemies[i];
            if (!enemy || !enemy.active) continue;

            if (frozen) {
                // Flash frozen effect
                const flash = Math.sin(time * 10) * 0.3 + 0.7;
                this.tempColor.setHex(0x88ddff).multiplyScalar(flash);
                this.instancedMesh.setColorAt(enemy.slot, this.tempColor);
                continue;
            }

            // Get target (decoy or player)
            const target = decoyPos || playerPos;

            // Calculate Boids steering
            const steering = this.calculateSteering(enemy, target);

            // Apply steering forces
            enemy.vx += steering.x * dt;
            enemy.vy += steering.y * dt;

            // Clamp velocity
            const speed = Math.hypot(enemy.vx, enemy.vy);
            const maxSpeed = enemy.baseSpeed * (enemy.dna?.aggro || 1.0);
            if (speed > maxSpeed) {
                enemy.vx = (enemy.vx / speed) * maxSpeed;
                enemy.vy = (enemy.vy / speed) * maxSpeed;
            }

            // Apply elemental physics
            this.applyElementalPhysics(enemy, sector, dt);

            // Update position
            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;

            // ========================================
            // NAN GUARD: Prevent 3D world crashes
            // Reset position if invalid (division by zero, overflow)
            // ========================================
            if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y) ||
                !Number.isFinite(enemy.vx) || !Number.isFinite(enemy.vy)) {
                console.warn('[EnemyPool] NaN detected, resetting enemy position');
                enemy.x = 0;
                enemy.y = 0;
                enemy.vx = 0;
                enemy.vy = 0;
            }

            // Update instance
            this.updateInstanceMatrix(enemy);
            this.updateInstanceColor(enemy, time);
        }

        // Batch update GPU buffers
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.instancedMesh.instanceColor.needsUpdate = true;
        this.glowMesh.instanceMatrix.needsUpdate = true;

        return results;
    }

    // ========================================
    // BOIDS STEERING: Separation + Alignment + Cohesion
    // ========================================
    calculateSteering(enemy, target) {
        const separation = { x: 0, y: 0 };
        const alignment = { x: 0, y: 0 };
        const cohesion = { x: 0, y: 0 };

        let separationCount = 0;
        let alignmentCount = 0;
        let cohesionCount = 0;

        // Check neighbors
        for (let i = 0; i < this.MAX_INSTANCES; i++) {
            const other = this.enemies[i];
            if (!other || !other.active || other === enemy) continue;

            const dx = enemy.x - other.x;
            const dy = enemy.y - other.y;
            const dist = Math.hypot(dx, dy);

            // SEPARATION: Push away from close neighbors
            if (dist < this.SEPARATION_DISTANCE && dist > 0) {
                separation.x += (dx / dist) * (this.SEPARATION_DISTANCE / dist);
                separation.y += (dy / dist) * (this.SEPARATION_DISTANCE / dist);
                separationCount++;
            }

            // ALIGNMENT: Match velocity of nearby units
            if (dist < this.ALIGNMENT_RADIUS) {
                alignment.x += other.vx;
                alignment.y += other.vy;
                alignmentCount++;
            }

            // COHESION: Move toward center of nearby group
            if (dist < this.COHESION_RADIUS) {
                cohesion.x += other.x;
                cohesion.y += other.y;
                cohesionCount++;
            }
        }

        // Average and weight forces
        const steer = { x: 0, y: 0 };

        if (separationCount > 0) {
            steer.x += (separation.x / separationCount) * this.SEPARATION_WEIGHT;
            steer.y += (separation.y / separationCount) * this.SEPARATION_WEIGHT;
        }

        if (alignmentCount > 0) {
            const avgVx = alignment.x / alignmentCount;
            const avgVy = alignment.y / alignmentCount;
            steer.x += (avgVx - enemy.vx) * this.ALIGNMENT_WEIGHT;
            steer.y += (avgVy - enemy.vy) * this.ALIGNMENT_WEIGHT;
        }

        if (cohesionCount > 0) {
            const centerX = cohesion.x / cohesionCount;
            const centerY = cohesion.y / cohesionCount;
            steer.x += (centerX - enemy.x) * 0.01 * this.COHESION_WEIGHT;
            steer.y += (centerY - enemy.y) * 0.01 * this.COHESION_WEIGHT;
        }

        // Add seek toward target
        const toTarget = {
            x: target.x - enemy.x,
            y: target.y - enemy.y
        };
        const distToTarget = Math.hypot(toTarget.x, toTarget.y);
        // Guard against division by zero
        if (distToTarget > 0.001) {
            steer.x += (toTarget.x / distToTarget) * enemy.baseSpeed * 0.5;
            steer.y += (toTarget.y / distToTarget) * enemy.baseSpeed * 0.5;
        }

        // Clamp total steering force
        const steerMag = Math.hypot(steer.x, steer.y);
        if (steerMag > this.MAX_STEER_FORCE) {
            steer.x = (steer.x / steerMag) * this.MAX_STEER_FORCE;
            steer.y = (steer.y / steerMag) * this.MAX_STEER_FORCE;
        }

        return steer;
    }

    // ========================================
    // ELEMENTAL PHYSICS: Sector-specific modifiers
    // ========================================
    applyElementalPhysics(enemy, sector, dt) {
        const element = this.getElement(sector);

        switch (element) {
            case 'ICE':
                // Nebula Drag: 0.95 velocity multiplier
                enemy.vx *= 0.95;
                enemy.vy *= 0.95;
                break;

            case 'FIRE':
                // Aggression already handled in DNA, but add visual heat
                break;

            case 'NATURE':
                // Separation already handled in steering
                break;

            case 'WIND':
                // Random impulse jolts
                if (Math.random() < 0.02) { // 2% chance per frame
                    const joltStrength = 50;
                    enemy.vx += (Math.random() - 0.5) * joltStrength;
                    enemy.vy += (Math.random() - 0.5) * joltStrength;
                }
                break;
        }
    }

    // ========================================
    // UPDATE INSTANCE MATRIX: Position/Rotation/Scale
    // ========================================
    updateInstanceMatrix(enemy) {
        this.tempPosition.set(enemy.x, enemy.y, enemy.z);

        // Rotation based on velocity
        const angle = Math.atan2(enemy.vy, enemy.vx);
        this.tempQuaternion.setFromEuler(new THREE.Euler(0, 0, angle));

        // Scale from DNA
        const scale = enemy.dna?.scale || 1.0;
        this.tempScale.set(scale, scale, scale);

        this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);

        this.instancedMesh.setMatrixAt(enemy.slot, this.tempMatrix);
        this.glowMesh.setMatrixAt(enemy.slot, this.tempMatrix);
    }

    // ========================================
    // UPDATE INSTANCE COLOR: Type + emissive from DNA
    // ========================================
    updateInstanceColor(enemy, time) {
        const baseColor = new THREE.Color(enemy.color);
        const emissive = enemy.dna?.emissive || 0.3;

        // Pulse effect
        const pulse = 0.8 + 0.2 * Math.sin(time * 3 + enemy.slot);
        baseColor.multiplyScalar(pulse * (1 + emissive));

        this.instancedMesh.setColorAt(enemy.slot, baseColor);
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================
    getElement(sector) {
        if (sector <= 5) return 'ICE';
        if (sector <= 10) return 'FIRE';
        if (sector <= 15) return 'NATURE';
        return 'WIND';
    }

    getBaseHP(type) {
        const hpTable = {
            normal: 30,
            fast: 15,
            tank: 80,
            shooter: 40,
            reaper: 60,
            boss: 500
        };
        return hpTable[type] || 30;
    }

    getBaseSpeed(type) {
        const speedTable = {
            normal: 80,
            fast: 150,
            tank: 40,
            shooter: 60,
            reaper: 100,
            boss: 30
        };
        return speedTable[type] || 80;
    }

    getTypeColor(type) {
        const colorTable = {
            normal: 0xef4444,   // Red
            fast: 0xf97316,    // Orange
            tank: 0x8b5cf6,    // Purple
            shooter: 0x22d3ee, // Cyan
            reaper: 0x1e293b,  // Dark
            boss: 0xf59e0b    // Gold
        };
        return colorTable[type] || 0xef4444;
    }

    // ========================================
    // GET ACTIVE ENEMIES: For collision detection
    // ========================================
    getActiveEnemies() {
        return this.enemies.filter(e => e !== null && e.active);
    }

    // ========================================
    // TAKE DAMAGE: Reduce HP, kill if dead
    // ========================================
    takeDamage(enemy, amount) {
        if (!enemy || !enemy.active) return false;

        enemy.hp -= amount;

        if (enemy.hp <= 0) {
            this.kill(enemy);
            return true; // Died
        }

        return false; // Survived
    }

    // ========================================
    // DISPOSE: Cleanup
    // ========================================
    dispose() {
        this.scene.remove(this.instancedMesh);
        this.scene.remove(this.glowMesh);
        this.instancedMesh.geometry.dispose();
        this.instancedMesh.material.dispose();
        this.glowMesh.geometry.dispose();
        this.glowMesh.material.dispose();
        this.enemies = [];
        this.activeCount = 0;
    }
}
