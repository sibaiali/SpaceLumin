/**
 * SingularitySequence.js - Black Hole Ending for Sector 11
 * Cinematic but lightweight ending sequence
 */

class SingularitySequence {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;
        this.phase = 0;
        this.time = 0;
        
        // Black hole mesh
        this.blackHole = null;
        this.accretionDisk = null;
        this.eventHorizon = null;
        
        // Screen effects
        this.vignette = null;
        this.overlay = null;
        
        // Callbacks
        this.onComplete = null;
        
        this.createMeshes();
        this.createOverlay();
    }
    
    createMeshes() {
        // Black hole core (dark sphere)
        const coreGeo = new THREE.SphereGeometry(60, 24, 24);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.98
        });
        this.blackHole = new THREE.Mesh(coreGeo, coreMat);
        this.blackHole.visible = false;
        this.blackHole.position.set(0, 0, -100);
        this.scene.add(this.blackHole);
        
        // Event horizon ring
        const ringGeo = new THREE.RingGeometry(55, 80, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x220022,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        this.eventHorizon = new THREE.Mesh(ringGeo, ringMat);
        this.eventHorizon.visible = false;
        this.eventHorizon.position.set(0, 0, -80);
        this.scene.add(this.eventHorizon);
        
        // Accretion disk (glowing ring)
        const diskGeo = new THREE.RingGeometry(80, 200, 48);
        const diskMat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        this.accretionDisk = new THREE.Mesh(diskGeo, diskMat);
        this.accretionDisk.visible = false;
        this.accretionDisk.rotation.x = Math.PI / 2.5;
        this.accretionDisk.position.set(0, 0, -90);
        this.scene.add(this.accretionDisk);
    }
    
    createOverlay() {
        // Create DOM overlay for vignette and fade effects
        this.overlay = document.createElement('div');
        this.overlay.id = 'singularity-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 100;
            opacity: 0;
            transition: opacity 0.5s;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;
        document.body.appendChild(this.overlay);
        
        // Vignette layer
        this.vignette = document.createElement('div');
        this.vignette.style.cssText = `
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse at center, 
                transparent 0%, 
                transparent 30%, 
                rgba(0,0,0,0.3) 60%, 
                rgba(0,0,0,0.8) 100%);
            pointer-events: none;
            opacity: 0;
            transition: opacity 1s;
        `;
        this.overlay.appendChild(this.vignette);
        
        // Text container (hidden initially)
        this.textContainer = document.createElement('div');
        this.textContainer.style.cssText = `
            position: relative;
            z-index: 10;
            text-align: center;
            opacity: 0;
            transform: scale(0.9);
            transition: opacity 1.5s, transform 1.5s;
        `;
        this.textContainer.innerHTML = `
            <h1 style="
                font-family: 'Cinzel', serif;
                font-size: clamp(2rem, 6vw, 4rem);
                color: #c8aa6e;
                text-shadow: 0 0 30px rgba(200,170,110,0.8), 0 4px 20px rgba(0,0,0,0.9);
                letter-spacing: 0.2em;
                margin-bottom: 1rem;
            ">SINGULARITY</h1>
            <p style="
                font-family: 'Inter', sans-serif;
                font-size: clamp(1rem, 2.5vw, 1.5rem);
                color: #a78bfa;
                text-shadow: 0 0 15px rgba(167,139,250,0.6);
                letter-spacing: 0.1em;
            ">TRANSCENDENCE ACHIEVED</p>
        `;
        this.overlay.appendChild(this.textContainer);
    }
    
    /**
     * Start the singularity sequence
     */
    start(onComplete) {
        this.active = true;
        this.phase = 1;
        this.time = 0;
        this.onComplete = onComplete;
        
        // Show black hole
        this.blackHole.visible = true;
        this.accretionDisk.visible = true;
        this.eventHorizon.visible = true;
        
        // Initial positions
        this.blackHole.scale.setScalar(0.1);
        this.accretionDisk.scale.setScalar(0.1);
        this.eventHorizon.scale.setScalar(0.1);
        this.blackHole.position.set(0, 100, -100);
        this.accretionDisk.position.set(0, 100, -90);
        this.eventHorizon.position.set(0, 100, -80);
        
        // Show overlay
        this.overlay.style.opacity = 1;
    }
    
    /**
     * Update sequence each frame
     * Returns gravity pull vector to apply to player, or null if complete
     */
    update(dt, playerX, playerY) {
        if (!this.active) return null;
        
        this.time += dt;
        
        // Phase 1: Black hole appears and grows (0-3s)
        if (this.phase === 1) {
            const progress = Math.min(1, this.time / 3);
            const scale = 0.1 + progress * 0.9;
            
            this.blackHole.scale.setScalar(scale);
            this.accretionDisk.scale.setScalar(scale);
            this.eventHorizon.scale.setScalar(scale);
            
            // Move toward center
            const y = 100 - progress * 100;
            this.blackHole.position.y = y;
            this.accretionDisk.position.y = y;
            this.eventHorizon.position.y = y;
            
            // Rotate accretion disk
            this.accretionDisk.rotation.z += dt * 2;
            this.eventHorizon.rotation.z -= dt * 0.5;
            
            // Start vignette
            this.vignette.style.opacity = progress * 0.5;
            
            if (this.time >= 3) {
                this.phase = 2;
                this.time = 0;
            }
            
            return { x: 0, y: 0 }; // No pull yet
        }
        
        // Phase 2: Gravity pull intensifies (3-8s)
        if (this.phase === 2) {
            const progress = Math.min(1, this.time / 5);
            
            // Rotate faster
            this.accretionDisk.rotation.z += dt * (2 + progress * 8);
            this.eventHorizon.rotation.z -= dt * (0.5 + progress * 3);
            
            // Increase vignette
            this.vignette.style.opacity = 0.5 + progress * 0.4;
            
            // Color shift on accretion disk
            const hue = 0.05 + progress * 0.1;
            this.accretionDisk.material.color.setHSL(hue, 1, 0.5);
            
            // Calculate gravity pull toward center
            const pullStrength = 50 + progress * 200;
            const dx = 0 - playerX;
            const dy = 0 - playerY;
            const dist = Math.hypot(dx, dy) || 1;
            
            const pull = {
                x: (dx / dist) * pullStrength,
                y: (dy / dist) * pullStrength
            };
            
            // Check if player reached center
            if (dist < 40 || this.time >= 5) {
                this.phase = 3;
                this.time = 0;
            }
            
            return pull;
        }
        
        // Phase 3: Event horizon crossing - fade to white (0-2s)
        if (this.phase === 3) {
            const progress = Math.min(1, this.time / 2);
            
            // Fade entire overlay to white
            this.overlay.style.backgroundColor = `rgba(255,255,255,${progress})`;
            
            // Hide 3D elements
            this.blackHole.material.opacity = 1 - progress;
            this.accretionDisk.material.opacity = 0.6 * (1 - progress);
            this.eventHorizon.material.opacity = 0.8 * (1 - progress);
            
            if (this.time >= 2) {
                this.phase = 4;
                this.time = 0;
            }
            
            return { x: 0, y: 0 };
        }
        
        // Phase 4: Show transcendence text (0-3s then complete)
        if (this.phase === 4) {
            const progress = Math.min(1, this.time / 1);
            
            // Show text
            this.textContainer.style.opacity = progress;
            this.textContainer.style.transform = `scale(${0.9 + progress * 0.1})`;
            
            if (this.time >= 4) {
                this.complete();
            }
            
            return null;
        }
        
        return null;
    }
    
    complete() {
        this.active = false;
        this.phase = 0;
        
        // Hide meshes
        this.blackHole.visible = false;
        this.accretionDisk.visible = false;
        this.eventHorizon.visible = false;
        
        // Callback
        if (this.onComplete) {
            this.onComplete();
        }
    }
    
    reset() {
        this.active = false;
        this.phase = 0;
        this.time = 0;
        
        this.blackHole.visible = false;
        this.accretionDisk.visible = false;
        this.eventHorizon.visible = false;
        
        this.overlay.style.opacity = 0;
        this.overlay.style.backgroundColor = 'transparent';
        this.vignette.style.opacity = 0;
        this.textContainer.style.opacity = 0;
    }
    
    dispose() {
        this.scene.remove(this.blackHole);
        this.scene.remove(this.accretionDisk);
        this.scene.remove(this.eventHorizon);
        
        this.blackHole.geometry.dispose();
        this.blackHole.material.dispose();
        this.accretionDisk.geometry.dispose();
        this.accretionDisk.material.dispose();
        this.eventHorizon.geometry.dispose();
        this.eventHorizon.material.dispose();
        
        if (this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}
