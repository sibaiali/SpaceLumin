/**
 * InputHandler.js - Mouse, Touch, and Keyboard Input
 * Handles all player input and converts to game actions
 * Integrates with MobileControls for joystick/button input
 */

// Input Sensitivity for mobile touch damping (0.2 = 20% of raw input for high-DPI screens)
const INPUT_SENSITIVITY = 0.2;

// JOYSTICK SMOOTHING: Lerp factor for velocity smoothing (lower = smoother "mass" feel)
const JOYSTICK_LERP_FACTOR = 0.08;

// AUTO-PULSE SHOOTING: Interval in seconds for automatic firing when touching + enemy in range
const AUTO_PULSE_INTERVAL = 0.2;
const AUTO_PULSE_RANGE = 400; // World units - max distance to auto-fire at enemy

// ========================================
// GESTURE DETECTION CONSTANTS
// ========================================
const TAP_MAX_DURATION = 200;     // Max ms for a tap (vs drag)
const TAP_MAX_MOVE = 15;          // Max pixels moved for tap (vs drag)
const DOUBLE_TAP_WINDOW = 300;    // Max ms between taps for double-tap
const LONG_PRESS_DURATION = 500;  // Ms to hold for freeze ability
const TAP_KILL_RADIUS = 50;       // World units - hitbox for tap-to-kill

class InputHandler {
    constructor(world3D) {
        this.world3D = world3D;

        // Mobile controls (joystick + buttons)
        this.mobileControls = new MobileControls();

        // Mouse/touch position in world coordinates
        this.mouseX = 0;
        this.mouseY = 0;
        this.screenX = window.innerWidth / 2;
        this.screenY = window.innerHeight / 2;

        // Input state
        this.isPointerDown = false;
        this.keysPressed = new Set();

        // Joystick-based target position (for mobile)
        this.joystickTargetX = 0;
        this.joystickTargetY = 0;
        this.lastAimAngle = Math.PI / 2; // Default up

        // LERP SMOOTHING: Smoothed velocity for "mass effect" feel
        this.smoothedVelocityX = 0;
        this.smoothedVelocityY = 0;

        // AUTO-PULSE SHOOTING: Timer and state
        this.autoPulseTimer = 0;
        this.enemyInRange = false;
        this.nearestEnemyPos = null;

        // Callbacks
        this.onDecoy = null;
        this.onFreeze = null;
        this.onAura = null;
        this.onPause = null;
        this.onFire = null;

        // ========================================
        // GESTURE DETECTION STATE
        // ========================================
        this.gestureState = {
            touchStartTime: 0,
            touchStartX: 0,
            touchStartY: 0,
            lastTapTime: 0,
            isDragging: false,
            longPressTimer: null,
            longPressTriggered: false
        };

        // Callbacks for gesture-triggered actions
        this.onTapKill = null;      // (worldX, worldY, enemy) => void
        this.onAbilityPulse = null; // (type) => void - 'aura' or 'freeze'

        // Bind event handlers
        this.bindEvents();

        // Initial position
        this.updateWorldPosition();
    }

    bindEvents() {
        const canvas = this.world3D.renderer.domElement;

        // Pointer move (desktop)
        window.addEventListener('pointermove', (e) => {
            // Ignore on mobile (use joystick) and if over UI
            if (this.mobileControls.isMobile) return;
            if (e.target.closest('.hud-button, .menu-btn, #pause-button, .menu-card')) {
                return;
            }

            this.screenX = e.clientX;
            this.screenY = e.clientY;
            this.updateWorldPosition();
        });

        // Pointer down (start firing - desktop)
        canvas.addEventListener('pointerdown', (e) => {
            if (this.mobileControls.isMobile) return;
            this.isPointerDown = true;
            this.screenX = e.clientX;
            this.screenY = e.clientY;
            this.updateWorldPosition();
        });

        // Pointer up (stop firing - desktop)
        window.addEventListener('pointerup', () => {
            if (this.mobileControls.isMobile) return;
            this.isPointerDown = false;
        });

        // Touch events for canvas (only if not using mobile controls)
        canvas.addEventListener('touchstart', (e) => {
            if (this.mobileControls.isMobile) return; // Let MobileControls handle
            e.preventDefault();
            this.isPointerDown = true;
            if (e.touches.length > 0) {
                this.screenX = e.touches[0].clientX;
                this.screenY = e.touches[0].clientY;
                this.updateWorldPosition();
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (this.mobileControls.isMobile) return;
            e.preventDefault();
            if (e.touches.length > 0) {
                this.screenX = e.touches[0].clientX;
                this.screenY = e.touches[0].clientY;
                this.updateWorldPosition();
            }
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            if (this.mobileControls.isMobile) return;
            this.isPointerDown = false;
        });

        // Keyboard
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keysPressed.add(key);

            // Handle specific keys
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.onDecoy) this.onDecoy();
            } else if (e.code === 'KeyF') {
                e.preventDefault();
                if (this.onFreeze) this.onFreeze();
            } else if (e.code === 'KeyR') {
                e.preventDefault();
                if (this.onAura) this.onAura();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (this.onPause) this.onPause();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keysPressed.delete(e.key.toLowerCase());
        });

        // Handle resize
        window.addEventListener('resize', () => {
            this.updateWorldPosition();
        });

        // ========================================
        // GESTURE DETECTION: Tap, Double-Tap, Long-Press
        // ========================================
        this.bindGestureEvents();
    }

    bindGestureEvents() {
        const canvas = this.world3D.renderer.domElement;

        // Touch start - begin gesture tracking
        canvas.addEventListener('touchstart', (e) => {
            // Skip if touching UI elements
            if (e.target.closest('.joystick-area, .buttons-area, .menu-card, #pause-button')) {
                return;
            }

            const touch = e.touches[0];
            this.gestureState.touchStartTime = performance.now();
            this.gestureState.touchStartX = touch.clientX;
            this.gestureState.touchStartY = touch.clientY;
            this.gestureState.isDragging = false;
            this.gestureState.longPressTriggered = false;

            // Start long-press timer for FREEZE ability
            this.gestureState.longPressTimer = setTimeout(() => {
                if (!this.gestureState.isDragging && this.onFreeze) {
                    this.gestureState.longPressTriggered = true;
                    this.onFreeze();
                    if (this.onAbilityPulse) this.onAbilityPulse('freeze');
                }
            }, LONG_PRESS_DURATION);
        }, { passive: true });

        // Touch move - detect dragging vs tap
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 0) return;
            const touch = e.touches[0];
            const dx = touch.clientX - this.gestureState.touchStartX;
            const dy = touch.clientY - this.gestureState.touchStartY;
            const dist = Math.hypot(dx, dy);

            // If moved beyond threshold, it's a drag not a tap
            if (dist > TAP_MAX_MOVE) {
                this.gestureState.isDragging = true;
                // Cancel long-press if dragging
                if (this.gestureState.longPressTimer) {
                    clearTimeout(this.gestureState.longPressTimer);
                    this.gestureState.longPressTimer = null;
                }
            }
        }, { passive: true });

        // Touch end - detect tap type
        canvas.addEventListener('touchend', (e) => {
            // Cancel long-press timer
            if (this.gestureState.longPressTimer) {
                clearTimeout(this.gestureState.longPressTimer);
                this.gestureState.longPressTimer = null;
            }

            // Skip if long-press was triggered or it was a drag
            if (this.gestureState.longPressTriggered) return;
            if (this.gestureState.isDragging) return;

            const now = performance.now();
            const duration = now - this.gestureState.touchStartTime;

            // Only count as tap if quick enough
            if (duration > TAP_MAX_DURATION) return;

            // Check for DOUBLE-TAP (Aura ability)
            if (now - this.gestureState.lastTapTime < DOUBLE_TAP_WINDOW) {
                // DOUBLE-TAP: Trigger Aura
                if (this.onAura) {
                    this.onAura();
                    if (this.onAbilityPulse) this.onAbilityPulse('aura');
                }
                this.gestureState.lastTapTime = 0; // Reset to prevent triple-tap
            } else {
                // SINGLE TAP: Attempt tap-to-kill
                this.gestureState.lastTapTime = now;
                this.attemptTapKill(
                    this.gestureState.touchStartX,
                    this.gestureState.touchStartY
                );
            }
        }, { passive: true });
    }

    // ========================================
    // TAP-TO-KILL: Raycast to enemy pool
    // ========================================
    attemptTapKill(screenX, screenY) {
        if (!this.enemyPool || this.enemyPool.length === 0) return;

        // Convert screen coords to world position
        const worldPos = this.world3D.screenToWorld(screenX, screenY);

        // Find enemy within tap radius (performance: only check enemyPool)
        let hitEnemy = null;
        let hitDist = TAP_KILL_RADIUS;

        for (const enemy of this.enemyPool) {
            const dx = enemy.x - worldPos.x;
            const dy = enemy.y - worldPos.y;
            const dist = Math.hypot(dx, dy);
            if (dist < hitDist) {
                hitDist = dist;
                hitEnemy = enemy;
            }
        }

        // If hit, trigger callback for instant kill
        if (hitEnemy && this.onTapKill) {
            this.onTapKill(worldPos.x, worldPos.y, hitEnemy);
        }
    }

    // Set enemy pool reference for raycast (called each frame from Game.js)
    setEnemyPool(enemies) {
        this.enemyPool = enemies;
    }

    updateWorldPosition() {
        const worldPos = this.world3D.screenToWorld(this.screenX, this.screenY);
        this.mouseX = worldPos.x;
        this.mouseY = worldPos.y;
    }

    // Update joystick target each frame (call from game loop)
    updateJoystickTarget(playerX, playerY, bounds, dt = 0.016) {
        if (!this.mobileControls.isMobile) return;

        const move = this.mobileControls.getMoveVector();
        const speed = 400; // Movement speed in world units

        // INPUT CALIBRATION: Apply 0.2 multiplier to raw touch input
        // This dampens sensitivity on high-DPI mobile screens
        const rawVelocityX = move.x * INPUT_SENSITIVITY * speed;
        const rawVelocityY = move.y * INPUT_SENSITIVITY * speed;

        // ========================================
        // JOYSTICK SMOOTHING (LERP): "Mass Effect"
        // Ship floats into position rather than snapping
        // Using 0.08 lerp factor for buttery smooth 120Hz feel
        // ========================================
        this.smoothedVelocityX += (rawVelocityX - this.smoothedVelocityX) * JOYSTICK_LERP_FACTOR;
        this.smoothedVelocityY += (rawVelocityY - this.smoothedVelocityY) * JOYSTICK_LERP_FACTOR;

        // Calculate target position based on SMOOTHED velocity + player position
        this.joystickTargetX = playerX + this.smoothedVelocityX;
        this.joystickTargetY = playerY + this.smoothedVelocityY;

        // Clamp to bounds
        const margin = 20;
        this.joystickTargetX = Math.max(bounds.left + margin, Math.min(bounds.right - margin, this.joystickTargetX));
        this.joystickTargetY = Math.max(bounds.bottom + margin, Math.min(bounds.top - margin, this.joystickTargetY));

        // Update aim angle based on movement
        const mag = Math.hypot(move.x, move.y);
        if (mag > 0.1) {
            this.lastAimAngle = Math.atan2(move.y, move.x);
        }
    }

    // ========================================
    // AUTO-PULSE SHOOTING: Check enemies in range
    // ========================================
    updateAutoPulse(dt, playerX, playerY, enemies) {
        if (!this.mobileControls.isMobile) return;

        // Update timer
        this.autoPulseTimer += dt;

        // Find nearest enemy within range
        this.enemyInRange = false;
        this.nearestEnemyPos = null;
        let nearestDist = AUTO_PULSE_RANGE;

        for (const enemy of enemies) {
            const dx = enemy.x - playerX;
            const dy = enemy.y - playerY;
            const dist = Math.hypot(dx, dy);
            if (dist < nearestDist) {
                nearestDist = dist;
                this.enemyInRange = true;
                this.nearestEnemyPos = { x: enemy.x, y: enemy.y };
            }
        }
    }

    // Check if auto-pulse should fire (touching screen + enemy in range + interval elapsed)
    shouldAutoPulse() {
        if (!this.mobileControls.isMobile) return false;
        if (!this.mobileControls.joystick.active) return false; // Must be touching screen
        if (!this.enemyInRange) return false;
        if (this.autoPulseTimer < AUTO_PULSE_INTERVAL) return false;

        // Reset timer and fire
        this.autoPulseTimer = 0;
        return true;
    }

    // Get auto-pulse aim direction (toward nearest enemy)
    getAutoPulseDirection(playerX, playerY) {
        if (!this.nearestEnemyPos) return null;
        const dx = this.nearestEnemyPos.x - playerX;
        const dy = this.nearestEnemyPos.y - playerY;
        const dist = Math.hypot(dx, dy) || 1;
        return { x: dx / dist, y: dy / dist };
    }

    getTargetPosition() {
        if (this.mobileControls.isMobile) {
            return { x: this.joystickTargetX, y: this.joystickTargetY };
        }
        return { x: this.mouseX, y: this.mouseY };
    }

    getAimDirection() {
        if (this.mobileControls.isMobile) {
            return this.mobileControls.getAimDirection();
        }
        // Desktop: aim toward mouse
        return null; // Let caller compute from mouse position
    }

    isFiring() {
        if (this.mobileControls.isMobile) {
            return this.mobileControls.isShooting;
        }
        return this.isPointerDown;
    }

    // Check mobile ability requests
    checkMobileAbilities() {
        if (!this.mobileControls.isMobile) return;

        if (this.mobileControls.requestFreeze() && this.onFreeze) {
            this.onFreeze();
        }
        if (this.mobileControls.requestAura() && this.onAura) {
            this.onAura();
        }
        if (this.mobileControls.requestDecoy() && this.onDecoy) {
            this.onDecoy();
        }
    }

    // Show/hide mobile controls
    showMobileControls() {
        this.mobileControls.show();
    }

    hideMobileControls() {
        this.mobileControls.hide();
    }

    updateMobileCooldowns(freezeProgress, auraProgress, decoyProgress) {
        this.mobileControls.updateCooldowns(freezeProgress, auraProgress, decoyProgress);
    }

    isKeyPressed(key) {
        return this.keysPressed.has(key.toLowerCase());
    }

    // Setup HUD button callbacks
    setupHUDButtons(callbacks) {
        const { onDecoy, onFreeze, onAura, onWeapon, onPause } = callbacks;

        this.onDecoy = onDecoy;
        this.onFreeze = onFreeze;
        this.onAura = onAura;
        this.onPause = onPause;

        // HUD buttons
        const btnDecoy = document.getElementById('btn-decoy');
        const btnFreeze = document.getElementById('btn-freeze');
        const btnAura = document.getElementById('btn-aura');
        const btnWeapon = document.getElementById('btn-weapon');
        const pauseBtn = document.getElementById('pause-button');

        if (btnDecoy) {
            btnDecoy.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onDecoy) onDecoy();
            });
        }

        if (btnFreeze) {
            btnFreeze.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onFreeze) onFreeze();
            });
        }

        if (btnAura) {
            btnAura.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onAura) onAura();
            });
        }

        if (btnWeapon) {
            btnWeapon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onWeapon) onWeapon();
            });
        }

        if (pauseBtn) {
            pauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onPause) onPause();
            });
        }
    }

    dispose() {
        // Event listeners are on window/canvas, no explicit removal needed
        // in game context (page reload cleans up)
    }
}
