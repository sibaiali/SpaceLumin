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

        // Velocity for Boids flocking & elemental physics
        this.vx = 0;
        this.vy = 0;

        // Generate evolved DNA from EnemyDNA genetic algorithm
        this.dna = (typeof enemyDNA !== 'undefined')
            ? enemyDNA.spawnNextGenDNA(sector)
            : { speed: 1.0, aggro: 1.0, scale: 1.0, emissive: 0.3, spawnTime: performance.now(), survivalTime: 0 };

        // Properties based on type + DNA
        this.setTypeProperties();

        if (typeof enemyDNA !== 'undefined') {
            enemyDNA.registerEnemy(this);
        }

        // Create mesh
        this.createMesh();

        // Shooter specific
        this.nextShot = 0;

        // Boss specific
        this.nextSummon = 0;

        // State Machine for telegraphing (QA Fairness Fix)
        this.state = ENEMY_STATE.CHASE;
        this.telegraphTimer = 0;
        const baseRange = this.type === 'reaper' ? 60 : 40;
        this.attackRange = baseRange * Math.min(1.4, Math.max(0.8, (this.dna?.aggro || 1.0) * 0.85));
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

        // Apply DNA gene modifiers (speed & scale for non-bosses)
        if (this.dna && this.type !== 'boss') {
            this.baseSpeed *= Math.max(0.75, Math.min(1.35, this.dna.speed || 1.0));
            this.r = Math.round(this.r * Math.max(0.85, Math.min(1.2, this.dna.scale || 1.0)));
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
        this.maxHp = this.hp;
    }

    createMesh() {
        let geometry, material;
        this.orbitRing1 = null;
        this.orbitRing2 = null;

        switch (this.type) {
            case 'boss': {
                // Planetary Leviathan Dreadnought: Armored reactor core + dual counter-rotating weapon rings + 6 solar lances
                geometry = new THREE.IcosahedronGeometry(this.r * 0.88, 1);
                material = new THREE.MeshPhysicalMaterial({
                    color: 0xea580c,
                    emissive: 0xf97316,
                    emissiveIntensity: 0.55,
                    metalness: 0.85,
                    roughness: 0.18,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    flatShading: true
                });
                this.mesh = new THREE.Mesh(geometry, material);

                const ringMat1 = new THREE.MeshStandardMaterial({
                    color: 0xfbbf24,
                    emissive: 0xea580c,
                    emissiveIntensity: 0.65,
                    metalness: 0.9,
                    roughness: 0.15
                });
                this.orbitRing1 = new THREE.Mesh(
                    new THREE.TorusGeometry(this.r * 1.32, 2.2, 8, 32),
                    ringMat1
                );
                // Add 6 radiating dreadnought spikes around outer ring
                const spikeGeo = new THREE.ConeGeometry(4.2, 15, 5);
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const spike = new THREE.Mesh(spikeGeo, ringMat1);
                    spike.position.set(Math.cos(angle) * (this.r * 1.45), Math.sin(angle) * (this.r * 1.45), 0);
                    spike.rotation.z = angle - Math.PI / 2;
                    this.orbitRing1.add(spike);
                }
                this.mesh.add(this.orbitRing1);

                const ringMat2 = new THREE.MeshBasicMaterial({
                    color: 0xfef08a,
                    transparent: true,
                    opacity: 0.85,
                    wireframe: true
                });
                this.orbitRing2 = new THREE.Mesh(
                    new THREE.TorusGeometry(this.r * 1.1, 1.4, 6, 24),
                    ringMat2
                );
                this.orbitRing2.rotation.x = Math.PI / 3;
                this.mesh.add(this.orbitRing2);
                break;
            }

            case 'reaper': {
                // Quantum Wraith: Elongated obsidian-violet void crystal + twin intersecting plasma scythe rings
                geometry = new THREE.OctahedronGeometry(this.r * 0.92, 0);
                geometry.scale(0.82, 1.28, 0.82);
                material = new THREE.MeshPhysicalMaterial({
                    color: 0x4c1d95,
                    emissive: 0xec4899,
                    emissiveIntensity: 0.65,
                    metalness: 0.9,
                    roughness: 0.1,
                    clearcoat: 1.0,
                    transparent: true,
                    opacity: 0.9
                });
                this.mesh = new THREE.Mesh(geometry, material);

                const scytheMat = new THREE.MeshBasicMaterial({
                    color: 0xf472b6,
                    transparent: true,
                    opacity: 0.85,
                    blending: THREE.AdditiveBlending
                });
                this.orbitRing1 = new THREE.Mesh(
                    new THREE.TorusGeometry(this.r * 1.18, 1.3, 6, 24),
                    scytheMat
                );
                this.orbitRing1.rotation.x = Math.PI / 4;
                this.mesh.add(this.orbitRing1);

                this.orbitRing2 = new THREE.Mesh(
                    new THREE.TorusGeometry(this.r * 1.18, 1.3, 6, 24),
                    scytheMat
                );
                this.orbitRing2.rotation.y = Math.PI / 4;
                this.mesh.add(this.orbitRing2);
                break;
            }

            case 'tanky': {
                // Aegis Bastion Juggernaut: Armored sapphire core + 4 orbiting heavy shield plates
                geometry = new THREE.DodecahedronGeometry(this.r * 0.95, 0);
                material = new THREE.MeshStandardMaterial({
                    color: 0x3b82f6,
                    emissive: 0x1d4ed8,
                    emissiveIntensity: 0.38,
                    roughness: 0.25,
                    metalness: 0.85,
                    flatShading: true
                });
                this.mesh = new THREE.Mesh(geometry, material);

                this.orbitRing1 = new THREE.Group();
                const plateGeo = new THREE.BoxGeometry(this.r * 0.72, 3.8, this.r * 0.65);
                const plateMat = new THREE.MeshStandardMaterial({
                    color: 0x93c5fd,
                    emissive: 0x38bdf8,
                    emissiveIntensity: 0.45,
                    metalness: 0.9,
                    roughness: 0.15
                });
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    const plate = new THREE.Mesh(plateGeo, plateMat);
                    plate.position.set(Math.cos(angle) * (this.r * 1.18), Math.sin(angle) * (this.r * 1.18), 0);
                    plate.rotation.z = angle + Math.PI / 2;
                    this.orbitRing1.add(plate);
                }
                this.mesh.add(this.orbitRing1);
                break;
            }

            case 'fast': {
                // Razor Viper Interceptor: Sleek forward-pointing strike dart + swept razor wings + thruster core
                geometry = new THREE.ConeGeometry(this.r * 0.75, this.r * 2.2, 5);
                geometry.scale(0.85, 1.0, 0.45);
                material = new THREE.MeshStandardMaterial({
                    color: 0xf87171,
                    emissive: 0xdc2626,
                    emissiveIntensity: 0.5,
                    roughness: 0.2,
                    metalness: 0.85,
                    flatShading: true
                });
                this.mesh = new THREE.Mesh(geometry, material);

                const wingGeo = new THREE.BoxGeometry(this.r * 2.3, 2.2, 4.5);
                const wingMat = new THREE.MeshStandardMaterial({
                    color: 0xfca5a5,
                    emissive: 0xef4444,
                    emissiveIntensity: 0.4,
                    metalness: 0.8,
                    roughness: 0.2
                });
                const wings = new THREE.Mesh(wingGeo, wingMat);
                wings.position.set(0, -this.r * 0.3, 0);
                this.mesh.add(wings);

                const thrusterGeo = new THREE.SphereGeometry(this.r * 0.35, 8, 8);
                const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
                const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
                thruster.position.set(0, -this.r * 1.05, 0);
                this.mesh.add(thruster);
                break;
            }

            case 'shooter': {
                // Orbital Artillery Platform: Cyan gunship hub + 4 quad-cross plasma cannon barrels + gyro ring
                geometry = new THREE.OctahedronGeometry(this.r * 0.88, 1);
                material = new THREE.MeshStandardMaterial({
                    color: 0x0ea5e9,
                    emissive: 0x0284c7,
                    emissiveIntensity: 0.4,
                    metalness: 0.8,
                    roughness: 0.22,
                    flatShading: true
                });
                this.mesh = new THREE.Mesh(geometry, material);

                this.orbitRing1 = new THREE.Group();
                const barrelGeo = new THREE.CylinderGeometry(1.6, 2.2, this.r * 1.15, 6);
                const barrelMat = new THREE.MeshStandardMaterial({
                    color: 0xe0f2fe,
                    emissive: 0x38bdf8,
                    emissiveIntensity: 0.5,
                    metalness: 0.9,
                    roughness: 0.15
                });
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
                    barrel.position.set(Math.cos(angle) * (this.r * 0.95), Math.sin(angle) * (this.r * 0.95), 0);
                    barrel.rotation.z = angle - Math.PI / 2;
                    this.orbitRing1.add(barrel);
                }
                const gyroRing = new THREE.Mesh(
                    new THREE.TorusGeometry(this.r * 1.15, 1.1, 6, 24),
                    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
                );
                this.orbitRing1.add(gyroRing);
                this.mesh.add(this.orbitRing1);
                break;
            }

            default: { // normal (Void Seeker Bio-Cybernetic Drone)
                geometry = new THREE.OctahedronGeometry(this.r * 0.92, 1);
                geometry.scale(1.0, 1.0, 0.68);
                material = new THREE.MeshStandardMaterial({
                    color: 0xfde68a,
                    emissive: 0xf97316,
                    emissiveIntensity: 0.35,
                    metalness: 0.75,
                    roughness: 0.25,
                    flatShading: true
                });
                this.mesh = new THREE.Mesh(geometry, material);

                // Orbiting stabilizer halo with twin side fins
                this.orbitRing1 = new THREE.Mesh(
                    new THREE.TorusGeometry(this.r * 1.12, 1.0, 6, 20),
                    new THREE.MeshBasicMaterial({
                        color: 0xfb923c,
                        transparent: true,
                        opacity: 0.7
                    })
                );
                this.mesh.add(this.orbitRing1);
            }
        }

        this.mesh.position.set(this.x, this.y, 0);

        // Glowing Cybernetic Optic Core facing the camera (+Z)
        const eyeColor = this.type === 'shooter' ? 0x00ffff
            : this.type === 'tanky' ? 0x60a5fa
            : this.type === 'reaper' ? 0xf43f5e
            : 0xef4444;
        const eyeGeometry = new THREE.OctahedronGeometry(this.r * 0.28, 0);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: eyeColor });
        const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        eye.position.set(0, 0, this.r * 0.65);
        this.mesh.add(eye);

        const pupilGeo = new THREE.SphereGeometry(this.r * 0.13, 8, 8);
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupil = new THREE.Mesh(pupilGeo, pupilMat);
        pupil.position.set(0, 0, this.r * 0.82);
        this.mesh.add(pupil);

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

    update(dt, playerPos, decoyPos, frozen, time, data, neighbors = [], directorSpeedMult = 1.0) {
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

        // Movement speed (modulated by Director)
        let speed = (90 + this.sector * 1.5) * this.baseSpeed * directorSpeedMult;

        // Nature Sector regeneration
        if (typeof difficultySystem !== 'undefined') {
            const p = difficultySystem.getParams();
            if (p && p.natureRegen > 0 && this.hp < this.maxHp) {
                this.hp = Math.min(this.maxHp, this.hp + p.natureRegen * dt);
            }
        }

        // ========================================
        // STATE MACHINE (QA Fairness - Telegraphing + Boids Flocking)
        // ========================================

        switch (this.state) {
            case ENEMY_STATE.CHASE: {
                // Base pursuit vector
                let dirX = dx / dist;
                let dirY = dy / dist;

                // Boids Separation & Cohesion so enemies form intelligent flocks instead of overlapping
                if (neighbors && neighbors.length > 1 && this.type !== 'boss') {
                    const sepDist = (typeof difficultySystem !== 'undefined')
                        ? difficultySystem.getSeparationDistance()
                        : 48;
                    let sepX = 0, sepY = 0, cohX = 0, cohY = 0, count = 0;

                    for (let i = 0; i < neighbors.length; i++) {
                        const other = neighbors[i];
                        if (other === this) continue;
                        const ndx = this.x - other.x;
                        const ndy = this.y - other.y;
                        const nd = Math.hypot(ndx, ndy);
                        if (nd > 0 && nd < sepDist) {
                            sepX += (ndx / nd) * ((sepDist - nd) / sepDist);
                            sepY += (ndy / nd) * ((sepDist - nd) / sepDist);
                        }
                        if (nd > 0 && nd < 140) {
                            cohX += other.x;
                            cohY += other.y;
                            count++;
                        }
                    }

                    dirX += sepX * 0.55;
                    dirY += sepY * 0.55;
                    if (count > 0) {
                        const cx = (cohX / count) - this.x;
                        const cy = (cohY / count) - this.y;
                        const cd = Math.hypot(cx, cy) || 1;
                        dirX += (cx / cd) * 0.12;
                        dirY += (cy / cd) * 0.12;
                    }
                    const norm = Math.hypot(dirX, dirY) || 1;
                    dirX /= norm;
                    dirY /= norm;
                }

                const stepVel = { x: dirX * speed, y: dirY * speed };
                if (typeof difficultySystem !== 'undefined') {
                    const jolt = difficultySystem.applyElementalPhysics(stepVel, 'enemy');
                    if (jolt) {
                        stepVel.x += jolt.x;
                        stepVel.y += jolt.y;
                    }
                }

                this.vx = stepVel.x;
                this.vy = stepVel.y;
                this.x += this.vx * dt;
                this.y += this.vy * dt;

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
            }

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

        // Animate articulated sub-structures & orientation
        const bob = Math.sin(time * 4 + this.spawnTime) * 3;
        this.mesh.position.z = bob;
        if (this.type === 'fast') {
            const heading = Math.atan2(this.vy || dy, this.vx || dx);
            this.mesh.rotation.z = heading - Math.PI / 2;
            this.mesh.rotation.y = Math.sin(time * 8) * 0.25;
        } else {
            this.mesh.rotation.y += dt * 0.9;
            this.mesh.rotation.z = Math.sin(time * 2) * 0.1;
        }
        if (this.orbitRing1) {
            this.orbitRing1.rotation.z += dt * (this.type === 'reaper' ? 3.2 : 1.8);
        }
        if (this.orbitRing2) {
            this.orbitRing2.rotation.z -= dt * 2.4;
            this.orbitRing2.rotation.x += dt * 1.1;
        }

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

        // Micro-dodge at high difficulty (Sector 8+)
        if (this.microDodge && this.hp > 0 && this.type !== 'boss' && Math.random() < 0.35) {
            const dodgeAngle = Math.random() * Math.PI * 2;
            this.x += Math.cos(dodgeAngle) * 18;
            this.y += Math.sin(dodgeAngle) * 18;
        }

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
