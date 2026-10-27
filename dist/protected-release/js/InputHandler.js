/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (InputHandler.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
const INPUT_SENSITIVITY = 0.2;
const JOYSTICK_LERP_FACTOR = 0.08;
const AUTO_PULSE_INTERVAL = 0.2;
const AUTO_PULSE_RANGE = 400; // World units - max distance to auto-fire at enemy
const TAP_MAX_DURATION = 200;     // Max ms for a tap (vs drag)
const TAP_MAX_MOVE = 15;          // Max pixels moved for tap (vs drag)
const DOUBLE_TAP_WINDOW = 300;    // Max ms between taps for double-tap
const LONG_PRESS_DURATION = 500;  // Ms to hold for freeze ability
const TAP_KILL_RADIUS = 50;       // World units - hitbox for tap-to-kill
class InputHandler {
constructor(world3D) {
this.world3D = world3D;
this.mobileControls = new MobileControls();
this.mouseX = 0;
this.mouseY = 0;
this.screenX = window.innerWidth / 2;
this.screenY = window.innerHeight / 2;
this.isPointerDown = false;
this.keysPressed = new Set();
this.joystickTargetX = 0;
this.joystickTargetY = 0;
this.lastAimAngle = Math.PI / 2; // Default up
this.smoothedVelocityX = 0;
this.smoothedVelocityY = 0;
this.autoPulseTimer = 0;
this.enemyInRange = false;
this.nearestEnemyPos = null;
this.onDecoy = null;
this.onFreeze = null;
this.onAura = null;
this.onPause = null;
this.onFire = null;
this.gestureState = {
touchStartTime: 0,
touchStartX: 0,
touchStartY: 0,
lastTapTime: 0,
isDragging: false,
longPressTimer: null,
longPressTriggered: false
};
this.onTapKill = null;      // (worldX, worldY, enemy) => void
this.onAbilityPulse = null; // (type) => void - 'aura' or 'freeze'
this.bindEvents();
this.updateWorldPosition();
}
bindEvents() {
const canvas = this.world3D.renderer.domElement;
window.addEventListener('pointermove', (e) => {
if (this.mobileControls.isMobile) return;
if (e.target.closest('.hud-button, .menu-btn, #pause-button, .menu-card')) {
return;
}
this.screenX = e.clientX;
this.screenY = e.clientY;
this.updateWorldPosition();
});
canvas.addEventListener('pointerdown', (e) => {
if (this.mobileControls.isMobile) return;
this.isPointerDown = true;
this.screenX = e.clientX;
this.screenY = e.clientY;
this.updateWorldPosition();
});
window.addEventListener('pointerup', () => {
if (this.mobileControls.isMobile) return;
this.isPointerDown = false;
});
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
window.addEventListener('keydown', (e) => {
const key = e.key.toLowerCase();
this.keysPressed.add(key);
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
window.addEventListener('resize', () => {
this.updateWorldPosition();
});
this.bindGestureEvents();
}
bindGestureEvents() {
const canvas = this.world3D.renderer.domElement;
canvas.addEventListener('touchstart', (e) => {
if (e.target.closest('.joystick-area, .buttons-area, .menu-card, #pause-button')) {
return;
}
const touch = e.touches[0];
this.gestureState.touchStartTime = performance.now();
this.gestureState.touchStartX = touch.clientX;
this.gestureState.touchStartY = touch.clientY;
this.gestureState.isDragging = false;
this.gestureState.longPressTriggered = false;
this.gestureState.longPressTimer = setTimeout(() => {
if (!this.gestureState.isDragging && this.onFreeze) {
this.gestureState.longPressTriggered = true;
this.onFreeze();
if (this.onAbilityPulse) this.onAbilityPulse('freeze');
}
}, LONG_PRESS_DURATION);
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
if (e.touches.length === 0) return;
const touch = e.touches[0];
const dx = touch.clientX - this.gestureState.touchStartX;
const dy = touch.clientY - this.gestureState.touchStartY;
const dist = Math.hypot(dx, dy);
if (dist > TAP_MAX_MOVE) {
this.gestureState.isDragging = true;
if (this.gestureState.longPressTimer) {
clearTimeout(this.gestureState.longPressTimer);
this.gestureState.longPressTimer = null;
}
}
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
if (this.gestureState.longPressTimer) {
clearTimeout(this.gestureState.longPressTimer);
this.gestureState.longPressTimer = null;
}
if (this.gestureState.longPressTriggered) return;
if (this.gestureState.isDragging) return;
const now = performance.now();
const duration = now - this.gestureState.touchStartTime;
if (duration > TAP_MAX_DURATION) return;
if (now - this.gestureState.lastTapTime < DOUBLE_TAP_WINDOW) {
if (this.onAura) {
this.onAura();
if (this.onAbilityPulse) this.onAbilityPulse('aura');
}
this.gestureState.lastTapTime = 0; // Reset to prevent triple-tap
} else {
this.gestureState.lastTapTime = now;
this.attemptTapKill(
this.gestureState.touchStartX,
this.gestureState.touchStartY
);
}
}, { passive: true });
}
attemptTapKill(screenX, screenY) {
if (!this.enemyPool || this.enemyPool.length === 0) return;
const worldPos = this.world3D.screenToWorld(screenX, screenY);
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
if (hitEnemy && this.onTapKill) {
this.onTapKill(worldPos.x, worldPos.y, hitEnemy);
}
}
setEnemyPool(enemies) {
this.enemyPool = enemies;
}
updateWorldPosition() {
const worldPos = this.world3D.screenToWorld(this.screenX, this.screenY);
this.mouseX = worldPos.x;
this.mouseY = worldPos.y;
}
updateJoystickTarget(playerX, playerY, bounds, dt = 0.016) {
if (!this.mobileControls.isMobile) return;
const move = this.mobileControls.getMoveVector();
const speed = 400; // Movement speed in world units
const rawVelocityX = move.x * INPUT_SENSITIVITY * speed;
const rawVelocityY = move.y * INPUT_SENSITIVITY * speed;
this.smoothedVelocityX += (rawVelocityX - this.smoothedVelocityX) * JOYSTICK_LERP_FACTOR;
this.smoothedVelocityY += (rawVelocityY - this.smoothedVelocityY) * JOYSTICK_LERP_FACTOR;
this.joystickTargetX = playerX + this.smoothedVelocityX;
this.joystickTargetY = playerY + this.smoothedVelocityY;
const margin = 20;
this.joystickTargetX = Math.max(bounds.left + margin, Math.min(bounds.right - margin, this.joystickTargetX));
this.joystickTargetY = Math.max(bounds.bottom + margin, Math.min(bounds.top - margin, this.joystickTargetY));
const mag = Math.hypot(move.x, move.y);
if (mag > 0.1) {
this.lastAimAngle = Math.atan2(move.y, move.x);
}
}
updateAutoPulse(dt, playerX, playerY, enemies) {
if (!this.mobileControls.isMobile) return;
this.autoPulseTimer += dt;
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
shouldAutoPulse() {
if (!this.mobileControls.isMobile) return false;
if (!this.mobileControls.joystick.active) return false; // Must be touching screen
if (!this.enemyInRange) return false;
if (this.autoPulseTimer < AUTO_PULSE_INTERVAL) return false;
this.autoPulseTimer = 0;
return true;
}
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
return null; // Let caller compute from mouse position
}
isFiring() {
if (this.mobileControls.isMobile) {
return this.mobileControls.isShooting;
}
return this.isPointerDown;
}
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
setupHUDButtons(callbacks) {
const { onDecoy, onFreeze, onAura, onWeapon, onPause } = callbacks;
this.onDecoy = onDecoy;
this.onFreeze = onFreeze;
this.onAura = onAura;
this.onPause = onPause;
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
}
}
