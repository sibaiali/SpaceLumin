/**
 * LabelSystem.js - Object Labels with Icons and Values
 * Pooled DOM elements for performance, positioned under objects
 */

class LabelSystem {
    constructor() {
        // Label pool
        this.maxLabels = 12;
        this.labels = [];
        this.activeLabels = new Map(); // object -> label
        
        // Floating text pool for pickup feedback
        this.floatingTexts = [];
        this.maxFloating = 8;
        
        // Icon mappings
        this.iconMap = {
            energy: { icon: '💧', text: 'HP', color: '#22d3ee' },
            predictiveVector: { icon: '🌀', text: 'Predictive Vector', color: '#00ffcc' },
            burst: { icon: '🌊', text: 'Flow', color: '#a855f7' },
            cherry: { icon: '🍒', text: 'Flow', color: '#f472b6' },
            banana: { icon: '🍌', text: 'Flow', color: '#fcd34d' },
            orange: { icon: '🍊', text: 'Flow', color: '#fb923c' },
            apple: { icon: '🍎', text: 'Flow', color: '#ef4444' },
            plum: { icon: '🍇', text: 'Shards', color: '#c084fc' },
            shield: { icon: '🛡️', text: 'Shield', color: '#60a5fa' },
            toxic: { icon: '☠️', text: 'Void', color: '#84cc16' },
            landmarkNode: { icon: '🔷', text: 'Landmark Node', color: '#00ffff' },
            glowingJuice: { icon: '✨', text: 'Regen', color: '#22c55e' },
            crystal: { icon: '💎', text: 'Shards', color: '#06b6d4' }
        };
        
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'label-container';
        this.container.style.cssText = `
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 12;
            overflow: hidden;
        `;
        document.body.appendChild(this.container);
        
        this.createLabelPool();
        this.createFloatingPool();
    }
    
    createLabelPool() {
        for (let i = 0; i < this.maxLabels; i++) {
            const label = document.createElement('div');
            label.className = 'object-label';
            label.style.cssText = `
                position: absolute;
                display: none;
                flex-direction: column;
                align-items: center;
                font-family: 'Inter', sans-serif;
                font-size: clamp(10px, 2vw, 14px);
                font-weight: 600;
                text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7);
                transform: translateX(-50%);
                white-space: nowrap;
                opacity: 0;
                transition: opacity 0.15s ease-out;
            `;
            
            label.innerHTML = `
                <span class="label-icon" style="font-size: clamp(14px, 3vw, 20px);"></span>
                <span class="label-text" style="color: #f0e6d2; letter-spacing: 0.05em;"></span>
                <span class="label-value" style="color: #22d3ee; font-size: 0.85em;"></span>
            `;
            
            this.container.appendChild(label);
            this.labels.push({ el: label, inUse: false, targetId: null });
        }
    }
    
    createFloatingPool() {
        for (let i = 0; i < this.maxFloating; i++) {
            const float = document.createElement('div');
            float.className = 'floating-text';
            float.style.cssText = `
                position: absolute;
                display: none;
                font-family: 'Inter', sans-serif;
                font-size: clamp(12px, 2.5vw, 18px);
                font-weight: 700;
                text-shadow: 0 2px 4px rgba(0,0,0,0.9);
                transform: translateX(-50%);
                pointer-events: none;
            `;
            this.container.appendChild(float);
            this.floatingTexts.push({ el: float, startTime: 0, x: 0, y: 0, active: false });
        }
    }
    
    /**
     * Update labels for visible collectibles
     * @param {Array} collectibles - Array of collectible objects
     * @param {Object} player - Player position {x, y}
     * @param {Function} projectFn - Function to project world coords to screen
     */
    update(collectibles, player, projectFn) {
        const playerX = player.x;
        const playerY = player.y;
        const maxDist = 250; // Only label nearby objects
        
        // Mark all labels as unused
        this.labels.forEach(l => l.inUse = false);
        
        let labelIndex = 0;
        
        for (const c of collectibles) {
            if (labelIndex >= this.maxLabels) break;
            
            // Distance check
            const dx = c.x - playerX;
            const dy = c.y - playerY;
            const dist = Math.hypot(dx, dy);
            
            if (dist > maxDist) continue;
            
            // Project to screen
            const screen = projectFn(c.x, c.y, 0);
            if (!screen || screen.x < 0 || screen.x > window.innerWidth ||
                screen.y < 0 || screen.y > window.innerHeight) continue;
            
            // Get icon data
            const iconData = this.iconMap[c.kind] || { icon: '❓', text: 'Item', color: '#888' };
            
            // Get value
            const value = this.getCollectibleValue(c);
            
            // Assign label
            const label = this.labels[labelIndex++];
            label.inUse = true;
            label.targetId = c.id;
            
            const el = label.el;
            el.style.display = 'flex';
            el.style.left = `${screen.x}px`;
            el.style.top = `${screen.y + 30}px`; // Below object
            
            // Fade by distance
            const fadeStart = maxDist * 0.6;
            const opacity = dist < fadeStart ? 1 : 1 - (dist - fadeStart) / (maxDist - fadeStart);
            el.style.opacity = Math.max(0.4, opacity);
            
            // Update content
            el.querySelector('.label-icon').textContent = iconData.icon;
            el.querySelector('.label-text').textContent = iconData.text;
            el.querySelector('.label-value').textContent = value;
            el.querySelector('.label-value').style.color = iconData.color;
        }
        
        // Hide unused labels
        for (let i = labelIndex; i < this.maxLabels; i++) {
            const label = this.labels[i];
            if (!label.inUse) {
                label.el.style.display = 'none';
                label.el.style.opacity = 0;
            }
        }
        
        // Update floating texts
        this.updateFloatingTexts();
    }
    
    getCollectibleValue(c) {
        const values = {
            energy: '+15 HP',
            predictiveVector: '+Resonance',
            burst: '+30 Flow',
            cherry: '+8 Flow',
            banana: '+12 Flow',
            orange: '+10 Flow',
            apple: '+15 Flow',
            plum: '+5 Shards',
            shield: '+Shield',
            toxic: '-10 HP',
            landmarkNode: '+Stabilize',
            glowingJuice: '+Regen',
            crystal: '+Shards'
        };
        return values[c.kind] || '+?';
    }
    
    /**
     * Spawn floating pickup text at screen position
     */
    spawnFloatingText(screenX, screenY, text, color) {
        const float = this.floatingTexts.find(f => !f.active);
        if (!float) return;
        
        float.active = true;
        float.startTime = performance.now();
        float.x = screenX;
        float.y = screenY;
        
        float.el.textContent = text;
        float.el.style.color = color;
        float.el.style.display = 'block';
        float.el.style.left = `${screenX}px`;
        float.el.style.top = `${screenY}px`;
        float.el.style.opacity = 1;
    }
    
    updateFloatingTexts() {
        const now = performance.now();
        const duration = 800; // ms
        const riseSpeed = 40; // pixels
        
        for (const float of this.floatingTexts) {
            if (!float.active) continue;
            
            const elapsed = now - float.startTime;
            const progress = Math.min(1, elapsed / duration);
            
            if (progress >= 1) {
                float.active = false;
                float.el.style.display = 'none';
                continue;
            }
            
            // Rise and fade
            const yOffset = -riseSpeed * progress;
            float.el.style.top = `${float.y + yOffset}px`;
            float.el.style.opacity = 1 - progress;
            float.el.style.transform = `translateX(-50%) scale(${1 + progress * 0.3})`;
        }
    }
    
    hide() {
        this.labels.forEach(l => {
            l.el.style.display = 'none';
            l.el.style.opacity = 0;
        });
        this.floatingTexts.forEach(f => {
            f.active = false;
            f.el.style.display = 'none';
        });
    }
    
    show() {
        // Labels will show on next update
    }
}
