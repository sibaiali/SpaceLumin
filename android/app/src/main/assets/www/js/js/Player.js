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
    constructor(scene, world3D, hullId = DEFAULT_HULL) {
        this.scene = scene;
        this.world3D = world3D;
        this.hull = HullDatabase[hullId] || HullDatabase[DEFAULT_HULL];

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

        // Teleport / Phase Dash (Tachyon Glitch special or universal micro-dash)
        this.teleportLast = -10;
        this.teleportCooldown = this.hull.teleport?.cooldown || 4.0;

        // Orbital Drone (Meta Lab upgrade)
        this.hasOrbitalDrone = false;
        this.droneMesh = null;
        this.droneAngle = 0;
        this.droneLastHit = 0;

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
        const meshCfg = this.hull?.mesh || {
            bodyColor: 0x22d3ee,
            accentColor: 0x38bdf8,
            engineGlow: 0x00ffff
        };
        const hullId = this.hull?.id || 'PHOTON_SCOUT';

        // Root mesh acts as the central armored fuselage spine
        // Note: In local space, -Y is FORWARD (Nose), +Y is REAR (Engine), +Z is DORSAL (Top)
        const coreGeo = new THREE.OctahedronGeometry(10, 1);
        coreGeo.scale(0.85, 1.55, 0.42);
        const hullMaterial = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            emissive: meshCfg.bodyColor,
            emissiveIntensity: 0.25,
            metalness: 0.85,
            roughness: 0.2
        });

        this.mesh = new THREE.Mesh(coreGeo, hullMaterial);

        // Forward Nose Lance Spire (pointing toward -Y)
        const noseGeo = new THREE.ConeGeometry(6.5, 22, 6);
        noseGeo.scale(0.85, 1.0, 0.45);
        const noseMat = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            emissive: meshCfg.accentColor,
            emissiveIntensity: 0.35,
            metalness: 0.9,
            roughness: 0.15
        });
        const noseCone = new THREE.Mesh(noseGeo, noseMat);
        noseCone.rotation.z = Math.PI; // Tip points toward -Y
        noseCone.position.set(0, -14, 0.5);
        this.mesh.add(noseCone);

        // Lyra's Biosphere Canopy Dome (translucent crystal cockpit + living inner heart)
        const canopyGeo = new THREE.SphereGeometry(4.8, 16, 12);
        canopyGeo.scale(0.75, 1.45, 0.65);
        const canopyMat = new THREE.MeshPhysicalMaterial({
            color: 0x0f172a,
            emissive: meshCfg.bodyColor,
            emissiveIntensity: 0.3,
            metalness: 0.2,
            roughness: 0.08,
            clearcoat: 1.0,
            transparent: true,
            opacity: 0.88
        });
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.set(0, -3.5, 3.2);
        this.mesh.add(canopy);

        // Lyra's Bio-Synthetic Heartbeat Core inside the canopy
        const lyraGeo = new THREE.OctahedronGeometry(2.1, 0);
        const lyraMat = new THREE.MeshBasicMaterial({
            color: 0x34d399,
            transparent: true,
            opacity: 0.95
        });
        this.lyraCore = new THREE.Mesh(lyraGeo, lyraMat);
        this.lyraCore.position.set(0, -3.5, 3.8);
        this.mesh.add(this.lyraCore);

        // Accent material for wings & weapon rails
        const wingMaterial = new THREE.MeshStandardMaterial({
            color: meshCfg.accentColor,
            emissive: meshCfg.bodyColor,
            emissiveIntensity: 0.4,
            metalness: 0.8,
            roughness: 0.22
        });

        const trimMaterial = new THREE.MeshBasicMaterial({
            color: meshCfg.engineGlow,
            transparent: true,
            opacity: 0.9
        });

        // Hull-Specific Sculpted Wings & Weapon Loadouts
        if (hullId === 'NEUTRON_TANK') {
            // Heavy Hextech Dreadnought: broad armored shoulders + dual heavy rotary cannons + dorsal power ring
            [-1, 1].forEach(side => {
                const pauldronGeo = new THREE.DodecahedronGeometry(8.5, 0);
                pauldronGeo.scale(1.1, 1.35, 0.45);
                const pauldron = new THREE.Mesh(pauldronGeo, wingMaterial);
                pauldron.position.set(side * 12, 1, 0);
                this.mesh.add(pauldron);

                // Heavy twin forward autocannon barrels
                const barrelGeo = new THREE.CylinderGeometry(1.4, 1.8, 18, 8);
                const barrel = new THREE.Mesh(barrelGeo, noseMat);
                barrel.position.set(side * 11.5, -10, 0);
                this.mesh.add(barrel);

                // Glowing muzzle tip
                const muzzleGeo = new THREE.SphereGeometry(1.6, 8, 8);
                const muzzle = new THREE.Mesh(muzzleGeo, trimMaterial);
                muzzle.position.set(side * 11.5, -19, 0);
                this.mesh.add(muzzle);
            });

            // Dorsal Hextech Reactor Ring
            const hexRingGeo = new THREE.TorusGeometry(9, 1.1, 6, 6);
            this.hullRing = new THREE.Mesh(hexRingGeo, trimMaterial);
            this.hullRing.position.set(0, 2, 4.2);
            this.mesh.add(this.hullRing);

        } else if (hullId === 'TACHYON_GLITCH') {
            // Cyber-Phantom X-Frame: 4 angled quantum blades + floating tachyon phase halo
            [-1, 1].forEach(side => {
                const frontBladeGeo = new THREE.ConeGeometry(4.5, 22, 4);
                frontBladeGeo.scale(0.6, 1.0, 0.25);
                const frontBlade = new THREE.Mesh(frontBladeGeo, wingMaterial);
                frontBlade.rotation.z = Math.PI + side * 0.42;
                frontBlade.position.set(side * 12, -5, 1.5);
                this.mesh.add(frontBlade);

                const rearBladeGeo = new THREE.ConeGeometry(4.0, 18, 4);
                rearBladeGeo.scale(0.55, 1.0, 0.25);
                const rearBlade = new THREE.Mesh(rearBladeGeo, noseMat);
                rearBlade.rotation.z = side * -0.55;
                rearBlade.position.set(side * 13, 6, -1.5);
                this.mesh.add(rearBlade);
            });

            // Floating Tachyon Phase Halo
            const haloGeo = new THREE.TorusGeometry(13, 0.9, 8, 24);
            this.hullRing = new THREE.Mesh(haloGeo, trimMaterial);
            this.hullRing.rotation.x = 0.35;
            this.hullRing.position.set(0, 0, 3.5);
            this.mesh.add(this.hullRing);

        } else {
            // PHOTON_SCOUT: Sleek swept-wing interceptor with forward energy lances & dorsal tail fins
            [-1, 1].forEach(side => {
                // Main swept delta wing
                const wingGeo = new THREE.ConeGeometry(7, 22, 4);
                wingGeo.scale(1.1, 1.0, 0.18);
                const wing = new THREE.Mesh(wingGeo, wingMaterial);
                wing.rotation.z = Math.PI * 0.5 * side + side * 0.28;
                wing.position.set(side * 11, 2.5, 0);
                this.mesh.add(wing);

                // Forward-swept wingtip plasma lance
                const lanceGeo = new THREE.ConeGeometry(1.6, 16, 5);
                const lance = new THREE.Mesh(lanceGeo, trimMaterial);
                lance.rotation.z = Math.PI; // Pointing forward (-Y)
                lance.position.set(side * 16.5, -3.5, 0.5);
                this.mesh.add(lance);

                // Angled dorsal stabilizer fin
                const finGeo = new THREE.BoxGeometry(1.2, 9, 5);
                const fin = new THREE.Mesh(finGeo, noseMat);
                fin.position.set(side * 6.5, 7.5, 3.0);
                fin.rotation.y = side * 0.35;
                this.mesh.add(fin);
            });
        }

        // Dual Rear Thruster Nozzles & Dynamic Plasma Plume (+Y rear)
        const engineMaterial = new THREE.MeshBasicMaterial({
            color: meshCfg.engineGlow,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });

        // Central reactor exhaust core (referenced as this.engine)
        const engineGeometry = new THREE.ConeGeometry(4.2, 14, 12);
        this.engine = new THREE.Mesh(engineGeometry, engineMaterial);
        this.engine.position.set(0, 15, 0); // Cone tip points to +Y (rear exhaust trail)
        this.mesh.add(this.engine);

        // Twin auxiliary thruster plumes
        const sidePlumeGeo = new THREE.ConeGeometry(2.4, 10, 8);
        this.leftPlume = new THREE.Mesh(sidePlumeGeo, engineMaterial.clone());
        this.leftPlume.position.set(-5.5, 13.5, 0);
        this.mesh.add(this.leftPlume);

        this.rightPlume = new THREE.Mesh(sidePlumeGeo, engineMaterial.clone());
        this.rightPlume.position.set(5.5, 13.5, 0);
        this.mesh.add(this.rightPlume);

        // Point light for ship aura
        this.glowLight = new THREE.PointLight(meshCfg.bodyColor, 0.95, 75);
        this.mesh.add(this.glowLight);

        this.scene.add(this.mesh);
    }

    createShieldMesh() {
        // Geodesic Hexagonal Energy Dome
        const geometry = new THREE.IcosahedronGeometry(30, 1);
        const material = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0,
            wireframe: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        this.shieldMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.shieldMesh);

        // Geodesic wireframe lattice + orbital ward ring
        const wireGeometry = new THREE.IcosahedronGeometry(31.2, 1);
        const wireMaterial = new THREE.MeshBasicMaterial({
            color: 0x7dd3fc,
            transparent: true,
            opacity: 0,
            wireframe: true
        });

        this.shieldWire = new THREE.Mesh(wireGeometry, wireMaterial);
        const wardRingGeo = new THREE.TorusGeometry(33, 0.8, 6, 36);
        const wardRing = new THREE.Mesh(wardRingGeo, wireMaterial);
        this.shieldWire.add(wardRing);
        this.scene.add(this.shieldWire);
    }

    createDecoyMesh() {
        // Holographic Starfighter Projection + Radar Beacon Rings
        const outerRingGeo = new THREE.TorusGeometry(24, 1.4, 8, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0,
            wireframe: true
        });

        this.decoyMesh = new THREE.Mesh(outerRingGeo, material);

        // Inner holographic ship silhouette inside the decoy ring
        const holoShipGeo = new THREE.ConeGeometry(9, 22, 5);
        const holoShip = new THREE.Mesh(holoShipGeo, material);
        holoShip.rotation.z = Math.PI;
        this.decoyMesh.add(holoShip);

        const holoWingsGeo = new THREE.BoxGeometry(24, 4, 2);
        const holoWings = new THREE.Mesh(holoWingsGeo, material);
        this.decoyMesh.add(holoWings);

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

            // Calculate acceleration from damped input (scaled by hull speed stat)
            const hullSpeed = this.hull?.stats?.speed || 1.0;
            const accelerationMagnitude = 1200 * jerkFactor * hullSpeed; // Base acceleration
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

        // Clamp max velocity (scaled by hull speed stat)
        const maxSpeed = 800 * (this.hull?.stats?.speed || 1.0);
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

        // Animate main engine, twin thruster plumes, Lyra core, and hull phase rings
        const enginePulse = 0.75 + 0.25 * Math.sin(time * 16);
        const plumeStretch = Math.min(2.2, 0.75 + speed * 0.0028);
        this.engine.material.opacity = enginePulse;
        this.engine.scale.set(0.85, plumeStretch, 0.85);
        if (this.leftPlume && this.rightPlume) {
            this.leftPlume.scale.set(0.8, plumeStretch * 0.9, 0.8);
            this.rightPlume.scale.set(0.8, plumeStretch * 0.9, 0.8);
        }
        if (this.lyraCore) {
            this.lyraCore.rotation.z += dt * 2.5;
            this.lyraCore.scale.setScalar(0.9 + 0.2 * Math.sin(time * 4.5));
        }
        if (this.hullRing) {
            this.hullRing.rotation.z += dt * 2.2;
        }

        // ========================================
        // SPACE WIND WOBBLE: Procedural ship animation
        // Creates organic "floating in space" feel
        // ========================================
        const wobbleX = Math.sin(time * 2.3) * 0.015;
        const wobbleY = Math.sin(time * 1.7) * 0.012;
        const wobbleZ = Math.sin(time * 3.1) * 0.008;
        this.mesh.rotation.x += wobbleX;
        this.mesh.rotation.y += wobbleY;
        this.mesh.rotation.z += wobbleZ;

        // ========================================
        // GHOST TRAIL: Velocity-scaled afterimage
        // Gets longer and brighter as speed increases
        // ========================================
        const trailIntensity = Math.min(1.0, speed / 200);
        for (let i = 0; i < this.trailMeshes.length; i++) {
            const t = this.trailMeshes[i];
            if (t) {
                const age = i / this.trailMeshes.length;
                t.material.opacity = trailIntensity * (1 - age) * 0.4;
                t.scale.setScalar(1 - age * 0.5);
            }
        }

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

    getArmorMultiplier() {
        return this.hull?.stats?.armor || 1.0;
    }

    getFireInterval() {
        const rate = this.hull?.stats?.fireRate || 1.0;
        return (1 / 9) / rate;
    }

    // ========================================
    // PHASE TELEPORT / DASH (Shift or E)
    // ========================================
    triggerTeleport(targetX, targetY, time) {
        if (time - this.teleportLast < this.teleportCooldown) return false;
        this.teleportLast = time;

        const isTachyon = this.hull?.stats?.special === 'teleport';
        const maxRange = isTachyon ? (this.hull.teleport?.range || 160) : 95;
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        const jumpDist = Math.min(maxRange, dist);

        const bounds = this.world3D.getVisibleBounds();
        this.x = Math.max(bounds.left + this.radius, Math.min(bounds.right - this.radius, this.x + (dx / dist) * jumpDist));
        this.y = Math.max(bounds.bottom + this.radius, Math.min(bounds.top - this.radius, this.y + (dy / dist) * jumpDist));
        this.smoothedPosition.set(this.x, this.y, 0);
        this.mesh.position.copy(this.smoothedPosition);

        this.activateShield(time, isTachyon ? 0.6 : 0.3);
        this.triggerAbilityPulse('aura', time);
        return true;
    }

    // ========================================
    // ORBITAL SENTINEL DRONE (Meta Lab Upgrade)
    // ========================================
    enableOrbitalDrone() {
        if (this.hasOrbitalDrone) return;
        this.hasOrbitalDrone = true;

        const geo = new THREE.OctahedronGeometry(7, 0);
        const mat = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            emissive: 0x22d3ee,
            emissiveIntensity: 0.6,
            shininess: 90,
            flatShading: true
        });
        this.droneMesh = new THREE.Mesh(geo, mat);

        const ringGeo = new THREE.TorusGeometry(11, 1.2, 6, 20);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.75
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        this.droneMesh.add(ring);

        this.scene.add(this.droneMesh);
    }

    updateOrbitalDrone(dt, time, enemies, onEnemyKilled) {
        if (!this.hasOrbitalDrone || !this.droneMesh) return;

        this.droneAngle += dt * 3.4;
        const orbitR = 54;
        const dx = this.x + Math.cos(this.droneAngle) * orbitR;
        const dy = this.y + Math.sin(this.droneAngle) * orbitR;

        this.droneMesh.position.set(dx, dy, 4);
        this.droneMesh.rotation.z += dt * 4;
        this.droneMesh.rotation.x += dt * 3;

        if (time - this.droneLastHit < 0.22) return;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const dist = Math.hypot(e.x - dx, e.y - dy);
            if (dist < e.r + 22) {
                this.droneLastHit = time;
                const dead = e.takeDamage(2.2);
                if (this.world3D?.spawnImpactGlow) {
                    this.world3D.spawnImpactGlow(e.x, e.y, 0x00ffff, 5);
                }
                if (dead && onEnemyKilled) {
                    onEnemyKilled(e, i);
                }
                break;
            }
        }
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.shieldMesh);
        this.scene.remove(this.shieldWire);
        this.scene.remove(this.decoyMesh);
        this.scene.remove(this.abilityPulseMesh);
        if (this.droneMesh) {
            this.scene.remove(this.droneMesh);
            this.droneMesh.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
        }

        this.trailMeshes.forEach(m => {
            this.scene.remove(m);
            if (m.geometry) m.geometry.dispose();
            if (m.material) m.material.dispose();
        });

        // Dispose geometries and materials
        this.mesh.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}
