/**
 * Collectible.js - 3D Collectible Artifacts & Bio-Synthetic Botanical Specimens
 * Handles all pickup types: energy crystals, supernova bursts, exotic fruits for Lyra, shields, neural nodes
 */

const COLLECTIBLE_CONFIGS = {
    energy: {
        color: 0x22d3ee,
        emissive: 0x0ac8b9,
        geometry: 'crystal',
        size: 10
    },
    predictiveVector: {
        color: 0x00ffcc,
        emissive: 0x00ffcc,
        geometry: 'neural',
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
        geometry: 'supernova',
        size: 12
    },
    shield: {
        color: 0x60a5fa,
        emissive: 0x2563eb,
        geometry: 'shield',
        size: 11
    },
    voidPlum: {
        color: 0x6d28d9,
        emissive: 0xa855f7,
        geometry: 'plum',
        size: 10
    },
    stellarMango: {
        color: 0xf59e0b,
        emissive: 0xfde047,
        geometry: 'mango',
        size: 10
    },
    nebulicApple: {
        color: 0x10b981,
        emissive: 0x6ee7b7,
        geometry: 'apple',
        size: 9
    },
    glowingJuice: {
        color: 0x22c55e,
        emissive: 0xa7f3d0,
        geometry: 'elixir',
        size: 9.5
    },
    toxicFruit: {
        color: 0x16a34a,
        emissive: 0xa855f7,
        geometry: 'toxic',
        size: 9.5
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
        this.orbitRing = null;

        // Create mesh
        this.createMesh();
    }

    createMesh() {
        const config = COLLECTIBLE_CONFIGS[this.kind] || COLLECTIBLE_CONFIGS.energy;
        let geometry;

        switch (config.geometry) {
            case 'crystal':
                // Elongated bipyramidal Hextech Resonance Crystal
                geometry = new THREE.OctahedronGeometry(config.size * 0.85, 0);
                geometry.scale(0.75, 1.45, 0.75);
                break;
            case 'octahedron':
                geometry = new THREE.OctahedronGeometry(config.size, 0);
                break;
            case 'neural':
                geometry = new THREE.OctahedronGeometry(config.size * 0.75, 0);
                break;
            case 'supernova':
                geometry = new THREE.IcosahedronGeometry(config.size * 0.65, 0);
                break;
            case 'shield':
                geometry = new THREE.IcosahedronGeometry(config.size * 0.72, 0);
                break;
            case 'plum':
                geometry = new THREE.DodecahedronGeometry(config.size * 0.85, 0);
                geometry.scale(0.9, 1.2, 0.9);
                break;
            case 'mango':
                geometry = new THREE.OctahedronGeometry(config.size * 0.9, 1);
                geometry.scale(0.8, 1.3, 0.75);
                break;
            case 'apple':
                geometry = new THREE.DodecahedronGeometry(config.size * 0.9, 0);
                break;
            case 'elixir':
                geometry = new THREE.OctahedronGeometry(config.size * 0.85, 0);
                geometry.scale(0.85, 1.3, 0.85);
                break;
            case 'toxic':
                geometry = new THREE.IcosahedronGeometry(config.size * 0.85, 0);
                break;
            default:
                geometry = new THREE.DodecahedronGeometry(config.size, 0);
        }

        const isWireframe = this.kind === 'landmarkNode';

        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.emissive,
            emissiveIntensity: isWireframe ? 0.85 : 0.5,
            roughness: 0.2,
            metalness: 0.75,
            transparent: true,
            opacity: 0.95,
            wireframe: isWireframe,
            flatShading: true
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x, this.y, 0);

        // 1. Energy Crystal: Add tilted golden-cyan containment ring + inner white core
        if (this.kind === 'energy') {
            this.orbitRing = new THREE.Mesh(
                new THREE.TorusGeometry(config.size * 1.15, 0.75, 6, 20),
                new THREE.MeshBasicMaterial({
                    color: 0x67e8f9,
                    transparent: true,
                    opacity: 0.75
                })
            );
            this.orbitRing.rotation.x = Math.PI / 3;
            this.mesh.add(this.orbitRing);
        }

        // 2. Supernova Burst: Dual orthogonal gyroscope rings + starlight core
        if (this.kind === 'burst') {
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xf472b6,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending
            });
            this.orbitRing = new THREE.Mesh(
                new THREE.TorusGeometry(config.size * 1.15, 1.2, 6, 24),
                ringMat
            );
            const ring2 = new THREE.Mesh(
                new THREE.TorusGeometry(config.size * 0.9, 1.0, 6, 20),
                new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 })
            );
            ring2.rotation.x = Math.PI / 2;
            this.orbitRing.add(ring2);
            this.mesh.add(this.orbitRing);
        }

        // 3. Aegis Shield Pickup: Outer geodesic wireframe cage + ward ring
        if (this.kind === 'shield') {
            this.orbitRing = new THREE.Mesh(
                new THREE.IcosahedronGeometry(config.size * 1.2, 0),
                new THREE.MeshBasicMaterial({
                    color: 0x93c5fd,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.8
                })
            );
            this.mesh.add(this.orbitRing);
        }

        // 4. Bio-Synthetic Exo-Fruits for Lyra: Add glowing emerald stem/leaf calyx crown + spore halo
        if (['voidPlum', 'stellarMango', 'nebulicApple', 'glowingJuice'].includes(this.kind)) {
            const leafGeo = new THREE.ConeGeometry(3.8, 4.5, 4);
            leafGeo.scale(1.2, 0.5, 0.5);
            const leafMat = new THREE.MeshBasicMaterial({
                color: 0x34d399,
                transparent: true,
                opacity: 0.95
            });
            const leafCrown = new THREE.Mesh(leafGeo, leafMat);
            leafCrown.position.set(0, config.size * 0.95, 0);
            this.mesh.add(leafCrown);

            this.orbitRing = new THREE.Mesh(
                new THREE.TorusGeometry(config.size * 1.15, 0.65, 6, 18),
                new THREE.MeshBasicMaterial({
                    color: config.emissive,
                    transparent: true,
                    opacity: 0.65
                })
            );
            this.orbitRing.rotation.x = Math.PI / 2.4;
            this.mesh.add(this.orbitRing);
        }

        // 5. Predictive Vector / Neural Node: Outer Nyström holocube frame
        if (this.kind === 'predictiveVector') {
            this.orbitRing = new THREE.Mesh(
                new THREE.TorusGeometry(config.size * 1.1, 1.0, 6, 24),
                new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.85 })
            );
            this.mesh.add(this.orbitRing);
        }

        // 6. Corrupted Toxic Spore Mine: Protruding hazard spikes + warning ring
        if (this.kind === 'toxicFruit') {
            const spikeGeo = new THREE.ConeGeometry(1.8, 7, 4);
            const spikeMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
            const dirs = [
                [1, 0, 0], [-1, 0, 0],
                [0, 1, 0], [0, -1, 0],
                [0, 0, 1], [0, 0, -1]
            ];
            dirs.forEach(([dx, dy, dz]) => {
                const sp = new THREE.Mesh(spikeGeo, spikeMat);
                sp.position.set(dx * config.size * 0.85, dy * config.size * 0.85, dz * config.size * 0.85);
                if (dx !== 0) sp.rotation.z = -dx * Math.PI / 2;
                if (dy < 0) sp.rotation.z = Math.PI;
                if (dz !== 0) sp.rotation.x = dz * Math.PI / 2;
                this.mesh.add(sp);
            });

            const ringGeo = new THREE.TorusGeometry(config.size + 3, 1.1, 6, 20);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.75
            });
            this.warningRing = new THREE.Mesh(ringGeo, ringMat);
            this.warningRing.rotation.x = Math.PI / 2;
            this.mesh.add(this.warningRing);
        }

        // Soft additive aura glow for high-energy artifacts
        if (['energy', 'predictiveVector', 'burst', 'glowingJuice'].includes(this.kind)) {
            const glowGeometry = new THREE.SphereGeometry(config.size * 1.35, 8, 8);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: config.emissive,
                transparent: true,
                opacity: 0.24,
                blending: THREE.AdditiveBlending
            });
            this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
            this.mesh.add(this.glow);
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
        const pulse = 0.92 + 0.16 * Math.sin(time * 5 + this.phase);
        this.mesh.scale.setScalar(pulse);
        this.mesh.rotation.y += dt * 2.0;
        this.mesh.rotation.z = Math.sin(time * 2.5 + this.phase) * 0.18;

        if (this.orbitRing) {
            this.orbitRing.rotation.z += dt * 3.0;
            this.orbitRing.rotation.x += dt * 1.4;
        }

        // Animate glow
        if (this.glow) {
            this.glow.material.opacity = 0.14 + 0.1 * Math.sin(time * 3.5);
        }

        // Animate warning ring for toxic
        if (this.warningRing) {
            this.warningRing.rotation.z += dt * 3.5;
            this.warningRing.rotation.y += dt * 2.0;
        }

        // Fade when dying
        if (this.ttl < 2) {
            const fade = this.ttl / 2;
            this.mesh.material.opacity = 0.95 * fade;
            if (this.glow) this.glow.material.opacity = 0.25 * fade;
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
