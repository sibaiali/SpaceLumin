/**
 * PredictionEvaluationAdapter.js
 * Development-only, side-effect-free evaluation of PredictiveAI state transitions.
 */
(function (root, factory) {
    'use strict';

    const isBrowser = typeof window !== 'undefined' && root === window;
    const isCommonJS = !isBrowser && typeof module !== 'undefined' && module.exports;
    if (isCommonJS) {
        module.exports = factory();
        return;
    }

    const params = new URLSearchParams(root.location.search);
    if (params.get('dev') !== '1' || params.get('evaluate') !== '1') return;

    root.document.documentElement.dataset.predictionEvaluator = 'loading';

    const api = factory();
    root.PredictionEvaluationAdapter = api.PredictionEvaluationAdapter;

    const faultBoundary = api.createPredictionEvaluationFaultBoundary({
        logger: (fault) => {
            const stack = fault.stack ? `\n${fault.stack}` : '';
            console.error(
                `[PredictionEvaluator] Hook ${fault.hookName} failed: ${fault.message}${stack}`
            );
        }
    });
    root.invokePredictionEvaluatorSafely = faultBoundary.invoke;
    root.getPredictionEvaluatorFaultSummary = faultBoundary.getFaultSummary;

    function initializePredictionEvaluator() {
        if (!root.game || root.game.predictionEvaluator) return;

        const predictor = typeof predictiveAI !== 'undefined' ? predictiveAI : null;
        if (!predictor) {
            console.error('[PredictionEvaluator] PredictiveAI is unavailable');
            return;
        }

        const requestedMode = (params.get('evaluationMode') || 'B').toUpperCase();
        const evaluationMode = requestedMode === 'A' ? 'A' : 'B';
        const sourceType = params.get('evaluationSource') === 'synthetic'
            ? 'synthetic'
            : 'human';

        root.game.predictionEvaluator = new api.PredictionEvaluationAdapter({
            evaluationMode,
            sourceType,
            totalStates: predictor.TOTAL_STATES,
            minTransitions: predictor.MIN_TRANSITIONS,
            algorithmConfigurationVersion: api.DEFAULT_ALGORITHM_CONFIGURATION_VERSION,
            lifecycleObserver: (type, payload) => {
                console.log(`[PredictionEvaluator] ${type}`, JSON.stringify(payload));
            },
            contextProvider: () => ({
                sector: root.game?.runData?.sector ?? null,
                gameTime: root.game?.runData?.time ?? null
            })
        });

        root.document.documentElement.dataset.predictionEvaluator = evaluationMode;

        console.log(
            `[PredictionEvaluator] Active in Mode ${evaluationMode}; ` +
            'events begin when the next run starts'
        );
    }

    root.initializePredictionEvaluator = initializePredictionEvaluator;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEFAULT_ALGORITHM_CONFIGURATION_VERSION =
        'pai-eval-v1|states=4x3x3|jerk=200,800|enemy=2,6|min=20|' +
        'ewm=.3|shots=5|top1=lowest-tie|target=next-position|dedupe=state-epoch';

    const STATUS = Object.freeze({
        OPEN: 'OPEN',
        RESOLVED: 'RESOLVED',
        CENSORED: 'CENSORED',
        NO_PREDICTION: 'NO_PREDICTION'
    });

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        for (const child of Object.values(value)) deepFreeze(child);
        return Object.freeze(value);
    }

    function createPredictionEvaluationFaultBoundary(options = {}) {
        const logger = options.logger || (() => {});
        const loggedFaults = new Set();
        const faultsByHook = Object.create(null);
        let totalFaultCount = 0;

        function invoke(hookName, callback) {
            if (typeof callback !== 'function') return undefined;

            try {
                return callback();
            } catch (error) {
                const safeHookName = typeof hookName === 'string' && hookName
                    ? hookName
                    : 'unknown';
                const message = error instanceof Error
                    ? error.message
                    : String(error);
                const stack = error && typeof error.stack === 'string'
                    ? error.stack
                    : null;
                const deduplicationKey = `${safeHookName}:${message}`;

                totalFaultCount++;
                faultsByHook[safeHookName] = (faultsByHook[safeHookName] || 0) + 1;

                if (!loggedFaults.has(deduplicationKey)) {
                    loggedFaults.add(deduplicationKey);
                    try {
                        logger(deepFreeze({
                            hookName: safeHookName,
                            message,
                            stack
                        }));
                    } catch (_loggingError) {
                        // Logging must never let an evaluator failure escape into gameplay.
                    }
                }

                return undefined;
            }
        }

        function getFaultSummary() {
            return deepFreeze({
                totalFaultCount,
                uniqueFaultCount: loggedFaults.size,
                faultsByHook: { ...faultsByHook }
            });
        }

        return Object.freeze({ invoke, getFaultSummary });
    }

    function defaultClock() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    function defaultSessionIdFactory(counter) {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `prediction-session-${Date.now()}-${counter}`;
    }

    function assertMode(mode) {
        if (mode !== 'A' && mode !== 'B') {
            throw new Error(`Unsupported evaluation mode: ${mode}`);
        }
    }

    function assertSourceType(sourceType) {
        if (sourceType !== 'human' && sourceType !== 'synthetic') {
            throw new Error(`Unsupported source type: ${sourceType}`);
        }
    }

    function cloneMatrix(matrix, totalStates) {
        if (!Array.isArray(matrix) || matrix.length !== totalStates) {
            throw new Error(`Snapshot must contain ${totalStates} transition rows`);
        }

        return matrix.map((row, rowIndex) => {
            if (!Array.isArray(row) || row.length !== totalStates) {
                throw new Error(`Transition row ${rowIndex} must contain ${totalStates} entries`);
            }
            return row.map((count, columnIndex) => {
                if (!Number.isFinite(count) || count < 0) {
                    throw new Error(`Invalid transition count at ${rowIndex},${columnIndex}`);
                }
                return count;
            });
        });
    }

    function makeSnapshot(snapshot, totalStates, minTransitions, freezeSnapshot) {
        if (!snapshot) return null;

        const copy = {
            snapshotId: snapshot.snapshotId ?? null,
            totalStates,
            minTransitions: Number.isFinite(snapshot.minTransitions)
                ? snapshot.minTransitions
                : minTransitions,
            totalTransitions: Number.isFinite(snapshot.totalTransitions)
                ? snapshot.totalTransitions
                : 0,
            transitions: cloneMatrix(snapshot.transitions, totalStates)
        };

        return freezeSnapshot ? deepFreeze(copy) : copy;
    }

    function makeEmptySnapshot(totalStates, minTransitions) {
        return {
            snapshotId: null,
            totalStates,
            minTransitions,
            totalTransitions: 0,
            transitions: Array.from(
                { length: totalStates },
                () => new Array(totalStates).fill(0)
            )
        };
    }

    function cloneEvent(event) {
        if (!event) return null;
        return deepFreeze({
            ...event,
            fullProbabilityRow: event.fullProbabilityRow
                ? [...event.fullProbabilityRow]
                : null
        });
    }

    class PredictionEvaluationAdapter {
        constructor(options = {}) {
            this.evaluationMode = (options.evaluationMode || 'B').toUpperCase();
            assertMode(this.evaluationMode);

            this.sourceType = options.sourceType || 'human';
            assertSourceType(this.sourceType);

            this.totalStates = options.totalStates ?? 36;
            this.minTransitions = options.minTransitions ?? 20;
            this.algorithmConfigurationVersion = options.algorithmConfigurationVersion ||
                DEFAULT_ALGORITHM_CONFIGURATION_VERSION;
            this.clock = options.clock || defaultClock;
            this.sessionIdFactory = options.sessionIdFactory || defaultSessionIdFactory;
            this.contextProvider = options.contextProvider || (() => ({}));
            this.lifecycleObserver = options.lifecycleObserver || null;

            this._ledger = [];
            this._openEvent = null;
            this._sessionId = null;
            this._sessionActive = false;
            this._sessionCounter = 0;
            this._eventOrdinal = 0;
            this._positionSerial = 0;
            this._stateEpochId = 0;
            this._currentEpochState = null;
            this._epochOpportunityOpened = false;
            this._lastObservedState = null;
            this._suppressedDuplicateCount = 0;
            this._sessionSuppressedDuplicateCount = 0;

            this._frozenModel = makeSnapshot(
                options.frozenSnapshot,
                this.totalStates,
                this.minTransitions,
                true
            );
            this._onlineModel = options.onlineSnapshot
                ? makeSnapshot(
                    options.onlineSnapshot,
                    this.totalStates,
                    this.minTransitions,
                    false
                )
                : makeEmptySnapshot(this.totalStates, this.minTransitions);
        }

        static createSnapshotFromPredictor(predictor, snapshotId = null) {
            if (!predictor) throw new Error('Predictor is required');
            const totalStates = predictor.TOTAL_STATES;
            return makeSnapshot({
                snapshotId,
                minTransitions: predictor.MIN_TRANSITIONS,
                totalTransitions: predictor.totalTransitions,
                transitions: predictor.transitions
            }, totalStates, predictor.MIN_TRANSITIONS, true);
        }

        loadFrozenSnapshot(snapshot) {
            if (this.evaluationMode !== 'A') {
                throw new Error('Frozen snapshots can only be loaded in Mode A');
            }
            if (this._sessionActive || this._openEvent || this._ledger.length > 0) {
                throw new Error('Frozen snapshot must be loaded before evaluation begins');
            }
            this._frozenModel = makeSnapshot(
                snapshot,
                this.totalStates,
                this.minTransitions,
                true
            );
            return this.getModelSnapshot();
        }

        beginSession(options = {}) {
            if (this._openEvent) this.censorOpenEvent('SESSION_REPLACED');

            this._sessionCounter++;
            this._sessionId = options.sessionId || this.sessionIdFactory(this._sessionCounter);
            this.sourceType = options.sourceType || this.sourceType;
            assertSourceType(this.sourceType);

            this._sessionActive = true;
            this._eventOrdinal = 0;
            this._positionSerial = 0;
            this._stateEpochId = 0;
            this._currentEpochState = null;
            this._epochOpportunityOpened = false;
            this._lastObservedState = null;
            this._sessionSuppressedDuplicateCount = 0;
            this._emit('SESSION_STARTED', {
                sessionId: this._sessionId,
                evaluationMode: this.evaluationMode,
                sourceType: this.sourceType
            });
            return this._sessionId;
        }

        endSession(reason = 'RUN_ENDED') {
            const censored = this.censorOpenEvent(reason);
            this._sessionActive = false;
            return censored;
        }

        observePosition(state) {
            if (!this._sessionActive || !this._isValidState(state)) return false;

            this._positionSerial++;

            if (this._currentEpochState === null || state !== this._currentEpochState) {
                this._stateEpochId++;
                this._currentEpochState = state;
                this._epochOpportunityOpened = false;
            }

            if (this._openEvent) this._resolveOpenEvent(state);

            // Mode B learns only after any stored prediction has been scored.
            if (this.evaluationMode === 'B' && this._lastObservedState !== null) {
                this._onlineModel.transitions[this._lastObservedState][state]++;
                this._onlineModel.totalTransitions++;
            }

            this._lastObservedState = state;
            return true;
        }

        openPredictionOpportunity(details = {}) {
            if (!this._sessionActive || this._currentEpochState === null) return null;

            if (this._epochOpportunityOpened || this._openEvent) {
                this._suppressedDuplicateCount++;
                this._sessionSuppressedDuplicateCount++;
                this._emit('DUPLICATE_SUPPRESSED', {
                    sessionId: this._sessionId,
                    stateEpochId: this._stateEpochId,
                    total: this._suppressedDuplicateCount
                });
                return null;
            }

            this._epochOpportunityOpened = true;

            const context = {
                ...this.contextProvider(),
                ...details
            };
            const model = this.evaluationMode === 'A'
                ? this._frozenModel
                : this._onlineModel;
            const projection = this._projectRow(model, this._currentEpochState);

            this._eventOrdinal++;
            this._openEvent = {
                eventId: `${this._sessionId}:${this._eventOrdinal}`,
                sessionId: this._sessionId,
                evaluationMode: this.evaluationMode,
                sourceType: this.sourceType,
                openedAt: Number.isFinite(context.openedAt) ? context.openedAt : this.clock(),
                resolvedAt: null,
                currentPositionSerial: this._positionSerial,
                nextPositionSerial: null,
                stateEpochId: this._stateEpochId,
                currentState: this._currentEpochState,
                predictedNextState: projection.predictedNextState,
                actualNextState: null,
                correct: null,
                predictionAvailable: projection.predictionAvailable,
                fullProbabilityRow: projection.fullProbabilityRow,
                probabilityAssignedToActualState: null,
                predictionLatencyMs: Number.isFinite(context.predictionLatencyMs)
                    ? context.predictionLatencyMs
                    : null,
                sector: Number.isFinite(context.sector) ? context.sector : null,
                gameTime: Number.isFinite(context.gameTime) ? context.gameTime : null,
                algorithmConfigurationVersion: this.algorithmConfigurationVersion,
                status: STATUS.OPEN
            };

            this._emit('EVENT_OPENED', {
                eventId: this._openEvent.eventId,
                stateEpochId: this._openEvent.stateEpochId,
                currentState: this._openEvent.currentState,
                predictedNextState: this._openEvent.predictedNextState,
                predictionAvailable: this._openEvent.predictionAvailable
            });

            return this.getOpenEvent();
        }

        censorOpenEvent(reason = 'RUN_ENDED') {
            if (!this._openEvent) return null;

            const finalEvent = deepFreeze({
                ...this._openEvent,
                resolvedAt: this.clock(),
                status: STATUS.CENSORED,
                censorReason: reason
            });
            this._ledger.push(finalEvent);
            this._openEvent = null;
            this._emit('EVENT_CENSORED', {
                eventId: finalEvent.eventId,
                reason
            });
            return finalEvent;
        }

        getSessionSummary() {
            const sessionEvents = this._sessionId
                ? this._ledger.filter(event => event.sessionId === this._sessionId)
                : [];
            return deepFreeze({
                sessionId: this._sessionId,
                evaluationMode: this.evaluationMode,
                sourceType: this.sourceType,
                active: this._sessionActive,
                positionCount: this._positionSerial,
                stateEpochCount: this._stateEpochId,
                eventCount: sessionEvents.length + (this._openEvent ? 1 : 0),
                resolvedCount: sessionEvents.filter(event => event.status === STATUS.RESOLVED).length,
                noPredictionCount: sessionEvents.filter(
                    event => event.status === STATUS.NO_PREDICTION
                ).length,
                censoredCount: sessionEvents.filter(event => event.status === STATUS.CENSORED).length,
                openCount: this._openEvent ? 1 : 0,
                suppressedDuplicateCount: this._sessionSuppressedDuplicateCount
            });
        }

        getEvents() {
            return Object.freeze([...this._ledger]);
        }

        getOpenEvent() {
            return cloneEvent(this._openEvent);
        }

        getSuppressedDuplicateCount() {
            return this._suppressedDuplicateCount;
        }

        getModelSnapshot() {
            const model = this.evaluationMode === 'A'
                ? this._frozenModel
                : this._onlineModel;
            if (!model) return null;
            return makeSnapshot(
                model,
                this.totalStates,
                this.minTransitions,
                true
            );
        }

        _resolveOpenEvent(actualState) {
            const open = this._openEvent;
            if (!open) return null;

            const probabilityAssignedToActualState = open.fullProbabilityRow
                ? open.fullProbabilityRow[actualState] ?? 0
                : null;
            const finalEvent = deepFreeze({
                ...open,
                resolvedAt: this.clock(),
                nextPositionSerial: this._positionSerial,
                actualNextState: actualState,
                correct: open.predictionAvailable && open.predictedNextState === actualState,
                probabilityAssignedToActualState,
                status: open.predictionAvailable ? STATUS.RESOLVED : STATUS.NO_PREDICTION
            });

            this._ledger.push(finalEvent);
            this._openEvent = null;
            this._emit('EVENT_FINALIZED', {
                eventId: finalEvent.eventId,
                status: finalEvent.status,
                currentState: finalEvent.currentState,
                predictedNextState: finalEvent.predictedNextState,
                actualNextState: finalEvent.actualNextState,
                correct: finalEvent.correct
            });
            return finalEvent;
        }

        _projectRow(model, currentState) {
            if (!model || model.totalTransitions < this.minTransitions) {
                return {
                    predictionAvailable: false,
                    predictedNextState: null,
                    fullProbabilityRow: null
                };
            }

            const row = model.transitions[currentState];
            const rowTotal = row.reduce((sum, count) => sum + count, 0);
            if (rowTotal <= 0) {
                return {
                    predictionAvailable: false,
                    predictedNextState: null,
                    fullProbabilityRow: null
                };
            }

            const probabilities = row.map(count => count / rowTotal);
            let predictedNextState = 0;
            for (let state = 1; state < probabilities.length; state++) {
                // Strictly greater preserves the lowest numeric state on a tie.
                if (probabilities[state] > probabilities[predictedNextState]) {
                    predictedNextState = state;
                }
            }

            return {
                predictionAvailable: true,
                predictedNextState,
                fullProbabilityRow: Object.freeze(probabilities)
            };
        }

        _isValidState(state) {
            return Number.isInteger(state) && state >= 0 && state < this.totalStates;
        }

        _emit(type, payload) {
            if (typeof this.lifecycleObserver === 'function') {
                this.lifecycleObserver(type, deepFreeze({ ...payload }));
            }
        }
    }

    return Object.freeze({
        PredictionEvaluationAdapter,
        STATUS,
        DEFAULT_ALGORITHM_CONFIGURATION_VERSION,
        createPredictionEvaluationFaultBoundary
    });
});
