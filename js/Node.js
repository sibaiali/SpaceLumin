/**
 * Node.js - 3D Gate/Node System
 * Represents the sector gate that must be purified to advance
 */

class GameNode {
    constructor(scene, x, y, sector) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.sector = sector;
        
        // Properties
        this.coreR = 12;
        this.shieldR = 40;
        this.maxHp = 10 + sector * 7;
        this.hp = this.maxHp;
        
        // Animation state
        this.pulsePhase = 0;
        
        // Create meshes
        this.createMesh();
    }
    
    createMesh() {
        // Main group
        this.group = new THREE.Group();
        this.group.position.set(this.x, this.y, 0);
        
        // Outer shield sphere
        const shieldGeometry = new THREE.SphereGeometry(this.shieldR, 32, 32);
        const shieldMaterial = new THREE.MeshBasicMaterial({
            color: 0xf87171,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });
        this.shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        this.group.add(this.shield);
        
        // Shield wireframe
        const wireGeometry = new THREE.SphereGeometry(this.shieldR, 16, 16);
        const wireMaterial = new THREE.MeshBasicMaterial({
            color: 0xf87171,
            transparent: true,
            opacity: 0.4,
            wireframe: true
        });
        this.shieldWire = new THREE.Mesh(wireGeometry, wireMaterial);
        this.group.add(this.shieldWire);
        
        // Inner corrupted core
        const coreGeometry = new THREE.IcosahedronGeometry(this.shieldR * 0.55, 1);
        const coreMaterial = new THREE.MeshPhongMaterial({
            color: 0x941b36,
            emissive: 0x7f1d1d,
            emissiveIntensity: 0.5,
            shininess: 20,
            flatShading: true
        });
        this.core = new THREE.Mesh(coreGeometry, coreMaterial);
        this.group.add(this.core);
        
        // Central energy sphere (hp indicator)
        const energyGeometry = new THREE.SphereGeometry(this.coreR, 16, 16);
        const energyMaterial = new THREE.MeshBasicMaterial({
            color: 0xfca5a5,
            transparent: true,
            opacity: 0.9
        });
        this.energy = new THREE.Mesh(energyGeometry, energyMaterial);
        this.group.add(this.energy);
        
        // Rotating ring
        const ringGeometry = new THREE.TorusGeometry(this.shieldR * 0.7, 2, 8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xf87171,
            transparent: true,
            opacity: 0.6
        });
        this.ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
        this.ring1.rotation.x = Math.PI / 2;
        this.group.add(this.ring1);
        
        // Second ring (perpendicular)
        this.ring2 = new THREE.Mesh(ringGeometry.clone(), ringMaterial.clone());
        this.ring2.rotation.y = Math.PI / 2;
        this.group.add(this.ring2);
        
        // Point lights
        this.coreLight = new THREE.PointLight(0xf87171, 1, 100);
        this.group.add(this.coreLight);
        
        this.scene.add(this.group);
    }
    
    update(dt, time) {
        this.pulsePhase = time;
        
        // Pulse based on HP
        const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
        const pulse = 0.7 + 0.3 * Math.sin(time * 3);
        
        // Animate shield
        this.shield.material.opacity = 0.1 + 0.1 * pulse;
        this.shieldWire.rotation.y += dt * 0.3;
        this.shieldWire.rotation.x += dt * 0.2;
        
        // Animate core
        this.core.rotation.y += dt * 0.5;
        this.core.rotation.x += dt * 0.3;
        
        // Energy sphere scales with HP
        const energyScale = 0.4 + 0.6 * hpRatio;
        this.energy.scale.setScalar(energyScale * pulse);
        
        // Rings rotate
        this.ring1.rotation.z += dt * 1.5;
        this.ring2.rotation.z -= dt * 1.2;
        
        // Light intensity based on HP
        this.coreLight.intensity = 0.5 + 0.5 * hpRatio;
        
        // Color shift as HP decreases
        if (hpRatio < 0.3) {
            // Weak - flicker
            const flicker = Math.random() > 0.5 ? 0.3 : 0.6;
            this.shield.material.opacity = flicker * 0.2;
        }
    }
    
    takeDamage(amount) {
        this.hp -= amount;
        
        // Flash effect
        this.energy.material.color.setHex(0xffffff);
        setTimeout(() => {
            if (this.energy && this.energy.material) {
                this.energy.material.color.setHex(0xfca5a5);
            }
        }, 100);
        
        return this.hp <= 0;
    }
    
    isDestroyed() {
        return this.hp <= 0;
    }
    
    getHpRatio() {
        return Math.max(0, this.hp / this.maxHp);
    }
    
    dispose() {
        this.scene.remove(this.group);
        this.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}

/**
 * NodeManager - Handles node creation and updates
 */
class NodeManager {
    constructor(scene) {
        this.scene = scene;
        this.nodes = [];
    }
    
    spawn(x, y, sector) {
        const node = new GameNode(this.scene, x, y, sector);
        this.nodes.push(node);
        return node;
    }
    
    update(dt, time) {
        for (const node of this.nodes) {
            node.update(dt, time);
        }
    }
    
    remove(node) {
        const idx = this.nodes.indexOf(node);
        if (idx !== -1) {
            node.dispose();
            this.nodes.splice(idx, 1);
        }
    }
    
    getActiveNodes() {
        return this.nodes.filter(n => !n.isDestroyed());
    }
    
    clear() {
        this.nodes.forEach(n => n.dispose());
        this.nodes = [];
    }
    
    dispose() {
        this.clear();
    }
}
