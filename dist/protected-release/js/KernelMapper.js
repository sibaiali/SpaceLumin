/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (KernelMapper.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class KernelMapper {
constructor() {
this.sigma = 300.0;            // RBF bandwidth σ
this.sigmaUpdated = false;
this.supportVectors = [];       // Array of {x, alpha}
this.MAX_SUPPORT = 200;         // Cap memory usage
this.trainBuffer  = [];         // { x: [3], label: 0|1|2 }
this.TRAIN_THRESH = 40;         // Fit after N labelled samples
this.trained      = false;
this.lambda = 1e-3;
this.FLOW        = 0;
this.FRUSTRATION = 1;
this.BOREDOM     = 2;
this.CLASS_NAMES = ['FLOW', 'FRUSTRATION', 'BOREDOM'];
this.lastProba = [1/3, 1/3, 1/3];
this.lastState = 'FLOW';
}
*/
classify(xPos, yPos, jerkMag) {
const x = this._normalise(xPos, yPos, jerkMag);
if (!this.trained || this.supportVectors.length === 0) {
return this._heuristicClassify(jerkMag);
}
const proba = this._predictProba(x);
this.lastProba = proba;
this.lastState = this.CLASS_NAMES[this._argmax(proba)];
return {
state:    this.lastState,
flowProb: proba[this.FLOW],
proba
};
}
*/
addSample(xPos, yPos, jerkMag, label) {
const x = this._normalise(xPos, yPos, jerkMag);
this.trainBuffer.push({ x, label });
if (this.trainBuffer.length >= this.TRAIN_THRESH) {
this._fit();
}
}
*/
forcefit() {
if (this.trainBuffer.length >= 10) this._fit();
}
*/
getMutationGate() {
const pFlow = this.lastProba[this.FLOW];
return 0.20 * pFlow + 0.05 * (1 - pFlow);
}
*/
kernel(a, b) {
const dSq = (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
return Math.exp(-dSq / (2 * this.sigma * this.sigma));
}
*/
_fit() {
const data  = this.trainBuffer.slice(-this.MAX_SUPPORT);
const n     = data.length;
const xs    = data.map(d => d.x);
const lam   = this.lambda * n;
const K = this._gramMatrix(xs);
for (let i = 0; i < n; i++) K[i][i] += lam;
const alphas = [0, 1, 2].map(c => {
const yBin = data.map(d => d.label === c ? 1.0 : -1.0);
return this._solveLinear(K, yBin, n);
});
this.sigma = this._medianSigma(xs) || this.sigma;
this.supportVectors = xs.map((x, i) => ({
x,
alpha: [alphas[0][i], alphas[1][i], alphas[2][i]]
}));
this.trained = true;
this.trainBuffer = [];   // Clear for next segment
console.log(`[KernelMapper] Fitted KLR on ${n} samples, σ=${this.sigma.toFixed(1)}`);
}
*/
_predictProba(x) {
const scores = [0, 0, 0];
for (const sv of this.supportVectors) {
const kv = this.kernel(sv.x, x);
scores[0] += sv.alpha[0] * kv;
scores[1] += sv.alpha[1] * kv;
scores[2] += sv.alpha[2] * kv;
}
return this._softmax(scores);
}
_gramMatrix(xs) {
const n = xs.length;
const K = Array.from({ length: n }, () => new Array(n).fill(0));
for (let i = 0; i < n; i++) {
K[i][i] = 1.0;            // k(x,x) = 1 always for RBF
for (let j = i + 1; j < n; j++) {
const v = this.kernel(xs[i], xs[j]);
K[i][j] = v;
K[j][i] = v;
}
}
return K;
}
*/
_solveLinear(A, b, n) {
const M = A.map((row, i) => [...row, b[i]]);
for (let col = 0; col < n; col++) {
let maxRow = col;
for (let r = col + 1; r < n; r++) {
if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
}
[M[col], M[maxRow]] = [M[maxRow], M[col]];
const pivot = M[col][col];
if (Math.abs(pivot) < 1e-12) continue;
for (let r = 0; r < n; r++) {
if (r === col) continue;
const factor = M[r][col] / pivot;
for (let c = col; c <= n; c++) {
M[r][c] -= factor * M[col][c];
}
}
}
return M.map((row, i) => (Math.abs(M[i][i]) > 1e-12 ? row[n] / M[i][i] : 0));
}
*/
_normalise(xPos, yPos, jerkMag) {
return [
xPos    / 800.0,    // world width ≈ 800
yPos    / 600.0,    // world height ≈ 600
jerkMag / 1000.0    // jerk 0–2000 → 0–2
];
}
*/
_medianSigma(xs) {
const dists = [];
for (let i = 0; i < xs.length; i++) {
for (let j = i + 1; j < xs.length; j++) {
const a = xs[i], b = xs[j];
dists.push((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}
}
if (dists.length === 0) return null;
dists.sort((a, b) => a - b);
const med = dists[Math.floor(dists.length / 2)];
return Math.sqrt(Math.max(med, 0.01));
}
_softmax(scores) {
const maxS = Math.max(...scores);
const exp  = scores.map(s => Math.exp(s - maxS));
const sum  = exp.reduce((a, b) => a + b, 0);
return exp.map(e => e / sum);
}
_argmax(arr) {
return arr.indexOf(Math.max(...arr));
}
*/
_heuristicClassify(jerkMag) {
if (typeof telemetryService === 'undefined') {
return { state: 'FLOW', flowProb: 0.5, proba: [0.5, 0.25, 0.25] };
}
const js = telemetryService.jerkScore;
let proba;
if (js >= 40 && js <= 75) {
proba = [0.65, 0.20, 0.15];          // In the flow band
} else if (js > 75) {
proba = [0.20, 0.65, 0.15];          // High jerk → frustration
} else {
proba = [0.20, 0.15, 0.65];          // Low jerk → boredom
}
return {
state:    this.CLASS_NAMES[this._argmax(proba)],
flowProb: proba[this.FLOW],
proba
};
}
reset() {
this.supportVectors = [];
this.trainBuffer    = [];
this.trained        = false;
this.lastProba      = [1/3, 1/3, 1/3];
this.lastState      = 'FLOW';
}
getDebugInfo() {
return {
trained:         this.trained,
sigma:           this.sigma.toFixed(2),
supportCount:    this.supportVectors.length,
trainBufferSize: this.trainBuffer.length,
lastState:       this.lastState,
flowProb:        this.lastProba[this.FLOW].toFixed(3),
mutationGate:    this.getMutationGate().toFixed(3)
};
}
}
const kernelMapper = new KernelMapper();
