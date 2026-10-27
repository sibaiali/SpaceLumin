/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (CognitiveOverloadDetector.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class CognitiveOverloadDetector {
constructor() {
this.m      = 60;             // Must match NystromKernel.numLandmarks
this.w      = new Float32Array(this.m).fill(0.0);
this.bias   = 0.0;
this.klrFitted = false;
this.KLR_LAMBDA = 5e-3;
this.KLR_LR     = 0.05;
this.lassoAlpha  = new Float32Array(this.m);
this.LASSO_LAMBDA = 8e-3;     // Sparsity strength
this.LASSO_ITERS  = 30;       // CD iterations per refit
this.PHI_ATTN   = 0.60;       // Simulated attention ROI activation
this.PHI_DMN    = 0.45;       // Simulated DMN activation
this.OI_PREV    = 0.15;       // Previous OI for derivative
this.OI_NOW     = 0.15;
this.OI_THRESH  = 0.15;
this.OI_DOT_THRESH = -0.03;   // d/dt threshold for pre-overload warning
this.overloadProb   = 0.0;    // P(Overload | x_t)  [0,1]
this.isOverloaded   = false;
this.preWarningFired = false;
this.lastWarningTime = -999999;
this.WARNING_COOLDOWN_MS = 5000;  // Don't fire twice within 5s
this.STIM_NAMES = [
'enemyDensity', 'bulletCoverage', 'audioPeakDb',
'visibleMeshes', 'aggressionMult', 'waveTimerRatio'
];
this.attrScores = new Float32Array(6);   // One per stimulus
this.trainBuf = [];
this.TRAIN_SIZE = 80;
this.lastStimulus  = null;
this.lastTelemetry = null;
this.interventionCooldowns = {
enemyDensity:   0,
bulletCoverage: 0,
audioPeakDb:    0,
visibleMeshes:  0,
aggressionMult: 0,
waveTimerRatio: 0
};
console.log('[CogOverload] Initialised — Space Lumin Neuro-Predictive Engine');
}
*/
update(nowMs, gameCtx) {
const stim = this.captureStimulus(gameCtx);
this.lastStimulus = stim;
const tel = this._captureTelemetry(gameCtx);
this.lastTelemetry = tel;
if (typeof nystromKernel !== 'undefined') {
nystromKernel.observe(tel, stim);
}
this._updateOI();
const label = this._computeLabel();
this._bufferTrainSample(tel, stim, label);
if (typeof nystromKernel !== 'undefined' && nystromKernel.isFitted) {
const phi = nystromKernel.featureVector(tel, stim);
this.overloadProb = this._klrPredict(phi);
}
const dOI = (this.OI_NOW - this.OI_PREV) / 0.05; // per-second rate (50ms tick)
const gateOpen = this.overloadProb > 0.65 && dOI < this.OI_DOT_THRESH;
if (gateOpen && nowMs - this.lastWarningTime > this.WARNING_COOLDOWN_MS) {
this.lastWarningTime = nowMs;
this.preWarningFired = true;
this._lassoAttributeStimulus(tel, stim);
this._dispatchIntervention(nowMs, gameCtx);
} else {
this.preWarningFired = false;
}
this.isOverloaded = this.OI_NOW < this.OI_THRESH;
}
*/
captureStimulus(ctx) {
if (!ctx) return {};
const ep = ctx.enemyPool;
const as = ctx.audioSystem;
const ds = ctx.difficultySystem;
const sb = ctx.spawnBudget;
const w3 = ctx.world3D;
const pl = ctx.player;
const bulletCoverage = ctx.activeBullets ?? 0;
const enemyDensity = (typeof predictiveAI !== 'undefined')
? predictiveAI.nearbyEnemies
: (ep?.genePool?.length ?? 0);
return {
enemyDensity:   Math.min(12, enemyDensity),
bulletCoverage: Math.min(30, bulletCoverage),
audioPeakDb:    as?.masterVolume ?? 0.5,     // Proxy for audio power
visibleMeshes:  w3?.scene?.children?.length ?? 0,
aggressionMult: ds?.getAggressionMult?.() ?? 1.0,
waveTimerRatio: sb?.getBudgetRatio?.()     ?? 0.5
};
}
_updateOI() {
this.OI_PREV = this.OI_NOW;
if (typeof neuroFlow !== 'undefined') {
const phi = neuroFlow.currentPhi;
this.PHI_ATTN = 0.4 + 0.6 * phi;
this.PHI_DMN  = 0.65 - 0.5 * phi + 0.1 * (1 - phi) ** 2;
} else {
this.PHI_ATTN = 1 - this.overloadProb;
this.PHI_DMN  = 0.3 + 0.4 * this.overloadProb;
}
this.OI_NOW = Math.max(-1, Math.min(1, this.PHI_ATTN - this.PHI_DMN));
}
_computeLabel() {
return (this.OI_NOW < this.OI_THRESH) ? 1 : 0;
}
_klrPredict(phi) {
let score = this.bias;
for (let i = 0; i < this.m; i++) score += this.w[i] * phi[i];
return 1.0 / (1.0 + Math.exp(-score));   // sigmoid
}
*/
_klrOnlineUpdate(phi, y) {
const yy  = y === 1 ? 1 : -1;     // {-1, +1} encoding
const dot  = this.bias + this._dot(this.w, phi);
const sig  = 1.0 / (1.0 + Math.exp(-yy * dot));
const grad = -yy * (1 - sig);     // ∂L/∂(w^T φ + b)
for (let i = 0; i < this.m; i++) {
this.w[i] -= this.KLR_LR * (grad * phi[i] + 2 * this.KLR_LAMBDA * this.w[i]);
}
this.bias -= this.KLR_LR * grad;
this.klrFitted = true;
}
_lassoAttributeStimulus(tel, stim) {
if (typeof nystromKernel === 'undefined' || !nystromKernel.isFitted) return;
if (this.trainBuf.length < 20) return;
const batch  = this.trainBuf.slice(-60);
const n      = batch.length;
const PHI    = batch.map(s => s.phi);    // (n, m)
const Y      = batch.map(s => s.label);  // (n,) in {0,1}
const alpha  = new Float32Array(this.lassoAlpha);
const lam    = this.LASSO_LAMBDA;
for (let iter = 0; iter < this.LASSO_ITERS; iter++) {
for (let j = 0; j < this.m; j++) {
const col_j  = PHI.map(phi => phi[j]);
const cj     = this._norm2(col_j) / n;   // ||φ̃_j||² / n
if (cj < 1e-10) continue;
let zj = 0;
for (let i = 0; i < n; i++) {
const ri = Y[i] - this._dotBatch(PHI[i], alpha) + col_j[i] * alpha[j];
zj += col_j[i] * ri;
}
zj /= n;
const sz = Math.sign(zj) * Math.max(Math.abs(zj) - lam, 0);
alpha[j] = sz / cj;
}
}
this.lassoAlpha = alpha;
if (!nystromKernel.isFitted) return;
const lm   = nystromKernel.landmarks;
const d    = nystromKernel.d;
const mean = nystromKernel.featureMean;
const std  = nystromKernel.featureStd;
for (let s = 0; s < 6; s++) {
const dim = 6 + s;   // Stimulus dimensions are indices 6–11
let score = 0;
for (let j = 0; j < this.m; j++) {
const xjs = lm[j * d + dim];
const zs  = (xjs - mean[dim]) / (std[dim] + 1e-6);
score    += Math.abs(alpha[j]) * Math.abs(zs);
}
this.attrScores[s] = score;
}
}
_dispatchIntervention(nowMs, ctx) {
if (!ctx) return;
let maxScore = -1, maxIdx = 0;
for (let i = 0; i < 6; i++) {
if (this.attrScores[i] > maxScore) {
maxScore = this.attrScores[i];
maxIdx   = i;
}
}
const stimName = this.STIM_NAMES[maxIdx];
if (this.interventionCooldowns[stimName] > nowMs) return;
console.log(`[CogOverload] ⚠ Pre-overload WARNING | P=${this.overloadProb.toFixed(2)} | OI=${this.OI_NOW.toFixed(3)} | Cause: ${stimName}`);
switch (stimName) {
case 'enemyDensity':
if (typeof director !== 'undefined') {
director.spawnDensityMult = Math.max(0.5, director.spawnDensityMult * 0.80);
}
this.interventionCooldowns[stimName] = nowMs + 8000;
break;
case 'bulletCoverage':
if (ctx.player && typeof metaSystem !== 'undefined') {
const dur = metaSystem.computeShieldDuration(ctx.sector ?? 1);
ctx.player.activateShield(performance.now() / 1000, Math.min(dur, 2.5));
}
this.interventionCooldowns[stimName] = nowMs + 6000;
break;
case 'audioPeakDb':
if (ctx.audioSystem?.setMasterVolume) {
const orig = ctx.audioSystem.masterVolume ?? 1.0;
ctx.audioSystem.setMasterVolume(orig * 0.6);
setTimeout(() => ctx.audioSystem?.setMasterVolume?.(orig), 4000);
}
this.interventionCooldowns[stimName] = nowMs + 7000;
break;
case 'visibleMeshes':
if (typeof difficultySystem !== 'undefined') {
const p = difficultySystem.getParams();
if (p) difficultySystem.cachedParams.hazardStrengthMult = Math.max(1, p.hazardStrengthMult * 0.7);
}
this.interventionCooldowns[stimName] = nowMs + 5000;
break;
case 'aggressionMult':
if (typeof director !== 'undefined') {
const orig = director.enemySpeedMult;
director.enemySpeedMult = Math.max(0.7, orig * 0.85);
setTimeout(() => { if (typeof director !== 'undefined') director.enemySpeedMult = orig; }, 3000);
}
this.interventionCooldowns[stimName] = nowMs + 6000;
break;
case 'waveTimerRatio':
if (ctx.spawnBudget?.extendBudget) {
ctx.spawnBudget.extendBudget(5.0);   // +5s grace
}
this.interventionCooldowns[stimName] = nowMs + 10000;
break;
}
}
_bufferTrainSample(tel, stim, label) {
if (typeof nystromKernel === 'undefined' || !nystromKernel.isFitted) return;
const phi = nystromKernel.featureVector(tel, stim);
this.trainBuf.push({ phi, label });
if (this.trainBuf.length > this.TRAIN_SIZE) this.trainBuf.shift();
if (this.trainBuf.length % 10 === 0) {
this._klrOnlineUpdate(phi, label);
}
}
_captureTelemetry(ctx) {
const tel = typeof telemetryService !== 'undefined' ? telemetryService : null;
const pl  = ctx?.player;
const dir = typeof director !== 'undefined' ? director : null;
return {
vx:        pl?.vx         ?? 0,
vy:        pl?.vy         ?? 0,
accelMag:  pl ? Math.hypot(pl.ax ?? 0, pl.ay ?? 0) : 0,
jerkMag:   tel?.jerkHistory?.slice(-1)[0]?.j ?? 0,
reactMs:   dir?.reactionSamples?.slice(-1)[0] ?? 2000,
accuracy:  dir ? (dir.shotsHit / Math.max(1, dir.shotsFired)) : 0.5
};
}
_dot(a, b) {
let s = 0;
for (let i = 0; i < a.length; i++) s += a[i] * b[i];
return s;
}
_dotBatch(phi, alpha) {
let s = 0;
for (let j = 0; j < this.m; j++) s += phi[j] * alpha[j];
return s;
}
_norm2(arr) {
let s = 0;
for (const v of arr) s += v * v;
return s;
}
reset() {
this.w              = new Float32Array(this.m).fill(0);
this.bias           = 0;
this.lassoAlpha     = new Float32Array(this.m);
this.trainBuf       = [];
this.klrFitted      = false;
this.overloadProb   = 0;
this.isOverloaded   = false;
this.OI_NOW         = 0.15;
this.OI_PREV        = 0.15;
this.attrScores     = new Float32Array(6);
this.lastWarningTime = -999999;
this.preWarningFired = false;
for (const k of Object.keys(this.interventionCooldowns)) {
this.interventionCooldowns[k] = 0;
}
if (typeof nystromKernel !== 'undefined') nystromKernel.reset();
}
getDebugInfo() {
const attr = {};
this.STIM_NAMES.forEach((n, i) => { attr[n] = this.attrScores[i].toFixed(3); });
return {
overloadProb:    this.overloadProb.toFixed(3),
overloadIndex:   this.OI_NOW.toFixed(3),
dOI:             ((this.OI_NOW - this.OI_PREV) / 0.05).toFixed(3),
isOverloaded:    this.isOverloaded,
preWarning:      this.preWarningFired,
klrFitted:       this.klrFitted,
stimAttribution: attr,
nystromState:    typeof nystromKernel !== 'undefined' ? nystromKernel.getDebugInfo() : null
};
}
}
const cogOverload = new CognitiveOverloadDetector();
