/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (Game.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
const SPAWN_CONFIG = [
{ kind: 'energy', max: 6, chance: 0.55, type: 'basic' },
{ kind: 'predictiveVector', max: 3, chance: 0.25, type: 'basic' },
{ kind: 'landmarkNode', max: 4, chance: 0.22, type: 'night' },
{ kind: 'shield', max: 2, chance: 0.12, type: 'flat' },
{ kind: 'burst', max: 1, chance: 0.35, type: 'flow' },
{ kind: 'nebulicApple', max: 4, chance: 0.25, type: 'fruitNight' },
{ kind: 'voidPlum', max: 2, chance: 0.12, type: 'fruit' },
{ kind: 'stellarMango', max: 2, chance: 0.12, type: 'fruitNight' },
{ kind: 'glowingJuice', max: 1, chance: 0.08, type: 'fruit' },
{ kind: 'toxicFruit', max: 1, chance: 0.05, type: 'fruit' }
];
class Game {
constructor() {
this.meta = new MetaSystem();
this.audio = new AudioSystem();
window.metaSystem = this.meta;
const container = document.getElementById('game-canvas');
this.world3D = new World3D(container);
this.input = new InputHandler(this.world3D);
this.ui = new UIController(this.meta);
this.director = new Director();
window.director = this.director;
this.labelSystem = new LabelSystem();
this.weaponEvolution = new WeaponEvolutionSystem(this.world3D.scene, this.world3D, this.audio);
this.monetization = new MonetizationSystem(this.ui, this.meta, this.audio);
this.singularity = new SingularitySequence(this.world3D.scene, this.world3D.camera);
this.state = 'menu'; // menu, tutorial, story, roadmap, onboard, meta, settings, playing, paused, results, singularity
this.runData = null;
this.lastAiTickMs = 0;
this.settings = {
performanceMode: false,
screenShake: true
};
this.clock = new THREE.Clock();
this.lastTime = performance.now();
this.timeScale = 1.0;
this.hitStopTimer = 0;
this.lastFrameTime = 16.67; // For dynamic quality
this.setupMenuNavigation();
this.setupSettingsListeners();
this.ui.updateMenuStats();
this.ui.updateRoadmapUI();
this.loop = this.loop.bind(this);
requestAnimationFrame(this.loop);
}
setupMenuNavigation() {
const hullBtns = document.querySelectorAll('.hull-select-btn');
const updateHullButtonsUI = () => {
const currentHull = this.meta.getSelectedHull();
hullBtns.forEach(btn => {
const isSelected = btn.getAttribute('data-hull') === currentHull;
btn.classList.toggle('hull-selected', isSelected);
});
};
hullBtns.forEach(btn => {
btn.addEventListener('click', () => {
const hullId = btn.getAttribute('data-hull');
if (hullId) {
this.meta.setSelectedHull(hullId);
updateHullButtonsUI();
const hullObj = typeof HullDatabase !== 'undefined' ? HullDatabase[hullId] : null;
this.ui.showToast(`Hull Selected: ${hullObj ? hullObj.name : hullId}`, 1400, '#22d3ee');
this.audio.playCollect('E4');
}
});
});
updateHullButtonsUI();
document.getElementById('btn-play')?.addEventListener('click', () => {
this.audio.init();
if (!this.meta.hasSeenOnboard()) {
this.navigateTo('onboard');
} else {
this.ui.updateRoadmapUI();
this.navigateTo('roadmap');
}
});
document.getElementById('btn-tutorial')?.addEventListener('click', () => this.navigateTo('tutorial'));
document.getElementById('btn-tutorial-back')?.addEventListener('click', () => this.navigateTo('menu'));
document.getElementById('btn-meta')?.addEventListener('click', () => {
this.ui.refreshMetaUI();
this.navigateTo('meta');
});
document.getElementById('btn-meta-back')?.addEventListener('click', () => this.navigateTo('menu'));
document.getElementById('btn-meta-close')?.addEventListener('click', () => this.navigateTo('menu'));
document.getElementById('btn-settings')?.addEventListener('click', () => this.navigateTo('settings'));
document.getElementById('btn-settings-back')?.addEventListener('click', () => this.navigateTo('menu'));
document.getElementById('btn-onboard-start')?.addEventListener('click', () => {
this.meta.markOnboardSeen();
this.ui.updateRoadmapUI();
this.navigateTo('roadmap');
});
document.getElementById('btn-onboard-back')?.addEventListener('click', () => this.navigateTo('menu'));
document.getElementById('btn-roadmap-start')?.addEventListener('click', () => {
if (!this.meta.hasSeenStory()) {
this.ui.resetStory();
this.navigateTo('story');
} else {
this.startRun();
}
});
document.getElementById('btn-roadmap-back')?.addEventListener('click', () => this.navigateTo('menu'));
document.getElementById('btn-story-next')?.addEventListener('click', () => {
if (!this.ui.nextStorySlide()) {
this.meta.markStorySeen();
this.startRun();
}
});
document.getElementById('btn-story-skip')?.addEventListener('click', () => {
this.meta.markStorySeen();
this.navigateTo('menu');
});
document.getElementById('btn-emergency-revive')?.addEventListener('click', () => {
if (this.monetization?.canRevive() && this.runData) {
this.ui.hideOverlay('results');
this.state = 'playing';
this.monetization.triggerRevive(this);
} else {
this.ui.showToast('Emergency Warp already used this run', 1500, '#fb923c');
}
});
document.getElementById('btn-double-crystals')?.addEventListener('click', () => {
this.monetization?.doubleRunCrystals(this.runData);
const btn = document.getElementById('btn-double-crystals');
if (btn) {
btn.disabled = true;
btn.style.opacity = '0.5';
}
});
document.getElementById('btn-restart')?.addEventListener('click', () => {
this.ui.hideOverlay('results');
this.startRun();
});
document.getElementById('btn-menu')?.addEventListener('click', () => {
this.ui.hideOverlay('results');
this.endRun();
this.navigateTo('menu');
});
document.getElementById('btn-resume')?.addEventListener('click', () => this.togglePause());
document.getElementById('btn-quit')?.addEventListener('click', () => {
this.ui.hideOverlay('pause');
this.endRun();
this.navigateTo('menu');
});
window.addEventListener('keydown', (e) => {
if (e.key === 'Enter') {
if (this.state === 'menu') {
this.audio.init();
this.ui.updateRoadmapUI();
this.navigateTo('roadmap');
} else if (this.state === 'results') {
this.ui.hideOverlay('results');
this.startRun();
}
} else if (e.key === 'Escape') {
if (['meta', 'settings', 'tutorial', 'roadmap'].includes(this.state)) {
this.navigateTo('menu');
} else if (this.state === 'playing' || this.state === 'paused') {
this.togglePause();
}
} else if ((e.key === 'Shift' || e.key === 'e' || e.key === 'E') && this.state === 'playing') {
this.triggerPhaseDash();
}
});
this.input.setupHUDButtons({
onDecoy: () => this.triggerDecoy(),
onFreeze: () => this.triggerFreeze(),
onAura: () => this.triggerAura(),
onWeapon: () => this.toggleAutoFire(),
onPause: () => this.togglePause()
});
}
setupSettingsListeners() {
this.ui.setupSettingsListeners({
onMusicChange: (on) => this.audio.setMusicOn(on),
onSfxChange: (on) => this.audio.setSfxOn(on),
onHapticsChange: (on) => this.audio.setHapticsOn(on),
onPerformanceChange: (on) => {
this.settings.performanceMode = on;
this.ui.showToast(on ? 'Performance mode: lower FX' : 'Performance mode disabled', 1400, '#9ca3af');
},
onShakeChange: (on) => {
this.settings.screenShake = on;
}
});
}
navigateTo(state) {
this.ui.hideAllOverlays();
this.state = state;
if (state === 'menu') {
this.ui.updateMenuStats();
}
this.ui.showOverlay(state);
}
startRun() {
this.audio.init();
this.ui.hideAllOverlays();
this.ui.showHUD();
const dblBtn = document.getElementById('btn-double-crystals');
if (dblBtn) {
dblBtn.disabled = false;
dblBtn.style.opacity = '1';
}
if (this.player) this.player.dispose();
if (this.bullets) this.bullets.dispose();
if (this.collectibles) this.collectibles.dispose();
if (this.nodes) this.nodes.dispose();
if (this.enemies) this.enemies.forEach(e => e.dispose());
const flowMax = this.meta.computeFlowMax();
this.runData = {
sector: 1,
flow: Math.min(flowMax, 65),
flowMax: flowMax,
crystals: 0,
time: 0,
freezeUntil: 0,
lastFreeze: -999,
lastAura: -999,
dayPhase: 0,
habitatXP: 0,
habitatTier: 0,
glowRegenUntil: 0,
isBossSector: false,
highestSector: 1,
weaponMode: 'basic',
stats: {
jerkHistory: [],
lastVelX: 0,
lastVelY: 0,
fruitsCollected: 0,
plumsCollected: 0,
landmarksCollected: 0,
tookDamage: false,
wraithKilled: false,
bossKilled: false
}
};
this.weaponEvolution?.reset();
this.monetization?.resetRun();
this.director?.reset();
if (typeof telemetryService !== 'undefined') telemetryService.reset();
if (typeof enemyDNA !== 'undefined') enemyDNA.reset();
if (typeof neuroFlow !== 'undefined') neuroFlow.reset();
if (typeof cogOverload !== 'undefined') cogOverload.reset();
this.lastAiTickMs = performance.now();
window.invokePredictionEvaluatorSafely?.('game.session-start', () => {
this.predictionEvaluator?.beginSession();
});
const selectedHull = this.meta.getSelectedHull();
this.player = new Player(this.world3D.scene, this.world3D, selectedHull);
if (this.meta.hasUpgrade('orbitalDrone')) {
this.player.enableOrbitalDrone();
}
this.bullets = new BulletPool(this.world3D.scene);
this.collectibles = new CollectibleManager(this.world3D.scene);
this.nodes = new NodeManager(this.world3D.scene);
this.enemies = [];
if (this.meta.hasUpgrade('shieldStart')) {
const duration = this.meta.computeShieldDuration(1);
this.player.activateShield(0, duration);
}
difficultySystem.setSector(this.runData.sector);
this.spawnInitialEntities();
this.spawnTimer = 0;
this.state = 'playing';
this.input.showMobileControls();
this.setupGestureCallbacks();
const hullName = this.player.hull?.name || 'Photon Scout';
this.ui.showToast(`Sector online · ${hullName}`, 1200, '#22d3ee');
this.ui.showToast('Purify the Gate & harvest fruits to keep Flow alive', 1600, '#22c55e');
}
setupGestureCallbacks() {
this.input.onTapKill = (worldX, worldY, enemy) => {
if (!this.runData || this.state !== 'playing') return;
const idx = this.enemies.indexOf(enemy);
const dead = enemy.takeDamage(999, this.runData.time);
if (dead && idx !== -1) {
this.handleEnemyDeath(enemy, idx, this.runData.time);
}
this.world3D.spawnImpactGlow(worldX, worldY, 0xa855f7, 12); // Purple explosion
if (this.audio.ready && this.audio.sounds.collect) {
this.audio.sounds.collect.triggerAttackRelease('G5', '16n');
setTimeout(() => this.audio.sounds.collect?.triggerAttackRelease('C6', '16n'), 50);
}
this.audio.haptic('medium');
if (this.settings.screenShake) {
this.world3D.shake(0.4);
}
};
this.input.onAbilityPulse = (type) => {
if (!this.player || !this.runData) return;
this.player.triggerAbilityPulse(type, this.runData.time);
this.audio.haptic('light');
};
}
endRun() {
window.invokePredictionEvaluatorSafely?.('game.session-end', () => {
this.predictionEvaluator?.endSession('RUN_ENDED');
if (typeof dataScreeningService !== 'undefined') dataScreeningService.flushScreenedWindow('session_end');
});
this.input.hideMobileControls();
if (this.player) {
this.player.dispose();
this.player = null;
}
if (this.bullets) {
this.bullets.dispose();
this.bullets = null;
}
if (this.collectibles) {
this.collectibles.dispose();
this.collectibles = null;
}
if (this.nodes) {
this.nodes.dispose();
this.nodes = null;
}
if (this.enemies) {
this.enemies.forEach(e => e.dispose());
this.enemies = [];
}
this.ui.hideHUD();
this.runData = null;
}
spawnInitialEntities() {
const bounds = this.world3D.getVisibleBounds();
let nx = bounds.left + bounds.width * (0.45 + Math.random() * 0.3);
let ny = bounds.bottom + bounds.height * (0.55 + Math.random() * 0.2);
if (this.runData.sector === 20) {
nx = 0;
ny = 0;
}
this.nodes.spawn(nx, ny, this.runData.sector);
for (let i = 0; i < 4; i++) {
const x = bounds.left + 80 + Math.random() * (bounds.width - 160);
const y = bounds.bottom + 80 + Math.random() * (bounds.height - 160);
this.collectibles.spawn('energy', x, y, this.runData.sector);
}
this.collectibles.spawn('predictiveVector',
bounds.left + 80 + Math.random() * (bounds.width - 160),
bounds.bottom + 80 + Math.random() * (bounds.height - 160),
this.runData.sector
);
this.runData.isBossSector = (this.runData.sector % 3 === 0);
if (this.runData.isBossSector) {
const ex = bounds.left + 60 + Math.random() * (bounds.width - 120);
const ey = bounds.top - bounds.height * 0.3;
this.spawnEnemy(ex, ey, 'boss');
}
const initTypes = ['goblin', 'normal', 'goblin'];
for (let i = 0; i < initTypes.length; i++) {
const angle = (i / initTypes.length) * Math.PI * 2 + 0.5;
const ex = Math.cos(angle) * (bounds.width * 0.36);
const ey = Math.sin(angle) * (bounds.height * 0.36);
this.spawnEnemy(ex, ey, initTypes[i]);
}
this.runData.weaponMode = this.meta.getWeaponMode(this.runData.sector);
}
spawnEnemy(x, y, type) {
const enemy = new Enemy(this.world3D.scene, x, y, this.runData.sector, type);
this.enemies.push(enemy);
return enemy;
}
togglePause() {
if (!this.runData) return;
if (this.state === 'playing') {
this.state = 'paused';
this.ui.showOverlay('pause');
this.ui.showToast('Paused', 800, '#9ca3af');
} else if (this.state === 'paused') {
this.state = 'playing';
this.ui.hideOverlay('pause');
this.ui.showToast('Resumed', 800, '#22d3ee');
this.lastTime = performance.now();
}
}
toggleAutoFire() {
if (this.player) {
this.player.autoFire = !this.player.autoFire;
this.ui.showToast(this.player.autoFire ? 'Auto-fire enabled' : 'Auto-fire disabled', 900, '#e5e7eb');
}
}
triggerPhaseDash() {
if (this.state !== 'playing' || !this.player || !this.runData) return;
const target = this.input.getTargetPosition();
if (this.player.triggerTeleport(target.x, target.y, this.runData.time)) {
this.audio.playWhoosh();
this.audio.haptic('medium');
const isTachyon = this.player.hull?.stats?.special === 'teleport';
this.ui.showToast(isTachyon ? '⚡ TACHYON PHASE JUMP' : '⚡ PHASE DASH', 1100, '#c084fc');
} else {
this.ui.showToast('Phase drive recharging...', 800, '#64748b');
}
}
triggerDecoy() {
if (this.state !== 'playing' || !this.player || !this.runData) return;
if (this.player.canDecoy(this.runData.time)) {
this.player.useDecoy(this.runData.time);
this.audio.playDecoy();
this.audio.haptic('medium');
this.ui.showToast('Decoy wave emitted', 1500, '#22d3ee');
} else {
this.ui.showToast('Decoy recharging...', 1000, '#64748b');
}
}
triggerFreeze() {
if (this.state !== 'playing' || !this.runData) return;
const cd = this.getFreezeCooldown();
if (this.runData.time - this.runData.lastFreeze < cd) {
this.ui.showToast('Freeze recharging...', 1000, '#64748b');
return;
}
this.runData.lastFreeze = this.runData.time;
this.runData.freezeUntil = this.runData.time + this.getFreezeDuration();
this.world3D.triggerFreeze(this.getFreezeDuration());
this.audio.playFreeze();
this.audio.haptic('heavy');
if (this.settings.screenShake) {
this.world3D.shake(0.8);
}
this.ui.showToast('⚡ TIME-LOCK ENGAGED', 1800, '#88ddff');
}
triggerAura() {
if (this.state !== 'playing' || !this.runData) return;
const cd = this.getAuraCooldown();
if (this.runData.time - this.runData.lastAura < cd) {
this.ui.showToast('Aura recharging...', 1000, '#64748b');
return;
}
this.runData.lastAura = this.runData.time;
if (this.enemies.length === 0) {
this.ui.showToast('Field already clear', 1000, '#64748b');
return;
}
let gain = this.enemies.length * 80;
if (this.meta.hasUpgrade('auraPlus')) gain = Math.floor(gain * 1.4);
for (let i = this.enemies.length - 1; i >= 0; i--) {
const e = this.enemies[i];
if (e.type !== 'boss') {
if (typeof enemyDNA !== 'undefined') enemyDNA.recordDeath(e);
e.dispose();
this.enemies.splice(i, 1);
this.runData.flow = Math.min(this.runData.flowMax, this.runData.flow + 1.3);
}
}
this.runData.crystals += gain;
this.audio.playLevelUp();
this.audio.haptic('heavy');
this.ui.showToast(`Aura surge +${gain} 💎`, 1800, '#22d3ee');
}
getFreezeDuration() {
return 2.5 + Math.min(3.5, this.runData.sector * 0.15);
}
getFreezeCooldown() {
return Math.max(8, 16 - this.runData.sector * 0.2);
}
getAuraCooldown() {
return Math.max(14, 26 - this.runData.sector * 0.25);
}
hitStop(duration) {
this.timeScale = 0.15;
this.hitStopTimer = duration;
}
loop(now) {
const clockDelta = this.clock.getDelta();
let dt = Math.min(clockDelta, 1 / 30); // Cap at ~33ms to prevent spiral of death
const MAX_STEP = 0.033; // 33ms max per step
const steps = dt > 0.1 ? Math.ceil(dt / MAX_STEP) : 1;
dt = dt / steps; // Divide into sub-steps
const frameTime = now - this.lastTime;
this.lastTime = now;
this.lastFrameTime = frameTime;
this.world3D.adaptQuality(frameTime);
if (this.hitStopTimer > 0) {
this.hitStopTimer -= dt * steps; // Use original delta for timer
if (this.hitStopTimer <= 0) this.timeScale = 1.0;
}
dt *= this.timeScale;
const time = now / 1000;
if (this.state === 'playing' && this.runData) {
this.updateGame(dt, time);
this.director.update(time, this.runData.sector);
} else if (this.state === 'singularity') {
this.updateSingularity(dt);
return; // Skip normal rendering
}
this.world3D.update(time, dt);
this.world3D.render();
requestAnimationFrame(this.loop);
}
updateGame(dt, time) {
const data = this.runData;
const bounds = this.world3D.getVisibleBounds();
const dailyMod = this.meta.getDailyMod();
data.time += dt;
const DAY = 90;
const phaseRaw = (data.time / DAY) % 1;
let phase = phaseRaw * (dailyMod.nightBias || 1.0);
phase = phase % 1;
let nightFactor = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
if (dailyMod.id === 'nightForever') nightFactor = Math.max(0.6, nightFactor);
data.dayPhase = nightFactor;
this.world3D.updateTheme(data.sector, nightFactor);
this.input.updateJoystickTarget(this.player.x, this.player.y, bounds, dt);
this.input.updateAutoPulse(dt, this.player.x, this.player.y, this.enemies);
this.input.setEnemyPool(this.enemies);
this.input.checkMobileAbilities();
const target = this.input.getTargetPosition();
const isFiring = this.input.isFiring() || this.player.autoFire;
this.player.update(dt, data.time, target.x, target.y, dailyMod.jerkFactor || 1.0);
if (this.world3D && typeof this.world3D.getPlanetaryGravityPull === 'function') {
const gPull = this.world3D.getPlanetaryGravityPull(
this.player.x,
this.player.y,
data.sector,
this.nodes ? this.nodes.getActiveNodes() : []
);
this.player.vx += gPull.x * dt;
this.player.vy += gPull.y * dt;
this.player.x += gPull.x * dt * 0.35;
this.player.y += gPull.y * dt * 0.35;
}
this.trackJerk(dt);
let nearbyEnemies = 0;
for (let i = 0; i < this.enemies.length; i++) {
const e = this.enemies[i];
if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 160) {
nearbyEnemies++;
}
}
if (typeof telemetryService !== 'undefined') {
telemetryService.recordPosition(
this.player.x,
this.player.y,
data.time,
data.flow,
data.flowMax,
nearbyEnemies
);
telemetryService.update(data.time);
if (typeof dataScreeningService !== 'undefined') {
const lastJerk = this.runData.stats.jerkHistory.length > 0
? this.runData.stats.jerkHistory[this.runData.stats.jerkHistory.length - 1]
: 0;
dataScreeningService.ingestFrame({
x: this.player.x,
y: this.player.y,
vx: this.player.vx,
vy: this.player.vy,
jerk: lastJerk,
flow: data.flow,
sector: data.sector,
nearbyEnemies,
dt,
time: data.time
});
}
if (this.predictionEvaluator && typeof predictiveAI !== 'undefined') {
const encodedState = predictiveAI.lastState;
window.invokePredictionEvaluatorSafely?.('game.position-observation', () => {
this.predictionEvaluator.observePosition(encodedState);
});
}
}
const nowMs = performance.now();
if (nowMs - this.lastAiTickMs >= 50) {
this.lastAiTickMs = nowMs;
if (typeof neuroFlow !== 'undefined') {
if (nowMs - neuroFlow.lastObservationTs > 1500) {
const flowRatio = data.flow / Math.max(1, data.flowMax);
const comboBoost = Math.min(0.25, (this.player.combo - 1) * 0.05);
const pressure = Math.min(0.35, nearbyEnemies * 0.08);
const pred = typeof predictiveAI !== 'undefined' ? predictiveAI.predict() : { panicRisk: 0 };
const phiSim = Math.max(0.15, Math.min(0.95,
0.38 + 0.30 * flowRatio + comboBoost + pressure - 0.20 * (pred.panicRisk || 0)
));
neuroFlow.onTribeObservation(phiSim);
}
neuroFlow.update(nowMs, data.sector);
}
if (typeof kernelMapper !== 'undefined' && typeof telemetryService !== 'undefined') {
const latestJerk = telemetryService.jerkHistory.length > 0
? telemetryService.jerkHistory[telemetryService.jerkHistory.length - 1].j
: 0;
kernelMapper.classify(this.player.x, this.player.y, latestJerk);
}
if (typeof cogOverload !== 'undefined') {
cogOverload.update(nowMs, {
player: this.player,
enemyPool: typeof enemyDNA !== 'undefined' ? enemyDNA : null,
audioSystem: this.audio,
difficultySystem: typeof difficultySystem !== 'undefined' ? difficultySystem : null,
spawnBudget: typeof spawnBudget !== 'undefined' ? spawnBudget : null,
world3D: this.world3D,
activeBullets: this.bullets.playerBullets.length + this.bullets.enemyBullets.length,
sector: data.sector
});
}
}
this.updateFlow(dt, dailyMod);
const frozen = data.time < data.freezeUntil;
this.collectibles.update(dt, data.time, bounds, { x: this.player.x, y: this.player.y });
this.nodes.update(dt, data.time, this.player, this.enemies);
this.bullets.update(dt, bounds, data.time);
this.player.updateOrbitalDrone(dt, data.time, this.enemies, (enemy, idx) => {
this.handleEnemyDeath(enemy, idx, data.time);
});
if (this.weaponEvolution) {
const newlyUnlocked = this.weaponEvolution.checkUnlockConditions(
data.sector,
data.flow,
this.player.combo,
data.stats.landmarksCollected || 0
);
for (const evo of newlyUnlocked) {
this.ui.showToast(`🔥 FUSION UNLOCKED: ${evo.name}!`, 2500, '#facc15');
}
this.weaponEvolution.update(
dt, data.time,
this.player.x, this.player.y,
this.enemies, this.bullets,
(enemy, idx) => this.handleEnemyDeath(enemy, idx, data.time)
);
}
spawnBudget.updateStars(data.time);
const projectFn = (x, y, z) => this.world3D.worldToScreen(x, y, z);
this.labelSystem.update(
this.collectibles.collectibles,
{ x: this.player.x, y: this.player.y },
projectFn
);
const playerPos = this.player.getPosition();
const decoyPos = this.player.getDecoyPosition();
const dirSpeedMult = this.director?.enemySpeedMult || 1.0;
for (let i = this.enemies.length - 1; i >= 0; i--) {
const e = this.enemies[i];
const result = e.update(dt, playerPos, decoyPos, frozen, data.time, data, this.enemies, dirSpeedMult);
if (result && result.x !== undefined && !result.spawnMinion) {
this.bullets.spawnEnemyBullet(result.x, result.y, result.vx, result.vy);
}
if (result && result.spawnMinion) {
this.spawnEnemy(result.x, result.y, result.minionType || 'goblin');
this.audio.playSpawn('G2');
}
}
if (this.input.shouldAutoPulse()) {
const aimDir = this.input.getAutoPulseDirection(this.player.x, this.player.y);
if (aimDir) {
const damage = this.meta.computeBulletDamage(data.sector, data.weaponMode);
this.bullets.spawnPlayerBullet(
this.player.x, this.player.y,
aimDir.x, aimDir.y,
damage, data.weaponMode,
data.time
);
this.director.recordShot();
this.audio.playShoot();
}
}
if (isFiring && data.time >= this.player.nextShotTime) {
const dx = target.x - this.player.x;
const dy = target.y - this.player.y;
const dist = Math.hypot(dx, dy) || 1;
const damage = this.meta.computeBulletDamage(data.sector, data.weaponMode);
this.bullets.spawnPlayerBullet(
this.player.x, this.player.y,
dx / dist, dy / dist,
damage, data.weaponMode,
data.time
);
this.director.recordShot();
this.player.nextShotTime = data.time + this.player.getFireInterval();
this.audio.playShoot();
}
this.spawnEntities(dt, nightFactor, dailyMod);
this.handleCollisions(data.time);
this.updateHabitat(dt, nightFactor);
const planetName = this.meta.getPlanetName(data.sector);
const activeNodes = this.nodes.getActiveNodes();
const gateHpRatio = activeNodes.length > 0 ? activeNodes[0].getHpRatio() : 0;
this.ui.updateHUD({
flow: data.flow,
flowMax: data.flowMax,
crystals: data.crystals,
sector: data.sector,
planetName: planetName,
nodesRemaining: activeNodes.length,
gateHpRatio: gateHpRatio,
isBoss: data.isBossSector,
isNight: nightFactor > 0.6,
habitatTier: data.habitatTier,
combo: this.player.combo,
activeEvolution: this.weaponEvolution?.getActiveEvolutionName(),
flowBand: typeof neuroFlow !== 'undefined' ? neuroFlow.flowBand : 'FLOW',
phi: typeof neuroFlow !== 'undefined' ? `φ=${neuroFlow.currentPhi.toFixed(2)}` : ''
});
const decoyCd = Math.max(0.001, this.player.decoyCooldown);
const freezeCd = Math.max(0.001, this.getFreezeCooldown());
const auraCd = Math.max(0.001, this.getAuraCooldown());
this.ui.updateCooldowns({
decoyProgress: Math.min(1, (data.time - this.player.decoyLast) / decoyCd),
freezeProgress: Math.min(1, (data.time - data.lastFreeze) / freezeCd),
auraProgress: Math.min(1, (data.time - data.lastAura) / auraCd)
});
this.audio.pulseMusic(data.time, data.dayPhase, data.isBossSector, this.player.combo);
this.audio.playSpaceDrone(data.time);
this.audio.setFlowState(data.flow < 15);
if (data.flow <= 0) {
this.showResults('loss');
} else if (activeNodes.length === 0) {
this.nextSector();
}
}
trackJerk(dt) {
if (!this.runData || !this.player) return;
const vx = this.player.vx;
const vy = this.player.vy;
const lvx = this.runData.stats.lastVelX;
const lvy = this.runData.stats.lastVelY;
const ax = vx - lvx;
const ay = vy - lvy;
const norm = (1 / 60) / (dt || 0.0001);
const j = Math.hypot(ax, ay) * norm;
this.runData.stats.jerkHistory.push(j);
if (this.runData.stats.jerkHistory.length > 180) {
this.runData.stats.jerkHistory.shift();
}
this.director?.recordMovement(j);
this.runData.stats.lastVelX = vx;
this.runData.stats.lastVelY = vy;
}
updateFlow(dt, dailyMod) {
const data = this.runData;
const diffBase = 0.4 + data.sector * 0.03;
let drain = diffBase * dt;
const jHist = data.stats.jerkHistory;
if (jHist.length > 0) {
const mean = jHist.reduce((a, b) => a + b, 0) / jHist.length;
const varc = jHist.reduce((a, v) => a + (v - mean) ** 2, 0) / jHist.length;
const sigma = Math.sqrt(Math.max(0, varc));
if (sigma > 60 * (dailyMod.jerkFactor || 1.0)) drain *= 1.1;
}
let regen = 0;
if (data.glowRegenUntil && data.time < data.glowRegenUntil) {
regen = 1.2 * dt;
}
if (this.meta.hasUpgrade('flowRegen')) {
regen += 0.1 * data.sector * dt;
}
if (data.habitatTier >= 1) regen += 0.4 * dt;
if (data.habitatTier >= 2) drain *= 0.9;
drain *= (dailyMod.flowDrainFactor || 1.0);
data.flow = Math.max(0, Math.min(data.flowMax, data.flow - drain + regen));
}
updateHabitat(dt, nightFactor) {
const data = this.runData;
const base = nightFactor < 0.6 ? 1.0 : 0.35;
const flowBonus = data.flow / Math.max(1, data.flowMax);
const crystalBonus = Math.log10(Math.max(1, 10 + data.crystals)) / 3;
data.habitatXP += dt * base * (0.4 + flowBonus + crystalBonus * 0.5);
const thresholds = [0, 120, 360, 840, 1800];
let tier = 0;
for (let i = 0; i < thresholds.length; i++) {
if (data.habitatXP >= thresholds[i]) tier = i;
}
if (tier !== data.habitatTier) {
data.habitatTier = tier;
const names = ['Seedling', 'Outpost', 'Colony', 'Sanctuary', 'Myth'];
this.ui.showToast(`Lyra's habitat evolved: ${names[tier]}`, 1800, '#22c55e');
}
}
spawnEntities(dt, nightFactor, dailyMod) {
const data = this.runData;
const bounds = this.world3D.getVisibleBounds();
this.spawnTimer += dt;
let modEnemy = (dailyMod.enemyFactor || 1.0) * (this.director?.spawnDensityMult || 1.0);
if (typeof neuroFlow !== 'undefined') modEnemy *= (neuroFlow.spawnAdjust || 1.0);
if (this.meta.hasUpgrade('toxicMastery')) modEnemy *= 1.25;
let baseInterval = (nightFactor > 0.6 ? 0.5 : 0.7) / Math.max(0.4, modEnemy);
if (this.settings.performanceMode) baseInterval *= 1.15;
if (this.spawnTimer < baseInterval) return;
this.spawnTimer -= baseInterval;
const counts = this.collectibles.getCounts();
let fruitBoost = dailyMod.fruitFactor || 1.0;
if (this.meta.hasUpgrade('fruitPlus')) fruitBoost *= 1.45;
for (const cfg of SPAWN_CONFIG) {
const current = counts[cfg.kind] || 0;
if (current >= cfg.max) continue;
let chance = cfg.chance;
if (cfg.type === 'fruit' || cfg.type === 'fruitNight') chance *= fruitBoost;
if (cfg.type === 'night') chance += 0.08 * nightFactor;
if (cfg.type === 'fruitNight' && nightFactor > 0.7) continue;
if (cfg.type === 'flow' && data.flow >= 35) continue;
if (Math.random() < chance) {
const margin = 60;
const x = bounds.left + margin + Math.random() * (bounds.width - margin * 2);
const y = bounds.bottom + margin + Math.random() * (bounds.height - margin * 2);
this.collectibles.spawn(cfg.kind, x, y, data.sector);
}
}
const diffParams = difficultySystem.getParams();
const timeBonusCap = Math.floor(Math.min(6, (data.time || 0) / 45));
let enemyCap = 5 + Math.floor(data.sector * 0.85) + timeBonusCap + Math.floor(nightFactor * 3);
enemyCap = Math.floor(enemyCap * Math.min(2.6, Math.max(1.0, diffParams.spawnRateMult * 0.55)));
if (this.settings.performanceMode) enemyCap = Math.floor(enemyCap * 0.7);
enemyCap = Math.min(enemyCap, 24); // Hard cap for performance
const timeEscalation = 1.0 + Math.min(0.75, (data.time || 0) / 150);
let enemyChance = (0.34 + 0.22 * nightFactor) * modEnemy * timeEscalation;
enemyChance *= Math.min(3.0, Math.max(1.0, diffParams.spawnRateMult * 0.45));
if (this.settings.performanceMode) enemyChance *= 0.85;
if (this.enemies.length < enemyCap && Math.random() < enemyChance) {
const x = bounds.left + 40 + Math.random() * (bounds.width - 80);
const y = bounds.bottom + 40 + Math.random() * (bounds.height - 80);
const type = this.director && typeof this.director.selectEnemyType === 'function'
? this.director.selectEnemyType(data.sector, diffParams.shouldSpawnElite)
: 'goblin';
this.spawnEnemy(x, y, type);
this.audio.playSpawn('C3');
if (Math.random() < 0.3) this.audio.playWhoosh();
}
const hasReaper = this.enemies.some(e => e.type === 'reaper');
if (!hasReaper && data.crystals >= 800) {
const wraithChance = nightFactor > 0.5 ? 0.05 : 0.02;
if (Math.random() < wraithChance) {
const side = Math.floor(Math.random() * 4);
let x, y;
if (side === 0) { x = bounds.left - 40; y = bounds.bottom + Math.random() * bounds.height; }
else if (side === 1) { x = bounds.right + 40; y = bounds.bottom + Math.random() * bounds.height; }
else if (side === 2) { x = bounds.left + Math.random() * bounds.width; y = bounds.top + 40; }
else { x = bounds.left + Math.random() * bounds.width; y = bounds.bottom - 40; }
this.spawnEnemy(x, y, 'reaper');
this.ui.showToast('⚠ Quantum Wraith entering night side', 2500, '#ec4899');
this.audio.playReaper('A1');
this.audio.playAlienApproach();
}
}
}
handleEnemyDeath(e, index, time) {
if (!e || !this.runData) return;
const data = this.runData;
const p = this.player;
const wasReaper = e.type === 'reaper';
const wasBoss = e.type === 'boss';
const deathX = e.x;
const deathY = e.y;
if (typeof enemyDNA !== 'undefined') {
enemyDNA.recordDeath(e);
}
if (this.director && e.spawnTime) {
this.director.recordKill((time - e.spawnTime) * 1000);
}
const actualIdx = (typeof index === 'number' && this.enemies[index] === e)
? index
: this.enemies.indexOf(e);
if (actualIdx !== -1) {
this.enemies.splice(actualIdx, 1);
}
e.dispose();
const glowColor = wasReaper ? 0xec4899 : (wasBoss ? 0xf97316 : 0x22d3ee);
const glowCount = wasBoss ? 20 : (wasReaper ? 15 : 10);
this.world3D.spawnImpactGlow(deathX, deathY, glowColor, glowCount);
this.audio.playImpact();
if (typeof difficultySystem !== 'undefined' && difficultySystem.getParams().fireFragments && !wasBoss) {
for (let k = 0; k < 4; k++) {
const ang = (k / 4) * Math.PI * 2 + Math.random() * 0.4;
this.bullets.spawnEnemyBullet(deathX, deathY, Math.cos(ang) * 150, Math.sin(ang) * 150);
}
}
if (wasReaper) {
data.stats.wraithKilled = true;
if (this.meta.unlockAchievement('wraithKill')) {
this.ui.showToast('Achievement unlocked: Wraith Slayer', 2000, '#22c55e');
}
}
if (wasBoss) {
data.stats.bossKilled = true;
if (this.meta.unlockAchievement('bossClear')) {
this.ui.showToast('Achievement unlocked: Void Colossus Down', 2000, '#22c55e');
}
}
data.flow = Math.min(data.flowMax, data.flow + 4);
let gain = wasReaper ? 400 : (wasBoss ? 600 : 120);
if (data.habitatTier >= 3) gain = Math.floor(gain * 1.2);
data.crystals += gain;
const screenPos = this.world3D.worldToScreen(deathX, deathY, 0);
if (screenPos && this.labelSystem) {
this.labelSystem.spawnFloatingText(screenPos.x, screenPos.y, `+${gain}💎`, '#22d3ee');
}
if (p) p.addCombo(time);
this.audio.playCollect('C4');
this.audio.haptic('light');
if (wasReaper || wasBoss) this.hitStop(0.25);
if (Math.random() < 0.22) {
this.collectibles.spawn('toxicFruit', deathX, deathY, data.sector);
}
}
handleCollisions(time) {
const data = this.runData;
const p = this.player;
const armorMult = p.getArmorMultiplier();
for (let i = this.collectibles.collectibles.length - 1; i >= 0; i--) {
const c = this.collectibles.collectibles[i];
const d = Math.hypot(p.x - c.x, p.y - c.y);
if (d < p.radius + 12) {
this.handleCollectiblePickup(c, time);
this.collectibles.remove(c);
}
}
for (let i = this.bullets.enemyBullets.length - 1; i >= 0; i--) {
const b = this.bullets.enemyBullets[i];
const d = Math.hypot(p.x - b.x, p.y - b.y);
if (d < p.radius + b.r) {
if (!p.shieldActive) {
const flowDmg = 7 / armorMult;
data.flow = Math.max(0, data.flow - flowDmg);
data.crystals = Math.max(0, data.crystals - 50);
p.combo = 1;
data.stats.tookDamage = true;
this.director?.recordDamage(time);
if (typeof predictiveAI !== 'undefined') predictiveAI.recordEvent('damage');
this.audio.playError('A2');
this.ui.showToast('Shot by void shard', 1400, '#f97316');
this.audio.haptic('heavy');
} else {
this.ui.showToast('Shield blocked shard', 900, '#60a5fa');
}
this.bullets.removeEnemyBullet(b);
}
}
for (const b of [...this.bullets.playerBullets]) {
for (const n of this.nodes.nodes) {
const dn = Math.hypot(b.x - n.x, b.y - n.y);
if (dn < n.shieldR + b.r) {
b.hasHit = true;
this.director.recordHit();
if (typeof telemetryService !== 'undefined') {
telemetryService.recordShot(true, data.time);
}
const isCoreHit = dn < n.coreR + b.r + 8;
const dmg = isCoreHit ? b.damage * 1.5 : b.damage;
const destroyed = n.takeDamage(dmg);
data.crystals += isCoreHit ? 10 : 6;
data.flow = Math.min(data.flowMax, data.flow + (isCoreHit ? 0.5 : 0.3));
this.world3D.spawnImpactGlow(b.x, b.y, isCoreHit ? 0xfacc15 : 0xf87171, 6);
if (destroyed) {
this.nodes.remove(n);
data.flow = Math.min(data.flowMax, data.flow + 28);
let gain = 400 + data.sector * 40;
if (data.habitatTier >= 3) gain = Math.floor(gain * 1.2);
data.crystals += gain;
this.world3D.spawnImpactGlow(n.x, n.y, 0x22c55e, 24);
this.ui.showToast(`Gate Purified! +${gain} 💎`, 1800, '#22c55e');
this.audio.playLevelUp();
this.audio.haptic('heavy');
this.hitStop(0.2);
if (this.meta.unlockAchievement('firstGate')) {
this.ui.showToast('Achievement unlocked: First Gate', 2000, '#22c55e');
}
}
this.bullets.removePlayerBullet(b);
break;
}
}
}
for (const b of [...this.bullets.playerBullets]) {
for (let i = this.enemies.length - 1; i >= 0; i--) {
const e = this.enemies[i];
const de = Math.hypot(b.x - e.x, b.y - e.y);
if (de < e.r + b.r) {
b.hasHit = true;
this.director.recordHit();
if (typeof telemetryService !== 'undefined') {
telemetryService.recordShot(true, data.time);
}
const dead = e.takeDamage(b.damage);
if (dead) {
this.handleEnemyDeath(e, i, time);
}
this.bullets.removePlayerBullet(b);
break;
}
}
}
for (let i = this.enemies.length - 1; i >= 0; i--) {
const e = this.enemies[i];
const d = Math.hypot(p.x - e.x, p.y - e.y);
if (d < p.radius + e.r) {
const isReaper = e.type === 'reaper';
const isBoss = e.type === 'boss';
if (!p.shieldActive) {
const stolen = isReaper ? Math.max(200, Math.floor(data.crystals * 0.5))
: (isBoss ? 250 : 60);
data.crystals = Math.max(0, data.crystals - stolen);
const flowLoss = (isBoss ? 14 : 9) / armorMult;
data.flow = Math.max(0, data.flow - flowLoss);
p.combo = 1;
p.applyKnockback(e.x, e.y);
data.stats.tookDamage = true;
this.director?.recordDamage(time);
if (typeof predictiveAI !== 'undefined') predictiveAI.recordEvent('damage');
if (isReaper) {
this.audio.playReaper('G1');
this.ui.showToast(`Wraith drained ${stolen} 💎`, 2000, '#ec4899');
} else {
this.audio.playError('A2');
this.ui.showToast('Creature hit', 1400, '#f97316');
}
this.audio.haptic('heavy');
if (this.settings.screenShake) {
this.world3D.shake(0.5);
}
} else {
this.ui.showToast('Shield blocked hit', 900, '#60a5fa');
}
if (!isBoss) {
if (typeof enemyDNA !== 'undefined') enemyDNA.recordDeath(e);
e.dispose();
this.enemies.splice(i, 1);
}
}
}
}
handleCollectiblePickup(c, time) {
const data = this.runData;
const p = this.player;
const screenPos = this.world3D.worldToScreen(c.x, c.y, 0);
if (screenPos && this.labelSystem) {
const valText = this.labelSystem.getCollectibleValue(c);
const iconInfo = this.labelSystem.iconMap[c.kind];
this.labelSystem.spawnFloatingText(screenPos.x, screenPos.y, valText, iconInfo?.color || '#22d3ee');
}
const fruits = ['voidPlum', 'stellarMango', 'nebulicApple', 'glowingJuice', 'toxicFruit'];
if (fruits.includes(c.kind)) {
data.stats.fruitsCollected++;
if (data.stats.fruitsCollected >= 30) {
if (this.meta.unlockAchievement('fruitHoard')) {
this.ui.showToast('Achievement unlocked: Fruit Hoarder', 2000, '#22c55e');
}
}
}
switch (c.kind) {
case 'energy':
data.flow = Math.min(data.flowMax, data.flow + 0.7);
data.crystals += 40 * p.combo;
p.addCombo(time);
this.audio.playCollect('C4');
this.ui.showToast('+Energy', 1000, '#22d3ee');
this.audio.haptic('light');
break;
case 'predictiveVector':
data.flow = Math.min(data.flowMax, data.flow + 3);
data.crystals += 120 * p.combo;
p.addCombo(time);
this.audio.playCollect('E4');
this.ui.showToast('⚛️ Harmonic Torus · Synth Resonance +3', 1200, '#00ffcc');
this.audio.haptic('light');
if (typeof predictiveAI !== 'undefined') {
predictiveAI.feedPositiveVector();
}
break;
case 'landmarkNode':
data.flow = Math.min(data.flowMax, data.flow + 5);
data.crystals += 80 * p.combo;
data.stats.landmarksCollected = (data.stats.landmarksCollected || 0) + 1;
p.addCombo(time);
this.audio.playCollect('C5');
this.ui.showToast('💠 Harmonic Prism · Geometry Stabilized', 1200, '#00ffff');
this.audio.haptic('light');
if (typeof nystromKernel !== 'undefined') {
nystromKernel.stabilizeRank();
}
break;
case 'burst':
data.flow = Math.min(data.flowMax, data.flow + 14);
data.crystals += 230 * p.combo;
p.addCombo(time);
this.audio.playCollect('G4');
this.ui.showToast('Flow Burst', 1500, '#ec4899');
this.audio.haptic('medium');
break;
case 'shield':
const duration = this.meta.computeShieldDuration(data.sector);
p.activateShield(time, duration);
data.crystals += 100;
this.audio.playCollect('B4');
this.ui.showToast('Shield activated', 1500, '#60a5fa');
this.audio.haptic('medium');
break;
case 'voidPlum':
let gain = 180;
if (this.meta.hasUpgrade('fruitSynergy')) {
gain += (data.stats.plumsCollected || 0) * 40;
data.stats.plumsCollected++;
}
data.flow = Math.min(data.flowMax, data.flow + 6);
data.crystals += gain * p.combo;
p.addCombo(time);
this.ui.showToast(`Void Plum +${gain}💎`, 1400, '#a855f7');
this.audio.playCollect('D4');
this.audio.haptic('light');
break;
case 'stellarMango':
data.flow = Math.min(data.flowMax, data.flow + 4);
data.crystals += 140 * p.combo;
p.comboUntil = time + 4;
this.ui.showToast('Stellar Mango · Combo extended', 1400, '#facc15');
this.audio.playCollect('E4');
this.audio.haptic('light');
break;
case 'nebulicApple':
data.flow = Math.min(data.flowMax, data.flow + 2.2);
data.crystals += 50;
this.ui.showToast('Nebulic Apple · Small comfort', 1000, '#4ade80');
this.audio.playCollect('C4');
break;
case 'glowingJuice':
data.glowRegenUntil = time + 6;
this.ui.showToast('Glowing Juice · Flow regenerates', 1500, '#22c55e');
this.audio.playCollect('G4');
this.audio.haptic('medium');
break;
case 'toxicFruit':
if (this.meta.hasUpgrade('toxicMastery')) {
data.flow = Math.min(data.flowMax, data.flow + 5);
data.crystals += 50;
this.ui.showToast('Toxic energy absorbed', 1000, '#a855f7');
this.audio.playCollect('A3');
} else if (!p.shieldActive) {
data.flow = Math.max(0, data.flow - 8);
data.crystals = Math.max(0, data.crystals - 90);
p.combo = 1;
data.stats.tookDamage = true;
this.ui.showToast('Toxic fruit · Misread the signal', 1700, '#f97316');
this.audio.playError('F2');
this.audio.haptic('heavy');
} else {
this.ui.showToast('Shield neutralized poison', 1100, '#60a5fa');
}
break;
}
}
nextSector() {
const data = this.runData;
data.sector++;
data.highestSector = Math.max(data.highestSector, data.sector);
this.meta.setMaxSector(data.highestSector);
if (typeof enemyDNA !== 'undefined') {
for (const e of this.enemies) {
if (e.dna) e.dna.survivalTime = performance.now() - e.dna.spawnTime;
}
enemyDNA.evolve();
}
if (data.sector > 20) {
this.triggerSingularity();
return;
}
data.flow = Math.max(data.flow, Math.min(data.flowMax, 65));
this.enemies.forEach(e => e.dispose());
this.enemies = [];
this.bullets.clear();
this.collectibles.clear();
this.nodes.clear();
const newMode = this.meta.getWeaponMode(data.sector);
if (newMode !== data.weaponMode) {
const label = newMode === 'fire' ? 'Fire rounds unlocked'
: newMode === 'electric' ? 'Electric rounds unlocked' : 'Standard rounds';
this.ui.showToast(label, 1400, '#f97316');
}
data.weaponMode = newMode;
const diffParams = difficultySystem.setSector(data.sector);
if (diffParams.sectorMessage) {
setTimeout(() => {
this.ui.showToast(diffParams.sectorMessage, 3000,
data.sector >= 9 ? '#ef4444' : (data.sector >= 6 ? '#f97316' : '#22d3ee'));
}, 1500);
}
const bounds = this.world3D.getVisibleBounds();
let nx = bounds.left + bounds.width * (0.4 + Math.random() * 0.35);
let ny = bounds.bottom + bounds.height * (0.55 + Math.random() * 0.2);
if (data.sector === 20) {
nx = 0;
ny = 0;
}
this.nodes.spawn(nx, ny, data.sector);
data.isBossSector = (data.sector % 3 === 0);
const planetName = this.meta.getPlanetName(data.sector);
if (data.isBossSector) {
const ex = bounds.left + 60 + Math.random() * (bounds.width - 120);
const ey = bounds.top - bounds.height * 0.2;
this.spawnEnemy(ex, ey, 'boss');
this.ui.showToast(`Sector ${data.sector} · ${planetName}`, 2000, '#f97316');
setTimeout(() => this.ui.showToast('⚠ Boss Inbound', 2500, '#ef4444'), 800);
} else {
const tierColor = data.sector >= 9 ? '#ef4444' : (data.sector >= 6 ? '#f97316' : '#22d3ee');
this.ui.showToast(`Sector ${data.sector} · ${planetName} · ${diffParams.difficultyTier}`, 2000, tierColor);
}
this.world3D.updateTheme(data.sector, data.dayPhase || 0);
if (typeof PlanetAtlas !== 'undefined') {
const prof = PlanetAtlas.getProfile(data.sector);
if (prof && prof.fact) {
setTimeout(() => {
this.ui.showToast('🪐 ' + prof.name + ': ' + prof.fact, 3800, '#38bdf8');
}, 450);
}
}
const vanguardCount = Math.min(7, 2 + Math.floor(data.sector * 0.65));
for (let i = 0; i < vanguardCount; i++) {
const ang = (i / vanguardCount) * Math.PI * 2 + Math.random() * 0.4;
const vx = Math.cos(ang) * (bounds.width * 0.38);
const vy = Math.sin(ang) * (bounds.height * 0.38);
const vType = this.director?.selectEnemyType
? this.director.selectEnemyType(data.sector, i === 0)
: 'goblin';
this.spawnEnemy(vx, vy, vType);
}
const phaseAnnouncements = {
2: '🪐 NEW PLANET & PSIONIC UFO ALIENS UNLOCKED!',
3: '🐙 NEW ICE WORLD & VOID KRAKEN CREATURES UNLOCKED!',
4: '🌌 XYLOS SUPER-EARTH & GOBLIN SWARM ESCALATION!',
5: '👁 ELDRITCH SERAPHIM ARCHONS UNLOCKED!',
6: '☀️ DYSON SINGULARITY WORLD UNLOCKED!'
};
if (phaseAnnouncements[data.sector]) {
setTimeout(() => {
this.ui.showToast(phaseAnnouncements[data.sector], 3200, '#c084fc');
}, 900);
}
this.audio.playLevelUp();
this.audio.haptic('medium');
}
showResults(reason) {
window.invokePredictionEvaluatorSafely?.('game.results-end', () => {
this.predictionEvaluator?.endSession(`RESULTS_${reason}`);
});
this.state = 'results';
const data = this.runData;
const crystals = data ? data.crystals : 0;
const bestSector = data ? data.highestSector : this.meta.getMaxSector();
const gatesPurified = data ? Math.max(0, data.sector - 1) : 0;
const oldBest = this.meta.getHighScore();
const newBest = Math.max(oldBest, crystals);
if (crystals > oldBest) {
this.meta.setHighScore(crystals);
this.ui.showToast('New record archive', 2000, '#a855f7');
}
const shardGain = Math.max(1, Math.floor(crystals / 1000) + gatesPurified);
this.meta.addArchiveShards(shardGain);
let style = 'Signal forming · Not enough data';
if (data && data.stats.jerkHistory.length > 0) {
const arr = data.stats.jerkHistory;
const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
if (mean < 60) style = 'Calm pilot · Smooth orbit control';
else if (mean < 120) style = 'Adaptive pilot · Controlled chaos';
else style = 'Chaotic pilot · H-PIM under heavy load';
}
this.ui.showResults({
crystals,
bestCrystals: newBest,
sector: bestSector,
gatesPurified,
shardGain,
style,
win: reason === 'win' || reason === 'singularity'
});
this.ui.showToast(`Archive Shards +${shardGain}`, 2000, '#22c55e');
setTimeout(() => this.ui.showToast('Progress Saved', 1500, '#94a3b8'), 600);
}
triggerSingularity() {
this.state = 'singularity';
this.enemies.forEach(e => e.dispose());
this.enemies = [];
this.bullets.clear();
this.collectibles.clear();
this.nodes.clear();
this.labelSystem.hide();
this.singularity.start(() => {
this.showResults('singularity');
this.meta.unlockAchievement('singularity');
});
this.ui.showToast('☠ SINGULARITY · Event Horizon Reached', 3000, '#a855f7');
this.audio.haptic('heavy');
}
updateSingularity(dt) {
if (this.state !== 'singularity') return;
const playerPos = this.player.getPosition();
const pull = this.singularity.update(dt, playerPos.x, playerPos.y);
if (pull) {
this.player.x += pull.x * dt;
this.player.y += pull.y * dt;
this.player.mesh.position.set(this.player.x, this.player.y, 0);
}
this.world3D.update(performance.now() / 1000, dt);
this.world3D.render();
}
}
