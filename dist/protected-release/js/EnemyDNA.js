/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (EnemyDNA.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class EnemyDNA {
constructor() {
this.genePool = [];
this.survivorPool = [];    // Top 10% longest survivors
this.generation = 1;
this.MUTATION_RATE = 0.15;       // 15% chance per gene
this.MUTATION_STRENGTH = 0.20;   // ±20% variation
this.SURVIVOR_PERCENT = 0.10;    // Top 10% pass genes
this.CHAOS_SPEED_BOOST = 0.15;   // +15% speed if player is chaotic
this.geneRanges = {
speed: { min: 0.6, max: 1.8, default: 1.0 },
aggro: { min: 0.5, max: 2.5, default: 1.0 },
scale: { min: 0.7, max: 1.5, default: 1.0 },
emissive: { min: 0.1, max: 1.0, default: 0.3 }
};
this.elementalModifiers = {
ICE: { speed: 0.85, aggro: 0.9, separation: 40 },      // Sectors 1-5
FIRE: { speed: 1.1, aggro: 2.0, separation: 50 },      // Sectors 6-10
NATURE: { speed: 0.95, aggro: 1.0, separation: 80 },   // Sectors 11-15
WIND: { speed: 1.2, aggro: 1.3, separation: 60 }       // Sectors 16-20
};
}
createDNA(parentA = null, parentB = null) {
if (parentA && parentB) {
return this.crossover(parentA, parentB);
}
return {
speed: this.randomInRange(this.geneRanges.speed),
aggro: this.randomInRange(this.geneRanges.aggro),
scale: this.randomInRange(this.geneRanges.scale),
emissive: this.randomInRange(this.geneRanges.emissive),
spawnTime: performance.now(),
survivalTime: 0
};
}
crossover(parentA, parentB) {
const child = {
speed: Math.random() < 0.5 ? parentA.speed : parentB.speed,
aggro: Math.random() < 0.5 ? parentA.aggro : parentB.aggro,
scale: Math.random() < 0.5 ? parentA.scale : parentB.scale,
emissive: Math.random() < 0.5 ? parentA.emissive : parentB.emissive,
spawnTime: performance.now(),
survivalTime: 0
};
return this.mutate(child);
}
mutate(dna) {
const mutated = { ...dna };
for (const gene of ['speed', 'aggro', 'scale', 'emissive']) {
if (Math.random() < this.MUTATION_RATE) {
const range = this.geneRanges[gene];
const variation = 1 + (Math.random() * 2 - 1) * this.MUTATION_STRENGTH;
mutated[gene] = this.clamp(mutated[gene] * variation, range.min, range.max);
}
}
return mutated;
}
adaptToTelemetry(dna) {
if (typeof telemetryService === 'undefined') return dna;
const adapted = { ...dna };
if (telemetryService.isChaotic()) {
adapted.speed *= (1 + this.CHAOS_SPEED_BOOST);
adapted.speed = this.clamp(adapted.speed,
this.geneRanges.speed.min,
this.geneRanges.speed.max);
}
adapted.aggro *= telemetryService.chaosFactor;
adapted.aggro = this.clamp(adapted.aggro,
this.geneRanges.aggro.min,
this.geneRanges.aggro.max);
return adapted;
}
applyElementalModifiers(dna, sector) {
const element = this.getElement(sector);
const mods = this.elementalModifiers[element];
if (!mods) return dna;
return {
...dna,
speed: dna.speed * mods.speed,
aggro: dna.aggro * mods.aggro
};
}
getElement(sector) {
if (sector <= 5) return 'ICE';
if (sector <= 10) return 'FIRE';
if (sector <= 15) return 'NATURE';
return 'WIND';
}
getSeparationDistance(sector) {
const element = this.getElement(sector);
return this.elementalModifiers[element]?.separation || 50;
}
registerEnemy(enemy) {
if (!enemy.dna) {
enemy.dna = this.createDNA();
}
this.genePool.push(enemy);
}
recordDeath(enemy) {
if (!enemy.dna) return;
enemy.dna.survivalTime = performance.now() - enemy.dna.spawnTime;
const idx = this.genePool.indexOf(enemy);
if (idx !== -1) this.genePool.splice(idx, 1);
}
evolve(deadEnemies = []) {
const allGenes = [...this.genePool, ...deadEnemies]
.filter(e => e.dna && e.dna.survivalTime > 0)
.map(e => e.dna);
if (allGenes.length < 5) {
this.generation++;
return; // Not enough data for evolution
}
allGenes.sort((a, b) => b.survivalTime - a.survivalTime);
const survivorCount = Math.max(2, Math.floor(allGenes.length * this.SURVIVOR_PERCENT));
this.survivorPool = allGenes.slice(0, survivorCount);
this.genePool = [];
this.generation++;
console.log(`[EnemyDNA] Generation ${this.generation}: ${survivorCount} survivors selected`);
}
spawnNextGenDNA(sector) {
let dna;
if (this.survivorPool.length >= 2) {
const parentA = this.survivorPool[Math.floor(Math.random() * this.survivorPool.length)];
const parentB = this.survivorPool[Math.floor(Math.random() * this.survivorPool.length)];
dna = this.crossover(parentA, parentB);
} else {
dna = this.createDNA();
}
dna = this.adaptToTelemetry(dna);
dna = this.applyElementalModifiers(dna, sector);
if (typeof predictiveAI !== 'undefined') {
const hint = predictiveAI.getEnemyHint();
dna.aggro = this.clamp(dna.aggro * hint.aggroMult,
this.geneRanges.aggro.min, this.geneRanges.aggro.max);
dna.speed = this.clamp(dna.speed * hint.speedMult,
this.geneRanges.speed.min, this.geneRanges.speed.max);
}
if (typeof neuroFlow !== 'undefined') {
dna = neuroFlow.clampDNA(dna, sector);
}
return dna;
}
randomInRange(range) {
return range.min + Math.random() * (range.max - range.min);
}
clamp(value, min, max) {
return Math.max(min, Math.min(max, value));
}
getStats() {
const avgGenes = { speed: 0, aggro: 0, scale: 0 };
if (this.genePool.length > 0) {
for (const enemy of this.genePool) {
if (enemy.dna) {
avgGenes.speed += enemy.dna.speed;
avgGenes.aggro += enemy.dna.aggro;
avgGenes.scale += enemy.dna.scale;
}
}
avgGenes.speed /= this.genePool.length;
avgGenes.aggro /= this.genePool.length;
avgGenes.scale /= this.genePool.length;
}
return {
generation: this.generation,
poolSize: this.genePool.length,
survivorCount: this.survivorPool.length,
averageGenes: {
speed: avgGenes.speed.toFixed(2),
aggro: avgGenes.aggro.toFixed(2),
scale: avgGenes.scale.toFixed(2)
}
};
}
reset() {
this.genePool = [];
this.survivorPool = [];
this.generation = 1;
}
}
const enemyDNA = new EnemyDNA();
