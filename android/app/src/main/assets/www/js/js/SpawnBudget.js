/**
 * SpawnBudget.js - Meaningful Object Economy
 * Limits clutter, converts excess to decorative stars
 */

class SpawnBudget {
    constructor() {
        // Budget limits per category
        this.limits = {
            collectibles: 6,
            landmarkNodes: 10,
            enemies: 12,
            projectiles: 40,
            particles: 800
        };
        
        // Current counts
        this.counts = {
            collectibles: 0,
            landmarkNodes: 0,
            enemies: 0,
            projectiles: 0,
            particles: 0
        };
        
        // Decorative stars (non-interactive, beautiful fallback)
        this.stars = [];
        this.maxStars = 30;
        
        // Performance mode reduces limits
        this.performanceMode = false;
    }
    
    setPerformanceMode(enabled) {
        this.performanceMode = enabled;
        if (enabled) {
            this.limits.collectibles = 4;
            this.limits.landmarkNodes = 6;
            this.limits.enemies = 8;
            this.limits.projectiles = 25;
            this.limits.particles = 400;
        } else {
            this.limits.collectibles = 6;
            this.limits.landmarkNodes = 10;
            this.limits.enemies = 12;
            this.limits.projectiles = 40;
            this.limits.particles = 800;
        }
    }
    
    /**
     * Check if category has budget for new spawn
     */
    canSpawn(category) {
        return this.counts[category] < this.limits[category];
    }
    
    /**
     * Reserve budget for spawn
     */
    reserve(category) {
        if (this.canSpawn(category)) {
            this.counts[category]++;
            return true;
        }
        return false;
    }
    
    /**
     * Release budget when object is removed
     */
    release(category) {
        this.counts[category] = Math.max(0, this.counts[category] - 1);
    }
    
    /**
     * Get remaining budget
     */
    remaining(category) {
        return Math.max(0, this.limits[category] - this.counts[category]);
    }
    
    /**
     * Convert excess spawn request to decorative star
     * Returns star data if converted, null if spawn should proceed
     */
    convertToStar(scene, x, y, color) {
        if (this.stars.length >= this.maxStars) {
            // Remove oldest star
            const oldest = this.stars.shift();
            if (oldest && oldest.mesh) {
                scene.remove(oldest.mesh);
                oldest.mesh.geometry.dispose();
                oldest.mesh.material.dispose();
            }
        }
        
        // Create decorative star mote
        const geometry = new THREE.SphereGeometry(2 + Math.random() * 2, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: color || 0xffffff,
            transparent: true,
            opacity: 0.3 + Math.random() * 0.3,
            blending: THREE.AdditiveBlending
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, -50 - Math.random() * 100);
        scene.add(mesh);
        
        const star = {
            mesh,
            baseOpacity: material.opacity,
            phase: Math.random() * Math.PI * 2,
            twinkleSpeed: 2 + Math.random() * 3
        };
        
        this.stars.push(star);
        return star;
    }
    
    /**
     * Update decorative stars (twinkle animation)
     */
    updateStars(time) {
        for (const star of this.stars) {
            if (!star.mesh) continue;
            const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.phase);
            star.mesh.material.opacity = star.baseOpacity * twinkle;
        }
    }
    
    /**
     * Clear all stars
     */
    clearStars(scene) {
        for (const star of this.stars) {
            if (star.mesh) {
                scene.remove(star.mesh);
                star.mesh.geometry.dispose();
                star.mesh.material.dispose();
            }
        }
        this.stars = [];
    }
    
    /**
     * Reset all counts (on run start)
     */
    reset() {
        this.counts = {
            collectibles: 0,
            landmarkNodes: 0,
            enemies: 0,
            projectiles: 0,
            particles: 0
        };
    }
    
    /**
     * Get budget status for debugging
     */
    getStatus() {
        return {
            collectibles: `${this.counts.collectibles}/${this.limits.collectibles}`,
            enemies: `${this.counts.enemies}/${this.limits.enemies}`,
            particles: `${this.counts.particles}/${this.limits.particles}`,
            stars: this.stars.length
        };
    }
}

// Global instance
const spawnBudget = new SpawnBudget();
