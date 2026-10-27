/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (DifficultySystem.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class DifficultySystem {
constructor() {
this.baseMultiplier = 1.55;
this.MAX_SECTOR = 20;
this.currentSector = 1;
this.elementalPhysics = {
ICE: {
name: 'ICE',
sectors: [1, 2, 3, 4, 5],
nebulaDrag: 0.95,           // Velocity *= 0.95 each frame
aggressionMult: 0.8,        // Slower enemy aggression
separationDistance: 40,     // Boids separation
playerDrag: 0.98,           // Slight player slowdown
visualTint: 0x88ddff,
description: 'Frozen Nebula - Movement Dampened'
},
FIRE: {
name: 'FIRE',
sectors: [6, 7, 8, 9, 10],
nebulaDrag: 1.0,            // Normal drag
aggressionMult: 2.0,        // 2x enemy aggression
separationDistance: 50,     // Normal separation
playerDrag: 1.0,            // Normal player
visualTint: 0xff4444,
description: 'Solar Inferno - Maximum Aggression'
},
NATURE: {
name: 'NATURE',
sectors: [11, 12, 13, 14, 15],
nebulaDrag: 0.98,           // Slight drag
aggressionMult: 1.0,        // Normal aggression
separationDistance: 80,     // Wide boids separation
playerDrag: 1.0,            // Normal player
visualTint: 0x22c55e,
description: 'Bio-Organic Zone - Swarm Tactics'
},
WIND: {
name: 'WIND',
sectors: [16, 17, 18, 19, 20],
nebulaDrag: 1.05,           // Slight speed boost
aggressionMult: 1.5,        // Enhanced aggression
separationDistance: 60,     // Medium separation
playerDrag: 1.0,            // Normal drag
impulseJoltChance: 0.03,    // 3% chance of random jolt
impulseJoltStrength: 80,    // Jolt force magnitude
visualTint: 0xa855f7,
description: 'Chaos Winds - Unpredictable Forces'
}
};
this.cachedParams = this.computeParams(1);
}
*/
sectorMult(sector) {
const L = Math.min(Math.max(sector, 1), this.MAX_SECTOR);
const raw = Math.pow(this.baseMultiplier, L - 1);
if (typeof neuroFlow !== 'undefined') {
return raw * neuroFlow.getDifficultyModifier();
}
return raw;
}
*/
getElement(sector) {
if (sector <= 5) return 'ICE';
if (sector <= 10) return 'FIRE';
if (sector <= 15) return 'NATURE';
return 'WIND';
}
*/
getElementalPhysics(sector) {
const element = this.getElement(sector);
return this.elementalPhysics[element];
}
*/
computeParams(sector) {
const L = Math.min(Math.max(sector, 1), this.MAX_SECTOR);
const mult = this.sectorMult(L);
const element = this.getElement(L);
const physics = this.elementalPhysics[element];
return {
sector: L,
sectorMult: mult,
element: element,
elementalPhysics: physics,
enemyHPMult: Math.min(200, mult),
enemySpeedMult: 1 + 0.12 * (L - 1),
spawnRateMult: Math.min(25, Math.max(1, Math.pow(mult, 0.45))),
projectileSpeedMult: 1 + 0.08 * (L - 1),
eliteChance: Math.min(0.95, Math.max(0, 0.03 + 0.05 * (L - 1))),
hazardStrengthMult: Math.min(40, Math.max(1, Math.pow(mult, 0.6))),
nebulaDrag: physics.nebulaDrag,
aggressionMult: physics.aggressionMult,
separationDistance: physics.separationDistance,
playerDrag: physics.playerDrag,
impulseJoltChance: physics.impulseJoltChance || 0,
impulseJoltStrength: physics.impulseJoltStrength || 0,
visualTint: physics.visualTint,
elasticHitboxMult: 1.0,     // Increases when player HP is low
elasticTurnRate: 1.0,       // Enemy turn rate reduction at low HP
fireFragments: element === 'FIRE',           // Enemies explode into fragments
natureRegen: element === 'NATURE' ? 2.0 : 0, // HP/sec regen for enemies
windTurbulence: element === 'WIND' ? 0.15 : 0, // Constant random force
microDodge: L >= 8,             // Enemies dodge when hit
homingShots: L >= 10,           // Mild tracking bullets
swarmCoordination: L >= 12,     // Formation spawns
multiPhaseElites: L >= 14,      // Shield + core phases
bulletHellGaps: L >= 16,        // Tighter bullet patterns + EMP
chaosWinds: L >= 17,            // Random velocity jolts
machineRealm: L >= 19,          // Maximum aggression
singularity: L === 20,          // The final test
hpDropFreqMult: this.getHPDropMultiplier(L),
shieldDurabilityMult: L >= 16 ? 0.4 : (L >= 12 ? 0.6 : 1.0),
maxHPDropsPerMinute: L >= 18 ? 0.1 : (L >= 14 ? 0.5 : (L >= 10 ? 1.0 : 3.0)),
directorLocked: L >= 10,
directorMaxAggression: L >= 18,
difficultyTier: this.getDifficultyTier(L),
sectorMessage: this.getSectorMessage(L),
elementDescription: physics.description
};
}
getHPDropMultiplier(L) {
if (L >= 19) return 0.02;   // Effectively disabled
if (L >= 16) return 0.15;   // 85% reduction
if (L >= 12) return 0.35;   // 65% reduction
if (L >= 8) return 0.60;    // 40% reduction
return 1.0;
}
getDifficultyTier(L) {
if (L <= 3) return 'Tutorial';
if (L <= 5) return 'Normal';          // ICE end
if (L <= 8) return 'Hard';            // FIRE mid
if (L <= 10) return 'Intense';        // FIRE end
if (L <= 13) return 'Insane';         // NATURE mid
if (L <= 15) return 'Nightmare';      // NATURE end
if (L <= 17) return 'Apocalypse';     // WIND mid
if (L <= 19) return 'Machine Realm';  // WIND late
return 'SINGULARITY';                  // L20
}
getSectorMessage(L) {
const messages = {
1: '❄ Frozen Nebula - Initializing...',
2: '❄ Ice Flow Detected',
3: '❄ Cryogenic Zone Active',
4: '❄ Sub-Zero Operations',
5: '❄ ICE CORE - Element Mastered',
6: '🔥 Solar Winds Approaching',
7: '🔥 Thermal Spike Detected',
8: '🔥 Inferno Zone - ⚠ Aggression Rising',
9: '🔥 Solar Core Breach',
10: '🔥 FIRE APEX - Maximum Heat',
11: '🌿 Bio-Organic Contact',
12: '🌿 Swarm Intelligence Detected',
13: '🌿 Hive Mind Active',
14: '🌿 Nature\'s Wrath - ⚡ Formation Spawns',
15: '🌿 NATURE HEART - Evolution Complete',
16: '💨 Chaos Winds Rising',
17: '💨 Turbulence Zone - ⚠ Unpredictable',
18: '💨 Storm Core - 💀 Machine Pressure',
19: '💨 WIND FURY - 🔥 Beyond Human Reaction',
20: '☠ S I N G U L A R I T Y - ONLY THE MACHINE WINS'
};
return messages[L] || '';
}
*/
setSector(sector) {
this.currentSector = sector;
this.cachedParams = this.computeParams(sector);
return this.cachedParams;
}
*/
getParams() {
return this.cachedParams;
}
*/
scaleEnemyHP(baseHP) {
return Math.round(baseHP * this.cachedParams.enemyHPMult);
}
*/
scaleEnemySpeed(baseSpeed) {
return baseSpeed * this.cachedParams.enemySpeedMult;
}
*/
scaleSpawnRate(baseRate) {
return baseRate * this.cachedParams.spawnRateMult;
}
*/
scaleProjectileSpeed(baseSpeed) {
return baseSpeed * this.cachedParams.projectileSpeedMult;
}
*/
shouldSpawnElite() {
return Math.random() < this.cachedParams.eliteChance;
}
*/
shouldAllowHPDrop() {
return Math.random() < this.cachedParams.hpDropFreqMult;
}
*/
canDirectorReduce() {
return !this.cachedParams.directorLocked;
}
*/
applyElementalPhysics(velocity, entityType = 'enemy') {
const params = this.cachedParams;
if (entityType === 'enemy') {
velocity.x *= params.nebulaDrag;
velocity.y *= params.nebulaDrag;
} else if (entityType === 'player') {
velocity.x *= params.playerDrag;
velocity.y *= params.playerDrag;
}
if (params.impulseJoltChance > 0 && Math.random() < params.impulseJoltChance) {
return {
x: (Math.random() - 0.5) * params.impulseJoltStrength,
y: (Math.random() - 0.5) * params.impulseJoltStrength
};
}
return null;
}
*/
getAggressionMult() {
return this.cachedParams.aggressionMult;
}
*/
getSeparationDistance() {
return this.cachedParams.separationDistance;
}
*/
debugPrintTable() {
console.log('=== 20 SECTOR ELEMENTAL ODYSSEY ===');
for (let L = 1; L <= this.MAX_SECTOR; L++) {
const p = this.computeParams(L);
console.log(`L${L} [${p.element}]: mult=${p.sectorMult.toFixed(2)}, HP=${p.enemyHPMult.toFixed(1)}x, ` +
`Speed=${p.enemySpeedMult.toFixed(2)}x, Aggro=${p.aggressionMult.toFixed(1)}x, ` +
`Drag=${p.nebulaDrag}, Tier=${p.difficultyTier}`);
}
}
}
const difficultySystem = new DifficultySystem();
