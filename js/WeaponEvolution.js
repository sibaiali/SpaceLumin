/**
 * WeaponEvolution.js - Multi-Tier Weapon Evolution & Fusion System
 * 
 * Implements Survivor-style weapon fusions when player meets landmark/vector requirements:
 * 1. Glacial Super-Beam (Laser + Cryo Core): Continuous ultra-wide piercing cryogenic laser.
 * 2. Singularity Storm (Predictive Vector + Lightning): Spawns crushing micro-vortices on boids.
 * 3. Bio-Hazard Swarm (Toxic Spores + Rapid Laser): Corrosive homing darts that chain acid damage.
 * 4. Quantum Overdrive (Energy + Landmark Node): 360-degree radial plasma barrage.
 */

const WEAPON_EVOLUTIONS = {
    glacialBeam: {
        id: 'glacialBeam',
        name: '❄️ Glacial Super-Beam',
        description: 'Ultra-wide piercing cryogenic beam that freezes and shatters enemy swarms.',
        color: 0x38bdf8,
        glowColor: 0x0284c7,
        dps: 32,
        freezeDuration: 2.5,
        beamWidth: 14
    },
    singularityStorm: {
        id: 'singularityStorm',
        name: '🌀 Singularity Storm',
        description: 'Gravitational micro-vortices tear through enemy formations and drag in boids.',
        color: 0xa855f7,
        glowColor: 0x7c3aed,
        dps: 26,
        pullForce: 85,
        radius: 120
    },
    bioHazard: {
        id: 'bioHazard',
        name: '☣️ Bio-Hazard Swarm',
        description: 'Homing corrosive spore darts that melt boid armor and spread chain acid.',
        color: 0x4ade80,
        glowColor: 0x16a34a,
        dps: 22,
        chainTargets: 4
    },
    quantumOverdrive: {
        id: 'quantumOverdrive',
        name: '⚡ Quantum Overdrive',
        description: '360-degree radial plasma cascade annihilating surrounding space beasts.',
        color: 0xfacc15,
        glowColor: 0xf59e0b,
        dps: 40,
        burstInterval: 1.8
    }
};

class WeaponEvolutionSystem {
    constructor(scene, world3D, audio) {
        this.scene = scene;
        this.world3D = world3D;
        this.audio = audio;
        
        // Active evolutions set
        this.unlockedEvolutions = new Set();
        this.activeEvolution = null; // Currently equipped evolved weapon
        
        // Visual groups
        this.vortices = []; // For singularity storm
        this.spores = [];   // For bio-hazard
        this.lastRadialBurst = 0;
        
        // Setup visual container
        this.group = new THREE.Group();
        this.scene.add(this.group);
    }
    
    /**
     * Check if player qualifies for an evolution based on inventory/meta state
     */
    checkUnlockConditions(sector, flow, combo, landmarksCollected) {
        const newlyUnlocked = [];
        
        // Glacial Beam unlocks at Sector >= 4 with combo >= 3
        if (sector >= 4 && combo >= 3 && !this.unlockedEvolutions.has('glacialBeam')) {
            this.unlock('glacialBeam');
            newlyUnlocked.push(WEAPON_EVOLUTIONS.glacialBeam);
        }
        
        // Singularity Storm unlocks when matrix rank is stabilized (Sector >= 8 or 5+ landmarks)
        if ((sector >= 8 || landmarksCollected >= 5) && !this.unlockedEvolutions.has('singularityStorm')) {
            this.unlock('singularityStorm');
            newlyUnlocked.push(WEAPON_EVOLUTIONS.singularityStorm);
        }
        
        // Bio-Hazard Swarm unlocks at Sector >= 12
        if (sector >= 12 && !this.unlockedEvolutions.has('bioHazard')) {
            this.unlock('bioHazard');
            newlyUnlocked.push(WEAPON_EVOLUTIONS.bioHazard);
        }
        
        // Quantum Overdrive unlocks at high flow state (Flow >= 80% in Sector >= 15)
        if (sector >= 15 && flow >= 40 && !this.unlockedEvolutions.has('quantumOverdrive')) {
            this.unlock('quantumOverdrive');
            newlyUnlocked.push(WEAPON_EVOLUTIONS.quantumOverdrive);
        }
        
        return newlyUnlocked;
    }
    
    unlock(evolutionId) {
        if (!WEAPON_EVOLUTIONS[evolutionId]) return;
        this.unlockedEvolutions.add(evolutionId);
        this.activeEvolution = WEAPON_EVOLUTIONS[evolutionId];
        console.log('[WeaponEvolution] UNLOCKED: ' + this.activeEvolution.name);
        if (this.audio && this.audio.playPowerup) {
            this.audio.playPowerup('G5');
        }
    }
    
    /**
     * Per-frame update for active evolution mechanics
     */
    update(dt, time, playerX, playerY, enemies, bullets) {
        if (!this.activeEvolution) return;
        
        // Singularity Storm: spawn & update gravitational micro-vortices
        if (this.activeEvolution.id === 'singularityStorm') {
            this.updateSingularityStorm(dt, time, playerX, playerY, enemies);
        }
        
        // Quantum Overdrive: 360-degree radial plasma burst
        if (this.activeEvolution.id === 'quantumOverdrive') {
            if (time - this.lastRadialBurst > this.activeEvolution.burstInterval) {
                this.lastRadialBurst = time;
                this.triggerRadialBurst(playerX, playerY, bullets);
            }
        }
    }
    
    updateSingularityStorm(dt, time, px, py, enemies) {
        // Spawn micro vortex occasionally
        if (this.vortices.length < 3 && Math.random() < 0.04) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 140;
            const vx = px + Math.cos(angle) * dist;
            const vy = py + Math.sin(angle) * dist;
            
            const geo = new THREE.TorusGeometry(12, 2.5, 8, 24);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xa855f7,
                transparent: true,
                opacity: 0.8,
                wireframe: true
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(vx, vy, 0);
            this.group.add(mesh);
            
            this.vortices.push({
                x: vx,
                y: vy,
                mesh: mesh,
                ttl: 3.5,
                radius: 120
            });
        }
        
        // Update vortices
        for (let i = this.vortices.length - 1; i >= 0; i--) {
            const v = this.vortices[i];
            v.ttl -= dt;
            v.mesh.rotation.z += dt * 5;
            v.mesh.scale.setScalar(1 + 0.3 * Math.sin(time * 8));
            
            // Pull surrounding boid enemies
            for (const e of enemies) {
                const dx = v.x - e.x;
                const dy = v.y - e.y;
                const d = Math.hypot(dx, dy);
                if (d < v.radius && d > 10) {
                    const pull = (80 / (d + 20)) * dt * 60;
                    e.x += (dx / d) * pull;
                    e.y += (dy / d) * pull;
                    e.takeDamage?.(25 * dt);
                }
            }
            
            if (v.ttl <= 0) {
                this.group.remove(v.mesh);
                v.mesh.geometry.dispose();
                v.mesh.material.dispose();
                this.vortices.splice(i, 1);
            }
        }
    }
    
    triggerRadialBurst(px, py, bullets) {
        if (!bullets) return;
        const count = 16;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = 450;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            bullets.spawnPlayerBullet(px, py, vx, vy, 1.8);
        }
        if (this.audio && this.audio.playExplode) {
            this.audio.playExplode('C4');
        }
    }
    
    getActiveEvolutionName() {
        return this.activeEvolution ? this.activeEvolution.name : null;
    }
    
    reset() {
        this.unlockedEvolutions.clear();
        this.activeEvolution = null;
        for (const v of this.vortices) {
            this.group.remove(v.mesh);
            v.mesh.geometry.dispose();
            v.mesh.material.dispose();
        }
        this.vortices = [];
    }
    
    dispose() {
        this.reset();
        this.scene.remove(this.group);
    }
}
