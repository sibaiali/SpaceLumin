/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (Node.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class GameNode {
constructor(scene, x, y, sector) {
this.scene = scene;
this.x = x;
this.y = y;
this.sector = sector;
this.coreR = 12;
this.shieldR = 40;
this.maxHp = 10 + sector * 7;
this.hp = this.maxHp;
this.pulsePhase = 0;
this.createMesh();
}
createMesh() {
this.group = new THREE.Group();
this.group.position.set(this.x, this.y, 0);
const isSingularity = this.sector === 20;
if (isSingularity) {
const coreGeometry = new THREE.SphereGeometry(this.coreR * 1.65, 32, 32);
const coreMaterial = new THREE.MeshBasicMaterial({
color: 0x000000,
transparent: true,
opacity: 0.98
});
this.core = new THREE.Mesh(coreGeometry, coreMaterial);
this.group.add(this.core);
const energyGeometry = new THREE.TorusGeometry(this.coreR * 1.75, 1.8, 12, 48);
const energyMaterial = new THREE.MeshBasicMaterial({
color: 0xfef08a,
transparent: true,
opacity: 0.95,
blending: THREE.AdditiveBlending
});
this.energy = new THREE.Mesh(energyGeometry, energyMaterial);
this.group.add(this.energy);
const shieldGeometry = new THREE.IcosahedronGeometry(this.shieldR, 2);
const shieldMaterial = new THREE.MeshBasicMaterial({
color: 0x7c3aed,
transparent: true,
opacity: 0.18,
side: THREE.DoubleSide,
blending: THREE.AdditiveBlending
});
this.shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
this.group.add(this.shield);
const wireGeometry = new THREE.IcosahedronGeometry(this.shieldR * 1.02, 1);
const wireMaterial = new THREE.MeshBasicMaterial({
color: 0xa855f7,
transparent: true,
opacity: 0.45,
wireframe: true
});
this.shieldWire = new THREE.Mesh(wireGeometry, wireMaterial);
this.group.add(this.shieldWire);
const ringGeometry = new THREE.TorusGeometry(this.shieldR * 0.85, 3.2, 8, 48);
const ringMaterial = new THREE.MeshBasicMaterial({
color: 0xc084fc,
transparent: true,
opacity: 0.8,
blending: THREE.AdditiveBlending
});
this.ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
this.ring1.rotation.x = Math.PI * 0.38;
this.group.add(this.ring1);
this.ring2 = new THREE.Mesh(
new THREE.TorusGeometry(this.shieldR * 0.65, 2.0, 8, 40),
new THREE.MeshBasicMaterial({
color: 0x38bdf8,
transparent: true,
opacity: 0.75,
blending: THREE.AdditiveBlending
})
);
this.ring2.rotation.y = Math.PI * 0.42;
this.group.add(this.ring2);
this.coreLight = new THREE.PointLight(0xa78bfa, 2.2, 180);
this.group.add(this.coreLight);
} else {
const frameGeo = new THREE.TorusGeometry(this.shieldR, 2.6, 10, 32);
const frameMat = new THREE.MeshStandardMaterial({
color: 0xc8aa6e,
emissive: 0x785a28,
emissiveIntensity: 0.35,
metalness: 0.9,
roughness: 0.2
});
this.stargateFrame = new THREE.Mesh(frameGeo, frameMat);
const chevronGeo = new THREE.BoxGeometry(4.2, 8.5, 4.2);
this.chevronMat = new THREE.MeshBasicMaterial({
color: 0xf87171,
transparent: true,
opacity: 0.95
});
for (let i = 0; i < 8; i++) {
const angle = (i / 8) * Math.PI * 2;
const chevron = new THREE.Mesh(chevronGeo, this.chevronMat);
chevron.position.set(
Math.cos(angle) * this.shieldR,
Math.sin(angle) * this.shieldR,
0
);
chevron.rotation.z = angle + Math.PI / 2;
this.stargateFrame.add(chevron);
}
this.group.add(this.stargateFrame);
const shieldGeometry = new THREE.IcosahedronGeometry(this.shieldR * 0.92, 1);
const shieldMaterial = new THREE.MeshBasicMaterial({
color: 0xf87171,
transparent: true,
opacity: 0.14,
side: THREE.DoubleSide,
blending: THREE.AdditiveBlending
});
this.shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
this.group.add(this.shield);
const wireGeometry = new THREE.IcosahedronGeometry(this.shieldR * 0.94, 1);
const wireMaterial = new THREE.MeshBasicMaterial({
color: 0xf87171,
transparent: true,
opacity: 0.42,
wireframe: true
});
this.shieldWire = new THREE.Mesh(wireGeometry, wireMaterial);
this.group.add(this.shieldWire);
const coreGeometry = new THREE.OctahedronGeometry(this.shieldR * 0.46, 0);
coreGeometry.scale(0.85, 1.35, 0.85);
const coreMaterial = new THREE.MeshStandardMaterial({
color: 0xef4444,
emissive: 0x991b1b,
emissiveIntensity: 0.6,
metalness: 0.75,
roughness: 0.18,
flatShading: true
});
this.core = new THREE.Mesh(coreGeometry, coreMaterial);
this.group.add(this.core);
const energyGeometry = new THREE.OctahedronGeometry(this.coreR, 1);
const energyMaterial = new THREE.MeshBasicMaterial({
color: 0xfca5a5,
transparent: true,
opacity: 0.92
});
this.energy = new THREE.Mesh(energyGeometry, energyMaterial);
this.group.add(this.energy);
const ring1Geo = new THREE.TorusGeometry(this.shieldR * 0.76, 1.6, 8, 36);
const ring1Mat = new THREE.MeshBasicMaterial({
color: 0xf87171,
transparent: true,
opacity: 0.75
});
this.ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
this.ring1.rotation.x = Math.PI / 3;
this.group.add(this.ring1);
const ring2Geo = new THREE.TorusGeometry(this.shieldR * 0.6, 1.3, 8, 32);
const ring2Mat = new THREE.MeshBasicMaterial({
color: 0xfbbf24,
transparent: true,
opacity: 0.7
});
this.ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
this.ring2.rotation.y = Math.PI / 3;
this.group.add(this.ring2);
this.coreLight = new THREE.PointLight(0xf87171, 1.2, 130);
this.group.add(this.coreLight);
}
this.scene.add(this.group);
}
update(dt, time, player, boids) {
this.pulsePhase = time;
const isSingularity = this.sector === 20;
if (isSingularity) {
this.singularityScale = (this.singularityScale || 1.0) + dt * 0.08;
const currentScale = Math.min(3.5, this.singularityScale);
this.group.scale.setScalar(currentScale);
this.shieldWire.rotation.y += dt * 0.4;
this.shieldWire.rotation.x += dt * 0.2;
if (this.core) {
this.core.rotation.y += dt * 0.6;
this.core.rotation.x += dt * 0.4;
}
this.ring1.rotation.z += dt * 2.0;
this.ring2.rotation.z -= dt * 1.5;
this.coreLight.intensity = 1.5 + 0.5 * Math.sin(time * 4);
if (player) {
const px = player.x;
const py = player.y;
const distPlayer = Math.hypot(px, py);
if (distPlayer > 5) {
const pullForce = Math.min(100, 1500 / (distPlayer + 10));
player.x -= (px / distPlayer) * pullForce * dt;
player.y -= (py / distPlayer) * pullForce * dt;
}
}
if (boids && Array.isArray(boids)) {
for (let i = 0; i < boids.length; i++) {
const b = boids[i];
const bx = b.x;
const by = b.y;
const distBoid = Math.hypot(bx, by);
if (distBoid > 5) {
const pullForce = Math.min(120, 1800 / (distBoid + 10));
b.x -= (bx / distBoid) * pullForce * dt;
b.y -= (by / distBoid) * pullForce * dt;
}
}
}
} else {
const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
const purified = 1.0 - hpRatio;
const pulse = 0.75 + 0.25 * Math.sin(time * (3.5 + purified * 4));
const stateColor = new THREE.Color();
if (purified < 0.5) {
stateColor.setHex(0xf87171).lerp(new THREE.Color(0xfbbf24), purified * 2);
} else {
stateColor.setHex(0xfbbf24).lerp(new THREE.Color(0x22d3ee), (purified - 0.5) * 2);
}
this.shield.material.color.copy(stateColor);
this.shieldWire.material.color.copy(stateColor);
this.ring1.material.color.copy(stateColor);
this.core.material.color.copy(stateColor);
this.core.material.emissive.copy(stateColor).multiplyScalar(0.55);
this.coreLight.color.copy(stateColor);
if (this.chevronMat) {
this.chevronMat.color.copy(stateColor);
}
const spinBoost = 1 + purified * 1.8;
if (this.stargateFrame) {
this.stargateFrame.rotation.z += dt * 0.35 * spinBoost;
}
this.shield.material.opacity = (0.1 + 0.1 * pulse);
this.shieldWire.rotation.y += dt * 0.4 * spinBoost;
this.shieldWire.rotation.x += dt * 0.25 * spinBoost;
this.core.rotation.y += dt * 0.8 * spinBoost;
this.core.rotation.z += dt * 0.4 * spinBoost;
const energyScale = 0.45 + 0.55 * hpRatio;
this.energy.scale.setScalar(energyScale * pulse);
this.ring1.rotation.z += dt * 1.6 * spinBoost;
this.ring1.rotation.x += dt * 0.5 * spinBoost;
this.ring2.rotation.z -= dt * 1.3 * spinBoost;
this.ring2.rotation.y += dt * 0.6 * spinBoost;
this.coreLight.intensity = 0.7 + 0.6 * purified;
if (hpRatio < 0.3) {
const flicker = Math.random() > 0.5 ? 0.35 : 0.7;
this.shield.material.opacity = flicker * 0.22;
}
}
}
takeDamage(amount) {
this.hp -= amount;
this.energy.material.color.setHex(0xffffff);
setTimeout(() => {
if (this.energy && this.energy.material) {
this.energy.material.color.setHex(0xa5f3fc);
}
}, 90);
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
update(dt, time, player, enemies) {
for (const node of this.nodes) {
node.update(dt, time, player, enemies);
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
