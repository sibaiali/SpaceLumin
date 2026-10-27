/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (Director.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class Director {
constructor() {
this.accuracy = 50;
this.survivalSkill = 50;
this.reactionTime = 50;
this.movementSkill = 50;
this.shotsFired = 0;
this.shotsHit = 0;
this.damagesTaken = 0;
this.enemiesKilled = 0;
this.lastDamageTime = 0;
this.reactionSamples = [];
this.movementSamples = [];
this.skillScore = 50;
this.lastUpdate = 0;
this.runStartTime = null;
this.playTimeElapsed = 0;
this.lastPrediction = {
collisionRisk: 0,
missedBurstRisk: 0,
panicRisk: 0
};
this.enemySpeedMult = 1.0;
this.spawnDensityMult = 1.0;
this.eliteChance = 0.1;
this.hazardFrequency = 1.0;
}
recordShot() {
this.shotsFired++;
}
recordHit() {
this.shotsHit++;
this.updateAccuracy();
}
recordDamage(time) {
this.damagesTaken++;
const timeSinceLast = time - this.lastDamageTime;
this.lastDamageTime = time;
if (timeSinceLast < 2) {
this.survivalSkill = Math.max(0, this.survivalSkill - 3);
} else {
this.survivalSkill = Math.max(0, this.survivalSkill - 1);
}
}
recordKill(reactionMs) {
this.enemiesKilled++;
if (reactionMs > 0 && reactionMs < 10000) {
this.reactionSamples.push(reactionMs);
if (this.reactionSamples.length > 20) this.reactionSamples.shift();
this.updateReactionSkill();
}
this.survivalSkill = Math.min(100, this.survivalSkill + 0.5);
}
recordMovement(jerkMagnitude) {
this.movementSamples.push(jerkMagnitude);
if (this.movementSamples.length > 60) this.movementSamples.shift();
if (this.movementSamples.length > 10) {
const avgJerk = this.movementSamples.reduce((a, b) => a + b, 0) / this.movementSamples.length;
this.movementSkill = Math.min(100, avgJerk * 0.5);
}
}
updateAccuracy() {
if (this.shotsFired > 10) {
this.accuracy = Math.round((this.shotsHit / this.shotsFired) * 100);
}
}
updateReactionSkill() {
if (this.reactionSamples.length < 5) return;
const avg = this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length;
this.reactionTime = Math.max(0, Math.min(100, 100 - (avg - 1000) / 40));
}
update(time, sector = 1) {
if (this.runStartTime === null) {
this.runStartTime = time;
}
if (time - this.lastUpdate < 1.0) return;
this.lastUpdate = time;
this.playTimeElapsed = Math.max(0, time - this.runStartTime);
this.skillScore = Math.round(
this.accuracy * 0.3 +
this.survivalSkill * 0.3 +
this.reactionTime * 0.2 +
this.movementSkill * 0.2
);
const canReduce = typeof difficultySystem !== 'undefined'
? difficultySystem.canDirectorReduce()
: true;
const maxAggression = typeof difficultySystem !== 'undefined'
? difficultySystem.getParams().directorMaxAggression
: false;
let normalized = this.skillScore / 100; // 0-1
const timeEscalation = Math.min(0.65, this.playTimeElapsed / 180); // +0.65 over 3 minutes
const phaseEscalation = Math.min(0.75, Math.max(0, (sector - 1) * 0.06));
if (maxAggression) {
normalized = 1.0;
} else if (!canReduce && normalized < 0.5) {
normalized = 0.5;
}
this.enemySpeedMult = 0.85 + normalized * 0.45 + timeEscalation * 0.25 + phaseEscalation * 0.25;
this.spawnDensityMult = 0.80 + normalized * 0.65 + timeEscalation * 0.45 + phaseEscalation * 0.40;
this.eliteChance = Math.min(0.85, 0.08 + normalized * 0.22 + timeEscalation * 0.18 + phaseEscalation * 0.20);
this.hazardFrequency = 0.6 + normalized * 1.0 + timeEscalation * 0.4;
if (typeof telemetryService !== 'undefined') {
const evaluator = typeof window !== 'undefined'
? window.game?.predictionEvaluator
: null;
const evaluationEnabled = evaluator &&
typeof window.invokePredictionEvaluatorSafely === 'function';
const predictionStartedAt = evaluationEnabled ? performance.now() : null;
const prediction = telemetryService.getPrediction();
if (evaluationEnabled) {
window.invokePredictionEvaluatorSafely('director.prediction-opportunity', () => {
evaluator.openPredictionOpportunity({
predictionLatencyMs: performance.now() - predictionStartedAt,
sector,
gameTime: this.playTimeElapsed
});
});
}
const { collisionRisk, missedBurstRisk, panicRisk } = prediction;
this.lastPrediction = {
collisionRisk: collisionRisk || 0,
missedBurstRisk: missedBurstRisk || 0,
panicRisk: panicRisk || 0
};
if (collisionRisk > 0.70) {
this.enemySpeedMult *= 0.90;
} else if (collisionRisk < 0.25 && this.skillScore > 55) {
this.enemySpeedMult *= 1.12;
this.spawnDensityMult *= 1.10;
}
if (missedBurstRisk > 0.60) {
this.eliteChance = Math.min(0.95, this.eliteChance + 0.12);
}
if (panicRisk > 0.70) {
this.spawnDensityMult *= 0.85;
}
}
}
*/
selectEnemyType(sector = 1, forceElite = false) {
const pred = this.lastPrediction || { collisionRisk: 0, missedBurstRisk: 0, panicRisk: 0 };
const isHighSkill = this.skillScore >= 58 || forceElite || Math.random() < this.eliteChance;
const pool = [
{ type: 'normal', weight: sector <= 2 ? 1.8 : 0.9 },
{ type: 'goblin', weight: 1.5 + Math.min(1.5, sector * 0.2) + (pred.panicRisk > 0.4 ? 0.6 : 0) },
{ type: 'fast',   weight: 1.2 }
];
if (sector >= 2) {
pool.push({
type: 'alien',
weight: 1.6 + Math.min(1.4, (sector - 1) * 0.25) + (pred.missedBurstRisk > 0.4 ? 0.8 : 0)
});
pool.push({
type: 'shooter',
weight: 1.1 + (isHighSkill ? 0.4 : 0)
});
}
if (sector >= 3) {
pool.push({
type: 'creature',
weight: 1.65 + Math.min(1.5, (sector - 2) * 0.25) + (isHighSkill ? 0.6 : 0)
});
pool.push({
type: 'tanky',
weight: 1.15 + (pred.collisionRisk < 0.35 ? 0.45 : 0)
});
}
if (sector >= 5) {
pool.push({
type: 'archon',
weight: 1.45 + Math.min(1.8, (sector - 4) * 0.3) + (isHighSkill ? 0.75 : 0)
});
}
const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
let roll = Math.random() * totalWeight;
for (const item of pool) {
roll -= item.weight;
if (roll <= 0) return item.type;
}
return pool[pool.length - 1].type;
}
getSkillTier() {
if (this.skillScore < 30) return 'Novice';
if (this.skillScore < 50) return 'Adept';
if (this.skillScore < 70) return 'Veteran';
if (this.skillScore < 90) return 'Elite';
return 'Legendary';
}
getDifficultyParams() {
return {
enemySpeedMult: this.enemySpeedMult,
spawnDensityMult: this.spawnDensityMult,
eliteChance: this.eliteChance,
hazardFrequency: this.hazardFrequency,
skillScore: this.skillScore,
playTimeElapsed: this.playTimeElapsed
};
}
reset() {
this.shotsFired = 0;
this.shotsHit = 0;
this.damagesTaken = 0;
this.enemiesKilled = 0;
this.reactionSamples = [];
this.movementSamples = [];
this.runStartTime = null;
this.playTimeElapsed = 0;
}
}
