/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (TelemetryService.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class TelemetryService {
constructor() {
this.positionHistory = [];     // {x, y, t} samples
this.velocityHistory = [];     // 1st derivative
this.accelerationHistory = []; // 2nd derivative
this.jerkHistory = [];         // 3rd derivative (target metric)
this.MAX_SAMPLES = 60;         // ~1 second at 60fps
this.MIN_SAMPLES_FOR_JERK = 4; // Need 4 positions for 3rd derivative
this.shotOutcomes = [];        // Array of {hit: boolean, time: number}
this.MAX_SHOT_HISTORY = 100;
this.entropyWindow = 20;       // Calculate entropy over last N shots
this.jerkScore = 50;           // How "chaotic" the player moves
this.entropyScore = 50;        // How "random" their shooting is
this.chaosFactor = 1.0;        // Combined chaos multiplier for DNA
this.lastMetricUpdate = 0;
this.updateInterval = 0.5;     // Recalculate every 0.5s
this.CHAOTIC_THRESHOLD = 65;   // Above this = chaotic playstyle
this.PRECISE_THRESHOLD = 35;   // Below this = precise playstyle
}
recordPosition(x, y, time, hp, maxHP, nearbyEnemies) {
this.positionHistory.push({ x, y, t: time });
if (this.positionHistory.length > this.MAX_SAMPLES) {
this.positionHistory.shift();
}
if (this.positionHistory.length >= this.MIN_SAMPLES_FOR_JERK) {
this.calculateDerivatives();
}
if (typeof predictiveAI !== 'undefined') {
predictiveAI.recordEvent('position', {
hp: hp ?? 100,
maxHP: maxHP ?? 100,
nearbyEnemies: nearbyEnemies ?? 0,
jerk: this.jerkHistory.length > 0
? this.jerkHistory[this.jerkHistory.length - 1].j
: 0
});
}
}
calculateDerivatives() {
const pos = this.positionHistory;
const n = pos.length;
if (n >= 2) {
const p1 = pos[n - 1];
const p0 = pos[n - 2];
const dt = p1.t - p0.t || 0.016;
const vx = (p1.x - p0.x) / dt;
const vy = (p1.y - p0.y) / dt;
this.velocityHistory.push({ vx, vy, t: p1.t });
if (this.velocityHistory.length > this.MAX_SAMPLES) {
this.velocityHistory.shift();
}
}
const vel = this.velocityHistory;
if (vel.length >= 2) {
const v1 = vel[vel.length - 1];
const v0 = vel[vel.length - 2];
const dt = v1.t - v0.t || 0.016;
const ax = (v1.vx - v0.vx) / dt;
const ay = (v1.vy - v0.vy) / dt;
this.accelerationHistory.push({ ax, ay, t: v1.t });
if (this.accelerationHistory.length > this.MAX_SAMPLES) {
this.accelerationHistory.shift();
}
}
const acc = this.accelerationHistory;
if (acc.length >= 2) {
const a1 = acc[acc.length - 1];
const a0 = acc[acc.length - 2];
const dt = a1.t - a0.t || 0.016;
const jx = (a1.ax - a0.ax) / dt;
const jy = (a1.ay - a0.ay) / dt;
const jerkMagnitude = Math.hypot(jx, jy);
this.jerkHistory.push({ j: jerkMagnitude, t: a1.t });
if (this.jerkHistory.length > this.MAX_SAMPLES) {
this.jerkHistory.shift();
}
}
}
recordShot(hit, time) {
this.shotOutcomes.push({ hit, t: time });
if (this.shotOutcomes.length > this.MAX_SHOT_HISTORY) {
this.shotOutcomes.shift();
}
if (typeof predictiveAI !== 'undefined') {
predictiveAI.recordEvent('shot', { hit });
}
}
calculateShotEntropy() {
if (this.shotOutcomes.length < 5) return 50; // Default until enough data
const recent = this.shotOutcomes.slice(-this.entropyWindow);
const hits = recent.filter(s => s.hit).length;
const misses = recent.length - hits;
const pHit = hits / recent.length;
const pMiss = misses / recent.length;
let entropy = 0;
if (pHit > 0) entropy -= pHit * Math.log2(pHit);
if (pMiss > 0) entropy -= pMiss * Math.log2(pMiss);
return Math.round(entropy * 100);
}
calculateJerkScore() {
if (this.jerkHistory.length < 10) return 50; // Default
const jerks = this.jerkHistory.map(j => j.j);
const mean = jerks.reduce((a, b) => a + b, 0) / jerks.length;
const variance = jerks.reduce((a, j) => a + Math.pow(j - mean, 2), 0) / jerks.length;
const stdDev = Math.sqrt(variance);
const normalizedVariance = Math.min(100, (stdDev / 50) * 100);
return Math.round(normalizedVariance);
}
update(time) {
if (time - this.lastMetricUpdate < this.updateInterval) return;
this.lastMetricUpdate = time;
this.jerkScore = this.calculateJerkScore();
this.entropyScore = this.calculateShotEntropy();
this.chaosFactor = 0.7 * (this.jerkScore / 50) + 0.3 * (this.entropyScore / 50);
this.chaosFactor = Math.max(0.5, Math.min(2.0, this.chaosFactor));
}
isChaotic() {
return this.jerkScore > this.CHAOTIC_THRESHOLD;
}
isPrecise() {
return this.jerkScore < this.PRECISE_THRESHOLD && this.entropyScore < this.PRECISE_THRESHOLD;
}
getPlaystyle() {
if (this.isChaotic()) return 'Chaotic';
if (this.isPrecise()) return 'Precise';
return 'Balanced';
}
getPrediction() {
if (typeof predictiveAI !== 'undefined') {
return predictiveAI.predict();
}
return { collisionRisk: 0, missedBurstRisk: 0, panicRisk: 0 };
}
getMetrics() {
return {
jerkScore: this.jerkScore,
entropyScore: this.entropyScore,
chaosFactor: this.chaosFactor.toFixed(2),
playstyle: this.getPlaystyle(),
prediction: this.getPrediction(),
samples: {
positions: this.positionHistory.length,
shots: this.shotOutcomes.length,
jerks: this.jerkHistory.length
}
};
}
reset() {
this.positionHistory = [];
this.velocityHistory = [];
this.accelerationHistory = [];
this.jerkHistory = [];
this.shotOutcomes = [];
this.jerkScore = 50;
this.entropyScore = 50;
this.chaosFactor = 1.0;
}
getLatestVectors() {
const v = this.velocityHistory.length > 0 ? this.velocityHistory[this.velocityHistory.length - 1] : { vx: 0, vy: 0 };
const a = this.accelerationHistory.length > 0 ? this.accelerationHistory[this.accelerationHistory.length - 1] : { ax: 0, ay: 0 };
return {
vx: v.vx,
vy: v.vy,
ax: a.ax,
ay: a.ay
};
}
}
const telemetryService = new TelemetryService();
