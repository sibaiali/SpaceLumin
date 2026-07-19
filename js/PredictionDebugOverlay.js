/**
 * PredictionDebugOverlay.js
 * Development-only, read-only visibility into the existing prediction runtime.
 */
(function () {
    'use strict';

    const UPDATE_INTERVAL_MS = 200;
    const STATUS = Object.freeze({
        ACTIVE: 'ACTIVE',
        INACTIVE: 'CONSTRUCTED / INACTIVE',
        UNREACHABLE: 'UNREACHABLE',
        NA: 'N/A'
    });

    const developmentModeAllowed = ['localhost', '127.0.0.1'].includes(window.location.hostname) ||
        new URLSearchParams(window.location.search).get('dev') === '1';

    if (!developmentModeAllowed) return;

    const freeze = (value) => Object.freeze(value);
    const finiteOrNull = (value) => Number.isFinite(value) ? value : null;

    class PredictionDebugSnapshotAdapter {
        constructor(runtime) {
            this.runtime = runtime;
        }

        read() {
            const game = this.runtime.getGame();
            const director = game?.director ?? null;
            const telemetry = this.runtime.telemetry;
            const predictor = this.runtime.predictor;
            const kernel = this.runtime.kernel;
            const neuro = this.runtime.neuro;
            const overload = this.runtime.overload;

            const positionCount = telemetry?.positionHistory?.length ?? 0;
            const velocityCount = telemetry?.velocityHistory?.length ?? 0;
            const accelerationCount = telemetry?.accelerationHistory?.length ?? 0;
            const jerkCount = telemetry?.jerkHistory?.length ?? 0;
            const shotCount = telemetry?.shotOutcomes?.length ?? 0;
            const latestJerk = jerkCount > 0
                ? finiteOrNull(telemetry.jerkHistory[jerkCount - 1]?.j)
                : null;
            const jerkReady = jerkCount >= 10;
            const entropyReady = shotCount >= 5;
            const combinedTelemetryReady = jerkReady && entropyReady;

            const modelReady = Boolean(
                predictor && predictor.totalTransitions >= predictor.MIN_TRANSITIONS
            );

            let shotWindow = 'empty';
            if (predictor?.shotWindow?.length) {
                shotWindow = '';
                for (const outcome of predictor.shotWindow) {
                    shotWindow += outcome === 1 ? 'M' : 'H';
                }
            }

            return freeze({
                capturedAt: performance.now(),
                systems: freeze({
                    game: game ? STATUS.ACTIVE : STATUS.NA,
                    telemetry: telemetry ? STATUS.ACTIVE : STATUS.NA,
                    prediction: predictor ? STATUS.ACTIVE : STATUS.NA,
                    director: director ? STATUS.ACTIVE : STATUS.NA,
                    kernel: kernel ? STATUS.UNREACHABLE : STATUS.NA,
                    neuro: neuro ? STATUS.INACTIVE : STATUS.NA,
                    overload: overload ? STATUS.UNREACHABLE : STATUS.NA
                }),
                game: freeze({
                    state: game?.state ?? null,
                    sector: finiteOrNull(game?.runData?.sector),
                    runTime: finiteOrNull(game?.runData?.time)
                }),
                telemetry: freeze({
                    latestJerk,
                    jerkScore: jerkReady ? finiteOrNull(telemetry?.jerkScore) : null,
                    entropyScore: entropyReady ? finiteOrNull(telemetry?.entropyScore) : null,
                    chaosFactor: combinedTelemetryReady ? finiteOrNull(telemetry?.chaosFactor) : null,
                    playstyle: combinedTelemetryReady ? telemetry.getPlaystyle() : null,
                    samples: freeze({
                        position: positionCount,
                        velocity: velocityCount,
                        acceleration: accelerationCount,
                        jerk: jerkCount,
                        shots: shotCount
                    })
                }),
                prediction: freeze({
                    modelReady,
                    encodedState: predictor && predictor.lastState >= 0 ? predictor.lastState : null,
                    transitions: predictor?.totalTransitions ?? null,
                    shotWindow,
                    recentMisses: predictor?.recentMisses ?? null,
                    risks: freeze({
                        collision: null,
                        missedBurst: modelReady ? finiteOrNull(predictor?.missedBurstRisk) : null,
                        panic: modelReady ? finiteOrNull(predictor?.panicRisk) : null
                    }),
                    callCount: null,
                    lastLatencyMs: null
                }),
                director: freeze({
                    shotsFired: director?.shotsFired ?? null,
                    shotsHit: director?.shotsHit ?? null,
                    accuracy: finiteOrNull(director?.accuracy),
                    skillScore: finiteOrNull(director?.skillScore),
                    multipliers: freeze({
                        enemySpeed: finiteOrNull(director?.enemySpeedMult),
                        spawnDensity: finiteOrNull(director?.spawnDensityMult),
                        eliteChance: finiteOrNull(director?.eliteChance),
                        hazardFrequency: finiteOrNull(director?.hazardFrequency)
                    }),
                    consumedByGameplay: false
                }),
                unavailable: freeze({
                    collisionCalibration: null,
                    hpBracket: null,
                    enemyDensityBracket: null,
                    kernelFlowClassification: null,
                    corticalPhi: null,
                    neuroFlowState: null,
                    overloadProbability: null,
                    stimulusAttribution: null,
                    adaptiveIntervention: null
                })
            });
        }
    }

    class PredictionDebugOverlay {
        constructor(adapter) {
            this.adapter = adapter;
            this.visible = false;
            this.timer = null;
            this.root = null;
            this.fields = new Map();
            this.handleKeyDown = this.handleKeyDown.bind(this);
        }

        init() {
            this.installStyles();
            this.root = this.buildDOM();
            document.body.appendChild(this.root);
            window.addEventListener('keydown', this.handleKeyDown);
            console.log('[PredictionDebugOverlay] Ready - press F3 to toggle');
        }

        installStyles() {
            if (document.getElementById('prediction-debug-overlay-styles')) return;

            const style = document.createElement('style');
            style.id = 'prediction-debug-overlay-styles';
            style.textContent = `
                #prediction-debug-overlay {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    width: min(620px, calc(100vw - 20px));
                    max-height: calc(100vh - 20px);
                    box-sizing: border-box;
                    overflow: hidden;
                    pointer-events: none;
                    z-index: 100001;
                    color: #dbeafe;
                    background: rgba(3, 7, 18, 0.94);
                    border: 1px solid #22d3ee;
                    border-radius: 7px;
                    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
                    font: 11px/1.28 Consolas, "Courier New", monospace;
                }
                #prediction-debug-overlay[hidden] { display: none !important; }
                .pdo-header {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    padding: 7px 9px;
                    color: #facc15;
                    background: rgba(15, 23, 42, 0.98);
                    border-bottom: 1px solid #164e63;
                    letter-spacing: 0.04em;
                }
                .pdo-header small { color: #64748b; letter-spacing: 0; }
                .pdo-body { padding: 7px; }
                .pdo-columns {
                    display: grid;
                    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
                    gap: 7px;
                }
                .pdo-stack { display: grid; gap: 7px; align-content: start; }
                .pdo-section {
                    min-width: 0;
                    padding: 5px 7px;
                    background: rgba(15, 23, 42, 0.72);
                    border: 1px solid #1e293b;
                    border-radius: 4px;
                }
                .pdo-title {
                    margin-bottom: 4px;
                    color: #67e8f9;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }
                .pdo-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 2px 8px;
                    align-items: baseline;
                }
                .pdo-label { color: #94a3b8; overflow: hidden; text-overflow: ellipsis; }
                .pdo-value { color: #e2e8f0; text-align: right; white-space: nowrap; }
                .pdo-status { font-weight: 700; }
                .pdo-status[data-state="ACTIVE"] { color: #4ade80; }
                .pdo-status[data-state="CONSTRUCTED / INACTIVE"] { color: #facc15; }
                .pdo-status[data-state="UNREACHABLE"] { color: #fb923c; }
                .pdo-status[data-state="N/A"], .pdo-na { color: #64748b; }
                .pdo-note {
                    margin-top: 4px;
                    padding-top: 4px;
                    color: #fb923c;
                    border-top: 1px solid #273449;
                }
                .pdo-unavailable { margin-top: 7px; }
                .pdo-na-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 3px 10px;
                }
                .pdo-na-item {
                    display: flex;
                    justify-content: space-between;
                    gap: 6px;
                    min-width: 0;
                }
                .pdo-na-item .pdo-label { white-space: nowrap; }
                .pdo-footer {
                    padding: 4px 9px 6px;
                    color: #64748b;
                    text-align: right;
                }
                @media (max-width: 760px) {
                    #prediction-debug-overlay {
                        font-size: 10px;
                        line-height: 1.2;
                    }
                    .pdo-columns { grid-template-columns: 1fr; }
                    .pdo-na-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
            `;
            document.head.appendChild(style);
        }

        buildDOM() {
            const root = document.createElement('aside');
            root.id = 'prediction-debug-overlay';
            root.hidden = true;
            root.setAttribute('aria-hidden', 'true');
            root.innerHTML = `
                <div class="pdo-header">
                    <span>Prediction Runtime</span>
                    <small>F3 toggle | read-only | 5 Hz</small>
                </div>
                <div class="pdo-body">
                    <div class="pdo-columns">
                        <div class="pdo-stack">
                            <section class="pdo-section">
                                <div class="pdo-title">Runtime systems</div>
                                <div class="pdo-grid">
                                    <span class="pdo-label">Game</span><span class="pdo-value pdo-status" data-field="system-game"></span>
                                    <span class="pdo-label">TelemetryService</span><span class="pdo-value pdo-status" data-field="system-telemetry"></span>
                                    <span class="pdo-label">PredictiveAI</span><span class="pdo-value pdo-status" data-field="system-prediction"></span>
                                    <span class="pdo-label">Director</span><span class="pdo-value pdo-status" data-field="system-director"></span>
                                    <span class="pdo-label">KernelMapper</span><span class="pdo-value pdo-status" data-field="system-kernel"></span>
                                    <span class="pdo-label">NeuroFlowController</span><span class="pdo-value pdo-status" data-field="system-neuro"></span>
                                    <span class="pdo-label">CognitiveOverload</span><span class="pdo-value pdo-status" data-field="system-overload"></span>
                                </div>
                            </section>
                            <section class="pdo-section">
                                <div class="pdo-title">Telemetry</div>
                                <div class="pdo-grid">
                                    <span class="pdo-label">game state</span><span class="pdo-value" data-field="game-state"></span>
                                    <span class="pdo-label">sector / run time</span><span class="pdo-value" data-field="game-sector-time"></span>
                                    <span class="pdo-label">movement jerk</span><span class="pdo-value" data-field="telemetry-jerk"></span>
                                    <span class="pdo-label">jerk score</span><span class="pdo-value" data-field="telemetry-jerk-score"></span>
                                    <span class="pdo-label">entropy</span><span class="pdo-value" data-field="telemetry-entropy"></span>
                                    <span class="pdo-label">chaos / playstyle</span><span class="pdo-value" data-field="telemetry-chaos-style"></span>
                                    <span class="pdo-label">samples p/v/a/j/s</span><span class="pdo-value" data-field="telemetry-samples"></span>
                                </div>
                            </section>
                        </div>
                        <div class="pdo-stack">
                            <section class="pdo-section">
                                <div class="pdo-title">Prediction</div>
                                <div class="pdo-grid">
                                    <span class="pdo-label">model</span><span class="pdo-value" data-field="prediction-model"></span>
                                    <span class="pdo-label">encoded state</span><span class="pdo-value" data-field="prediction-state"></span>
                                    <span class="pdo-label">transitions</span><span class="pdo-value" data-field="prediction-transitions"></span>
                                    <span class="pdo-label">shot window (H/M)</span><span class="pdo-value" data-field="prediction-shot-window"></span>
                                    <span class="pdo-label">recent misses</span><span class="pdo-value" data-field="prediction-misses"></span>
                                    <span class="pdo-label">missed-burst risk</span><span class="pdo-value" data-field="prediction-missed-risk"></span>
                                    <span class="pdo-label">panic risk</span><span class="pdo-value" data-field="prediction-panic-risk"></span>
                                    <span class="pdo-label">prediction calls</span><span class="pdo-value" data-field="prediction-calls"></span>
                                    <span class="pdo-label">last prediction latency</span><span class="pdo-value" data-field="prediction-latency"></span>
                                </div>
                            </section>
                            <section class="pdo-section">
                                <div class="pdo-title">Director</div>
                                <div class="pdo-grid">
                                    <span class="pdo-label">shots / hits</span><span class="pdo-value" data-field="director-shots"></span>
                                    <span class="pdo-label">accuracy / skill</span><span class="pdo-value" data-field="director-skill"></span>
                                    <span class="pdo-label">enemy speed</span><span class="pdo-value" data-field="director-speed"></span>
                                    <span class="pdo-label">spawn density</span><span class="pdo-value" data-field="director-density"></span>
                                    <span class="pdo-label">elite chance</span><span class="pdo-value" data-field="director-elite"></span>
                                    <span class="pdo-label">hazard frequency</span><span class="pdo-value" data-field="director-hazard"></span>
                                </div>
                                <div class="pdo-note">Calculated multipliers are currently not consumed by gameplay.</div>
                            </section>
                        </div>
                    </div>
                    <section class="pdo-section pdo-unavailable">
                        <div class="pdo-title">Verified unavailable values</div>
                        <div class="pdo-na-grid">
                            <div class="pdo-na-item"><span class="pdo-label">collision calibration</span><span class="pdo-na">N/A</span></div>
                            <div class="pdo-na-item"><span class="pdo-label">HP bracket</span><span class="pdo-na">N/A</span></div>
                            <div class="pdo-na-item"><span class="pdo-label">enemy-density bracket</span><span class="pdo-na">N/A</span></div>
                            <div class="pdo-na-item"><span class="pdo-label">Kernel flow class</span><span class="pdo-na">N/A</span></div>
                            <div class="pdo-na-item"><span class="pdo-label">cortical phi</span><span class="pdo-na">N/A</span></div>
                            <div class="pdo-na-item"><span class="pdo-label">NeuroFlow live state</span><span class="pdo-na">N/A</span></div>
                            <div class="pdo-na-item"><span class="pdo-label">overload probability</span><span class="pdo-na">N/A</span></div>
                            <div class="pdo-na-item"><span class="pdo-label">stimulus attribution</span><span class="pdo-na">N/A</span></div>
                            <div class="pdo-na-item"><span class="pdo-label">adaptive intervention</span><span class="pdo-na">N/A</span></div>
                        </div>
                    </section>
                </div>
                <div class="pdo-footer">No update, predict, classify, or intervention methods are called.</div>
            `;

            for (const field of root.querySelectorAll('[data-field]')) {
                this.fields.set(field.dataset.field, field);
            }
            return root;
        }

        handleKeyDown(event) {
            if (event.key !== 'F3' || event.repeat || this.isTypingTarget(event.target)) return;
            event.preventDefault();
            this.toggle();
        }

        isTypingTarget(target) {
            if (!(target instanceof Element)) return false;
            return Boolean(
                target.closest('input, textarea, select, [contenteditable="true"]') ||
                target.isContentEditable
            );
        }

        toggle() {
            this.visible = !this.visible;
            this.root.hidden = !this.visible;
            this.root.setAttribute('aria-hidden', String(!this.visible));

            if (this.visible) {
                this.render(this.adapter.read());
                this.timer = window.setInterval(() => {
                    this.render(this.adapter.read());
                }, UPDATE_INTERVAL_MS);
            } else if (this.timer !== null) {
                window.clearInterval(this.timer);
                this.timer = null;
            }
        }

        render(snapshot) {
            this.setStatus('system-game', snapshot.systems.game);
            this.setStatus('system-telemetry', snapshot.systems.telemetry);
            this.setStatus('system-prediction', snapshot.systems.prediction);
            this.setStatus('system-director', snapshot.systems.director);
            this.setStatus('system-kernel', snapshot.systems.kernel);
            this.setStatus('system-neuro', snapshot.systems.neuro);
            this.setStatus('system-overload', snapshot.systems.overload);

            this.setField('game-state', snapshot.game.state);
            this.setField('game-sector-time', snapshot.game.sector === null
                ? 'N/A'
                : `${snapshot.game.sector} / ${this.number(snapshot.game.runTime, 1)}s`);

            this.setField('telemetry-jerk', this.number(snapshot.telemetry.latestJerk, 2));
            this.setField('telemetry-jerk-score', this.number(snapshot.telemetry.jerkScore, 0));
            this.setField('telemetry-entropy', this.number(snapshot.telemetry.entropyScore, 0));
            this.setField('telemetry-chaos-style', snapshot.telemetry.chaosFactor === null
                ? 'N/A'
                : `${this.number(snapshot.telemetry.chaosFactor, 2)} / ${snapshot.telemetry.playstyle}`);
            this.setField(
                'telemetry-samples',
                `${snapshot.telemetry.samples.position}/${snapshot.telemetry.samples.velocity}/` +
                `${snapshot.telemetry.samples.acceleration}/${snapshot.telemetry.samples.jerk}/` +
                `${snapshot.telemetry.samples.shots}`
            );

            this.setField('prediction-model', snapshot.prediction.modelReady ? 'READY' : 'WARM-UP');
            this.setField('prediction-state', snapshot.prediction.encodedState);
            this.setField('prediction-transitions', snapshot.prediction.transitions);
            this.setField('prediction-shot-window', snapshot.prediction.shotWindow);
            this.setField('prediction-misses', snapshot.prediction.recentMisses);
            this.setField('prediction-missed-risk', this.percent(snapshot.prediction.risks.missedBurst));
            this.setField('prediction-panic-risk', this.percent(snapshot.prediction.risks.panic));
            this.setField('prediction-calls', snapshot.prediction.callCount);
            this.setField('prediction-latency', snapshot.prediction.lastLatencyMs === null
                ? null
                : `${this.number(snapshot.prediction.lastLatencyMs, 2)} ms`);

            this.setField('director-shots', snapshot.director.shotsFired === null
                ? null
                : `${snapshot.director.shotsFired} / ${snapshot.director.shotsHit}`);
            this.setField('director-skill', snapshot.director.accuracy === null
                ? null
                : `${this.number(snapshot.director.accuracy, 0)}% / ${this.number(snapshot.director.skillScore, 0)}`);
            this.setField('director-speed', this.multiplier(snapshot.director.multipliers.enemySpeed));
            this.setField('director-density', this.multiplier(snapshot.director.multipliers.spawnDensity));
            this.setField('director-elite', this.percent(snapshot.director.multipliers.eliteChance));
            this.setField('director-hazard', this.multiplier(snapshot.director.multipliers.hazardFrequency));
        }

        setStatus(name, value) {
            const field = this.fields.get(name);
            if (!field) return;
            this.setField(name, value);
            field.dataset.state = value;
        }

        setField(name, value) {
            const field = this.fields.get(name);
            if (!field) return;
            const text = value === null || value === undefined || value === '' ? 'N/A' : String(value);
            if (field.textContent !== text) field.textContent = text;
            field.classList.toggle('pdo-na', text === 'N/A');
        }

        number(value, digits) {
            return value === null || value === undefined ? 'N/A' : Number(value).toFixed(digits);
        }

        percent(value) {
            return value === null || value === undefined ? 'N/A' : `${(Number(value) * 100).toFixed(1)}%`;
        }

        multiplier(value) {
            return value === null || value === undefined ? 'N/A' : `${Number(value).toFixed(2)}x`;
        }
    }

    function initPredictionDebugOverlay() {
        const adapter = new PredictionDebugSnapshotAdapter({
            getGame: () => window.game ?? null,
            telemetry: typeof telemetryService !== 'undefined' ? telemetryService : null,
            predictor: typeof predictiveAI !== 'undefined' ? predictiveAI : null,
            kernel: typeof kernelMapper !== 'undefined' ? kernelMapper : null,
            neuro: typeof neuroFlow !== 'undefined' ? neuroFlow : null,
            overload: typeof cogOverload !== 'undefined' ? cogOverload : null
        });
        new PredictionDebugOverlay(adapter).init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPredictionDebugOverlay, { once: true });
    } else {
        initPredictionDebugOverlay();
    }
})();
