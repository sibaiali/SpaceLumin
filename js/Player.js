/**
 * Player.js - 3D Player Ship (Luminaris)
 * Handles player mesh, movement, shield, decoy, and auto-fire
 */

// ========================================
// HULL DATABASE (Standardized per Architecture Doc)
// Keys match IDs for Save System compatibility
// ========================================
const HullDatabase = {
    PHOTON_SCOUT: {
        id: 'PHOTON_SCOUT',
        name: 'Photon Scout',
        description: 'High Speed, Low Armor - Perfect for dodging',
        stats: {
            speed: 1.5,      // 50% faster movement
            armor: 0.6,      // 40% less damage resistance
            fireRate: 1.2,   // 20% faster shooting
            special: null
        },
        mesh: {
            bodyColor: 0x22d3ee,
            accentColor: 0x38bdf8,
            engineGlow: 0x00ffff
        }
    },
    NEUTRON_TANK: {
        id: 'NEUTRON_TANK',
        name: 'Neutron Tank',
        description: 'High Armor, Low Speed - Built to withstand',
        stats: {
            speed: 0.7,      // 30% slower movement
            armor: 1.8,      // 80% more damage resistance
            fireRate: 0.85,  // 15% slower shooting
            special: null
        },
        mesh: {
            bodyColor: 0x60a5fa,
            accentColor: 0x3b82f6,
            engineGlow: 0x2563eb
        }
    },
    TACHYON_GLITCH: {
        id: 'TACHYON_GLITCH',
        name: 'Tachyon Glitch',
        description: 'Teleport Ability - Phase through danger',
        stats: {
            speed: 1.0,      // Normal speed
            armor: 0.9,      // Slightly less armor
            fireRate: 1.0,   // Normal fire rate
            special: 'teleport'  // Special ability: short-range teleport
        },
        mesh: {
            bodyColor: 0xa855f7,
            accentColor: 0xc084fc,
            engineGlow: 0xe879f9
        },
        teleport: {
            range: 150,       // Max teleport distance
            cooldown: 3.0,    // Cooldown in seconds
            invincibility: 0.3 // Brief invincibility after teleport
        }
    }
};

// Default hull for new players
const DEFAULT_HULL = 'PHOTON_SCOUT';

// ========================================
// MOBILE TOUCH OPTIMIZATION CONSTANTS
// ========================================
const MOBILE_SENSITIVITY = 0.2;       // Input damping (0.2 = 20% of raw input for high-DPI screens)
const TOUCH_DEADZONE = 5;             // 5px deadzone to prevent shaking
const POSITION_LERP_SPEED = 4.0;      // Lerp factor for position smoothing
const ROTATION_SLERP_SPEED = 3.0;     // Slerp factor for rotation smoothing
const DRAG_PER_SECOND = 0.05;         // Target velocity remaining after 1 second (95% drag)

class Player {
    constructor(scene, world3D) {
        this.scene = scene;
        this.world3D = world3D;

        // Position and movement
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.prevX = 0;
        this.prevY = 0;
        this.radius = 16;

        // Smoothed state for mobile (lerp/slerp targets)
        this.smoothedPosition = new THREE.Vector3(0, 0, 0);
        this.targetPosition = new THREE.Vector3(0, 0, 0);
        this.smoothedQuaternion = new THREE.Quaternion();
        this.targetQuaternion = new THREE.Quaternion();

        // Acceleration for delta-timed physics
        this.ax = 0;
        this.ay = 0;

        // Combat
        this.combo = 1;
        this.comboUntil = 0;
        this.autoFire = false;
        this.nextShotTime = 0;

        // Decoy
        this.decoyLast = -10;
        this.decoyCooldown = 3;
        this.decoyActive = false;
        this.decoyPos = { x: 0, y: 0 };
        this.decoyUntil = 0;
        this.decoyMesh = null;

        // Shield
        this.shieldActive = false;
        this.shieldUntil = 0;

        // Knockback
        this.knockVX = 0;
        this.knockVY = 0;

        // Trail
        this.trail = [];
        this.trailMeshes = [];

        // Ability Pulse (visual feedback for gestural abilities)
        this.abilityPulseActive = false;
        this.abilityPulseUntil = 0;
        this.abilityPulseColor = 0x22d3ee;

        // Create meshes
        this.createShipMesh();
        this.createShieldMesh();
        this.createDecoyMesh();
        this.createTrailSystem();
        this.createAbilityPulseMesh();
    }

    createShipMesh() {
        // Main ship body - sleek triangular design
        const bodyGeometry = new THREE.ConeGeometry(12, 28, 4);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0xe5e7eb,
            emissive: 0x22d3ee,
            emissiveIntensity: 0.2,
            shininess: 100,
            flatShading: false
        });

        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.rotation.z = Math.PI;

        // Engine glow
        const engineGeometry = new THREE.SphereGeometry(4, 16, 16);
        const engineMaterial = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.9
        });

        this.engine = new THREE.Mesh(engineGeometry, engineMaterial);
        this.engine.position.set(0, 10, 0);
        this.mesh.add(this.engine);

        // Wing accents
        const wingGeometry = new THREE.BoxGeometry(20, 2, 6);
        const wingMaterial = new THREE.MeshPhongMaterial({
            color: 0x38bdf8,
            emissive: 0x0ac8b9,
            emissiveIntensity: 0.3
        });

        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-8, 4, 0);
        leftWing.rotation.z = 0.3;
        this.mesh.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(8, 4, 0);
        rightWing.rotation.z = -0.3;
        this.mesh.add(rightWing);

        // Point light for glow effect
        this.glowLight = new THREE.PointLight(0x22d3ee, 0.8, 60);
        this.mesh.add(this.glowLight);

        this.scene.add(this.mesh);
    }

    createShieldMesh() {
        const geometry = new THREE.SphereGeometry(30, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0,
            wireframe: false,
            side: THREE.DoubleSide
        });

        this.shieldMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.shieldMesh);

        // Shield wireframe overlay
        const wireGeometry = new THREE.SphereGeometry(31, 16, 16);
        const wireMaterial = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0,
            wireframe: true
        });

        this.shieldWire = new THREE.Mesh(wireGeometry, wireMaterial);
        this.scene.add(this.shieldWire);
    }

    createDecoyMesh() {
        const geometry = new THREE.TorusGeometry(25, 3, 8, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0
        });

        this.decoyMesh = new THREE.Mesh(geometry, material);
        this.decoyMesh.rotation.x = Math.PI / 2;
        this.scene.add(this.decoyMesh);
    }

    createTrailSystem() {
        // Pre-create trail particles
        const trailGeometry = new THREE.SphereGeometry(3, 8, 8);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.6
        });

        for (let i = 0; i < 20; i++) {
            const trail = new THREE.Mesh(trailGeometry.clone(), trailMaterial.clone());
            trail.visible = false;
            this.scene.add(trail);
            this.trailMeshes.push(trail);
        }
    }

    // ========================================
    // ABILITY PULSE: Glowing ring for gestural feedback
    // ========================================
    createAbilityPulseMesh() {
        const geometry = new THREE.RingGeometry(25, 35, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        this.abilityPulseMesh = new THREE.Mesh(geometry, material);
        this.abilityPulseMesh.rotation.x = Math.PI / 2; // Flat ring
        this.scene.add(this.abilityPulseMesh);
    }

    // Trigger ability pulse (called when gestural ability activates)
    triggerAbilityPulse(type, time) {
        this.abilityPulseActive = true;
        this.abilityPulseUntil = time + 0.5; // 0.5s pulse duration

        // Color based on ability type
        if (type === 'freeze') {
            this.abilityPulseColor = 0x88ddff; // Ice blue
        } else if (type === 'aura') {
            this.abilityPulseColor = 0xa855f7; // Purple
        } else {
            this.abilityPulseColor = 0x22d3ee; // Cyan
        }

        this.abilityPulseMesh.material.color.setHex(this.abilityPulseColor);
        this.abilityPulseMesh.material.opacity = 0.8;
        this.abilityPulseMesh.scale.setScalar(1);
    }

    update(dt, time, targetX, targetY, jerkFactor = 1.0) {
        // ========================================
        // MOBILE TOUCH OPTIMIZATION
        // ========================================

        // Calculate delta to target
        const deltaX = targetX - this.x;
        const deltaY = targetY - this.y;
        const distanceToTarget = Math.hypot(deltaX, deltaY);

        // TOUCH DEADZONE: If finger is within deadzone, zero acceleration
        // Prevents "shaking" when finger is held still on mobile glass
        if (distanceToTarget < TOUCH_DEADZONE) {
            this.ax = 0;
            this.ay = 0;
        } else {
            // INPUT DAMPING: Apply sensitivity constant to prevent high-speed snapping
            // Raw input is multiplied by MOBILE_SENSITIVITY (0.04) for smooth control
            const dampedDeltaX = deltaX * MOBILE_SENSITIVITY;
            const dampedDeltaY = deltaY * MOBILE_SENSITIVITY;

            // Calculate acceleration from damped input
            const accelerationMagnitude = 1200 * jerkFactor; // Base acceleration
            const direction = Math.atan2(dampedDeltaY, dampedDeltaX);
            this.ax = Math.cos(direction) * accelerationMagnitude * Math.min(1, distanceToTarget / 100);
            this.ay = Math.sin(direction) * accelerationMagnitude * Math.min(1, distanceToTarget / 100);
        }

        // ========================================
        // DELTA TIMING: Newtonian Physics
        // velocity += acceleration * deltaTime
        // Ensures consistent speed across 60Hz and 120Hz screens
        // ========================================
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;

        // ========================================
        // FRICTION ADJUSTMENT: Frame-rate independent drag
        // Formula: velocity *= DRAG_PER_SECOND^dt
        // This maintains the "heavy" feeling across 60Hz and 120Hz devices
        // At any framerate, after 1 second, velocity = original * 0.05 (95% drag)
        // ========================================
        const dragFactor = Math.pow(DRAG_PER_SECOND, dt);
        this.vx *= dragFactor;
        this.vy *= dragFactor;

        // Clamp max velocity
        const maxSpeed = 800;
        const currentSpeed = Math.hypot(this.vx, this.vy);
        if (currentSpeed > maxSpeed) {
            const scale = maxSpeed / currentSpeed;
            this.vx *= scale;
            this.vy *= scale;
        }

        // Apply velocity to position (delta-timed)
        // Position += Velocity * delta
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Apply knockback (delta-timed with frame-rate independent decay)
        if (Math.abs(this.knockVX) + Math.abs(this.knockVY) > 1) {
            this.x += this.knockVX * dt;
            this.y += this.knockVY * dt;
            const knockbackDrag = Math.pow(0.01, dt); // 99% decay per second
            this.knockVX *= knockbackDrag;
            this.knockVY *= knockbackDrag;
        }

        // Get bounds and clamp position
        const bounds = this.world3D.getVisibleBounds();
        this.x = Math.max(bounds.left + this.radius, Math.min(bounds.right - this.radius, this.x));
        this.y = Math.max(bounds.bottom + this.radius, Math.min(bounds.top - this.radius, this.y));

        this.prevX = this.x;
        this.prevY = this.y;

        // ========================================
        // LERPING: Smooth position with THREE.Vector3.lerp
        // Gives the Luminaris a "heavy, cinematic" feel on mobile glass
        // ========================================
        this.targetPosition.set(this.x, this.y, 0);
        this.smoothedPosition.lerp(this.targetPosition, POSITION_LERP_SPEED * dt);

        // Update mesh position with smoothed values
        this.mesh.position.copy(this.smoothedPosition);

        // ========================================
        // SLERPING: Smooth rotation with THREE.Quaternion.slerp
        // Creates fluid, heavy rotation for cinematic mobile feel
        // ========================================
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 10) {
            const moveAngle = Math.atan2(this.vy, this.vx);
            const tiltAmount = Math.min(0.3, speed * 0.0005);

            // Create target quaternion from euler angles
            const targetEuler = new THREE.Euler(
                0,
                tiltAmount,
                Math.PI + moveAngle - Math.PI / 2,
                'XYZ'
            );
            this.targetQuaternion.setFromEuler(targetEuler);

            // Slerp toward target rotation
            this.smoothedQuaternion.slerp(this.targetQuaternion, ROTATION_SLERP_SPEED * dt);
            this.mesh.quaternion.copy(this.smoothedQuaternion);
        }

        // Animate engine (uses smoothed speed)
        const enginePulse = 0.8 + 0.4 * Math.sin(time * 10);
        this.engine.material.opacity = enginePulse;
        this.engine.scale.setScalar(0.8 + speed * 0.002);

        // Update combo timer
        if (this.combo > 1 && time > this.comboUntil) {
            this.combo = 1;
        }

        // Update decoy
        if (this.decoyActive) {
            if (time > this.decoyUntil) {
                this.decoyActive = false;
                this.decoyMesh.material.opacity = 0;
            } else {
                const pulse = 1 + 0.3 * Math.sin(time * 5);
                this.decoyMesh.scale.setScalar(pulse);
                this.decoyMesh.material.opacity = 0.6;
                this.decoyMesh.rotation.z += dt * 2;
            }
        }

        // Update shield
        if (this.shieldActive) {
            if (time > this.shieldUntil) {
                this.shieldActive = false;
                this.shieldMesh.material.opacity = 0;
                this.shieldWire.material.opacity = 0;
            } else {
                const pulse = 0.3 + 0.1 * Math.sin(time * 4);
                this.shieldMesh.material.opacity = pulse;
                this.shieldWire.material.opacity = pulse + 0.2;
                this.shieldMesh.rotation.y += dt * 0.5;
                this.shieldWire.rotation.y -= dt * 0.3;
            }
        }
        // Use smoothed position for shield/wire
        this.shieldMesh.position.copy(this.smoothedPosition);
        this.shieldWire.position.copy(this.smoothedPosition);

        // ========================================
        // ABILITY PULSE: Expanding ring animation
        // ========================================
        if (this.abilityPulseActive) {
            if (time > this.abilityPulseUntil) {
                this.abilityPulseActive = false;
                this.abilityPulseMesh.material.opacity = 0;
            } else {
                // Calculate progress (0 to 1)
                const duration = 0.5;
                const elapsed = duration - (this.abilityPulseUntil - time);
                const progress = elapsed / duration;

                // Expand and fade
                const scale = 1 + progress * 3; // Expand 3x
                this.abilityPulseMesh.scale.setScalar(scale);
                this.abilityPulseMesh.material.opacity = 0.8 * (1 - progress);
            }
        }
        this.abilityPulseMesh.position.copy(this.smoothedPosition);

        // Update trail (uses smoothed position)
        if (speed > 50) {
            this.trail.push({ x: this.smoothedPosition.x, y: this.smoothedPosition.y, t: time });
            if (this.trail.length > 20) this.trail.shift();
        }

        this.updateTrail(time);
    }

    updateTrail(time) {
        for (let i = 0; i < this.trailMeshes.length; i++) {
            const mesh = this.trailMeshes[i];
            if (i < this.trail.length) {
                const p = this.trail[i];
                const age = time - p.t;
                if (age > 0.6) {
                    mesh.visible = false;
                    continue;
                }
                mesh.visible = true;
                mesh.position.set(p.x, p.y, -5);
                const scale = 1 - age / 0.6;
                mesh.scale.setScalar(scale);
                mesh.material.opacity = 0.6 * scale;
            } else {
                mesh.visible = false;
            }
        }
    }

    addCombo(time) {
        this.combo += 1;
        this.comboUntil = time + 3;
    }

    canDecoy(time) {
        return (time - this.decoyLast) >= this.decoyCooldown;
    }

    useDecoy(time) {
        this.decoyLast = time;
        this.decoyActive = true;
        this.decoyPos = { x: this.x, y: this.y };
        this.decoyUntil = time + 3.5;
        this.decoyMesh.position.set(this.x, this.y, 0);
        return true;
    }

    activateShield(time, duration) {
        this.shieldActive = true;
        this.shieldUntil = time + duration;
    }

    applyKnockback(fx, fy) {
        const dx = this.x - fx;
        const dy = this.y - fy;
        const d = Math.hypot(dx, dy) || 1;
        const k = 260;
        this.knockVX += (dx / d) * k;
        this.knockVY += (dy / d) * k;
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    getDecoyPosition() {
        return this.decoyActive ? this.decoyPos : null;
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.shieldMesh);
        this.scene.remove(this.shieldWire);
        this.scene.remove(this.decoyMesh);
        this.scene.remove(this.abilityPulseMesh);

        this.trailMeshes.forEach(m => this.scene.remove(m));

        // Dispose geometries and materials
        this.mesh.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}
