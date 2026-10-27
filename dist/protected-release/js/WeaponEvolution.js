/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (WeaponEvolution.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
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
this.unlockedEvolutions = new Set();
this.activeEvolution = null; // Currently equipped evolved weapon
this.vortices = []; // For singularity storm
this.spores = [];   // For bio-hazard
this.lastRadialBurst = 0;
this.group = new THREE.Group();
this.scene.add(this.group);
this.beamMesh = null;
this.beamGlowMesh = null;
this.beamActiveUntil = 0;
this.lastGlacialFire = 0;
this.lastBioSpawn = 0;
this.lastVortexTick = 0;
this._createGlacialBeamMesh();
}
_createGlacialBeamMesh() {
const beamLength = 420;
const geo = new THREE.PlaneGeometry(beamLength, 14);
geo.translate(beamLength / 2, 0, 0);
const mat = new THREE.MeshBasicMaterial({
color: 0x38bdf8,
transparent: true,
opacity: 0,
side: THREE.DoubleSide,
blending: THREE.AdditiveBlending
});
this.beamMesh = new THREE.Mesh(geo, mat);
const glowGeo = new THREE.PlaneGeometry(beamLength, 32);
glowGeo.translate(beamLength / 2, 0, 0);
const glowMat = new THREE.MeshBasicMaterial({
color: 0x0284c7,
transparent: true,
opacity: 0,
side: THREE.DoubleSide,
blending: THREE.AdditiveBlending
});
this.beamGlowMesh = new THREE.Mesh(glowGeo, glowMat);
this.beamMesh.add(this.beamGlowMesh);
this.group.add(this.beamMesh);
}
*/
checkUnlockConditions(sector, flow, combo, landmarksCollected) {
const newlyUnlocked = [];
if (((sector >= 2 && combo >= 3) || sector >= 4) && !this.unlockedEvolutions.has('glacialBeam')) {
this.unlock('glacialBeam');
newlyUnlocked.push(WEAPON_EVOLUTIONS.glacialBeam);
}
if ((sector >= 5 || landmarksCollected >= 3) && !this.unlockedEvolutions.has('singularityStorm')) {
this.unlock('singularityStorm');
newlyUnlocked.push(WEAPON_EVOLUTIONS.singularityStorm);
}
if ((sector >= 7 || (sector >= 4 && landmarksCollected >= 5)) && !this.unlockedEvolutions.has('bioHazard')) {
this.unlock('bioHazard');
newlyUnlocked.push(WEAPON_EVOLUTIONS.bioHazard);
}
if (sector >= 9 && flow >= 40 && !this.unlockedEvolutions.has('quantumOverdrive')) {
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
*/
update(dt, time, playerX, playerY, enemies, bullets, onEnemyKilled) {
if (this.unlockedEvolutions.size === 0) return;
if (this.unlockedEvolutions.has('glacialBeam')) {
this.updateGlacialBeam(dt, time, playerX, playerY, enemies, onEnemyKilled);
}
if (this.unlockedEvolutions.has('singularityStorm')) {
this.updateSingularityStorm(dt, time, playerX, playerY, enemies, onEnemyKilled);
}
if (this.unlockedEvolutions.has('bioHazard')) {
this.updateBioHazardSwarm(dt, time, playerX, playerY, enemies, onEnemyKilled);
}
if (this.unlockedEvolutions.has('quantumOverdrive')) {
if (time - this.lastRadialBurst > WEAPON_EVOLUTIONS.quantumOverdrive.burstInterval) {
this.lastRadialBurst = time;
this.triggerRadialBurst(playerX, playerY, bullets, time);
}
}
}
updateGlacialBeam(dt, time, px, py, enemies, onEnemyKilled) {
if (time - this.lastGlacialFire > 2.2 && enemies.length > 0) {
this.lastGlacialFire = time;
this.beamActiveUntil = time + 0.65;
let nearest = enemies[0];
let bestDist = Infinity;
for (const e of enemies) {
const d = Math.hypot(e.x - px, e.y - py);
if (d < bestDist) {
bestDist = d;
nearest = e;
}
}
this.beamAngle = Math.atan2(nearest.y - py, nearest.x - px);
const cos = Math.cos(this.beamAngle);
const sin = Math.sin(this.beamAngle);
for (let i = enemies.length - 1; i >= 0; i--) {
const e = enemies[i];
const rx = e.x - px;
const ry = e.y - py;
const proj = rx * cos + ry * sin;
const perp = Math.abs(-rx * sin + ry * cos);
if (proj > 0 && proj < 420 && perp < (e.r + 18)) {
e.baseSpeed = Math.max(0.35, e.baseSpeed * 0.85);
const dead = e.takeDamage?.(2.5);
if (dead && onEnemyKilled) {
onEnemyKilled(e, i);
}
}
}
}
if (this.beamMesh) {
if (time < this.beamActiveUntil) {
const remain = (this.beamActiveUntil - time) / 0.65;
this.beamMesh.position.set(px, py, 1);
this.beamMesh.rotation.z = this.beamAngle || 0;
this.beamMesh.material.opacity = 0.85 * remain;
this.beamGlowMesh.material.opacity = 0.45 * remain;
} else {
this.beamMesh.material.opacity = 0;
this.beamGlowMesh.material.opacity = 0;
}
}
}
updateSingularityStorm(dt, time, px, py, enemies, onEnemyKilled) {
if (this.vortices.length < 3 && Math.random() < 0.04) {
const angle = Math.random() * Math.PI * 2;
const dist = 60 + Math.random() * 140;
const vx = px + Math.cos(angle) * dist;
const vy = py + Math.sin(angle) * dist;
const geo = new THREE.TorusGeometry(14, 2.5, 8, 24);
const mat = new THREE.MeshBasicMaterial({
color: 0xa855f7,
transparent: true,
opacity: 0.85,
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
const shouldTickDamage = (time - this.lastVortexTick) >= 0.25;
if (shouldTickDamage) this.lastVortexTick = time;
for (let i = this.vortices.length - 1; i >= 0; i--) {
const v = this.vortices[i];
v.ttl -= dt;
v.mesh.rotation.z += dt * 5;
v.mesh.scale.setScalar(1 + 0.3 * Math.sin(time * 8));
for (let j = enemies.length - 1; j >= 0; j--) {
const e = enemies[j];
const dx = v.x - e.x;
const dy = v.y - e.y;
const d = Math.hypot(dx, dy);
if (d < v.radius && d > 10) {
const pull = (80 / (d + 20)) * dt * 60;
e.x += (dx / d) * pull;
e.y += (dy / d) * pull;
if (shouldTickDamage) {
const dead = e.takeDamage?.(1.5);
if (dead && onEnemyKilled) {
onEnemyKilled(e, j);
}
}
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
updateBioHazardSwarm(dt, time, px, py, enemies, onEnemyKilled) {
if (time - this.lastBioSpawn > 1.4 && enemies.length > 0 && this.spores.length < 8) {
this.lastBioSpawn = time;
for (let k = 0; k < 2; k++) {
const angle = (k === 0 ? 1 : -1) * (Math.PI / 3) + Math.random() * 0.5;
const geo = new THREE.OctahedronGeometry(4.5, 0);
const mat = new THREE.MeshBasicMaterial({
color: 0x4ade80,
transparent: true,
opacity: 0.95
});
const mesh = new THREE.Mesh(geo, mat);
mesh.position.set(px, py, 2);
this.group.add(mesh);
this.spores.push({
x: px,
y: py,
vx: Math.cos(angle) * 260,
vy: Math.sin(angle) * 260,
mesh,
ttl: 3.0,
chainsLeft: 2
});
}
}
for (let i = this.spores.length - 1; i >= 0; i--) {
const s = this.spores[i];
s.ttl -= dt;
let target = null;
let bestDist = Infinity;
let targetIdx = -1;
for (let j = 0; j < enemies.length; j++) {
const e = enemies[j];
const d = Math.hypot(e.x - s.x, e.y - s.y);
if (d < bestDist) {
bestDist = d;
target = e;
targetIdx = j;
}
}
if (target) {
const desiredAngle = Math.atan2(target.y - s.y, target.x - s.x);
const speed = 320;
s.vx = s.vx * 0.88 + Math.cos(desiredAngle) * speed * 0.12;
s.vy = s.vy * 0.88 + Math.sin(desiredAngle) * speed * 0.12;
}
s.x += s.vx * dt;
s.y += s.vy * dt;
s.mesh.position.set(s.x, s.y, 2);
s.mesh.rotation.z += dt * 10;
s.mesh.rotation.x += dt * 8;
if (target && bestDist < target.r + 8) {
const dead = target.takeDamage?.(2.0);
if (dead && onEnemyKilled) {
onEnemyKilled(target, targetIdx);
}
if (s.chainsLeft > 0 && enemies.length > 0) {
s.chainsLeft--;
s.vx = -s.vx;
s.vy = -s.vy;
} else {
s.ttl = 0;
}
}
if (s.ttl <= 0) {
this.group.remove(s.mesh);
s.mesh.geometry.dispose();
s.mesh.material.dispose();
this.spores.splice(i, 1);
}
}
}
triggerRadialBurst(px, py, bullets, time) {
if (!bullets) return;
const count = 12;
for (let i = 0; i < count; i++) {
const angle = (i / count) * Math.PI * 2;
const dx = Math.cos(angle);
const dy = Math.sin(angle);
bullets.spawnPlayerBullet(px, py, dx, dy, 1.8, 'electric', time);
}
if (this.audio && this.audio.playExplode) {
this.audio.playExplode('C3');
}
}
getActiveEvolutionName() {
if (this.unlockedEvolutions.size === 0) return null;
return Array.from(this.unlockedEvolutions)
.map(id => WEAPON_EVOLUTIONS[id]?.name)
.filter(Boolean)
.join(' + ');
}
reset() {
this.unlockedEvolutions.clear();
this.activeEvolution = null;
if (this.beamMesh) {
this.beamMesh.material.opacity = 0;
this.beamGlowMesh.material.opacity = 0;
}
for (const v of this.vortices) {
this.group.remove(v.mesh);
v.mesh.geometry.dispose();
v.mesh.material.dispose();
}
this.vortices = [];
for (const s of this.spores) {
this.group.remove(s.mesh);
s.mesh.geometry.dispose();
s.mesh.material.dispose();
}
this.spores = [];
}
dispose() {
this.reset();
if (this.beamMesh) {
this.group.remove(this.beamMesh);
this.beamMesh.geometry.dispose();
this.beamMesh.material.dispose();
this.beamGlowMesh.geometry.dispose();
this.beamGlowMesh.material.dispose();
}
this.scene.remove(this.group);
}
}
