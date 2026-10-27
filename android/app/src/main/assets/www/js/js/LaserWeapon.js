/**
 * LaserWeapon.js - Continuous Laser Beam System
 * Glow, pulse width, hit sparks - all pooled for performance
 */

class LaserWeapon {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.energy = 100;
        this.maxEnergy = 100;
        this.rechargeRate = 15; // per second when not firing
        this.drainRate = 25; // per second when firing
        
        // Damage per second
        this.dps = 8;
        
        // Beam visual
        this.beamGroup = new THREE.Group();
        this.scene.add(this.beamGroup);
        
        // Core beam (cylinder) - thin white line
        const coreGeo = new THREE.CylinderGeometry(1.5, 1.5, 1, 6, 1);
        coreGeo.rotateX(Math.PI / 2);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95
        });
        this.coreBeam = new THREE.Mesh(coreGeo, coreMat);
        this.beamGroup.add(this.coreBeam);
        
        // Outer glow (larger cylinder, additive) - cyan aura
        const glowGeo = new THREE.CylinderGeometry(5, 5, 1, 6, 1);
        glowGeo.rotateX(Math.PI / 2);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending
        });
        this.glowBeam = new THREE.Mesh(glowGeo, glowMat);
        this.beamGroup.add(this.glowBeam);
        
        // Hit spark pool (8 particles - pooled)
        this.sparks = [];
        const sparkGeo = new THREE.SphereGeometry(2, 4, 4);
        for (let i = 0; i < 8; i++) {
            const spark = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending
            }));
            spark.visible = false;
            this.scene.add(spark);
            this.sparks.push({ mesh: spark, life: 0, vx: 0, vy: 0 });
        }
        
        this.beamGroup.visible = false;
        
        // Beam state
        this.beamLength = 0;
        this.targetLength = 0;
        this.pulsePhase = 0;
        this.lastSparkTime = 0;
    }
    
    startFiring() {
        if (this.energy <= 0) return false;
        this.active = true;
        this.beamGroup.visible = true;
        return true;
    }
    
    stopFiring() {
        this.active = false;
        this.beamGroup.visible = false;
    }
    
    update(dt, time, playerX, playerY, aimX, aimY, enemies, nodes) {
        // Recharge when not firing
        if (!this.active) {
            this.energy = Math.min(this.maxEnergy, this.energy + this.rechargeRate * dt);
            this.updateSparks(dt);
            return null;
        }
        
        // Drain energy
        this.energy -= this.drainRate * dt;
        if (this.energy <= 0) {
            this.energy = 0;
            this.stopFiring();
            return null;
        }
        
        // Calculate beam direction
        const dx = aimX - playerX;
        const dy = aimY - playerY;
        const dist = Math.hypot(dx, dy) || 1;
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        // Raycast to find first hit
        let hitResult = this.raycast(playerX, playerY, dirX, dirY, 600, enemies, nodes);
        this.targetLength = hitResult ? hitResult.distance : 600;
        
        // Smooth beam extension
        this.beamLength += (this.targetLength - this.beamLength) * dt * 20;
        
        // Position beam
        const halfLen = this.beamLength / 2;
        const angle = Math.atan2(dy, dx);
        
        this.beamGroup.position.set(
            playerX + dirX * halfLen,
            playerY + dirY * halfLen,
            0
        );
        this.beamGroup.rotation.z = angle;
        
        // Scale beam length
        this.coreBeam.scale.z = this.beamLength;
        this.glowBeam.scale.z = this.beamLength;
        
        // Pulse width effect
        this.pulsePhase += dt * 15;
        const pulse = 1 + 0.15 * Math.sin(this.pulsePhase);
        this.coreBeam.scale.x = pulse;
        this.coreBeam.scale.y = pulse;
        this.glowBeam.scale.x = pulse * 1.3;
        this.glowBeam.scale.y = pulse * 1.3;
        
        // Spawn hit sparks (rate limited)
        if (hitResult && time - this.lastSparkTime > 0.05) {
            this.lastSparkTime = time;
            this.spawnSpark(hitResult.x, hitResult.y);
        }
        
        this.updateSparks(dt);
        
        // Return hit result with DPS damage
        if (hitResult) {
            hitResult.damage = this.dps * dt;
        }
        
        return hitResult;
    }
    
    raycast(ox, oy, dx, dy, maxDist, enemies, nodes) {
        let closest = null;
        let minDist = maxDist;
        
        // Check enemies
        for (const e of enemies) {
            const d = this.lineCircleIntersect(ox, oy, dx, dy, e.x, e.y, e.r);
            if (d !== null && d < minDist && d > 20) {
                minDist = d;
                closest = { type: 'enemy', target: e, distance: d, x: ox + dx * d, y: oy + dy * d };
            }
        }
        
        // Check nodes
        for (const n of nodes) {
            const d = this.lineCircleIntersect(ox, oy, dx, dy, n.x, n.y, n.shieldR);
            if (d !== null && d < minDist && d > 20) {
                minDist = d;
                closest = { type: 'node', target: n, distance: d, x: ox + dx * d, y: oy + dy * d };
            }
        }
        
        return closest;
    }
    
    lineCircleIntersect(ox, oy, dx, dy, cx, cy, r) {
        const fx = ox - cx;
        const fy = oy - cy;
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - r * r;
        const disc = b * b - 4 * a * c;
        
        if (disc < 0) return null;
        
        const t1 = (-b - Math.sqrt(disc)) / (2 * a);
        const t2 = (-b + Math.sqrt(disc)) / (2 * a);
        
        if (t1 >= 0) return t1;
        if (t2 >= 0) return t2;
        return null;
    }
    
    spawnSpark(x, y) {
        const spark = this.sparks.find(s => s.life <= 0);
        if (!spark) return;
        
        spark.mesh.visible = true;
        spark.mesh.position.set(x, y, 0);
        spark.mesh.material.opacity = 1;
        spark.mesh.scale.setScalar(1 + Math.random());
        spark.life = 0.12;
        spark.vx = (Math.random() - 0.5) * 150;
        spark.vy = (Math.random() - 0.5) * 150;
    }
    
    updateSparks(dt) {
        for (const s of this.sparks) {
            if (s.life <= 0) continue;
            s.life -= dt;
            s.mesh.position.x += s.vx * dt;
            s.mesh.position.y += s.vy * dt;
            s.mesh.material.opacity = s.life / 0.12;
            s.mesh.scale.multiplyScalar(1.05);
            if (s.life <= 0) s.mesh.visible = false;
        }
    }
    
    getEnergyRatio() {
        return this.energy / this.maxEnergy;
    }
    
    dispose() {
        this.scene.remove(this.beamGroup);
        this.beamGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        this.sparks.forEach(s => {
            this.scene.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
        });
    }
}
