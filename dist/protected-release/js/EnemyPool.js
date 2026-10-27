/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (EnemyPool.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class EnemyPool {
constructor(scene) {
this.scene = scene;
this.MAX_INSTANCES = 500;
this.activeCount = 0;
this.enemies = new Array(this.MAX_INSTANCES).fill(null);
this.matrices = new Array(this.MAX_INSTANCES);
this.colors = new Array(this.MAX_INSTANCES);
this.tempMatrix = new THREE.Matrix4();
this.tempPosition = new THREE.Vector3();
this.tempQuaternion = new THREE.Quaternion();
this.tempScale = new THREE.Vector3();
this.tempColor = new THREE.Color();
this.SEPARATION_DISTANCE = 50;      // Min distance between units
this.ALIGNMENT_RADIUS = 100;        // Radius for velocity averaging
this.COHESION_RADIUS = 150;         // Radius for center-of-mass
this.SEPARATION_WEIGHT = 1.5;
this.ALIGNMENT_WEIGHT = 0.8;
this.COHESION_WEIGHT = 0.5;
this.MAX_STEER_FORCE = 200;
this.createInstancedMesh();
}
createInstancedMesh() {
const geometry = new THREE.IcosahedronGeometry(12, 1);
const material = new THREE.MeshPhongMaterial({
color: 0xffffff,
emissive: 0x000000,
shininess: 30,
flatShading: true
});
this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.MAX_INSTANCES);
this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
new Float32Array(this.MAX_INSTANCES * 3),
3
);
this.instancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < this.MAX_INSTANCES; i++) {
this.instancedMesh.setMatrixAt(i, hideMatrix);
this.instancedMesh.setColorAt(i, new THREE.Color(0x000000));
}
this.instancedMesh.instanceMatrix.needsUpdate = true;
this.instancedMesh.instanceColor.needsUpdate = true;
this.scene.add(this.instancedMesh);
const glowMaterial = new THREE.MeshBasicMaterial({
color: 0xff0000,
transparent: true,
opacity: 0.3,
blending: THREE.AdditiveBlending
});
this.glowMesh = new THREE.InstancedMesh(
new THREE.IcosahedronGeometry(15, 0),
glowMaterial,
this.MAX_INSTANCES
);
this.glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
for (let i = 0; i < this.MAX_INSTANCES; i++) {
this.glowMesh.setMatrixAt(i, hideMatrix);
}
this.glowMesh.instanceMatrix.needsUpdate = true;
this.scene.add(this.glowMesh);
}
spawn(x, y, type = 'normal', sector = 1) {
let slot = -1;
for (let i = 0; i < this.MAX_INSTANCES; i++) {
if (this.enemies[i] === null) {
slot = i;
break;
}
}
if (slot === -1) {
console.warn('[EnemyPool] No free slots!');
return null;
}
const dna = typeof enemyDNA !== 'undefined'
? enemyDNA.spawnNextGenDNA(sector)
: { speed: 1.0, aggro: 1.0, scale: 1.0, emissive: 0.3, spawnTime: performance.now(), survivalTime: 0 };
const enemy = {
slot,
x, y, z: 0,
vx: 0, vy: 0,
type,
sector,
dna,
hp: this.getBaseHP(type) * dna.scale,
maxHP: this.getBaseHP(type) * dna.scale,
baseSpeed: this.getBaseSpeed(type) * dna.speed,
state: 'idle',
stateTimer: 0,
color: this.getTypeColor(type),
spawnTime: performance.now() / 1000,
active: true
};
if (typeof enemyDNA !== 'undefined') {
enemyDNA.registerEnemy(enemy);
}
this.enemies[slot] = enemy;
this.activeCount++;
this.updateInstanceMatrix(enemy);
return enemy;
}
kill(enemy) {
if (!enemy || !enemy.active) return;
enemy.dna.survivalTime = performance.now() - enemy.dna.spawnTime;
if (typeof enemyDNA !== 'undefined') {
enemyDNA.recordDeath(enemy);
}
const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
this.instancedMesh.setMatrixAt(enemy.slot, hideMatrix);
this.glowMesh.setMatrixAt(enemy.slot, hideMatrix);
enemy.active = false;
this.enemies[enemy.slot] = null;
this.activeCount--;
this.instancedMesh.instanceMatrix.needsUpdate = true;
this.glowMesh.instanceMatrix.needsUpdate = true;
}
update(dt, playerPos, decoyPos, frozen, time, sector) {
if (this.activeCount === 0) return [];
if (typeof enemyDNA !== 'undefined') {
this.SEPARATION_DISTANCE = enemyDNA.getSeparationDistance(sector);
}
const results = [];
for (let i = 0; i < this.MAX_INSTANCES; i++) {
const enemy = this.enemies[i];
if (!enemy || !enemy.active) continue;
if (frozen) {
const flash = Math.sin(time * 10) * 0.3 + 0.7;
this.tempColor.setHex(0x88ddff).multiplyScalar(flash);
this.instancedMesh.setColorAt(enemy.slot, this.tempColor);
continue;
}
const target = decoyPos || playerPos;
const steering = this.calculateSteering(enemy, target);
enemy.vx += steering.x * dt;
enemy.vy += steering.y * dt;
const speed = Math.hypot(enemy.vx, enemy.vy);
const maxSpeed = enemy.baseSpeed * (enemy.dna?.aggro || 1.0);
if (speed > maxSpeed) {
enemy.vx = (enemy.vx / speed) * maxSpeed;
enemy.vy = (enemy.vy / speed) * maxSpeed;
}
this.applyElementalPhysics(enemy, sector, dt);
enemy.x += enemy.vx * dt;
enemy.y += enemy.vy * dt;
if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y) ||
!Number.isFinite(enemy.vx) || !Number.isFinite(enemy.vy)) {
console.warn('[EnemyPool] NaN detected, resetting enemy position');
enemy.x = 0;
enemy.y = 0;
enemy.vx = 0;
enemy.vy = 0;
}
this.updateInstanceMatrix(enemy);
this.updateInstanceColor(enemy, time);
}
this.instancedMesh.instanceMatrix.needsUpdate = true;
this.instancedMesh.instanceColor.needsUpdate = true;
this.glowMesh.instanceMatrix.needsUpdate = true;
return results;
}
calculateSteering(enemy, target) {
const separation = { x: 0, y: 0 };
const alignment = { x: 0, y: 0 };
const cohesion = { x: 0, y: 0 };
let separationCount = 0;
let alignmentCount = 0;
let cohesionCount = 0;
for (let i = 0; i < this.MAX_INSTANCES; i++) {
const other = this.enemies[i];
if (!other || !other.active || other === enemy) continue;
const dx = enemy.x - other.x;
const dy = enemy.y - other.y;
const dist = Math.hypot(dx, dy);
if (dist < this.SEPARATION_DISTANCE && dist > 0) {
separation.x += (dx / dist) * (this.SEPARATION_DISTANCE / dist);
separation.y += (dy / dist) * (this.SEPARATION_DISTANCE / dist);
separationCount++;
}
if (dist < this.ALIGNMENT_RADIUS) {
alignment.x += other.vx;
alignment.y += other.vy;
alignmentCount++;
}
if (dist < this.COHESION_RADIUS) {
cohesion.x += other.x;
cohesion.y += other.y;
cohesionCount++;
}
}
const steer = { x: 0, y: 0 };
if (separationCount > 0) {
steer.x += (separation.x / separationCount) * this.SEPARATION_WEIGHT;
steer.y += (separation.y / separationCount) * this.SEPARATION_WEIGHT;
}
if (alignmentCount > 0) {
const avgVx = alignment.x / alignmentCount;
const avgVy = alignment.y / alignmentCount;
steer.x += (avgVx - enemy.vx) * this.ALIGNMENT_WEIGHT;
steer.y += (avgVy - enemy.vy) * this.ALIGNMENT_WEIGHT;
}
if (cohesionCount > 0) {
const centerX = cohesion.x / cohesionCount;
const centerY = cohesion.y / cohesionCount;
steer.x += (centerX - enemy.x) * 0.01 * this.COHESION_WEIGHT;
steer.y += (centerY - enemy.y) * 0.01 * this.COHESION_WEIGHT;
}
const toTarget = {
x: target.x - enemy.x,
y: target.y - enemy.y
};
const distToTarget = Math.hypot(toTarget.x, toTarget.y);
if (distToTarget > 0.001) {
steer.x += (toTarget.x / distToTarget) * enemy.baseSpeed * 0.5;
steer.y += (toTarget.y / distToTarget) * enemy.baseSpeed * 0.5;
}
const steerMag = Math.hypot(steer.x, steer.y);
if (steerMag > this.MAX_STEER_FORCE) {
steer.x = (steer.x / steerMag) * this.MAX_STEER_FORCE;
steer.y = (steer.y / steerMag) * this.MAX_STEER_FORCE;
}
return steer;
}
applyElementalPhysics(enemy, sector, dt) {
const element = this.getElement(sector);
switch (element) {
case 'ICE':
enemy.vx *= 0.95;
enemy.vy *= 0.95;
break;
case 'FIRE':
break;
case 'NATURE':
break;
case 'WIND':
if (Math.random() < 0.02) { // 2% chance per frame
const joltStrength = 50;
enemy.vx += (Math.random() - 0.5) * joltStrength;
enemy.vy += (Math.random() - 0.5) * joltStrength;
}
break;
}
}
updateInstanceMatrix(enemy) {
this.tempPosition.set(enemy.x, enemy.y, enemy.z);
const angle = Math.atan2(enemy.vy, enemy.vx);
this.tempQuaternion.setFromEuler(new THREE.Euler(0, 0, angle));
const scale = enemy.dna?.scale || 1.0;
this.tempScale.set(scale, scale, scale);
this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
this.instancedMesh.setMatrixAt(enemy.slot, this.tempMatrix);
this.glowMesh.setMatrixAt(enemy.slot, this.tempMatrix);
}
updateInstanceColor(enemy, time) {
const baseColor = new THREE.Color(enemy.color);
const emissive = enemy.dna?.emissive || 0.3;
const pulse = 0.8 + 0.2 * Math.sin(time * 3 + enemy.slot);
baseColor.multiplyScalar(pulse * (1 + emissive));
this.instancedMesh.setColorAt(enemy.slot, baseColor);
}
getElement(sector) {
if (sector <= 5) return 'ICE';
if (sector <= 10) return 'FIRE';
if (sector <= 15) return 'NATURE';
return 'WIND';
}
getBaseHP(type) {
const hpTable = {
normal: 30,
fast: 15,
tank: 80,
shooter: 40,
reaper: 60,
boss: 500
};
return hpTable[type] || 30;
}
getBaseSpeed(type) {
const speedTable = {
normal: 80,
fast: 150,
tank: 40,
shooter: 60,
reaper: 100,
boss: 30
};
return speedTable[type] || 80;
}
getTypeColor(type) {
const colorTable = {
normal: 0xef4444,   // Red
fast: 0xf97316,    // Orange
tank: 0x8b5cf6,    // Purple
shooter: 0x22d3ee, // Cyan
reaper: 0x1e293b,  // Dark
boss: 0xf59e0b    // Gold
};
return colorTable[type] || 0xef4444;
}
getActiveEnemies() {
return this.enemies.filter(e => e !== null && e.active);
}
takeDamage(enemy, amount) {
if (!enemy || !enemy.active) return false;
enemy.hp -= amount;
if (enemy.hp <= 0) {
this.kill(enemy);
return true; // Died
}
return false; // Survived
}
dispose() {
this.scene.remove(this.instancedMesh);
this.scene.remove(this.glowMesh);
this.instancedMesh.geometry.dispose();
this.instancedMesh.material.dispose();
this.glowMesh.geometry.dispose();
this.glowMesh.material.dispose();
this.enemies = [];
this.activeCount = 0;
}
}
