/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (MobileControls.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class MobileControls {
constructor() {
this.isMobile = this.detectMobile();
this.active = false;
this.joystick = {
active: false,
origin: { x: 0, y: 0 },
current: { x: 0, y: 0 },
vector: { x: 0, y: 0 }, // Normalized -1 to 1
id: null,
baseEl: document.querySelector('.joystick-base'),
knobEl: document.querySelector('.joystick-knob')
};
this.buttons = {
shoot: false,
freeze: false,
aura: false,
decoy: false
};
this.isShooting = false;
this.rings = {
freeze: document.getElementById('ring-freeze'),
aura: document.getElementById('ring-aura'),
decoy: document.getElementById('ring-decoy')
};
this.container = document.getElementById('mobile-controls');
this.speedMultiplier = 1.5;
this.centerDeadzone = 10;
this.setupListeners();
if (this.isMobile) {
console.log('[MobileControls] Mobile device detected, controls ready');
}
}
detectMobile() {
if (typeof window.IS_MOBILE !== 'undefined') {
return window.IS_MOBILE;
}
return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
('ontouchstart' in window) ||
(navigator.maxTouchPoints > 0) ||
(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}
getAimDirection() {
const v = this.getMoveVector();
const mag = Math.hypot(v.x, v.y);
if (mag < 0.1) return null;
return { x: v.x / mag, y: v.y / mag };
}
requestFreeze() {
if (this.buttons.freeze) {
this.buttons.freeze = false;
return true;
}
return false;
}
requestAura() {
if (this.buttons.aura) {
this.buttons.aura = false;
return true;
}
return false;
}
requestDecoy() {
if (this.buttons.decoy) {
this.buttons.decoy = false;
return true;
}
return false;
}
setupListeners() {
const zone = document.querySelector('.joystick-area');
if (zone) {
zone.addEventListener('touchstart', (e) => this.handleJoystickStart(e), { passive: false });
zone.addEventListener('touchmove', (e) => this.handleJoystickMove(e), { passive: false });
zone.addEventListener('touchend', (e) => this.handleJoystickEnd(e), { passive: false });
}
this.setupButton('mobile-shoot', 'shoot');
this.setupButton('mobile-freeze', 'freeze');
this.setupButton('mobile-aura', 'aura');
this.setupButton('mobile-decoy', 'decoy');
}
setupButton(id, action) {
const btn = document.getElementById(id);
if (!btn) return;
const start = (e) => {
e.preventDefault();
e.stopPropagation();
this.buttons[action] = true;
btn.classList.add('active');
if (action === 'shoot') {
this.isShooting = true;
}
};
const end = (e) => {
e.preventDefault();
e.stopPropagation();
this.buttons[action] = false;
btn.classList.remove('active');
if (action === 'shoot') {
this.isShooting = false;
}
};
btn.addEventListener('touchstart', start, { passive: false });
btn.addEventListener('touchend', end, { passive: false });
btn.addEventListener('touchcancel', end, { passive: false });
btn.addEventListener('mousedown', start);
btn.addEventListener('mouseup', end);
btn.addEventListener('mouseleave', end);
}
handleJoystickStart(e) {
e.preventDefault();
const touch = e.changedTouches[0];
this.joystick.id = touch.identifier;
this.joystick.active = true;
const rect = this.joystick.baseEl.getBoundingClientRect();
const centerX = rect.left + rect.width / 2;
const centerY = rect.top + rect.height / 2;
this.joystick.origin = { x: centerX, y: centerY };
this.updateJoystick(touch.clientX, touch.clientY);
}
handleJoystickMove(e) {
e.preventDefault();
for (let i = 0; i < e.changedTouches.length; i++) {
if (e.changedTouches[i].identifier === this.joystick.id) {
this.updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
break;
}
}
}
handleJoystickEnd(e) {
e.preventDefault();
for (let i = 0; i < e.changedTouches.length; i++) {
if (e.changedTouches[i].identifier === this.joystick.id) {
this.resetJoystick();
break;
}
}
}
updateJoystick(x, y) {
const maxDist = 40; // Max visual distance for knob
let dx = x - this.joystick.origin.x;
let dy = y - this.joystick.origin.y;
const dist = Math.hypot(dx, dy);
if (dist < this.centerDeadzone) {
this.joystick.vector.x = 0;
this.joystick.vector.y = 0;
this.joystick.knobEl.style.transform = `translate(0px, 0px)`;
return;
}
if (dist > 0) {
const effectiveDist = dist - this.centerDeadzone;
const effectiveMax = maxDist - this.centerDeadzone;
const inputMag = Math.min(effectiveDist / effectiveMax, 1.0);
this.joystick.vector.x = (dx / dist) * inputMag;
this.joystick.vector.y = -(dy / dist) * inputMag;
const visualDist = Math.min(dist, maxDist);
const knobX = (dx / dist) * visualDist;
const knobY = (dy / dist) * visualDist;
this.joystick.knobEl.style.transform = `translate(${knobX}px, ${knobY}px)`;
}
}
resetJoystick() {
this.joystick.active = false;
this.joystick.id = null;
this.joystick.vector = { x: 0, y: 0 };
this.joystick.knobEl.style.transform = `translate(0px, 0px)`;
}
getMoveVector() {
const mag = Math.hypot(this.joystick.vector.x, this.joystick.vector.y);
if (mag < 0.1) return { x: 0, y: 0 };
return this.joystick.vector;
}
checkButton(action) {
return this.buttons[action];
}
updateCooldowns(abilities) {
if (this.rings.freeze) this.updateRing(this.rings.freeze, abilities.freeze);
if (this.rings.aura) this.updateRing(this.rings.aura, abilities.aura);
if (this.rings.decoy) this.updateRing(this.rings.decoy, abilities.decoy);
}
updateRing(el, abilityState) {
el.style.opacity = abilityState.cooldown > 0 ? 0.5 : 1;
}
show() {
this.container.style.display = 'block';
this.active = true;
}
hide() {
this.container.style.display = 'none';
this.active = false;
this.resetJoystick();
}
}
