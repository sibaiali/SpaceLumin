/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (SpawnBudget.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class SpawnBudget {
constructor() {
this.limits = {
collectibles: 6,
landmarkNodes: 10,
enemies: 12,
projectiles: 40,
particles: 800
};
this.counts = {
collectibles: 0,
landmarkNodes: 0,
enemies: 0,
projectiles: 0,
particles: 0
};
this.stars = [];
this.maxStars = 30;
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
*/
canSpawn(category) {
return this.counts[category] < this.limits[category];
}
*/
reserve(category) {
if (this.canSpawn(category)) {
this.counts[category]++;
return true;
}
return false;
}
*/
release(category) {
this.counts[category] = Math.max(0, this.counts[category] - 1);
}
*/
remaining(category) {
return Math.max(0, this.limits[category] - this.counts[category]);
}
*/
convertToStar(scene, x, y, color) {
if (this.stars.length >= this.maxStars) {
const oldest = this.stars.shift();
if (oldest && oldest.mesh) {
scene.remove(oldest.mesh);
oldest.mesh.geometry.dispose();
oldest.mesh.material.dispose();
}
}
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
*/
updateStars(time) {
for (const star of this.stars) {
if (!star.mesh) continue;
const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.phase);
star.mesh.material.opacity = star.baseOpacity * twinkle;
}
}
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
const spawnBudget = new SpawnBudget();
