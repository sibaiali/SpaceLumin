/**
 * Collectible.js - 3D Collectible Items
 * Handles all pickup types: energy, boost, fruits, shields, asteroids
 */

const COLLECTIBLE_CONFIGS = {
    energy: {
        color: 0x22d3ee,
        emissive: 0x0ac8b9,
        geometry: 'sphere',
        size: 10
    },
    predictiveVector: {
        color: 0x00ffcc,
        emissive: 0x00ffcc,
        geometry: 'torus',
        size: 11
    },
    landmarkNode: {
        color: 0x00ffff,
        emissive: 0x00ffff,
        geometry: 'octahedron',
        size: 12
    },
    burst: {
        color: 0xec4899,
        emissive: 0xf9a8d4,
        geometry: 'ring',
        size: 13
    },
    shield: {
        color: 0x60a5fa,
        emissive: 0x2563eb,
        geometry: 'shield',
        size: 11
    },
    voidPlum: {
        color: 0x4c1d95,
        emissive: 0xa855f7,
        geometry: 'plum',
        size: 11
    },
    stellarMango: {
        color: 0xf59e0b,
        emissive: 0xfef9c3,
        geometry: 'mango',
        size: 10
    },
    nebulicApple: {
        color: 0x16a34a,
        emissive: 0xbbf7d0,
        geometry: 'apple',
        size: 8
    },
    glowingJuice: {
        color: 0x22c55e,
        emissive: 0xe0f2fe,
        geometry: 'sphere',
        size: 9
    },
    toxicFruit: {
        color: 0x22c55e,
        emissive: 0xa855f7,
        geometry: 'toxic',
        size: 9
    }
};

class Collectible {
    constructor(scene, kind, x, y, sector) {
        this.scene = scene;
        this.kind = kind;
        this.x = x;
        this.y = y;
        this.sector = sector;
        this.r = 10;

        // Lifetime
        this.ttl = kind === 'burst' ? 10 + Math.random() * 6 : 12 + Math.random() * 10;
        this.spawnTime = performance.now() / 1000;

        // Animation
        this.phase = Math.random() * Math.PI * 2;

        // Create mesh
        this.createMesh();
    }

    createMesh() {
        const config = COLLECTIBLE_CONFIGS[this.kind] || COLLECTIBLE_CONFIGS.energy;
        let geometry;

        switch (config.geometry) {
            case 'diamond':
            case 'octahedron':
                geometry = new THREE.OctahedronGeometry(config.size, 0);
                break;
            case 'torus':
                geometry = new THREE.TorusGeometry(config.size, 1.2, 8, 32);
                break;
            case 'rock':
                geometry = new THREE.DodecahedronGeometry(config.size, 0);
                break;
            case 'ring':
                geometry = new THREE.TorusGeometry(config.size, config.size * 0.3, 8, 16);
                break;
            case 'shield':
                geometry = new THREE.TorusGeometry(config.size, config.size * 0.2, 8, 32);
                break;
            case 'plum':
                geometry = new THREE.SphereGeometry(config.size, 12, 8);
                break;
            case 'mango':
                geometry = new THREE.SphereGeometry(config.size, 12, 8);
                break;
            case 'apple':
                geometry = new THREE.SphereGeometry(config.size, 10, 10);
                break;
            case 'toxic':
                geometry = new THREE.IcosahedronGeometry(config.size, 0);
                break;
            default: // sphere/energy - use DodecahedronGeometry for crystal look
                geometry = new THREE.DodecahedronGeometry(config.size, 0);
        }

        const isWireframe = this.kind === 'landmarkNode';

        // Use MeshStandardMaterial for high-quality lighting
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.emissive,
            emissiveIntensity: isWireframe ? 0.8 : 0.4,
            roughness: 0.3,
            metalness: 0.6,
            transparent: true,
            opacity: 0.95,
            wireframe: isWireframe
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x, this.y, 0);

        // Add glow sphere for energy/predictiveVector types (NO PointLight - saves GPU)
        if (['energy', 'predictiveVector', 'burst', 'glowingJuice'].includes(this.kind)) {
            const glowGeometry = new THREE.SphereGeometry(config.size * 1.4, 6, 6);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: config.emissive,
                transparent: true,
                opacity: 0.3,
                blending: THREE.AdditiveBlending
            });
            this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
            this.mesh.add(this.glow);
        }

        if (this.kind === 'voidPlum') {
            // Add highlight
            const highlightGeo = new THREE.SphereGeometry(4, 8, 8);
            const highlightMat = new THREE.MeshBasicMaterial({
                color: 0xa855f7,
                transparent: true,
                opacity: 0.6
            });
            const highlight = new THREE.Mesh(highlightGeo, highlightMat);
            highlight.position.set(-2, 2, 6);
            this.mesh.add(highlight);
        }

        if (this.kind === 'toxicFruit') {
            // Add warning ring
            const ringGeo = new THREE.TorusGeometry(config.size + 2, 1, 4, 16);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xa855f7,
                transparent: true,
                opacity: 0.7
            });
            this.warningRing = new THREE.Mesh(ringGeo, ringMat);
            this.warningRing.rotation.x = Math.PI / 2;
            this.mesh.add(this.warningRing);
        }

        this.scene.add(this.mesh);
    }

    update(dt, time, bounds) {
        this.ttl -= dt;

        // Wobble movement
        const wobble = 4;
        this.x += Math.cos(time * 0.6 + this.x * 0.01) * wobble * dt;
        this.y += Math.sin(time * 0.7 + this.y * 0.009) * wobble * dt;

        // Clamp to bounds
        this.x = Math.max(bounds.left + 40, Math.min(bounds.right - 40, this.x));
        this.y = Math.max(bounds.bottom + 40, Math.min(bounds.top - 40, this.y));

        // Update mesh
        this.mesh.position.set(this.x, this.y, 0);

        // Animate
        const pulse = 0.9 + 0.2 * Math.sin(time * 5 + this.phase);
        this.mesh.scale.setScalar(pulse);
        if (this.kind === 'predictiveVector') {
            this.mesh.rotation.x += dt * 1.5;
            this.mesh.rotation.y += dt * 2.0;
        } else {
            this.mesh.rotation.y += dt * 2;
        }

        // Animate glow
        if (this.glow) {
            this.glow.material.opacity = 0.15 + 0.1 * Math.sin(time * 3);
        }

        // Animate warning ring for toxic
        if (this.warningRing) {
            this.warningRing.rotation.z += dt * 3;
        }

        // Fade when dying
        if (this.ttl < 2) {
            const fade = this.ttl / 2;
            this.mesh.material.opacity = 0.95 * fade;
            if (this.glow) this.glow.material.opacity = 0.3 * fade;
        }
    }

    isAlive() {
        return this.ttl > 0;
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}

/**
 * CollectibleManager - Handles spawning and management
 */
class CollectibleManager {
    constructor(scene) {
        this.scene = scene;
        this.collectibles = [];
    }

    spawn(kind, x, y, sector) {
        const collectible = new Collectible(this.scene, kind, x, y, sector);
        this.collectibles.push(collectible);
        return collectible;
    }

    update(dt, time, bounds) {
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const c = this.collectibles[i];
            c.update(dt, time, bounds);

            if (!c.isAlive()) {
                c.dispose();
                this.collectibles.splice(i, 1);
            }
        }
    }

    remove(collectible) {
        const idx = this.collectibles.indexOf(collectible);
        if (idx !== -1) {
            collectible.dispose();
            this.collectibles.splice(idx, 1);
        }
    }

    getCounts() {
        const counts = {};
        for (const c of this.collectibles) {
            counts[c.kind] = (counts[c.kind] || 0) + 1;
        }
        return counts;
    }

    clear() {
        this.collectibles.forEach(c => c.dispose());
        this.collectibles = [];
    }

    dispose() {
        this.clear();
    }
}
