/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (NeuroFlowController.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class NeuroFlowController {
constructor() {
this.PHI_UNDER = 0.40;        // φ < 0.40 → boredom/disengagement
this.PHI_OVER  = 0.80;        // φ > 0.80 → over-stimulation
this.BETA      = 0.35;        // Neuro-attenuation coefficient
this.BASE_MULT = 1.55;
this.a1 = 0.90;               // AR coefficient 1
this.a2 = -0.10;              // AR coefficient 2
this.F  = [[this.a1, this.a2], [1.0, 0.0]];   // Transition matrix
this.H  = [1.0, 0.0];         // Observation row
this.zHat = [0.5, 0.5];       // [φ, φ_prev]
this.P    = [[0.1, 0], [0, 0.1]];
this.Q = [[0.005, 0], [0, 0.005]];   // Process noise
this.R = 0.05;                        // Observation noise (TRIBE error)
this.phiHistory = [0.5, 0.5, 0.5, 0.5];   // Last 4 Kalman extrapolates
this.currentPhi = 0.5;
this.pendingObservation = null;   // { phi: number, ts: number }
this.lastObservationTs  = 0;
this.LABEL_INTERVAL_MS = 500;   // Label every 500ms
this.lastLabelTs       = 0;
this.flowBand      = 'FLOW';   // 'FLOW' | 'OVER' | 'UNDER'
this.diffMult      = 1.0;      // Modifier to apply to f(L)
this.spawnAdjust   = 1.0;      // Multiplier for SpawnBudget
this.aggroAdjust   = 1.0;      // Multiplier for EnemyDNA aggro gene
this.mutationGate  = 0.15;     // KLR-gated mutation strength
this.tickCount = 0;
console.log('[NeuroFlowController] Initialised – Lumin Flow 2.0');
}
*/
update(nowMs, sector) {
this.tickCount++;
this._kalmanPredict();
if (this.pendingObservation !== null) {
this._kalmanUpdate(this.pendingObservation.phi);
this.pendingObservation = null;
}
const phiNow = this._getKalmanPhi();
this.phiHistory.push(phiNow);
if (this.phiHistory.length > 4) this.phiHistory.shift();
this.currentPhi = phiNow;
this.flowBand = this._classifyBand(phiNow);
this._updateDifficultyModifiers(phiNow, sector);
if (nowMs - this.lastLabelTs > this.LABEL_INTERVAL_MS) {
this._autoLabel(nowMs, phiNow);
this.lastLabelTs = nowMs;
}
}
*/
interpolate(tau) {
return this._catmullRom(tau, this.phiHistory);
}
*/
onTribeObservation(phi) {
const clamped = Math.max(0, Math.min(1, phi));
this.pendingObservation = { phi: clamped, ts: performance.now() };
this.lastObservationTs  = performance.now();
}
*/
clampDNA(dna, sector) {
const phi   = this.currentPhi;
const fL    = this._difficultyMultiplier(sector);
const fTild = fL * (1 - this.BETA * (1 - phi));  // §5.1 neuro-attenuation
const compress = Math.pow(fTild, 1/3);
const gate  = typeof kernelMapper !== 'undefined'
? kernelMapper.getMutationGate()
: 0.15;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const modulate = (gene, lo, hi) => clamp(gene * compress * (1 + (Math.random()*2-1) * gate), lo, hi);
return {
...dna,
speed:    modulate(dna.speed,    0.6, 1.8) * this.spawnAdjust,
aggro:    modulate(dna.aggro,    0.5, 2.5) * this.aggroAdjust,
scale:    dna.scale,       // Scale not neuro-modulated (visual only)
emissive: dna.emissive
};
}
*/
getDifficultyModifier() {
return this.diffMult;
}
_kalmanPredict() {
const z0 = this.zHat[0], z1 = this.zHat[1];
this.zHat = [
this.F[0][0]*z0 + this.F[0][1]*z1,
this.F[1][0]*z0 + this.F[1][1]*z1
];
this.P = _mat2Add(_mat2Mul(_mat2Mul(this.F, this.P), _mat2T(this.F)), this.Q);
}
_kalmanUpdate(y) {
const nu = y - (this.H[0]*this.zHat[0] + this.H[1]*this.zHat[1]);
const S = this.P[0][0] + this.R;
const Kg = [this.P[0][0] / S, this.P[1][0] / S];
this.zHat = [this.zHat[0] + Kg[0]*nu, this.zHat[1] + Kg[1]*nu];
const IP = [
[1 - Kg[0]*this.H[0], -Kg[0]*this.H[1]],
[-Kg[1]*this.H[0],    1 - Kg[1]*this.H[1]]
];
this.P = _mat2Mul(IP, this.P);
}
_getKalmanPhi() {
return Math.max(0, Math.min(1, this.zHat[0]));
}
*/
_catmullRom(tau, pts) {
const [p0, p1, p2, p3] = pts;
const t2 = tau * tau;
const t3 = t2  * tau;
const v  = 0.5 * (
(-t3 + 2*t2 - tau)      * p0 +
( 3*t3 - 5*t2 + 2)      * p1 +
(-3*t3 + 4*t2 + tau)    * p2 +
( t3 - t2)              * p3
);
return Math.max(0, Math.min(1, v));
}
_classifyBand(phi) {
if (phi > this.PHI_OVER)  return 'OVER';
if (phi < this.PHI_UNDER) return 'UNDER';
return 'FLOW';
}
*/
_difficultyMultiplier(sector) {
return Math.pow(this.BASE_MULT, Math.max(1, sector) - 1);
}
*/
_updateDifficultyModifiers(phi, sector) {
const fL       = this._difficultyMultiplier(sector);
const fTild    = fL * (1 - this.BETA * (1 - phi));
this.diffMult  = Math.max(0.65, Math.min(1.0, fTild / fL));
switch (this.flowBand) {
case 'OVER':
this.spawnAdjust = 0.85;
this.aggroAdjust = 1.00;
break;
case 'UNDER':
this.spawnAdjust = 1.00;
this.aggroAdjust = 1.10;
break;
default:   // 'FLOW'
this.spawnAdjust = 1.00;
this.aggroAdjust = 1.00;
break;
}
if (typeof kernelMapper !== 'undefined') {
this.mutationGate = kernelMapper.getMutationGate();
}
}
_autoLabel(nowMs, phi) {
if (typeof telemetryService === 'undefined') return;
if (typeof kernelMapper    === 'undefined') return;
const p = telemetryService;
let label;
if      (phi > 0.70) label = kernelMapper.FLOW;
else if (phi < 0.35) label = kernelMapper.BOREDOM;
else                 label = kernelMapper.FRUSTRATION;
const pos = p.positionHistory[p.positionHistory.length - 1] || { x: 400, y: 300 };
const jerk = p.jerkHistory.length > 0
? p.jerkHistory[p.jerkHistory.length - 1].j
: 0;
kernelMapper.addSample(pos.x, pos.y, jerk, label);
}
getDebugInfo() {
return {
phi:          this.currentPhi.toFixed(3),
flowBand:     this.flowBand,
diffMult:     this.diffMult.toFixed(3),
spawnAdjust:  this.spawnAdjust.toFixed(2),
aggroAdjust:  this.aggroAdjust.toFixed(2),
mutationGate: this.mutationGate.toFixed(3),
kalmanState:  [this.zHat[0].toFixed(3), this.zHat[1].toFixed(3)],
kalmanCov:    this.P[0][0].toFixed(4),
kernel:       typeof kernelMapper !== 'undefined' ? kernelMapper.getDebugInfo() : null
};
}
reset() {
this.zHat        = [0.5, 0.5];
this.P           = [[0.1, 0], [0, 0.1]];
this.phiHistory  = [0.5, 0.5, 0.5, 0.5];
this.currentPhi  = 0.5;
this.flowBand    = 'FLOW';
this.diffMult    = 1.0;
this.spawnAdjust = 1.0;
this.aggroAdjust = 1.0;
this.tickCount   = 0;
if (typeof kernelMapper !== 'undefined') kernelMapper.reset();
}
}
function _mat2Mul(A, B) {
return [
[A[0][0]*B[0][0] + A[0][1]*B[1][0],  A[0][0]*B[0][1] + A[0][1]*B[1][1]],
[A[1][0]*B[0][0] + A[1][1]*B[1][0],  A[1][0]*B[0][1] + A[1][1]*B[1][1]]
];
}
function _mat2Add(A, B) {
return [
[A[0][0]+B[0][0], A[0][1]+B[0][1]],
[A[1][0]+B[1][0], A[1][1]+B[1][1]]
];
}
function _mat2T(A) {
return [[A[0][0], A[1][0]], [A[0][1], A[1][1]]];
}
const neuroFlow = new NeuroFlowController();
