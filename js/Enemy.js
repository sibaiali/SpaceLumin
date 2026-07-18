/**
 * Enemy.js - 3D Enemy Entities (VoidFauna)
 * Handles enemy mesh generation, AI movement, and types
 * Includes identity system with names and skin styles
 * Features telegraph state for fair gameplay
 */

// Enemy State Machine Constants
const ENEMY_STATE = {
    IDLE: 'IDLE',
    CHASE: 'CHASE',
    TELEGRAPH: 'TELEGRAPH',
    ATTACK: 'ATTACK'
};

// Telegraph duration in seconds (0.5s = 30 frames at 60fps)
const TELEGRAPH_DURATION = 0.5;

// Name generation syllables
const ENEMY_SYLLABLES = ['Zor', 'Kel', 'Vax', 'Nyx', 'Qor', 'Bel', 'Tyr', 'Mox', 'Xen', 'Pyx'];
const ENEMY_SUFFIXES = ['ax', 'ix', 'on', 'ar', 'us', 'el', 'or', 'im', 'an', 'is'];

// Type descriptors
const ENEMY_DESCRIPTORS = {
    normal: ['Space Cotton', 'Void Wisp', 'Nebula Puff'],
    fast: ['Void Dart', 'Quantum Spark', 'Phase Runner'],
    tanky: ['Nebula Giant', 'Cosmic Boulder', 'Void Guardian'],
    shooter: ['Plasma Turret', 'Star Shooter', 'Ion Blaster'],
    reaper: ['Quantum Wraith', 'Soul Harvester', 'Death Specter'],
    boss: ['Cosmic Overlord', 'Sector Lord', 'Void Emperor']
};

// Skin styles
const SKIN_STYLES = ['cotton', 'lizard'];

class Enemy {
    constructor(scene, x, y, sector, type = 'normal') {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.type = type;
        this.sector = sector;
        this.spawnTime = performance.now() / 1000;

        // Generate identity
        this.generateIdentity();

        // Spawn animation
        this.spawning = (type === 'reaper');
        this.spawnTimer = 1.5;

        // Properties based on type
        this.setTypeProperties();

        // Create mesh
        this.createMesh();

        // Shooter specific
        this.nextShot = 0;

        // Boss specific
        this.nextSummon = 0;

        // State Machine for telegraphing (QA Fairness Fix)
        this.state = ENEMY_STATE.CHASE;
        this.telegraphTimer = 0;
        this.attackRange = this.type === 'reaper' ? 60 : 40; // Distance to trigger attack
        this.originalColor = null; // Store original material color for telegraph flash
        this.attackVelocity = { x: 0, y: 0 }; // Store attack direction
    }

    generateIdentity() {
        // Generate name from syllables
        const syl1 = ENEMY_SYLLABLES[Math.floor(Math.random() * ENEMY_SYLLABLES.length)];
        const syl2 = ENEMY_SUFFIXES[Math.floor(Math.random() * ENEMY_SUFFIXES.length)];
        this.name = syl1 + syl2;

        // Get type descriptor
        const descriptors = ENEMY_DESCRIPTORS[this.type] || ENEMY_DESCRIPTORS.normal;
        this.descriptor = descriptors[Math.floor(Math.random() * descriptors.length)];

        // Assign skin style
        this.skinStyle = SKIN_STYLES[Math.floor(Math.random() * SKIN_STYLES.length)];

        // Full display name
        this.displayName = `${this.name} the ${this.descriptor}`;
    }

    setTypeProperties() {
        switch (this.type) {
            case 'boss':
                this.r = 32;
                this.hp = 40;
                this.hitsToDie = 10;
                this.baseSpeed = 0.65;
                break;
            case 'reaper':
                this.r = 26;
                this.hp = 10;
                this.hitsToDie = 10;
                this.baseSpeed = 1.4;
                break;
            case 'tanky':
                this.r = 22;
                this.hp = 6;
                this.hitsToDie = 6;
                this.baseSpeed = 0.6;
                break;
            case 'fast':
                this.r = 13;
                this.hp = 2;
                this.hitsToDie = 2;
                this.baseSpeed = 1.7;
                break;
            case 'shooter':
                this.r = 16;
                this.hp = 3;
                this.hitsToDie = 3;
                this.baseSpeed = 0.8;
                break;
            default: // normal
                this.r = 16;
                this.hp = 3;
                this.hitsToDie = 3;
                this.baseSpeed = 1.0;
        }

        // Apply difficulty scaling from DifficultySystem
        if (typeof difficultySystem !== 'undefined') {
            const diffParams = difficultySystem.getParams();

            // Scale HP with difficulty (capped at 120x)
            this.hp = Math.round(this.hp * diffParams.enemyHPMult);
            this.hitsToDie = Math.max(this.hitsToDie, Math.ceil(this.hp / 3));

            // Scale speed with difficulty
            this.baseSpeed *= diffParams.enemySpeedMult;

            // Store unfair mechanics flags
            this.microDodge = diffParams.microDodge;
            this.homingShots = diffParams.homingShots;
            this.machineRealm = diffParams.machineRealm;
        }
    }

    createMesh() {
        let geometry, material;

        switch (this.type) {
            case 'boss':
                // Large menacing sphere - PBR metallic with clearcoat
                geometry = new THREE.IcosahedronGeometry(this.r, 1);
                material = new THREE.MeshPhysicalMaterial({
                    color: 0xea580c,
                    emissive: 0xf97316,
                    emissiveIntensity: 0.5,
                    metalness: 0.8,
                    roughness: 0.2,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    flatShading: true
                });
                break;

            case 'reaper':
                // Ethereal ghost - PBR with high clearcoat for glassy look
                geometry = new THREE.OctahedronGeometry(this.r, 0);
                material = new THREE.MeshPhysicalMaterial({
                    color: 0x581c87,
                    emissive: 0xec4899,
                    emissiveIntensity: 0.6,
                    metalness: 0.9,
                    roughness: 0.1,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.05,
                    transparent: true,
                    opacity: 0.85
                });
                break;

            case 'tanky':
                // Dense crystalline structure - OctahedronGeometry for solid/defensive look
                geometry = new THREE.OctahedronGeometry(this.r * 1.2, 0);
                material = new THREE.MeshStandardMaterial({
                    color: 0x60a5fa,
                    emissive: 0x2563eb,
                    emissiveIntensity: 0.3,
                    roughness: 0.3,
                    metalness: 0.7,
                    flatShading: true
                });
                break;

            case 'fast':
                // Sharp tetrahedron - fast/aggressive look
                geometry = new THREE.TetrahedronGeometry(this.r * 1.2, 0);
                material = new THREE.MeshStandardMaterial({
                    color: 0xf87171,
                    emissive: 0xef4444,
                    emissiveIntensity: 0.4,
                    roughness: 0.2,
                    metalness: 0.8,
                    flatShading: true
                });
                break;

            case 'shooter':
                // Angular with visible "turret"
                geometry = new THREE.DodecahedronGeometry(this.r, 0);
                material = new THREE.MeshPhongMaterial({
                    color: 0x38bdf8,
                    emissive: 0x0284c7,
                    emissiveIntensity: 0.3,
                    shininess: 60
                });
                break;

            default: // normal
                geometry = new THREE.SphereGeometry(this.r, 12, 12);
                material = new THREE.MeshPhongMaterial({
                    color: 0xfef3c7,
                    emissive: 0xf87171,
                    emissiveIntensity: 0.2,
                    shininess: 40
                });
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x, this.y, 0);

        // Add eye for non-boss/reaper
        if (!['boss', 'reaper'].includes(this.type)) {
            const eyeGeometry = new THREE.SphereGeometry(this.r * 0.25, 8, 8);
            const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x020617 });
            const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye.position.set(0, 0, this.r * 0.8);
            this.mesh.add(eye);

            // Eye highlight
            const highlightGeometry = new THREE.SphereGeometry(this.r * 0.1, 8, 8);
            const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xf9fafb });
            const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
            highlight.position.set(-this.r * 0.08, this.r * 0.05, this.r * 0.9);
            this.mesh.add(highlight);
        }

        // Spawn effect ring for reapers
        if (this.type === 'reaper') {
            const ringGeometry = new THREE.RingGeometry(this.r * 1.5, this.r * 2, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0xec4899,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            this.spawnRing = new THREE.Mesh(ringGeometry, ringMaterial);
            this.spawnRing.rotation.x = Math.PI / 2;
            this.scene.add(this.spawnRing);
        }

        this.scene.add(this.mesh);
    }

    update(dt, playerPos, decoyPos, frozen, time, data) {
        // Handle spawn animation
        if (this.spawning) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawning = false;
                if (this.spawnRing) {
                    this.scene.remove(this.spawnRing);
                    this.spawnRing.geometry.dispose();
                    this.spawnRing.material.dispose();
                    this.spawnRing = null;
                }
            } else {
                // Animate spawn ring
                if (this.spawnRing) {
                    const scale = 1.5 - this.spawnTimer;
                    this.spawnRing.scale.setScalar(scale);
                    this.spawnRing.material.opacity = this.spawnTimer / 1.5;
                    this.spawnRing.position.set(this.x, this.y, 0);
                }
                return null; // No bullets during spawn
            }
        }

        if (frozen) {
            // Frozen state - enemies float and bob gently
            const floatBob = Math.sin(time * 2 + this.spawnTime * 10) * 8;
            this.mesh.position.z = 15 + floatBob;

            // Slow rotation
            this.mesh.rotation.y += dt * 0.3;
            this.mesh.rotation.x += dt * 0.2;

            // Tint towards frozen blue
            if (this.mesh.material.emissive) {
                const frozenColor = new THREE.Color(0x88ccff);
                this.mesh.material.emissive.lerp(frozenColor, dt * 2);
            }

            return null;
        }

        // Reset emissive when unfrozen
        if (this._wasFrozen && !frozen) {
            this._wasFrozen = false;
            // Restore original color if we have it stored
            if (this.originalColor && this.mesh.material.color) {
                this.mesh.material.color.copy(this.originalColor);
            }
        }
        this._wasFrozen = frozen;

        // Target position (decoy if active, else player)
        const target = decoyPos || playerPos;

        // Calculate direction and distance
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;

        // Movement speed
        let speed = (90 + this.sector * 1.5) * this.baseSpeed;

        // ========================================
        // STATE MACHINE (QA Fairness - Telegraphing)
        // ========================================

        switch (this.state) {
            case ENEMY_STATE.CHASE:
                // Move toward target
                this.x += (dx / dist) * speed * dt;
                this.y += (dy / dist) * speed * dt;

                // Check if within attack range (for melee types: reaper, fast, normal)
                if (dist < this.attackRange && ['reaper', 'fast', 'normal', 'tanky'].includes(this.type)) {
                    // Transition to TELEGRAPH state
                    this.state = ENEMY_STATE.TELEGRAPH;
                    this.telegraphTimer = TELEGRAPH_DURATION;

                    // Store attack direction
                    this.attackVelocity.x = (dx / dist) * speed * 3; // 3x speed burst
                    this.attackVelocity.y = (dy / dist) * speed * 3;

                    // Store original color for restoration
                    if (this.mesh.material.color && !this.originalColor) {
                        this.originalColor = this.mesh.material.color.clone();
                    }

                    // Play charge_hiss sound
                    if (typeof window.game !== 'undefined' && window.game.audio) {
                        window.game.audio.playSound('charge_hiss');
                    }
                }
                break;

            case ENEMY_STATE.TELEGRAPH:
                // Don't move during telegraph - enemy is "winding up"
                this.telegraphTimer -= dt;

                // Visual: Pulse/vibrate with pure WHITE (#FFFFFF)
                const pulseIntensity = Math.sin(time * 30) * 0.5 + 0.5; // Fast pulse
                const vibrate = Math.sin(time * 60) * 2; // Vibration offset

                // Override color to white
                if (this.mesh.material.color) {
                    this.mesh.material.color.setHex(0xFFFFFF);
                }
                if (this.mesh.material.emissive) {
                    this.mesh.material.emissive.setHex(0xFFFFFF);
                    this.mesh.material.emissiveIntensity = 0.5 + pulseIntensity * 0.5;
                }

                // Apply vibration
                this.mesh.position.x = this.x + vibrate;
                this.mesh.position.y = this.y + vibrate * 0.7;

                // Transition to ATTACK when timer expires
                if (this.telegraphTimer <= 0) {
                    this.state = ENEMY_STATE.ATTACK;

                    // Restore original color
                    if (this.originalColor && this.mesh.material.color) {
                        this.mesh.material.color.copy(this.originalColor);
                    }
                    if (this.mesh.material.emissive && this.originalColor) {
                        // Reset emissive to a tinted version
                        this.mesh.material.emissive.copy(this.originalColor).multiplyScalar(0.3);
                        this.mesh.material.emissiveIntensity = 0.3;
                    }
                }
                break;

            case ENEMY_STATE.ATTACK:
                // Apply velocity thrust (lunge attack)
                this.x += this.attackVelocity.x * dt;
                this.y += this.attackVelocity.y * dt;

                // Decay attack velocity (frame-rate independent)
                // Formula: velocity *= decay^dt where decay = 0.001 means 99.9% decay per second
                const attackDecay = Math.pow(0.001, dt);
                this.attackVelocity.x *= attackDecay;
                this.attackVelocity.y *= attackDecay;

                // Return to CHASE when thrust is exhausted
                const thrustMag = Math.hypot(this.attackVelocity.x, this.attackVelocity.y);
                if (thrustMag < speed * 0.3) {
                    this.state = ENEMY_STATE.CHASE;
                }
                break;

            default:
                this.state = ENEMY_STATE.CHASE;
        }

        // Update mesh position (if not in telegraph with vibration override)
        if (this.state !== ENEMY_STATE.TELEGRAPH) {
            this.mesh.position.set(this.x, this.y, 0);
        }

        // Animate
        const bob = Math.sin(time * 4 + this.spawnTime) * 3;
        this.mesh.position.z = bob;
        this.mesh.rotation.y += dt * (this.type === 'fast' ? 3 : 1);
        this.mesh.rotation.z = Math.sin(time * 2) * 0.1;

        // Type-specific behavior (shooter - ranged attack)
        let bullet = null;

        if (this.type === 'shooter') {
            if (!this.nextShot) this.nextShot = time + 1.2 + Math.random() * 1.2;
            if (time >= this.nextShot) {
                this.nextShot = time + 1.5 + Math.random() * 1.3;
                // Create bullet
                const bx = dx / dist;
                const by = dy / dist;
                bullet = {
                    x: this.x,
                    y: this.y,
                    vx: bx * 220,
                    vy: by * 220,
                    r: 4,
                    life: 3
                };
            }
        }

        if (this.type === 'boss' && data) {
            if (!this.nextSummon) this.nextSummon = time + 3;
            if (time >= this.nextSummon) {
                this.nextSummon = time + 3.5 + Math.random() * 1.5;
                // Signal to spawn minion
                const angle = Math.random() * Math.PI * 2;
                return {
                    spawnMinion: true,
                    x: this.x + Math.cos(angle) * 40,
                    y: this.y + Math.sin(angle) * 40
                };
            }
        }

        return bullet;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.hitsToDie = Math.max(0, this.hitsToDie - 1);

        // Flash effect
        const originalEmissive = this.mesh.material.emissiveIntensity;
        this.mesh.material.emissiveIntensity = 1;
        setTimeout(() => {
            if (this.mesh && this.mesh.material) {
                this.mesh.material.emissiveIntensity = originalEmissive;
            }
        }, 100);

        // Check death condition
        if (this.type === 'boss') {
            return this.hitsToDie <= 0;
        }
        return this.hp <= 0;
    }

    dispose() {
        this.scene.remove(this.mesh);
        if (this.spawnRing) {
            this.scene.remove(this.spawnRing);
            this.spawnRing.geometry.dispose();
            this.spawnRing.material.dispose();
        }

        this.mesh.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}
