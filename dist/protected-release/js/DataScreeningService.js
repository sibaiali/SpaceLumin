/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (DataScreeningService.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
class DataScreeningService {
constructor() {
this.storageKey = 'spacelumin_screened_dataset_v1';
this.endpoint = '/api/telemetry/screened';
this.windowSamples = [];
this.screenedBatches = [];
this.rejectedOutliers = 0;
this.acceptedSamples = 0;
this.lastFlushTime = 0;
this.flushIntervalSec = 10.0;
this.sessionId = 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
this._loadStoredBatches();
}
_loadStoredBatches() {
if (typeof localStorage === 'undefined') return;
try {
const raw = localStorage.getItem(this.storageKey);
if (raw) {
const parsed = JSON.parse(raw);
if (Array.isArray(parsed)) {
this.screenedBatches = parsed.slice(-80);
}
}
} catch (_) {}
}
_saveStoredBatches() {
if (typeof localStorage === 'undefined') return;
try {
localStorage.setItem(this.storageKey, JSON.stringify(this.screenedBatches.slice(-80)));
} catch (_) {}
}
*/
ingestFrame(sample) {
if (!sample) return false;
const { x, y, vx, vy, jerk, flow, sector, nearbyEnemies, dt, time } = sample;
if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(vx) || !Number.isFinite(vy)) {
this.rejectedOutliers++;
return false;
}
if (typeof dt === 'number' && (dt <= 0 || dt > 0.2)) {
this.rejectedOutliers++;
return false;
}
const cleanJerk = Number.isFinite(jerk) ? Math.min(5000, Math.max(0, jerk)) : 0;
const speed = Math.hypot(vx, vy);
this.acceptedSamples++;
this.windowSamples.push({
t: Number((time || 0).toFixed(3)),
x: Math.round(x),
y: Math.round(y),
s: Math.round(speed),
j: Math.round(cleanJerk),
f: Math.round(flow || 0),
sec: sector || 1,
ne: nearbyEnemies || 0,
st: typeof predictiveAI !== 'undefined' ? predictiveAI.lastState : -1
});
if ((time || 0) - this.lastFlushTime >= this.flushIntervalSec && this.windowSamples.length >= 20) {
this.lastFlushTime = time || 0;
this.flushScreenedWindow('periodic');
}
return true;
}
*/
flushScreenedWindow(reason = 'periodic') {
if (this.windowSamples.length === 0) return null;
const n = this.windowSamples.length;
let sumSpeed = 0;
let sumJerk = 0;
let activeFrames = 0;
const stateCounts = new Map();
for (let i = 0; i < n; i++) {
const w = this.windowSamples[i];
sumSpeed += w.s;
sumJerk += w.j;
if (w.s > 8) activeFrames++;
if (w.st >= 0) {
stateCounts.set(w.st, (stateCounts.get(w.st) || 0) + 1);
}
}
const meanSpeed = sumSpeed / n;
const meanJerk = sumJerk / n;
const activityRatio = activeFrames / n;
let shannonEntropy = 0;
for (const count of stateCounts.values()) {
const p = count / n;
if (p > 0) shannonEntropy -= p * Math.log2(p);
}
const prediction = (typeof telemetryService !== 'undefined' && telemetryService.getPrediction)
? telemetryService.getPrediction()
: { collisionRisk: 0, missedBurstRisk: 0, panicRisk: 0 };
const qualityScore = Math.round(
Math.min(100, Math.max(0,
activityRatio * 55 +
Math.min(1, shannonEntropy / 3.2) * 30 +
Math.min(1, n / 120) * 15
))
);
const packet = {
sessionId: this.sessionId,
timestamp: new Date().toISOString(),
reason,
sampleCount: n,
acceptedTotal: this.acceptedSamples,
rejectedOutliers: this.rejectedOutliers,
qualityScore,
screenedPassed: qualityScore >= 35 && activityRatio >= 0.25,
metrics: {
meanSpeed: Number(meanSpeed.toFixed(2)),
meanJerk: Number(meanJerk.toFixed(2)),
activityRatio: Number(activityRatio.toFixed(3)),
shannonEntropy: Number(shannonEntropy.toFixed(3)),
uniqueMarkovStates: stateCounts.size,
totalTransitions: typeof predictiveAI !== 'undefined' ? predictiveAI.totalTransitions : 0,
collisionRisk: Number((prediction.collisionRisk || 0).toFixed(3)),
missedBurstRisk: Number((prediction.missedBurstRisk || 0).toFixed(3)),
panicRisk: Number((prediction.panicRisk || 0).toFixed(3)),
neuroPhi: typeof neuroFlow !== 'undefined' ? Number((neuroFlow.currentPhi || 0).toFixed(3)) : null,
directorSkill: typeof window !== 'undefined' && window.game?.director ? window.game.director.skillScore : 50
},
sector: this.windowSamples[n - 1].sec
};
this.windowSamples = [];
if (packet.screenedPassed || reason === 'session_end') {
this.screenedBatches.push(packet);
this._saveStoredBatches();
this._dispatchToBackend(packet);
}
return packet;
}
_dispatchToBackend(packet) {
if (typeof fetch !== 'function') return;
try {
fetch(this.endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(packet),
keepalive: true
}).catch(() => {});
} catch (_) {}
}
getSummary() {
return {
sessionId: this.sessionId,
acceptedSamples: this.acceptedSamples,
rejectedOutliers: this.rejectedOutliers,
archivedBatches: this.screenedBatches.length
};
}
}
const dataScreeningService = new DataScreeningService();
if (typeof window !== 'undefined') {
window.dataScreeningService = dataScreeningService;
}
