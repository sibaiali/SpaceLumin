/**
 * Game.js - Main Game Controller
 * Orchestrates all game systems, entities, and the main loop
 */

// Spawn configuration
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
        // Core systems
        this.meta = new MetaSystem();
        this.audio = new AudioSystem();

        // 3D world
        const container = document.getElementById('game-canvas');
        this.world3D = new World3D(container);

        // Input
        this.input = new InputHandler(this.world3D);

        // UI
        this.ui = new UIController(this.meta);

        // Adaptive difficulty Director
        this.director = new Director();

        // Label system for collectibles
        this.labelSystem = new LabelSystem();

        // Weapon Evolution / Fusion System
        this.weaponEvolution = new WeaponEvolutionSystem(this.world3D.scene, this.world3D, this.audio);

        // Monetization & Rewarded Ad System
        this.monetization = new MonetizationSystem(this.ui, this.meta, this.audio);

        // Singularity ending (sector 11)
        this.singularity = new SingularitySequence(this.world3D.scene, this.world3D.camera);

        // Game state
        this.state = 'menu'; // menu, tutorial, story, roadmap, onboard, meta, settings, playing, paused, results, singularity

        // Run data (reset each run)
        this.runData = null;

        // Settings
        this.settings = {
            performanceMode: false,
            screenShake: true
        };

        // Timing - THREE.Clock for frame-rate independent physics
        this.clock = new THREE.Clock();
        this.lastTime = performance.now();
        this.timeScale = 1.0;
        this.hitStopTimer = 0;
        this.lastFrameTime = 16.67; // For dynamic quality

        // Initialize
        this.setupMenuNavigation();
        this.setupSettingsListeners();
        this.ui.updateMenuStats();
        this.ui.updateRoadmapUI();

        // Start main loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    setupMenuNavigation() {
        // Play button
        document.getElementById('btn-play')?.addEventListener('click', () => {
            this.audio.init();
            if (!this.meta.hasSeenOnboard()) {
                this.navigateTo('onboard');
            } else {
                this.ui.updateRoadmapUI();
                this.navigateTo('roadmap');
            }
        });

        // Tutorial
        document.getElementById('btn-tutorial')?.addEventListener('click', () => this.navigateTo('tutorial'));
        document.getElementById('btn-tutorial-back')?.addEventListener('click', () => this.navigateTo('menu'));

        // Meta Lab
        document.getElementById('btn-meta')?.addEventListener('click', () => {
            this.ui.refreshMetaUI();
            this.navigateTo('meta');
        });
        document.getElementById('btn-meta-back')?.addEventListener('click', () => this.navigateTo('menu'));
        document.getElementById('btn-meta-close')?.addEventListener('click', () => this.navigateTo('menu'));

        // Settings
        document.getElementById('btn-settings')?.addEventListener('click', () => this.navigateTo('settings'));
        document.getElementById('btn-settings-back')?.addEventListener('click', () => this.navigateTo('menu'));

        // Onboard
        document.getElementById('btn-onboard-start')?.addEventListener('click', () => {
            this.meta.markOnboardSeen();
            this.ui.updateRoadmapUI();
            this.navigateTo('roadmap');
        });
        document.getElementById('btn-onboard-back')?.addEventListener('click', () => this.navigateTo('menu'));

        // Roadmap
        document.getElementById('btn-roadmap-start')?.addEventListener('click', () => {
            if (!this.meta.hasSeenStory()) {
                this.ui.resetStory();
                this.navigateTo('story');
            } else {
                this.startRun();
            }
        });
        document.getElementById('btn-roadmap-back')?.addEventListener('click', () => this.navigateTo('menu'));

        // Story
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

        // Results
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
            document.getElementById('btn-double-crystals').disabled = true;
            document.getElementById('btn-double-crystals').style.opacity = '0.5';
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

        // Pause
        document.getElementById('btn-resume')?.addEventListener('click', () => this.togglePause());
        document.getElementById('btn-quit')?.addEventListener('click', () => {
            this.ui.hideOverlay('pause');
            this.endRun();
            this.navigateTo('menu');
        });

        // Keyboard shortcuts
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
            }
        });

        // Setup HUD button callbacks
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

        // Initialize run data
        const flowMax = this.meta.computeFlowMax();
        this.runData = {
            sector: 1,
            flow: 55,
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

        window.invokePredictionEvaluatorSafely?.('game.session-start', () => {
            this.predictionEvaluator?.beginSession();
        });

        // Create entities
        this.player = new Player(this.world3D.scene, this.world3D);
        this.bullets = new BulletPool(this.world3D.scene);
        this.collectibles = new CollectibleManager(this.world3D.scene);
        this.nodes = new NodeManager(this.world3D.scene);
        this.enemies = [];

        // Start with shield if upgrade owned
        if (this.meta.hasUpgrade('shieldStart')) {
            const duration = this.meta.computeShieldDuration(1);
            this.player.activateShield(0, duration);
        }

        // Initialize difficulty system for sector 1
        difficultySystem.setSector(this.runData.sector);

        // Spawn initial entities
        this.spawnInitialEntities();

        // Spawn timer
        this.spawnTimer = 0;

        this.state = 'playing';

        // Show mobile controls if on mobile device
        this.input.showMobileControls();

        // ========================================
        // GESTURE CALLBACKS: Tap-to-Kill, Ability Pulse
        // ========================================
        this.setupGestureCallbacks();

        this.ui.showToast('Sector online', 1200, '#22d3ee');
        this.ui.showToast('Collect energy & fruits to keep Flow alive', 1600, '#22c55e');
    }

    setupGestureCallbacks() {
        // TAP-TO-KILL: Instant kill enemy under tap point
        this.input.onTapKill = (worldX, worldY, enemy) => {
            if (!this.runData || this.state !== 'playing') return;

            // Deal massive damage (instant kill)
            enemy.takeDamage(999, this.runData.time);

            // Spawn Nebula Space Matter explosion at tap point
            this.world3D.spawnImpactGlow(worldX, worldY, 0xa855f7, 12); // Purple explosion

            // Play Star Splash sound at 1.5x pitch
            if (this.audio.ready && this.audio.sounds.collect) {
                // Higher pitch = higher note
                this.audio.sounds.collect.triggerAttackRelease('G5', '16n');
                setTimeout(() => this.audio.sounds.collect.triggerAttackRelease('C6', '16n'), 50);
            }

            // Haptic feedback
            this.audio.haptic('medium');

            // Screen shake
            if (this.settings.screenShake) {
                this.world3D.shake(0.4);
            }
        };

        // ABILITY PULSE: Visual feedback when gesture abilities trigger
        this.input.onAbilityPulse = (type) => {
            if (!this.player || !this.runData) return;

            // Trigger the visual pulse ring
            this.player.triggerAbilityPulse(type, this.runData.time);

            // Additional haptic for feedback
            this.audio.haptic('light');
        };
    }

    endRun() {
        window.invokePredictionEvaluatorSafely?.('game.session-end', () => {
            this.predictionEvaluator?.endSession('RUN_ENDED');
        });

        // Hide mobile controls
        this.input.hideMobileControls();

        // Clean up entities
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

        // Spawn gate/node (Singularity is forced to center 0,0,0)
        let nx = bounds.left + bounds.width * (0.45 + Math.random() * 0.3);
        let ny = bounds.bottom + bounds.height * (0.55 + Math.random() * 0.2);
        if (this.runData.sector === 20) {
            nx = 0;
            ny = 0;
        }
        this.nodes.spawn(nx, ny, this.runData.sector);

        // Initial collectibles
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

        // Boss sector?
        this.runData.isBossSector = (this.runData.sector % 3 === 0);
        if (this.runData.isBossSector) {
            const ex = bounds.left + 60 + Math.random() * (bounds.width - 120);
            const ey = bounds.top - bounds.height * 0.3;
            this.spawnEnemy(ex, ey, 'boss');
        }

        // Set weapon mode
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

        // Trigger freeze VFX - universe cracks and freezes
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

        // Calculate gain
        let gain = this.enemies.length * 80;
        if (this.meta.hasUpgrade('auraPlus')) gain = Math.floor(gain * 1.4);

        // Clear non-boss enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.type !== 'boss') {
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
        // ========================================
        // DELTA TIMING: Use THREE.Clock for frame-rate independence
        // This ensures consistent speed on 60Hz and 120Hz screens
        // ========================================
        const clockDelta = this.clock.getDelta();
        let dt = Math.min(clockDelta, 1 / 30); // Cap at ~33ms to prevent spiral of death

        // ========================================
        // SUB-STEPPING: Prevent physics tunneling on slow devices
        // If delta > 100ms, break into smaller steps
        // ========================================
        const MAX_STEP = 0.033; // 33ms max per step
        const steps = dt > 0.1 ? Math.ceil(dt / MAX_STEP) : 1;
        dt = dt / steps; // Divide into sub-steps

        const frameTime = now - this.lastTime;
        this.lastTime = now;
        this.lastFrameTime = frameTime;

        // Dynamic quality scaling based on frame time
        this.world3D.adaptQuality(frameTime);

        // Hit stop
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt * steps; // Use original delta for timer
            if (this.hitStopTimer <= 0) this.timeScale = 1.0;
        }
        dt *= this.timeScale;

        const time = now / 1000;

        // Update based on state
        if (this.state === 'playing' && this.runData) {
            this.updateGame(dt, time);

            // Update Director once per second
            this.director.update(time);
        } else if (this.state === 'singularity') {
            // Handle singularity ending sequence
            this.updateSingularity(dt);
            return; // Skip normal rendering
        }

        // Always update background
        this.world3D.update(time, dt);
        this.world3D.render();

        requestAnimationFrame(this.loop);
    }

    updateGame(dt, time) {
        const data = this.runData;
        const bounds = this.world3D.getVisibleBounds();
        const dailyMod = this.meta.getDailyMod();

        data.time += dt;

        // Day/night cycle
        const DAY = 90;
        const phaseRaw = (data.time / DAY) % 1;
        let phase = phaseRaw * (dailyMod.nightBias || 1.0);
        phase = phase % 1;
        let nightFactor = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
        if (dailyMod.id === 'nightForever') nightFactor = Math.max(0.6, nightFactor);
        data.dayPhase = nightFactor;

        // Update theme
        this.world3D.updateTheme(data.sector, nightFactor);

        // Update joystick target position for mobile (before getting target)
        // Pass dt for lerp smoothing (buttery smooth 120Hz feel)
        this.input.updateJoystickTarget(this.player.x, this.player.y, bounds, dt);

        // AUTO-PULSE: Update enemy proximity tracking for mobile
        this.input.updateAutoPulse(dt, this.player.x, this.player.y, this.enemies);

        // TAP-TO-KILL: Provide enemy pool reference for raycast
        this.input.setEnemyPool(this.enemies);

        // Check mobile ability button presses
        this.input.checkMobileAbilities();

        // Get input
        const target = this.input.getTargetPosition();
        const isFiring = this.input.isFiring() || this.player.autoFire;

        // Update player
        this.player.update(dt, data.time, target.x, target.y, dailyMod.jerkFactor || 1.0);

        // Track jerk for pilot style
        this.trackJerk(dt);

        // ========================================
        // TELEMETRY SERVICE: Track player position for jerkiness
        // ========================================
        if (typeof telemetryService !== 'undefined') {
            telemetryService.recordPosition(this.player.x, this.player.y, data.time);
            telemetryService.update(data.time);

            if (this.predictionEvaluator && typeof predictiveAI !== 'undefined') {
                const encodedState = predictiveAI.lastState;
                window.invokePredictionEvaluatorSafely?.('game.position-observation', () => {
                    this.predictionEvaluator.observePosition(encodedState);
                });
            }
        }

        // Update flow
        this.updateFlow(dt, dailyMod);

        // Frozen state
        const frozen = data.time < data.freezeUntil;

        // Update entities
        this.collectibles.update(dt, data.time, bounds);
        this.nodes.update(dt, data.time, this.player, this.enemies);
        this.bullets.update(dt, bounds, data.time);

        // Weapon Evolution / Fusion System update
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
            this.weaponEvolution.update(dt, data.time, this.player.x, this.player.y, this.enemies, this.bullets);
        }

        // Update decorative stars from spawn budget
        spawnBudget.updateStars(data.time);

        // Update labels for collectibles (positioned under objects)
        const projectFn = (x, y, z) => this.world3D.worldToScreen(x, y, z);
        this.labelSystem.update(
            this.collectibles.collectibles,
            { x: this.player.x, y: this.player.y },
            projectFn
        );

        // Update enemies
        const playerPos = this.player.getPosition();
        const decoyPos = this.player.getDecoyPosition();

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const result = e.update(dt, playerPos, decoyPos, frozen, data.time, data);

            // Handle shooter bullets
            if (result && result.x !== undefined && !result.spawnMinion) {
                this.bullets.spawnEnemyBullet(result.x, result.y, result.vx, result.vy);
            }

            // Handle boss minion spawn
            if (result && result.spawnMinion) {
                this.spawnEnemy(result.x, result.y, 'fast');
                this.audio.playSpawn('G2');
            }
        }

        // ========================================
        // MOBILE COMBAT: Auto-Pulse Shooting (Photonic Lance)
        // When touching screen + enemy in range, fires every 0.2s toward nearest enemy
        // ========================================
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

        // Player firing (manual / desktop)
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

            this.player.nextShotTime = data.time + 1 / 9;
            this.audio.playShoot();
        }

        // Spawn entities
        this.spawnEntities(dt, nightFactor, dailyMod);

        // Handle collisions
        this.handleCollisions(data.time);

        // Update habitat
        this.updateHabitat(dt, nightFactor);

        // Update HUD
        const planetName = this.meta.getPlanetName(data.sector);
        this.ui.updateHUD({
            flow: data.flow,
            flowMax: data.flowMax,
            crystals: data.crystals,
            sector: data.sector,
            planetName: planetName,
            nodesRemaining: this.nodes.getActiveNodes().length,
            isBoss: data.isBossSector,
            isNight: nightFactor > 0.6,
            habitatTier: data.habitatTier
        });

        // Update cooldowns
        const decoyCd = Math.max(0.001, this.player.decoyCooldown);
        const freezeCd = Math.max(0.001, this.getFreezeCooldown());
        const auraCd = Math.max(0.001, this.getAuraCooldown());

        this.ui.updateCooldowns({
            decoyProgress: Math.min(1, (data.time - this.player.decoyLast) / decoyCd),
            freezeProgress: Math.min(1, (data.time - data.lastFreeze) / freezeCd),
            auraProgress: Math.min(1, (data.time - data.lastAura) / auraCd)
        });

        // Music and ambient sounds
        this.audio.pulseMusic(data.time, data.dayPhase, data.isBossSector, this.player.combo);
        this.audio.playSpaceDrone(data.time);
        this.audio.setFlowState(data.flow < 15);

        // Check game over
        if (data.flow <= 0) {
            this.showResults('loss');
        } else if (this.nodes.getActiveNodes().length === 0) {
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

        this.runData.stats.lastVelX = vx;
        this.runData.stats.lastVelY = vy;
    }

    updateFlow(dt, dailyMod) {
        const data = this.runData;
        const diffBase = 0.4 + data.sector * 0.03;
        let drain = diffBase * dt;

        // Jerk penalty
        const jHist = data.stats.jerkHistory;
        if (jHist.length > 0) {
            const mean = jHist.reduce((a, b) => a + b, 0) / jHist.length;
            const varc = jHist.reduce((a, v) => a + (v - mean) ** 2, 0) / jHist.length;
            const sigma = Math.sqrt(Math.max(0, varc));
            if (sigma > 60 * (dailyMod.jerkFactor || 1.0)) drain *= 1.1;
        }

        // Regen
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

        let modEnemy = dailyMod.enemyFactor || 1.0;
        if (this.meta.hasUpgrade('toxicMastery')) modEnemy *= 1.25;

        let baseInterval = (nightFactor > 0.6 ? 0.5 : 0.7) / modEnemy;
        if (this.settings.performanceMode) baseInterval *= 1.15;

        if (this.spawnTimer < baseInterval) return;
        this.spawnTimer -= baseInterval;

        const counts = this.collectibles.getCounts();
        const fruitBoost = dailyMod.fruitFactor || 1.0;

        // Spawn collectibles
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

        // Spawn enemies with difficulty scaling
        const diffParams = difficultySystem.getParams();

        // Base cap scales with difficulty
        let enemyCap = 4 + Math.floor(data.sector * 0.5) + Math.floor(nightFactor * 3);
        enemyCap = Math.floor(enemyCap * Math.min(2.5, diffParams.spawnRateMult * 0.5));
        if (this.settings.performanceMode) enemyCap = Math.floor(enemyCap * 0.7);
        enemyCap = Math.min(enemyCap, 20); // Hard cap for performance

        // Spawn chance scales with difficulty
        let enemyChance = (0.25 + 0.2 * nightFactor) * modEnemy;
        enemyChance *= Math.min(3.0, diffParams.spawnRateMult * 0.4);
        if (this.settings.performanceMode) enemyChance *= 0.85;

        if (this.enemies.length < enemyCap && Math.random() < enemyChance) {
            const x = bounds.left + 40 + Math.random() * (bounds.width - 80);
            const y = bounds.bottom + 40 + Math.random() * (bounds.height - 80);

            // Type selection with elite chance from difficulty
            let type = 'normal';
            if (diffParams.shouldSpawnElite || Math.random() < diffParams.eliteChance) {
                // Higher chance of dangerous types at high difficulty
                const r = Math.random();
                if (r < 0.3) type = 'tanky';
                else if (r < 0.6) type = 'shooter';
                else type = 'fast';
            } else {
                const r = Math.random();
                if (r < 0.25) type = 'fast';
                else if (r < 0.5) type = 'tanky';
                else if (r < 0.7) type = 'shooter';
            }

            this.spawnEnemy(x, y, type);
            this.audio.playSpawn('C3');
            if (Math.random() < 0.3) this.audio.playWhoosh();
        }

        // Spawn reaper (more common at high difficulty)
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

    handleCollisions(time) {
        const data = this.runData;
        const p = this.player;

        // Player vs collectibles
        for (let i = this.collectibles.collectibles.length - 1; i >= 0; i--) {
            const c = this.collectibles.collectibles[i];
            const d = Math.hypot(p.x - c.x, p.y - c.y);

            if (d < p.radius + 12) {
                this.handleCollectiblePickup(c, time);
                this.collectibles.remove(c);
            }
        }

        // Player vs enemy bullets
        for (let i = this.bullets.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.bullets.enemyBullets[i];
            const d = Math.hypot(p.x - b.x, p.y - b.y);

            if (d < p.radius + b.r) {
                if (!p.shieldActive) {
                    data.flow = Math.max(0, data.flow - 7);
                    data.crystals = Math.max(0, data.crystals - 50);
                    p.combo = 1;
                    data.stats.tookDamage = true;
                    this.audio.playError('A2');
                    this.ui.showToast('Shot by void shard', 1400, '#f97316');
                    this.audio.haptic('heavy');
                } else {
                    this.ui.showToast('Shield blocked shard', 900, '#60a5fa');
                }
                this.bullets.removeEnemyBullet(b);
            }
        }

        // Player bullets vs nodes
        for (const b of [...this.bullets.playerBullets]) {
            for (const n of this.nodes.nodes) {
                const dn = Math.hypot(b.x - n.x, b.y - n.y);

                if (dn < n.coreR + b.r + 8) {
                    b.hasHit = true;
                    this.director.recordHit();
                    if (typeof telemetryService !== 'undefined') {
                        telemetryService.recordShot(true, data.time);
                    }
                    const destroyed = n.takeDamage(1);
                    data.crystals += 6;
                    data.flow = Math.min(data.flowMax, data.flow + 0.3);

                    if (destroyed) {
                        this.nodes.remove(n);
                        data.flow = Math.min(data.flowMax, data.flow + 28);
                        let gain = 400 + data.sector * 40;
                        if (data.habitatTier >= 3) gain = Math.floor(gain * 1.2);
                        data.crystals += gain;

                        this.ui.showToast('Gate purified', 1800, '#22c55e');
                        this.audio.playLevelUp();
                        this.audio.haptic('heavy');
                        this.hitStop(0.2);

                        if (this.meta.unlockAchievement('firstGate')) {
                            this.ui.showToast('Achievement unlocked: First Gate', 2000, '#22c55e');
                        }
                    }

                    this.bullets.removePlayerBullet(b);
                    break;
                } else if (dn < n.shieldR) {
                    b.hasHit = true;
                    this.director.recordHit();
                    if (typeof telemetryService !== 'undefined') {
                        telemetryService.recordShot(true, data.time);
                    }
                    this.bullets.removePlayerBullet(b);
                    break;
                }
            }
        }

        // Player bullets vs enemies
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
                        const wasReaper = e.type === 'reaper';
                        const wasBoss = e.type === 'boss';
                        const deathX = e.x;
                        const deathY = e.y;

                        e.dispose();
                        this.enemies.splice(i, 1);

                        // Spawn impact glow VFX at death location
                        const glowColor = wasReaper ? 0xec4899 : (wasBoss ? 0xf97316 : 0x22d3ee);
                        const glowCount = wasBoss ? 20 : (wasReaper ? 15 : 10);
                        this.world3D.spawnImpactGlow(deathX, deathY, glowColor, glowCount);
                        this.audio.playImpact();

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

                        p.addCombo(time);
                        this.audio.playCollect('C4');
                        this.audio.haptic('light');

                        if (wasReaper || wasBoss) this.hitStop(0.25);

                        // Drop toxic fruit
                        if (Math.random() < 0.22) {
                            this.collectibles.spawn('toxicFruit', deathX, deathY, data.sector);
                        }
                    }

                    this.bullets.removePlayerBullet(b);
                    break;
                }
            }
        }

        // Player vs enemies
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
                    data.flow = Math.max(0, data.flow - (isBoss ? 14 : 9));
                    p.combo = 1;
                    p.applyKnockback(e.x, e.y);
                    data.stats.tookDamage = true;

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
                    e.dispose();
                    this.enemies.splice(i, 1);
                }
            }
        }
    }

    handleCollectiblePickup(c, time) {
        const data = this.runData;
        const p = this.player;

        // Track fruit collection
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
                this.ui.showToast('Predictive Vector', 1200, '#00ffcc');
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
                this.ui.showToast('Landmark Node Stabilized', 1200, '#00ffff');
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

        // MAX 20 SECTORS - Elemental Odyssey ends at Singularity
        if (data.sector > 20) {
            // Trigger Singularity sequence at sector 20 completion
            this.triggerSingularity();
            return;
        }

        // Reset sector state
        data.flow = 55;

        // Clear entities
        this.enemies.forEach(e => e.dispose());
        this.enemies = [];
        this.bullets.clear();
        this.collectibles.clear();
        this.nodes.clear();

        // Update weapon mode
        const newMode = this.meta.getWeaponMode(data.sector);
        if (newMode !== data.weaponMode) {
            const label = newMode === 'fire' ? 'Fire rounds unlocked'
                : newMode === 'electric' ? 'Electric rounds unlocked' : 'Standard rounds';
            this.ui.showToast(label, 1400, '#f97316');
        }
        data.weaponMode = newMode;

        // Update difficulty system for new sector
        const diffParams = difficultySystem.setSector(data.sector);

        // Show sector transition message
        if (diffParams.sectorMessage) {
            setTimeout(() => {
                this.ui.showToast(diffParams.sectorMessage, 3000,
                    data.sector >= 9 ? '#ef4444' : (data.sector >= 6 ? '#f97316' : '#22d3ee'));
            }, 1500);
        }

        // Spawn new gate
        const bounds = this.world3D.getVisibleBounds();
        const nx = bounds.left + bounds.width * (0.4 + Math.random() * 0.35);
        const ny = bounds.bottom + bounds.height * (0.55 + Math.random() * 0.2);
        this.nodes.spawn(nx, ny, data.sector);

        // Boss sector?
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

        // Update high score
        const oldBest = this.meta.getHighScore();
        const newBest = Math.max(oldBest, crystals);
        if (crystals > oldBest) {
            this.meta.setHighScore(crystals);
            this.ui.showToast('New record archive', 2000, '#a855f7');
        }

        // Calculate shard gain
        const shardGain = Math.max(1, Math.floor(crystals / 1000) + gatesPurified);
        this.meta.addArchiveShards(shardGain);

        // Classify pilot style
        let style = 'Signal forming · Not enough data';
        if (data && data.stats.jerkHistory.length > 0) {
            const arr = data.stats.jerkHistory;
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            if (mean < 60) style = 'Calm pilot · Smooth orbit control';
            else if (mean < 120) style = 'Adaptive pilot · Controlled chaos';
            else style = 'Chaotic pilot · H-PIM under heavy load';
        }

        // Show results
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
        // Enter singularity state
        this.state = 'singularity';

        // Clear entities except player
        this.enemies.forEach(e => e.dispose());
        this.enemies = [];
        this.bullets.clear();
        this.collectibles.clear();
        this.nodes.clear();

        // Hide labels
        this.labelSystem.hide();

        // Start singularity sequence
        this.singularity.start(() => {
            // On complete: show win results with transcendence achieved
            this.showResults('singularity');

            // Unlock achievement
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
            // Apply gravity pull to player
            this.player.x += pull.x * dt;
            this.player.y += pull.y * dt;
            this.player.mesh.position.set(this.player.x, this.player.y, 0);
        }

        // Render during singularity
        this.world3D.update(performance.now() / 1000, dt);
        this.world3D.render();
    }
}
