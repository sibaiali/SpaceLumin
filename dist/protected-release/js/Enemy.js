/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (Enemy.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
const ENEMY_STATE = {
IDLE: 'IDLE',
CHASE: 'CHASE',
TELEGRAPH: 'TELEGRAPH',
ATTACK: 'ATTACK'
};
const TELEGRAPH_DURATION = 0.5;
const ENEMY_SYLLABLES = ['Zor', 'Kel', 'Vax', 'Nyx', 'Qor', 'Bel', 'Tyr', 'Mox', 'Xen', 'Pyx', 'Griz', 'Krag', 'Zul'];
const ENEMY_SUFFIXES = ['ax', 'ix', 'on', 'ar', 'us', 'el', 'or', 'im', 'an', 'is', 'gob', 'tek'];
const ENEMY_DESCRIPTORS = {
normal: ['Void Seeker', 'Nebula Drone', 'Star Scout'],
goblin: ['Astro-Goblin Raider', 'Crystal Snatcher', 'Warp Goblin'],
fast: ['Razor Viper', 'Quantum Dart', 'Phase Striker'],
shooter: ['Artillery Platform', 'Star Blaster', 'Ion Turret'],
alien: ['Psionic Grey Invader', 'Saucer Stalker', 'Zeta Mind-Weaver'],
tanky: ['Aegis Goliath', 'Bastion Juggernaut', 'Void Colossus'],
creature: ['Void Kraken', 'Abyssal Leviathan', 'Tentacle Horror'],
reaper: ['Quantum Wraith', 'Soul Harvester', 'Entropy Specter'],
archon: ['Eldritch Seraph', 'Singularity Archon', 'Ophanim Watcher'],
boss: ['Cosmic Overlord', 'Sector Dreadnought', 'Void Emperor']
};
const SKIN_STYLES = ['cotton', 'lizard', 'cyber', 'eldritch'];
class Enemy {
constructor(scene, x, y, sector, type = 'normal') {
this.scene = scene;
this.x = x;
this.y = y;
this.type = type;
this.sector = sector;
this.spawnTime = performance.now() / 1000;
this.animPhase = Math.random() * Math.PI * 2;
this.generateIdentity();
this.spawning = (type === 'reaper' || type === 'archon');
this.spawnTimer = 1.3;
this.vx = 0;
this.vy = 0;
this.dna = (typeof enemyDNA !== 'undefined')
? enemyDNA.spawnNextGenDNA(sector)
: { speed: 1.0, aggro: 1.0, scale: 1.0, emissive: 0.3, spawnTime: performance.now(), survivalTime: 0 };
this.setTypeProperties();
if (typeof enemyDNA !== 'undefined') {
enemyDNA.registerEnemy(this);
}
this.orbitRing1 = null;
this.orbitRing2 = null;
this.tentacles = [];
this.wings = [];
this.daggers = [];
this.createMesh();
this.nextShot = 0;
this.nextSummon = 0;
this.state = ENEMY_STATE.CHASE;
this.telegraphTimer = 0;
const baseRange = (this.type === 'reaper' || this.type === 'creature') ? 62 : 44;
this.attackRange = baseRange * Math.min(1.4, Math.max(0.8, (this.dna?.aggro || 1.0) * 0.85));
this.originalColor = null;
this.attackVelocity = { x: 0, y: 0 };
}
generateIdentity() {
const syl1 = ENEMY_SYLLABLES[Math.floor(Math.random() * ENEMY_SYLLABLES.length)];
const syl2 = ENEMY_SUFFIXES[Math.floor(Math.random() * ENEMY_SUFFIXES.length)];
this.name = syl1 + syl2;
const descriptors = ENEMY_DESCRIPTORS[this.type] || ENEMY_DESCRIPTORS.normal;
this.descriptor = descriptors[Math.floor(Math.random() * descriptors.length)];
this.skinStyle = SKIN_STYLES[Math.floor(Math.random() * SKIN_STYLES.length)];
this.displayName = `${this.name} the ${this.descriptor}`;
}
setTypeProperties() {
switch (this.type) {
case 'boss':
this.r = 34;
this.hp = 45;
this.hitsToDie = 12;
this.baseSpeed = 0.68;
break;
case 'archon':
this.r = 25;
this.hp = 12;
this.hitsToDie = 9;
this.baseSpeed = 1.25;
break;
case 'reaper':
this.r = 26;
this.hp = 10;
this.hitsToDie = 10;
this.baseSpeed = 1.4;
break;
case 'creature':
this.r = 24;
this.hp = 9;
this.hitsToDie = 7;
this.baseSpeed = 0.95;
break;
case 'tanky':
this.r = 22;
this.hp = 7;
this.hitsToDie = 6;
this.baseSpeed = 0.65;
break;
case 'alien':
this.r = 18;
this.hp = 5;
this.hitsToDie = 4;
this.baseSpeed = 1.15;
break;
case 'goblin':
this.r = 15;
this.hp = 3;
this.hitsToDie = 3;
this.baseSpeed = 1.55;
break;
case 'fast':
this.r = 13;
this.hp = 2;
this.hitsToDie = 2;
this.baseSpeed = 1.75;
break;
case 'shooter':
this.r = 16;
this.hp = 4;
this.hitsToDie = 3;
this.baseSpeed = 0.85;
break;
default: // normal
this.r = 16;
this.hp = 3;
this.hitsToDie = 3;
this.baseSpeed = 1.05;
}
if (this.dna && this.type !== 'boss') {
this.baseSpeed *= Math.max(0.75, Math.min(1.4, this.dna.speed || 1.0));
this.r = Math.round(this.r * Math.max(0.85, Math.min(1.22, this.dna.scale || 1.0)));
}
if (typeof difficultySystem !== 'undefined') {
const diffParams = difficultySystem.getParams();
this.hp = Math.round(this.hp * diffParams.enemyHPMult);
this.hitsToDie = Math.max(this.hitsToDie, Math.ceil(this.hp / 3));
this.baseSpeed *= diffParams.enemySpeedMult;
this.microDodge = diffParams.microDodge;
this.homingShots = diffParams.homingShots;
this.machineRealm = diffParams.machineRealm;
}
this.maxHp = this.hp;
}
createMesh() {
let geometry, material;
let hasCustomEyes = false;
switch (this.type) {
case 'boss': {
geometry = new THREE.IcosahedronGeometry(this.r * 0.88, 1);
material = new THREE.MeshPhysicalMaterial({
color: 0xea580c,
emissive: 0xf97316,
emissiveIntensity: 0.55,
metalness: 0.85,
roughness: 0.18,
clearcoat: 1.0,
clearcoatRoughness: 0.1,
flatShading: true
});
this.mesh = new THREE.Mesh(geometry, material);
const ringMat1 = new THREE.MeshStandardMaterial({
color: 0xfbbf24,
emissive: 0xea580c,
emissiveIntensity: 0.65,
metalness: 0.9,
roughness: 0.15
});
this.orbitRing1 = new THREE.Mesh(
new THREE.TorusGeometry(this.r * 1.35, 2.4, 8, 32),
ringMat1
);
const spikeGeo = new THREE.ConeGeometry(4.5, 16, 5);
for (let i = 0; i < 8; i++) {
const angle = (i / 8) * Math.PI * 2;
const spike = new THREE.Mesh(spikeGeo, ringMat1);
spike.position.set(Math.cos(angle) * (this.r * 1.48), Math.sin(angle) * (this.r * 1.48), 0);
spike.rotation.z = angle - Math.PI / 2;
this.orbitRing1.add(spike);
}
this.mesh.add(this.orbitRing1);
const ringMat2 = new THREE.MeshBasicMaterial({
color: 0xfef08a,
transparent: true,
opacity: 0.85,
wireframe: true
});
this.orbitRing2 = new THREE.Mesh(
new THREE.TorusGeometry(this.r * 1.12, 1.5, 6, 24),
ringMat2
);
this.orbitRing2.rotation.x = Math.PI / 3;
this.mesh.add(this.orbitRing2);
break;
}
case 'goblin': {
hasCustomEyes = true;
geometry = new THREE.DodecahedronGeometry(this.r * 0.88, 0);
geometry.scale(0.95, 1.05, 0.85);
material = new THREE.MeshStandardMaterial({
color: 0x16a34a,
emissive: 0x15803d,
emissiveIntensity: 0.45,
metalness: 0.55,
roughness: 0.3,
flatShading: true
});
this.mesh = new THREE.Mesh(geometry, material);
const earGeo = new THREE.ConeGeometry(this.r * 0.28, this.r * 1.25, 4);
const earMat = new THREE.MeshStandardMaterial({
color: 0x22c55e,
emissive: 0x166534,
emissiveIntensity: 0.4,
flatShading: true
});
[-1, 1].forEach(side => {
const ear = new THREE.Mesh(earGeo, earMat);
ear.position.set(side * this.r * 1.1, this.r * 0.15, 0);
ear.rotation.z = -side * (Math.PI * 0.42);
this.mesh.add(ear);
const hornGeo = new THREE.ConeGeometry(this.r * 0.16, this.r * 0.7, 5);
const hornMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
const horn = new THREE.Mesh(hornGeo, hornMat);
horn.position.set(side * this.r * 0.42, this.r * 0.85, this.r * 0.3);
horn.rotation.z = -side * 0.25;
this.mesh.add(horn);
const eyeGeo = new THREE.OctahedronGeometry(this.r * 0.22, 0);
eyeGeo.scale(1.3, 0.65, 0.6);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
const eye = new THREE.Mesh(eyeGeo, eyeMat);
eye.position.set(side * this.r * 0.36, this.r * 0.2, this.r * 0.78);
eye.rotation.z = -side * 0.35;
this.mesh.add(eye);
const daggerGeo = new THREE.ConeGeometry(this.r * 0.2, this.r * 1.3, 4);
const daggerMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
const dagger = new THREE.Mesh(daggerGeo, daggerMat);
dagger.position.set(side * this.r * 1.05, -this.r * 0.35, this.r * 0.3);
dagger.rotation.z = Math.PI + side * 0.2;
this.mesh.add(dagger);
this.daggers.push(dagger);
});
break;
}
case 'alien': {
hasCustomEyes = true;
geometry = new THREE.SphereGeometry(this.r * 0.78, 14, 14);
geometry.scale(0.88, 1.25, 0.85);
material = new THREE.MeshPhysicalMaterial({
color: 0x64748b,
emissive: 0x06b6d4,
emissiveIntensity: 0.45,
metalness: 0.75,
roughness: 0.15,
clearcoat: 1.0
});
this.mesh = new THREE.Mesh(geometry, material);
[-1, 1].forEach(side => {
const alienEyeGeo = new THREE.SphereGeometry(this.r * 0.26, 10, 10);
alienEyeGeo.scale(1.25, 0.75, 0.5);
const alienEyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const alienEye = new THREE.Mesh(alienEyeGeo, alienEyeMat);
alienEye.position.set(side * this.r * 0.34, this.r * 0.12, this.r * 0.65);
alienEye.rotation.z = -side * 0.42;
this.mesh.add(alienEye);
});
this.orbitRing1 = new THREE.Mesh(
new THREE.TorusGeometry(this.r * 1.22, 2.2, 8, 28),
new THREE.MeshStandardMaterial({
color: 0x94a3b8,
emissive: 0x0ea5e9,
emissiveIntensity: 0.5,
metalness: 0.9,
roughness: 0.15
})
);
this.orbitRing1.rotation.x = Math.PI * 0.32;
const nodeGeo = new THREE.SphereGeometry(2.4, 8, 8);
const nodeMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
for (let i = 0; i < 6; i++) {
const a = (i / 6) * Math.PI * 2;
const node = new THREE.Mesh(nodeGeo, nodeMat);
node.position.set(Math.cos(a) * (this.r * 1.22), Math.sin(a) * (this.r * 1.22), 0);
this.orbitRing1.add(node);
}
this.mesh.add(this.orbitRing1);
break;
}
case 'creature': {
geometry = new THREE.OctahedronGeometry(this.r * 0.85, 1);
geometry.scale(0.95, 1.2, 0.88);
material = new THREE.MeshPhysicalMaterial({
color: 0x9d174d,
emissive: 0xdb2777,
emissiveIntensity: 0.55,
metalness: 0.4,
roughness: 0.25,
clearcoat: 0.9,
flatShading: true
});
this.mesh = new THREE.Mesh(geometry, material);
const tentacleGeo = new THREE.ConeGeometry(this.r * 0.18, this.r * 1.35, 5);
const tentacleMat = new THREE.MeshStandardMaterial({
color: 0xf472b6,
emissive: 0xbe185d,
emissiveIntensity: 0.6,
roughness: 0.3
});
for (let i = 0; i < 6; i++) {
const angle = (i / 6) * Math.PI * 2;
const pivot = new THREE.Group();
pivot.rotation.z = angle;
const tentacle = new THREE.Mesh(tentacleGeo, tentacleMat);
tentacle.position.set(0, this.r * 1.15, 0);
pivot.add(tentacle);
this.mesh.add(pivot);
this.tentacles.push({ pivot, baseAngle: angle, index: i });
}
break;
}
case 'archon': {
geometry = new THREE.OctahedronGeometry(this.r * 0.72, 1);
material = new THREE.MeshPhysicalMaterial({
color: 0xfef08a,
emissive: 0xa855f7,
emissiveIntensity: 0.75,
metalness: 0.9,
roughness: 0.1,
clearcoat: 1.0
});
this.mesh = new THREE.Mesh(geometry, material);
const wingGeo = new THREE.ConeGeometry(this.r * 0.28, this.r * 1.55, 4);
wingGeo.scale(0.65, 1.0, 0.2);
const wingMat = new THREE.MeshBasicMaterial({
color: 0xfde047,
transparent: true,
opacity: 0.9,
blending: THREE.AdditiveBlending
});
const wingAngles = [-0.85, -0.35, 0.15, Math.PI - 0.15, Math.PI + 0.35, Math.PI + 0.85];
wingAngles.forEach((ang, idx) => {
const wingPivot = new THREE.Group();
wingPivot.rotation.z = ang;
const wMesh = new THREE.Mesh(wingGeo, wingMat);
wMesh.position.set(0, this.r * 1.1, 0);
wingPivot.add(wMesh);
this.mesh.add(wingPivot);
this.wings.push({ pivot: wingPivot, baseAngle: ang, side: idx < 3 ? 1 : -1, idx });
});
const wheelMat = new THREE.MeshBasicMaterial({
color: 0xc084fc,
transparent: true,
opacity: 0.85,
wireframe: true
});
this.orbitRing1 = new THREE.Mesh(new THREE.TorusGeometry(this.r * 1.1, 1.2, 6, 24), wheelMat);
this.orbitRing1.rotation.x = Math.PI / 3;
this.mesh.add(this.orbitRing1);
this.orbitRing2 = new THREE.Mesh(new THREE.TorusGeometry(this.r * 1.1, 1.2, 6, 24), wheelMat);
this.orbitRing2.rotation.y = Math.PI / 3;
this.mesh.add(this.orbitRing2);
break;
}
case 'reaper': {
geometry = new THREE.OctahedronGeometry(this.r * 0.92, 0);
geometry.scale(0.82, 1.28, 0.82);
material = new THREE.MeshPhysicalMaterial({
color: 0x4c1d95,
emissive: 0xec4899,
emissiveIntensity: 0.65,
metalness: 0.9,
roughness: 0.1,
clearcoat: 1.0,
transparent: true,
opacity: 0.9
});
this.mesh = new THREE.Mesh(geometry, material);
const scytheMat = new THREE.MeshBasicMaterial({
color: 0xf472b6,
transparent: true,
opacity: 0.85,
blending: THREE.AdditiveBlending
});
this.orbitRing1 = new THREE.Mesh(
new THREE.TorusGeometry(this.r * 1.18, 1.3, 6, 24),
scytheMat
);
this.orbitRing1.rotation.x = Math.PI / 4;
this.mesh.add(this.orbitRing1);
this.orbitRing2 = new THREE.Mesh(
new THREE.TorusGeometry(this.r * 1.18, 1.3, 6, 24),
scytheMat
);
this.orbitRing2.rotation.y = Math.PI / 4;
this.mesh.add(this.orbitRing2);
break;
}
case 'tanky': {
geometry = new THREE.DodecahedronGeometry(this.r * 0.95, 0);
material = new THREE.MeshStandardMaterial({
color: 0x3b82f6,
emissive: 0x1d4ed8,
emissiveIntensity: 0.38,
roughness: 0.25,
metalness: 0.85,
flatShading: true
});
this.mesh = new THREE.Mesh(geometry, material);
this.orbitRing1 = new THREE.Group();
const plateGeo = new THREE.BoxGeometry(this.r * 0.72, 3.8, this.r * 0.65);
const plateMat = new THREE.MeshStandardMaterial({
color: 0x93c5fd,
emissive: 0x38bdf8,
emissiveIntensity: 0.45,
metalness: 0.9,
roughness: 0.15
});
for (let i = 0; i < 4; i++) {
const angle = (i / 4) * Math.PI * 2;
const plate = new THREE.Mesh(plateGeo, plateMat);
plate.position.set(Math.cos(angle) * (this.r * 1.18), Math.sin(angle) * (this.r * 1.18), 0);
plate.rotation.z = angle + Math.PI / 2;
this.orbitRing1.add(plate);
}
this.mesh.add(this.orbitRing1);
break;
}
case 'fast': {
geometry = new THREE.ConeGeometry(this.r * 0.75, this.r * 2.2, 5);
geometry.scale(0.85, 1.0, 0.45);
material = new THREE.MeshStandardMaterial({
color: 0xf87171,
emissive: 0xdc2626,
emissiveIntensity: 0.5,
roughness: 0.2,
metalness: 0.85,
flatShading: true
});
this.mesh = new THREE.Mesh(geometry, material);
const wingGeo = new THREE.BoxGeometry(this.r * 2.3, 2.2, 4.5);
const wingMat = new THREE.MeshStandardMaterial({
color: 0xfca5a5,
emissive: 0xef4444,
emissiveIntensity: 0.4,
metalness: 0.8,
roughness: 0.2
});
const wings = new THREE.Mesh(wingGeo, wingMat);
wings.position.set(0, -this.r * 0.3, 0);
this.mesh.add(wings);
const thrusterGeo = new THREE.SphereGeometry(this.r * 0.35, 8, 8);
const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
thruster.position.set(0, -this.r * 1.05, 0);
this.mesh.add(thruster);
break;
}
case 'shooter': {
geometry = new THREE.OctahedronGeometry(this.r * 0.88, 1);
material = new THREE.MeshStandardMaterial({
color: 0x0ea5e9,
emissive: 0x0284c7,
emissiveIntensity: 0.4,
metalness: 0.8,
roughness: 0.22,
flatShading: true
});
this.mesh = new THREE.Mesh(geometry, material);
this.orbitRing1 = new THREE.Group();
const barrelGeo = new THREE.CylinderGeometry(1.6, 2.2, this.r * 1.15, 6);
const barrelMat = new THREE.MeshStandardMaterial({
color: 0xe0f2fe,
emissive: 0x38bdf8,
emissiveIntensity: 0.5,
metalness: 0.9,
roughness: 0.15
});
for (let i = 0; i < 4; i++) {
const angle = (i / 4) * Math.PI * 2;
const barrel = new THREE.Mesh(barrelGeo, barrelMat);
barrel.position.set(Math.cos(angle) * (this.r * 0.95), Math.sin(angle) * (this.r * 0.95), 0);
barrel.rotation.z = angle - Math.PI / 2;
this.orbitRing1.add(barrel);
}
const gyroRing = new THREE.Mesh(
new THREE.TorusGeometry(this.r * 1.15, 1.1, 6, 24),
new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
);
this.orbitRing1.add(gyroRing);
this.mesh.add(this.orbitRing1);
break;
}
default: { // normal (Void Seeker Bio-Cybernetic Drone)
geometry = new THREE.OctahedronGeometry(this.r * 0.92, 1);
geometry.scale(1.0, 1.0, 0.68);
material = new THREE.MeshStandardMaterial({
color: 0xfde68a,
emissive: 0xf97316,
emissiveIntensity: 0.35,
metalness: 0.75,
roughness: 0.25,
flatShading: true
});
this.mesh = new THREE.Mesh(geometry, material);
this.orbitRing1 = new THREE.Mesh(
new THREE.TorusGeometry(this.r * 1.12, 1.0, 6, 20),
new THREE.MeshBasicMaterial({
color: 0xfb923c,
transparent: true,
opacity: 0.7
})
);
this.mesh.add(this.orbitRing1);
}
}
this.mesh.position.set(this.x, this.y, 0);
if (!hasCustomEyes) {
const eyeColor = this.type === 'shooter' ? 0x00ffff
: this.type === 'tanky' ? 0x60a5fa
: this.type === 'reaper' ? 0xf43f5e
: this.type === 'archon' ? 0xc084fc
: this.type === 'creature' ? 0xfbbf24
: 0xef4444;
const eyeGeometry = new THREE.OctahedronGeometry(this.r * 0.28, 0);
const eyeMaterial = new THREE.MeshBasicMaterial({ color: eyeColor });
const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
eye.position.set(0, 0, this.r * 0.68);
this.mesh.add(eye);
const pupilGeo = new THREE.SphereGeometry(this.r * 0.13, 8, 8);
const pupilMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pupil = new THREE.Mesh(pupilGeo, pupilMat);
pupil.position.set(0, 0, this.r * 0.84);
this.mesh.add(pupil);
}
if (this.spawning) {
const ringGeometry = new THREE.RingGeometry(this.r * 1.5, this.r * 2.1, 32);
const ringMaterial = new THREE.MeshBasicMaterial({
color: this.type === 'archon' ? 0xc084fc : 0xec4899,
transparent: true,
opacity: 0.65,
side: THREE.DoubleSide
});
this.spawnRing = new THREE.Mesh(ringGeometry, ringMaterial);
this.spawnRing.rotation.x = Math.PI / 2;
this.scene.add(this.spawnRing);
}
if (typeof SymbolBadges !== 'undefined') {
const roleBadges = {
goblin:   { glyph: '👺', color: '#4ade80' },
alien:    { glyph: '🛸', color: '#38bdf8' },
creature: { glyph: '🐙', color: '#e879f9' },
archon:   { glyph: '👁️', color: '#facc15' },
reaper:   { glyph: '💀', color: '#f43f5e' },
shooter:  { glyph: '🎯', color: '#22d3ee' },
tanky:    { glyph: '🛡️', color: '#60a5fa' },
fast:     { glyph: '⚡', color: '#fbbf24' },
boss:     { glyph: '👑', color: '#f97316' },
normal:   { glyph: '👾', color: '#fb923c' }
};
const badgeCfg = roleBadges[this.type] || roleBadges.normal;
this.roleBadge = SymbolBadges.createSprite(badgeCfg.glyph, badgeCfg.color, this.type === 'boss' ? 28 : 18, 'hostile');
this.roleBadge.position.set(0, this.r * 1.45, 8);
this.mesh.add(this.roleBadge);
}
this.scene.add(this.mesh);
}
update(dt, playerPos, decoyPos, frozen, time, data, neighbors = [], directorSpeedMult = 1.0) {
if (this.spawning) {
this.spawnTimer -= dt;
if (this.spawnTimer <= 0) {
this.spawning = false;
if (this.spawnRing) {
this.scene.remove(this.spawnRing);
this.spawnRing.geometry.dispose();
this.spawnRing.material.dispose();
this.spawnRing = null;
}
} else {
if (this.spawnRing) {
const scale = 1.5 - this.spawnTimer;
this.spawnRing.scale.setScalar(scale);
this.spawnRing.material.opacity = this.spawnTimer / 1.5;
this.spawnRing.position.set(this.x, this.y, 0);
}
return null;
}
}
if (frozen) {
const floatBob = Math.sin(time * 2 + this.spawnTime * 10) * 8;
this.mesh.position.z = 15 + floatBob;
this.mesh.rotation.y += dt * 0.3;
this.mesh.rotation.x += dt * 0.2;
if (this.mesh.material.emissive) {
const frozenColor = new THREE.Color(0x88ccff);
this.mesh.material.emissive.lerp(frozenColor, dt * 2);
}
return null;
}
if (this._wasFrozen && !frozen) {
this._wasFrozen = false;
if (this.originalColor && this.mesh.material.color) {
this.mesh.material.color.copy(this.originalColor);
}
}
this._wasFrozen = frozen;
const baseTarget = decoyPos || playerPos;
let targetX = baseTarget.x;
let targetY = baseTarget.y;
if (!decoyPos && typeof window !== 'undefined' && window.game) {
if (['goblin', 'creature', 'normal'].includes(this.type) && window.game.collectibles?.collectibles) {
const foods = window.game.collectibles.collectibles;
let nearestFood = null;
let nearestFoodDist = 250;
for (let fIdx = 0; fIdx < foods.length; fIdx++) {
const food = foods[fIdx];
if (food.kind === 'toxicFruit' || food.kind === 'shield') continue;
const fd = Math.hypot(food.x - this.x, food.y - this.y);
if (fd < nearestFoodDist) {
nearestFoodDist = fd;
nearestFood = food;
}
}
if (nearestFood) {
targetX = nearestFood.x;
targetY = nearestFood.y;
if (nearestFoodDist < this.r + 14) {
const foodSymbols = {
voidPlum: '🍇', stellarMango: '🥭', nebulicApple: '🍏',
glowingJuice: '🧪', energy: '💎', burst: '🌟',
predictiveVector: '⚛️', landmarkNode: '💠'
};
const sym = foodSymbols[nearestFood.kind] || '🍇';
window.game.collectibles.remove(nearestFood);
this.hp = Math.min(this.maxHp * 1.6, this.hp + 2.5);
this.r = Math.min(32, this.r * 1.08);
this.baseSpeed = Math.min(2.2, this.baseSpeed * 1.06);
this.mesh.scale.multiplyScalar(1.1);
if (window.game.world3D) {
window.game.world3D.spawnImpactGlow(this.x, this.y, 0x4ade80, 6);
const sp = window.game.world3D.worldToScreen(this.x, this.y, 0);
if (sp && window.game.labelSystem) {
window.game.labelSystem.spawnFloatingText(sp.x, sp.y, sym + ' Devoured! +HP', '#4ade80');
}
}
}
}
}
if (this.type === 'tanky' && window.game.nodes?.nodes?.length > 0) {
const gate = window.game.nodes.nodes[0];
const playerToGate = Math.hypot(playerPos.x - gate.x, playerPos.y - gate.y);
if (playerToGate > 230) {
const guardAngle = time * 0.9 + this.animPhase;
targetX = gate.x + Math.cos(guardAngle) * 85;
targetY = gate.y + Math.sin(guardAngle) * 85;
}
}
if (window.game.player && ['archon', 'alien', 'goblin', 'reaper'].includes(this.type) && targetX === baseTarget.x) {
const leadTime = this.type === 'archon' ? 0.38 : 0.22;
targetX += (window.game.player.vx || 0) * leadTime;
targetY += (window.game.player.vy || 0) * leadTime;
}
}
const dx = targetX - this.x;
const dy = targetY - this.y;
const dist = Math.hypot(dx, dy) || 1;
let speed = (92 + this.sector * 2.2) * this.baseSpeed * directorSpeedMult;
const regenRate = (this.type === 'creature' ? 1.2 : 0) +
((typeof difficultySystem !== 'undefined' && difficultySystem.getParams().natureRegen) || 0);
if (regenRate > 0 && this.hp < this.maxHp) {
this.hp = Math.min(this.maxHp, this.hp + regenRate * dt);
}
switch (this.state) {
case ENEMY_STATE.CHASE: {
let dirX = dx / dist;
let dirY = dy / dist;
if (this.type === 'goblin') {
const perpX = -dirY;
const perpY = dirX;
const weave = Math.sin(time * 8.5 + this.animPhase) * 0.65;
dirX += perpX * weave;
dirY += perpY * weave;
} else if (this.type === 'alien') {
const perpX = -dirY;
const perpY = dirX;
const orbitDir = (this.animPhase > Math.PI ? 1 : -1);
if (dist < 170) {
dirX = -dirX * 0.4 + perpX * orbitDir * 0.9;
dirY = -dirY * 0.4 + perpY * orbitDir * 0.9;
} else if (dist < 260) {
dirX = dirX * 0.35 + perpX * orbitDir * 0.85;
dirY = dirY * 0.35 + perpY * orbitDir * 0.85;
}
}
if (neighbors && neighbors.length > 1 && this.type !== 'boss') {
const sepDist = (typeof difficultySystem !== 'undefined')
? difficultySystem.getSeparationDistance()
: 48;
let sepX = 0, sepY = 0, cohX = 0, cohY = 0, count = 0;
for (let i = 0; i < neighbors.length; i++) {
const other = neighbors[i];
if (other === this) continue;
const ndx = this.x - other.x;
const ndy = this.y - other.y;
const nd = Math.hypot(ndx, ndy);
if (nd > 0 && nd < sepDist) {
sepX += (ndx / nd) * ((sepDist - nd) / sepDist);
sepY += (ndy / nd) * ((sepDist - nd) / sepDist);
}
if (nd > 0 && nd < 140) {
cohX += other.x;
cohY += other.y;
count++;
}
}
dirX += sepX * 0.55;
dirY += sepY * 0.55;
if (count > 0) {
const cx = (cohX / count) - this.x;
const cy = (cohY / count) - this.y;
const cd = Math.hypot(cx, cy) || 1;
dirX += (cx / cd) * 0.12;
dirY += (cy / cd) * 0.12;
}
}
const norm = Math.hypot(dirX, dirY) || 1;
dirX /= norm;
dirY /= norm;
const stepVel = { x: dirX * speed, y: dirY * speed };
if (typeof difficultySystem !== 'undefined') {
const jolt = difficultySystem.applyElementalPhysics(stepVel, 'enemy');
if (jolt) {
stepVel.x += jolt.x;
stepVel.y += jolt.y;
}
}
this.vx = stepVel.x;
this.vy = stepVel.y;
this.x += this.vx * dt;
this.y += this.vy * dt;
if (dist < this.attackRange && ['reaper', 'fast', 'normal', 'tanky', 'goblin', 'creature'].includes(this.type)) {
this.state = ENEMY_STATE.TELEGRAPH;
this.telegraphTimer = TELEGRAPH_DURATION;
this.attackVelocity.x = (dx / dist) * speed * 3.1;
this.attackVelocity.y = (dy / dist) * speed * 3.1;
if (this.mesh.material.color && !this.originalColor) {
this.originalColor = this.mesh.material.color.clone();
}
if (typeof window.game !== 'undefined' && window.game.audio) {
window.game.audio.playSound('charge_hiss');
}
}
break;
}
case ENEMY_STATE.TELEGRAPH: {
this.telegraphTimer -= dt;
const pulseIntensity = Math.sin(time * 30) * 0.5 + 0.5;
const vibrate = Math.sin(time * 60) * 2;
if (this.mesh.material.color) {
this.mesh.material.color.setHex(0xFFFFFF);
}
if (this.mesh.material.emissive) {
this.mesh.material.emissive.setHex(0xFFFFFF);
this.mesh.material.emissiveIntensity = 0.5 + pulseIntensity * 0.5;
}
this.mesh.position.x = this.x + vibrate;
this.mesh.position.y = this.y + vibrate * 0.7;
if (this.telegraphTimer <= 0) {
this.state = ENEMY_STATE.ATTACK;
if (this.originalColor && this.mesh.material.color) {
this.mesh.material.color.copy(this.originalColor);
}
if (this.mesh.material.emissive && this.originalColor) {
this.mesh.material.emissive.copy(this.originalColor).multiplyScalar(0.3);
this.mesh.material.emissiveIntensity = 0.35;
}
}
break;
}
case ENEMY_STATE.ATTACK: {
this.x += this.attackVelocity.x * dt;
this.y += this.attackVelocity.y * dt;
const attackDecay = Math.pow(0.001, dt);
this.attackVelocity.x *= attackDecay;
this.attackVelocity.y *= attackDecay;
const thrustMag = Math.hypot(this.attackVelocity.x, this.attackVelocity.y);
if (thrustMag < speed * 0.3) {
this.state = ENEMY_STATE.CHASE;
}
break;
}
default:
this.state = ENEMY_STATE.CHASE;
}
if (this.state !== ENEMY_STATE.TELEGRAPH) {
this.mesh.position.set(this.x, this.y, 0);
}
const bob = Math.sin(time * 4 + this.spawnTime) * 3;
this.mesh.position.z = bob;
if (this.type === 'fast') {
const heading = Math.atan2(this.vy || dy, this.vx || dx);
this.mesh.rotation.z = heading - Math.PI / 2;
this.mesh.rotation.y = Math.sin(time * 8) * 0.25;
} else {
this.mesh.rotation.y += dt * 0.9;
this.mesh.rotation.z = Math.sin(time * 2.2 + this.animPhase) * 0.12;
}
if (this.orbitRing1) {
this.orbitRing1.rotation.z += dt * (this.type === 'reaper' || this.type === 'alien' ? 3.4 : 1.9);
}
if (this.orbitRing2) {
this.orbitRing2.rotation.z -= dt * 2.5;
this.orbitRing2.rotation.x += dt * 1.2;
}
if (this.tentacles.length > 0) {
for (let i = 0; i < this.tentacles.length; i++) {
const t = this.tentacles[i];
t.pivot.rotation.z = t.baseAngle + Math.sin(time * 5.5 + i * 1.1) * 0.28;
t.pivot.rotation.x = Math.cos(time * 4.5 + i) * 0.32;
}
}
if (this.wings.length > 0) {
for (let i = 0; i < this.wings.length; i++) {
const w = this.wings[i];
w.pivot.rotation.z = w.baseAngle + Math.sin(time * 7.0 + w.idx * 0.6) * 0.22 * w.side;
w.pivot.rotation.y = Math.sin(time * 7.0) * 0.35;
}
}
if (this.daggers.length > 0) {
this.daggers[0].rotation.x = Math.sin(time * 12) * 0.45;
if (this.daggers[1]) this.daggers[1].rotation.x = -Math.sin(time * 12) * 0.45;
}
let bullet = null;
if (['shooter', 'alien', 'archon'].includes(this.type)) {
const baseInterval = this.type === 'archon' ? 1.15 : (this.type === 'alien' ? 1.35 : 1.55);
if (!this.nextShot) this.nextShot = time + 0.9 + Math.random() * 0.9;
if (time >= this.nextShot) {
this.nextShot = time + Math.max(0.65, baseInterval - this.sector * 0.025) + Math.random() * 0.6;
const bx = (playerPos.x - this.x) / (Math.hypot(playerPos.x - this.x, playerPos.y - this.y) || 1);
const by = (playerPos.y - this.y) / (Math.hypot(playerPos.x - this.x, playerPos.y - this.y) || 1);
const projSpeed = (this.type === 'archon' ? 270 : 230) * Math.min(1.6, 1 + this.sector * 0.03);
bullet = {
x: this.x,
y: this.y,
vx: bx * projSpeed,
vy: by * projSpeed,
r: 4,
life: 3
};
}
}
if (this.type === 'boss' && data) {
if (!this.nextSummon) this.nextSummon = time + 2.5;
if (time >= this.nextSummon) {
this.nextSummon = time + Math.max(1.8, 3.4 - this.sector * 0.08) + Math.random() * 1.0;
const angle = Math.random() * Math.PI * 2;
const pool = ['goblin', 'fast'];
if (this.sector >= 4) pool.push('alien');
if (this.sector >= 6) pool.push('creature');
if (this.sector >= 9) pool.push('archon');
const summonType = pool[Math.floor(Math.random() * pool.length)];
return {
spawnMinion: true,
minionType: summonType,
x: this.x + Math.cos(angle) * 44,
y: this.y + Math.sin(angle) * 44
};
}
}
return bullet;
}
takeDamage(amount) {
this.hp -= amount;
this.hitsToDie = Math.max(0, this.hitsToDie - 1);
const dodgeProb = (this.type === 'goblin' || this.type === 'archon') ? 0.28 : (this.microDodge ? 0.35 : 0);
if (dodgeProb > 0 && this.hp > 0 && this.type !== 'boss' && Math.random() < dodgeProb) {
const dodgeAngle = Math.random() * Math.PI * 2;
this.x += Math.cos(dodgeAngle) * 20;
this.y += Math.sin(dodgeAngle) * 20;
}
const originalEmissive = this.mesh.material.emissiveIntensity;
this.mesh.material.emissiveIntensity = 1;
setTimeout(() => {
if (this.mesh && this.mesh.material) {
this.mesh.material.emissiveIntensity = originalEmissive;
}
}, 100);
if (this.type === 'boss') {
return this.hitsToDie <= 0;
}
return this.hp <= 0;
}
dispose() {
this.scene.remove(this.mesh);
if (this.spawnRing) {
this.scene.remove(this.spawnRing);
this.spawnRing.geometry.dispose();
this.spawnRing.material.dispose();
}
this.mesh.traverse(obj => {
if (obj === this.roleBadge) return;
if (obj.geometry) obj.geometry.dispose();
if (obj.material) obj.material.dispose();
});
}
}
