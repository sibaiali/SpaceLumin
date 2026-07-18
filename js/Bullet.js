/**
 * Bullet.js - 3D Projectile System
 * Handles player bullets (with fire/electric modes) and enemy bullets
 */

// MOBILE PERFORMANCE: Limit active bullets to prevent visual clutter and GPU strain
const MAX_PLAYER_BULLETS = 15;

class Bullet {
    constructor(scene, x, y, dx, dy, damage = 1, mode = 'basic', isEnemy = false) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.mode = mode;
        this.isEnemy = isEnemy;

        // Velocity
        const speed = isEnemy ? 220 : 640;
        this.vx = dx * speed;
        this.vy = dy * speed;

        // Lifetime
        this.life = isEnemy ? 3 : 1.2;
        this.r = isEnemy ? 4 : 5;

        // Create mesh
        this.createMesh();
    }

    createMesh() {
        let geometry, material, glowColor;

        if (this.isEnemy) {
            // Enemy bullets - orange spheres
            geometry = Bullet.getEnemyGeometry();
            material = new THREE.MeshBasicMaterial({
                color: 0xf97316,
                transparent: true,
                opacity: 0.9
            });
            glowColor = 0xf97316;
        } else {
            // Player bullets based on mode
            switch (this.mode) {
                case 'fire':
                    geometry = Bullet.getFireGeometry(this.r);
                    material = new THREE.MeshBasicMaterial({
                        color: 0xf97316,
                        transparent: true,
                        opacity: 0.95
                    });
                    glowColor = 0xf97316;
                    break;

                case 'electric':
                    geometry = Bullet.getElectricGeometry(this.r);
                    material = new THREE.MeshBasicMaterial({
                        color: 0xa855f7,
                        transparent: true,
                        opacity: 0.95
                    });
                    glowColor = 0xa855f7;
                    break;

                default: // basic
                    geometry = Bullet.getBasicGeometry();
                    material = new THREE.MeshBasicMaterial({
                        color: 0x22d3ee,
                        transparent: true,
                        opacity: 0.95
                    });
                    glowColor = 0x22d3ee;
            }
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x, this.y, 0);

        // Orient toward movement
        if (!this.isEnemy && this.mode === 'fire') {
            const angle = Math.atan2(this.vy, this.vx);
            this.mesh.rotation.z = angle - Math.PI / 2;
        }

        // Add core glow with additive blending (NO PointLight - saves GPU)
        const core = new THREE.Mesh(
            Bullet.getCoreGeometry(),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending
            })
        );
        this.mesh.add(core);

        this.scene.add(this.mesh);
    }

    // Shared geometry cache - prevents per-bullet allocation
    static _basicGeo = null;
    static _enemyGeo = null;
    static _coreGeo = null;
    static _fireGeo = null;
    static _electricGeo = null;

    static getBasicGeometry() {
        if (!Bullet._basicGeo) Bullet._basicGeo = new THREE.SphereGeometry(5, 6, 6);
        return Bullet._basicGeo;
    }

    static getEnemyGeometry() {
        if (!Bullet._enemyGeo) Bullet._enemyGeo = new THREE.SphereGeometry(4, 6, 6);
        return Bullet._enemyGeo;
    }

    static getCoreGeometry() {
        if (!Bullet._coreGeo) Bullet._coreGeo = new THREE.SphereGeometry(2, 4, 4);
        return Bullet._coreGeo;
    }

    static getFireGeometry(r) {
        if (!Bullet._fireGeo) Bullet._fireGeo = new THREE.ConeGeometry(3, 12, 4);
        return Bullet._fireGeo;
    }

    static getElectricGeometry(r) {
        if (!Bullet._electricGeo) Bullet._electricGeo = new THREE.OctahedronGeometry(4, 0);
        return Bullet._electricGeo;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;

        // Update mesh position
        this.mesh.position.set(this.x, this.y, 0);

        // Animate based on mode
        if (this.mode === 'electric') {
            this.mesh.rotation.z += dt * 15;
            this.mesh.rotation.x += dt * 10;
        } else if (this.mode === 'fire') {
            // Flame flicker
            this.mesh.scale.x = 1 + Math.sin(performance.now() * 0.02) * 0.1;
        }

        // Fade as life decreases
        const alpha = Math.min(1, this.life * 2);
        this.mesh.material.opacity = 0.95 * alpha;
    }

    isAlive() {
        return this.life > 0;
    }

    isOutOfBounds(bounds) {
        return this.x < bounds.left - 50 ||
            this.x > bounds.right + 50 ||
            this.y < bounds.bottom - 50 ||
            this.y > bounds.top + 50;
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
 * BulletPool - Manages bullet creation and recycling
 */
class BulletPool {
    constructor(scene) {
        this.scene = scene;
        this.playerBullets = [];
        this.enemyBullets = [];
    }

    spawnPlayerBullet(x, y, dx, dy, damage, mode, time) {
        // MOBILE PERFORMANCE: Enforce max bullet limit
        if (this.playerBullets.length >= MAX_PLAYER_BULLETS) {
            return null; // Don't spawn if at cap
        }

        const bullet = new Bullet(this.scene, x, y, dx, dy, damage, mode, false);
        bullet.spawnTime = time ?? 0;
        bullet.hasHit = false;
        this.playerBullets.push(bullet);
        return bullet;
    }

    spawnEnemyBullet(x, y, vx, vy) {
        const dist = Math.hypot(vx, vy) || 1;
        const bullet = new Bullet(this.scene, x, y, vx / dist, vy / dist, 1, 'basic', true);
        // Override velocity since we receive actual velocity not direction
        bullet.vx = vx;
        bullet.vy = vy;
        this.enemyBullets.push(bullet);
        return bullet;
    }

    update(dt, bounds, time) {
        // Update player bullets
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const b = this.playerBullets[i];
            b.update(dt);

            if (!b.isAlive() || b.isOutOfBounds(bounds)) {
                if (!b.hasHit) {
                    if (typeof telemetryService !== 'undefined') {
                        telemetryService.recordShot(false, time ?? 0);
                    }
                }
                b.dispose();
                this.playerBullets.splice(i, 1);
            }
        }

        // Update enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            b.update(dt);

            if (!b.isAlive() || b.isOutOfBounds(bounds)) {
                b.dispose();
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    removePlayerBullet(bullet) {
        const idx = this.playerBullets.indexOf(bullet);
        if (idx !== -1) {
            bullet.dispose();
            this.playerBullets.splice(idx, 1);
        }
    }

    removeEnemyBullet(bullet) {
        const idx = this.enemyBullets.indexOf(bullet);
        if (idx !== -1) {
            bullet.dispose();
            this.enemyBullets.splice(idx, 1);
        }
    }

    clear() {
        this.playerBullets.forEach(b => b.dispose());
        this.enemyBullets.forEach(b => b.dispose());
        this.playerBullets = [];
        this.enemyBullets = [];
    }

    dispose() {
        this.clear();
    }
}
