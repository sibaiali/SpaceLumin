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

    function downloadBrowserText({ filename, mimeType, content }) {
        if (typeof root.Blob !== 'function' ||
            !root.URL || typeof root.URL.createObjectURL !== 'function') {
            throw new Error('Browser download support is unavailable');
        }

        const blob = new root.Blob([content], { type: mimeType });
        const objectUrl = root.URL.createObjectURL(blob);
        let anchor = null;
        try {
            anchor = root.document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = filename;
            anchor.style.display = 'none';
            root.document.body.appendChild(anchor);
            anchor.click();
        } finally {
            if (anchor && typeof anchor.remove === 'function') anchor.remove();
            if (typeof root.URL.revokeObjectURL === 'function') {
                root.URL.revokeObjectURL(objectUrl);
            }
        }
    }

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
            evaluatorConfigurationVersion: api.DEFAULT_ALGORITHM_CONFIGURATION_VERSION,
            participantLabel: params.get('evaluationParticipant') ||
                api.DEFAULT_PARTICIPANT_LABEL,
            playStyleLabel: params.get('evaluationPlayStyle') ||
                api.DEFAULT_PLAY_STYLE_LABEL,
            sessionNotes: params.get('evaluationNotes') || null,
            buildVersion: params.get('evaluationBuild') || null,
            applicationVersion: 'v4.0 · Elemental Odyssey',
            faultSummaryProvider: faultBoundary.getFaultSummary,
            lifecycleObserver: (type, payload) => {
                console.log(`[PredictionEvaluator] ${type}`, JSON.stringify(payload));
            },
            contextProvider: () => ({
                sector: root.game?.runData?.sector ?? null,
                gameTime: root.game?.runData?.time ?? null
            })
        });
        const evaluator = root.game.predictionEvaluator;
        root.spaceLuminEvaluation = api.createPredictionEvaluationDevelopmentApi({
            adapter: evaluator,
            invokeSafely: faultBoundary.invoke,
            downloader: downloadBrowserText,
            calibrationSnapshotFactory: (snapshotOptions = {}) =>
                api.PredictionEvaluationAdapter.createSnapshotFromPredictor(predictor, {
                    applicationVersion: evaluator.applicationVersion,
                    buildVersion: evaluator.buildVersion,
                    evaluatorConfigurationVersion: evaluator.evaluatorConfigurationVersion,
                    ...snapshotOptions
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
    const CALIBRATION_SNAPSHOT_SCHEMA_VERSION =
        'spacelumin.prediction-calibration/1.0.0';
    const SESSION_METADATA_SCHEMA_VERSION =
        'spacelumin.prediction-session/1.0.0';
    const EXPORT_SCHEMA_VERSION =
        'spacelumin.prediction-export/1.0.0';
    const CONFIGURATION_SCHEMA_VERSION =
        'spacelumin.prediction-evaluator-configuration/1.0.0';
    const DEFAULT_PARTICIPANT_LABEL = 'participant-unknown';
    const DEFAULT_PLAY_STYLE_LABEL = 'play-style-unknown';

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

    function cloneValue(value) {
        if (Array.isArray(value)) return value.map(cloneValue);
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [key, cloneValue(child)])
        );
    }

    function immutableCopy(value) {
        return deepFreeze(cloneValue(value));
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

    function defaultTimestampFactory() {
        return new Date().toISOString();
    }

    function defaultSessionIdFactory(counter) {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `prediction-session-${Date.now()}-${counter}`;
    }

    function defaultSnapshotIdFactory(createdAt) {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `calibration-${crypto.randomUUID()}`;
        }
        const safeTimestamp = String(createdAt).replace(/[^0-9A-Za-z]/g, '');
        return `calibration-${safeTimestamp || Date.now()}`;
    }

    function normalizeTimestamp(value, fallbackFactory) {
        if (typeof value === 'string' && value.trim()) return value.trim();
        return fallbackFactory();
    }

    function normalizeOptionalText(value, maximumLength = 500) {
        if (typeof value !== 'string') return null;
        const normalized = value.trim();
        return normalized ? normalized.slice(0, maximumLength) : null;
    }

    function normalizeParticipantLabel(value) {
        const normalized = normalizeOptionalText(value, 80);
        if (!normalized || !/^participant-[a-z0-9][a-z0-9._-]*$/i.test(normalized)) {
            return DEFAULT_PARTICIPANT_LABEL;
        }
        return normalized;
    }

    function normalizePlayStyleLabel(value) {
        const normalized = normalizeOptionalText(value, 80);
        if (!normalized || !/^[a-z0-9][a-z0-9._-]*$/i.test(normalized)) {
            return DEFAULT_PLAY_STYLE_LABEL;
        }
        return normalized;
    }

    function normalizeSessionId(value) {
        const normalized = normalizeOptionalText(value, 120);
        if (!normalized || !/^[a-z0-9][a-z0-9._-]*$/i.test(normalized)) return null;
        return normalized;
    }

    function finiteOrNull(value) {
        return Number.isFinite(value) ? value : null;
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

    function makeSnapshot(
        snapshot,
        totalStates,
        minTransitions,
        freezeSnapshot,
        defaults = {}
    ) {
        if (!snapshot) return null;

        const transitions = cloneMatrix(snapshot.transitions, totalStates);
        const rowTotals = transitions.map(row => row.reduce((sum, count) => sum + count, 0));
        const normalizedProbabilityRows = transitions.map((row, rowIndex) => {
            const rowTotal = rowTotals[rowIndex];
            return rowTotal > 0 ? row.map(count => count / rowTotal) : null;
        });
        const globalStateCounts = Array.from({ length: totalStates }, (_, state) =>
            transitions.reduce((sum, row) => sum + row[state], 0)
        );
        const derivedTransitionCount = rowTotals.reduce((sum, count) => sum + count, 0);
        const createdAt = normalizeTimestamp(
            snapshot.createdAt || defaults.createdAt,
            defaults.timestampFactory || defaultTimestampFactory
        );
        const snapshotId = snapshot.snapshotId || defaults.snapshotId ||
            (defaults.snapshotIdFactory || defaultSnapshotIdFactory)(createdAt);
        const stateLabels = Array.isArray(snapshot.stateLabels) &&
            snapshot.stateLabels.length === totalStates
            ? snapshot.stateLabels.map(label => String(label))
            : Array.from({ length: totalStates }, (_, state) => String(state));
        const stateVocabulary = Array.isArray(snapshot.stateVocabulary) &&
            snapshot.stateVocabulary.length === totalStates
            ? cloneValue(snapshot.stateVocabulary)
            : Array.from({ length: totalStates }, (_, state) => ({ stateId: state }));

        const copy = {
            schemaVersion: snapshot.schemaVersion || CALIBRATION_SNAPSHOT_SCHEMA_VERSION,
            snapshotId,
            createdAt,
            evaluatorConfigurationVersion: snapshot.evaluatorConfigurationVersion ||
                defaults.evaluatorConfigurationVersion || null,
            sourceModelType: snapshot.sourceModelType || null,
            stateLabels,
            stateVocabulary,
            totalStates,
            minTransitions: Number.isFinite(snapshot.minTransitions)
                ? snapshot.minTransitions
                : minTransitions,
            totalTransitions: Number.isFinite(snapshot.totalTransitions)
                ? snapshot.totalTransitions
                : derivedTransitionCount,
            transitions,
            normalizedProbabilityRows,
            rowTotals,
            globalStateCounts,
            calibrationSessionIds: Array.isArray(snapshot.calibrationSessionIds)
                ? [...snapshot.calibrationSessionIds]
                : null,
            calibrationObservationCount: Number.isFinite(snapshot.calibrationObservationCount)
                ? snapshot.calibrationObservationCount
                : null,
            modelDimensions: cloneValue(snapshot.modelDimensions || {
                hpBrackets: null,
                zoneLevels: null,
                jerkLevels: null,
                totalStates
            }),
            smoothingConfiguration: cloneValue(snapshot.smoothingConfiguration || {
                transitionProbabilitySmoothing: 'none',
                riskEwmAlpha: null
            }),
            applicationVersion: snapshot.applicationVersion || defaults.applicationVersion || null,
            buildVersion: snapshot.buildVersion || defaults.buildVersion || null
        };

        return freezeSnapshot ? deepFreeze(copy) : copy;
    }

    function makeEmptySnapshot(totalStates, minTransitions, defaults = {}) {
        return makeSnapshot({
            snapshotId: null,
            totalStates,
            minTransitions,
            totalTransitions: 0,
            transitions: Array.from(
                { length: totalStates },
                () => new Array(totalStates).fill(0)
            )
        }, totalStates, minTransitions, false, defaults);
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

    function unavailableFaultSummary() {
        return deepFreeze({
            available: false,
            totalFaultCount: null,
            uniqueFaultCount: null,
            faultsByHook: null
        });
    }

    function normalizeFaultSummary(summary) {
        if (!summary || !Number.isFinite(summary.totalFaultCount)) {
            return unavailableFaultSummary();
        }
        return deepFreeze({
            available: true,
            totalFaultCount: summary.totalFaultCount,
            uniqueFaultCount: Number.isFinite(summary.uniqueFaultCount)
                ? summary.uniqueFaultCount
                : null,
            faultsByHook: summary.faultsByHook && typeof summary.faultsByHook === 'object'
                ? { ...summary.faultsByHook }
                : {}
        });
    }

    function faultDelta(start, end) {
        if (!start.available || !end.available) return unavailableFaultSummary();
        const hookNames = new Set([
            ...Object.keys(start.faultsByHook || {}),
            ...Object.keys(end.faultsByHook || {})
        ]);
        const faultsByHook = {};
        for (const hookName of hookNames) {
            const count = (end.faultsByHook[hookName] || 0) -
                (start.faultsByHook[hookName] || 0);
            if (count > 0) faultsByHook[hookName] = count;
        }
        return deepFreeze({
            available: true,
            totalFaultCount: Math.max(0, end.totalFaultCount - start.totalFaultCount),
            uniqueFaultCount: start.uniqueFaultCount === null || end.uniqueFaultCount === null
                ? null
                : Math.max(0, end.uniqueFaultCount - start.uniqueFaultCount),
            faultsByHook
        });
    }

    const EVENT_CSV_COLUMNS = Object.freeze([
        'exportSchemaVersion',
        'exportedAt',
        'eventId',
        'sessionId',
        'participantLabel',
        'playStyleLabel',
        'evaluationMode',
        'sourceType',
        'status',
        'openedAt',
        'resolvedAt',
        'predictionLatencyMs',
        'currentState',
        'predictedNextState',
        'actualNextState',
        'correct',
        'predictionAvailable',
        'probabilityAssignedToActualState',
        'fullProbabilityRow',
        'stateEpochId',
        'currentPositionSerial',
        'nextPositionSerial',
        'sector',
        'gameTime',
        'evaluatorConfigurationVersion',
        'calibrationSnapshotId',
        'sessionNotes',
        'evaluatorFaultCount'
    ]);

    const SESSION_CSV_COLUMNS = Object.freeze([
        'exportSchemaVersion',
        'exportedAt',
        'sessionId',
        'participantLabel',
        'playStyleLabel',
        'evaluationMode',
        'sourceType',
        'calibrationSnapshotId',
        'startTimestamp',
        'endTimestamp',
        'durationMs',
        'startingSector',
        'finalSector',
        'totalEventCount',
        'resolvedCount',
        'noPredictionCount',
        'censoredCount',
        'unresolvedCount',
        'evaluatorFaultCount',
        'evaluatorConfigurationVersion',
        'buildVersion',
        'sessionNotes'
    ]);

    function encodeCsvValue(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'unavailable';
        const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
        if (/[",\r\n]/.test(serialized)) {
            return `"${serialized.replace(/"/g, '""')}"`;
        }
        return serialized;
    }

    function sanitizeFilenamePart(value) {
        const normalized = String(value || 'session-unknown')
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^[-_]+|[-_]+$/g, '')
            .slice(0, 80);
        return normalized || 'session-unknown';
    }

    function exportFilename(kind, sessionId, extension) {
        return `spacelumin-${kind}-${sanitizeFilenamePart(sessionId)}.${extension}`;
    }

    function createPredictionEvaluationDevelopmentApi(options = {}) {
        const adapter = options.adapter;
        const invokeSafely = options.invokeSafely || ((_hookName, callback) => callback());
        const downloader = options.downloader || (() => {
            throw new Error('Browser download support is unavailable');
        });
        const calibrationSnapshotFactory = options.calibrationSnapshotFactory || null;

        if (!adapter) throw new Error('Evaluation adapter is required');

        function invoke(methodName, callback) {
            return invokeSafely(`development-api.${methodName}`, callback);
        }

        function resolveSessionId(sessionId) {
            return sessionId || adapter.getSessionSummary().sessionId;
        }

        function download(kind, extension, mimeType, contentFactory, sessionId, exportOptions) {
            return invoke(`download-${kind}`, () => {
                const resolvedSessionId = resolveSessionId(sessionId);
                const content = contentFactory(resolvedSessionId, exportOptions || {});
                const filename = exportFilename(kind, resolvedSessionId, extension);
                downloader({ filename, mimeType, content });
                return filename;
            });
        }

        return Object.freeze({
            setSessionMetadata(metadata = {}) {
                return invoke('set-session-metadata', () =>
                    adapter.setSessionMetadata(metadata)
                );
            },
            startSession(sessionOptions = {}) {
                return invoke('start-session', () => adapter.beginSession(sessionOptions));
            },
            endSession(reason = 'DEVELOPMENT_API_END', sessionOptions = {}) {
                return invoke('end-session', () => adapter.endSession(reason, sessionOptions));
            },
            createCalibrationSnapshot(snapshotOptions = {}) {
                return invoke('create-calibration-snapshot', () => {
                    if (typeof calibrationSnapshotFactory !== 'function') {
                        throw new Error('Calibration snapshot creation is unavailable');
                    }
                    return immutableCopy(calibrationSnapshotFactory(snapshotOptions));
                });
            },
            loadCalibrationSnapshot(snapshot) {
                return invoke('load-calibration-snapshot', () =>
                    adapter.loadFrozenSnapshot(snapshot)
                );
            },
            exportJSON(sessionId, exportOptions = {}) {
                return invoke('export-json', () =>
                    adapter.exportSessionJSON(resolveSessionId(sessionId), exportOptions)
                );
            },
            exportEventsCSV(sessionId, exportOptions = {}) {
                return invoke('export-events-csv', () =>
                    adapter.exportEventsCSV(resolveSessionId(sessionId), exportOptions)
                );
            },
            exportSessionCSV(sessionId, exportOptions = {}) {
                return invoke('export-session-csv', () =>
                    adapter.exportSessionCSV(resolveSessionId(sessionId), exportOptions)
                );
            },
            downloadJSON(sessionId, exportOptions = {}) {
                return download(
                    'evaluation',
                    'json',
                    'application/json;charset=utf-8',
                    (resolvedSessionId, resolvedOptions) =>
                        adapter.exportSessionJSON(resolvedSessionId, resolvedOptions),
                    sessionId,
                    exportOptions
                );
            },
            downloadEventsCSV(sessionId, exportOptions = {}) {
                return download(
                    'events',
                    'csv',
                    'text/csv;charset=utf-8',
                    (resolvedSessionId, resolvedOptions) =>
                        adapter.exportEventsCSV(resolvedSessionId, resolvedOptions),
                    sessionId,
                    exportOptions
                );
            },
            downloadSessionCSV(sessionId, exportOptions = {}) {
                return download(
                    'session',
                    'csv',
                    'text/csv;charset=utf-8',
                    (resolvedSessionId, resolvedOptions) =>
                        adapter.exportSessionCSV(resolvedSessionId, resolvedOptions),
                    sessionId,
                    exportOptions
                );
            }
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
            this.evaluatorConfigurationVersion = options.evaluatorConfigurationVersion ||
                this.algorithmConfigurationVersion;
            this.clock = options.clock || defaultClock;
            this.timestampFactory = options.timestampFactory || defaultTimestampFactory;
            this.sessionIdFactory = options.sessionIdFactory || defaultSessionIdFactory;
            this.snapshotIdFactory = options.snapshotIdFactory || defaultSnapshotIdFactory;
            this.contextProvider = options.contextProvider || (() => ({}));
            this.lifecycleObserver = options.lifecycleObserver || null;
            this.faultSummaryProvider = options.faultSummaryProvider || null;
            this.participantLabel = normalizeParticipantLabel(options.participantLabel);
            this.playStyleLabel = normalizePlayStyleLabel(options.playStyleLabel);
            this.sessionNotes = normalizeOptionalText(options.sessionNotes);
            this.nextSessionId = normalizeSessionId(options.sessionId);
            this.applicationVersion = normalizeOptionalText(options.applicationVersion, 120);
            this.buildVersion = normalizeOptionalText(options.buildVersion, 120);

            this._ledger = [];
            this._sessionRecords = new Map();
            this._activeSession = null;
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
                true,
                this._snapshotDefaults()
            );
            this._onlineModel = options.onlineSnapshot
                ? makeSnapshot(
                    options.onlineSnapshot,
                    this.totalStates,
                    this.minTransitions,
                    false,
                    this._snapshotDefaults()
                )
                : makeEmptySnapshot(
                    this.totalStates,
                    this.minTransitions,
                    this._snapshotDefaults()
                );
        }

        static createSnapshotFromPredictor(predictor, snapshotOptions = {}) {
            if (!predictor) throw new Error('Predictor is required');
            const totalStates = predictor.TOTAL_STATES;
            const options = typeof snapshotOptions === 'string'
                ? { snapshotId: snapshotOptions }
                : (snapshotOptions || {});
            const dimensionsAvailable = Number.isFinite(predictor.HP_BRACKETS) &&
                Number.isFinite(predictor.ZONE_LEVELS) &&
                Number.isFinite(predictor.JERK_LEVELS) &&
                predictor.ZONE_LEVELS > 0 && predictor.JERK_LEVELS > 0;
            const stateVocabulary = Array.from({ length: totalStates }, (_, stateId) => {
                if (!dimensionsAvailable) {
                    return {
                        stateId,
                        hpBracket: null,
                        zoneBracket: null,
                        jerkBracket: null
                    };
                }
                const jerkBracket = stateId % predictor.JERK_LEVELS;
                const remaining = Math.floor(stateId / predictor.JERK_LEVELS);
                const zoneBracket = remaining % predictor.ZONE_LEVELS;
                const hpBracket = Math.floor(remaining / predictor.ZONE_LEVELS);
                return { stateId, hpBracket, zoneBracket, jerkBracket };
            });
            return makeSnapshot({
                schemaVersion: CALIBRATION_SNAPSHOT_SCHEMA_VERSION,
                snapshotId: options.snapshotId || null,
                createdAt: options.createdAt || null,
                evaluatorConfigurationVersion: options.evaluatorConfigurationVersion ||
                    DEFAULT_ALGORITHM_CONFIGURATION_VERSION,
                sourceModelType: 'PredictiveAI.MarkovTransitionCounts',
                stateLabels: Array.from({ length: totalStates }, (_, state) => String(state)),
                stateVocabulary,
                minTransitions: predictor.MIN_TRANSITIONS,
                totalTransitions: predictor.totalTransitions,
                transitions: predictor.transitions,
                calibrationSessionIds: Array.isArray(options.calibrationSessionIds)
                    ? options.calibrationSessionIds
                    : null,
                calibrationObservationCount: Number.isFinite(options.calibrationObservationCount)
                    ? options.calibrationObservationCount
                    : null,
                modelDimensions: {
                    hpBrackets: finiteOrNull(predictor.HP_BRACKETS),
                    zoneLevels: finiteOrNull(predictor.ZONE_LEVELS),
                    jerkLevels: finiteOrNull(predictor.JERK_LEVELS),
                    totalStates
                },
                smoothingConfiguration: {
                    transitionProbabilitySmoothing: 'none',
                    riskEwmAlpha: finiteOrNull(predictor.EWM_ALPHA)
                },
                applicationVersion: options.applicationVersion || null,
                buildVersion: options.buildVersion || null
            }, totalStates, predictor.MIN_TRANSITIONS, true, {
                timestampFactory: options.timestampFactory || defaultTimestampFactory,
                snapshotIdFactory: options.snapshotIdFactory || defaultSnapshotIdFactory,
                evaluatorConfigurationVersion: options.evaluatorConfigurationVersion ||
                    DEFAULT_ALGORITHM_CONFIGURATION_VERSION,
                applicationVersion: options.applicationVersion || null,
                buildVersion: options.buildVersion || null
            });
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
                true,
                this._snapshotDefaults()
            );
            return this.getModelSnapshot();
        }

        setSessionMetadata(metadata = {}) {
            if (this._sessionActive) {
                throw new Error('Session metadata can only be changed between sessions');
            }
            const nextSourceType = metadata.sourceType === undefined
                ? this.sourceType
                : metadata.sourceType;
            assertSourceType(nextSourceType);
            const nextParticipantLabel = metadata.participantLabel === undefined
                ? this.participantLabel
                : normalizeParticipantLabel(metadata.participantLabel);
            const nextPlayStyleLabel = metadata.playStyleLabel === undefined
                ? this.playStyleLabel
                : normalizePlayStyleLabel(metadata.playStyleLabel);
            const nextNotes = metadata.notes === undefined &&
                metadata.sessionNotes === undefined
                ? this.sessionNotes
                : normalizeOptionalText(
                    metadata.notes === undefined ? metadata.sessionNotes : metadata.notes
                );
            const nextBuildVersion = metadata.buildVersion === undefined
                ? this.buildVersion
                : normalizeOptionalText(metadata.buildVersion, 120);
            const nextSessionId = metadata.sessionId === undefined
                ? this.nextSessionId
                : normalizeSessionId(metadata.sessionId);
            if (metadata.sessionId !== undefined && !nextSessionId) {
                throw new Error('Session ID must use letters, numbers, dots, underscores, or hyphens');
            }

            this.sourceType = nextSourceType;
            this.participantLabel = nextParticipantLabel;
            this.playStyleLabel = nextPlayStyleLabel;
            this.sessionNotes = nextNotes;
            this.buildVersion = nextBuildVersion;
            this.nextSessionId = nextSessionId;

            return deepFreeze({
                sessionId: this.nextSessionId,
                participantLabel: this.participantLabel,
                playStyleLabel: this.playStyleLabel,
                sourceType: this.sourceType,
                buildVersion: this.buildVersion,
                notes: this.sessionNotes
            });
        }

        beginSession(options = {}) {
            if (this._sessionActive) {
                this.endSession('SESSION_REPLACED');
            } else if (this._openEvent) {
                this.censorOpenEvent('SESSION_REPLACED');
            }

            this._sessionCounter++;
            this._sessionId = options.sessionId || this.nextSessionId ||
                this.sessionIdFactory(this._sessionCounter);
            this.nextSessionId = null;
            const sessionSourceType = options.sourceType || this.sourceType;
            assertSourceType(sessionSourceType);
            this.sourceType = sessionSourceType;

            const context = {
                ...this.contextProvider(),
                ...options.context
            };
            const startTimestamp = normalizeTimestamp(
                options.startTimestamp,
                this.timestampFactory
            );
            const startClock = this.clock();
            const participantLabel = normalizeParticipantLabel(
                options.participantLabel || this.participantLabel
            );
            const playStyleLabel = normalizePlayStyleLabel(
                options.playStyleLabel || this.playStyleLabel
            );
            const notes = normalizeOptionalText(
                options.notes === undefined ? this.sessionNotes : options.notes
            );
            const buildVersion = normalizeOptionalText(
                options.buildVersion || this.buildVersion,
                120
            );
            const calibrationSnapshot = this.evaluationMode === 'A'
                ? this._frozenModel
                : this.getModelSnapshot();
            const lockedStartMetadata = deepFreeze({
                schemaVersion: SESSION_METADATA_SCHEMA_VERSION,
                sessionId: this._sessionId,
                participantLabel,
                playStyleLabel,
                evaluationMode: this.evaluationMode,
                sourceType: sessionSourceType,
                startTimestamp,
                applicationVersion: this.applicationVersion,
                buildVersion,
                evaluatorConfigurationVersion: this.evaluatorConfigurationVersion,
                calibrationSnapshotId: calibrationSnapshot?.snapshotId ?? null,
                startingSector: Number.isFinite(options.startingSector)
                    ? options.startingSector
                    : finiteOrNull(context.sector),
                notes
            });
            this._activeSession = {
                lockedStartMetadata,
                startClock,
                calibrationSnapshot,
                configuration: this._configurationForSession(sessionSourceType, buildVersion),
                faultStart: this._readFaultSummary()
            };

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
                sourceType: sessionSourceType,
                calibrationSnapshotId: lockedStartMetadata.calibrationSnapshotId
            });
            return this._sessionId;
        }

        endSession(reason = 'RUN_ENDED', options = {}) {
            if (!this._sessionActive || !this._activeSession) return null;

            const censored = this.censorOpenEvent(reason);
            const context = {
                ...this.contextProvider(),
                ...options.context
            };
            const endTimestamp = normalizeTimestamp(options.endTimestamp, this.timestampFactory);
            const endClock = this.clock();
            const faults = faultDelta(
                this._activeSession.faultStart,
                this._readFaultSummary()
            );
            const session = this._buildSessionMetadata({
                endTimestamp,
                endClock,
                finalSector: Number.isFinite(options.finalSector)
                    ? options.finalSector
                    : finiteOrNull(context.sector),
                reason,
                faults
            });
            const record = deepFreeze({
                session,
                configuration: immutableCopy(this._activeSession.configuration),
                calibrationSnapshot: this._activeSession.calibrationSnapshot
                    ? immutableCopy(this._activeSession.calibrationSnapshot)
                    : null,
                faults: immutableCopy(faults),
                notes: deepFreeze({ sessionNotes: session.notes })
            });
            this._sessionRecords.set(this._sessionId, record);
            this._sessionActive = false;
            this._activeSession = null;
            this._emit('SESSION_ENDED', {
                sessionId: this._sessionId,
                reason,
                totalEventCount: session.totalEventCount
            });
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
                ? (this._activeSession?.calibrationSnapshot || this._frozenModel)
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
            if (!this._sessionId) {
                return deepFreeze({
                    sessionId: null,
                    evaluationMode: this.evaluationMode,
                    sourceType: this.sourceType,
                    active: false,
                    positionCount: 0,
                    stateEpochCount: 0,
                    eventCount: 0,
                    resolvedCount: 0,
                    noPredictionCount: 0,
                    censoredCount: 0,
                    openCount: 0,
                    unresolvedCount: 0,
                    suppressedDuplicateCount: 0
                });
            }

            const sessionEvents = this._sessionEvents(this._sessionId);
            const openCount = this._sessionActive && this._openEvent ? 1 : 0;
            return deepFreeze({
                sessionId: this._sessionId,
                evaluationMode: this.evaluationMode,
                sourceType: this.sourceType,
                active: this._sessionActive,
                positionCount: this._positionSerial,
                stateEpochCount: this._stateEpochId,
                eventCount: sessionEvents.length + openCount,
                resolvedCount: sessionEvents.filter(event => event.status === STATUS.RESOLVED).length,
                noPredictionCount: sessionEvents.filter(
                    event => event.status === STATUS.NO_PREDICTION
                ).length,
                censoredCount: sessionEvents.filter(event => event.status === STATUS.CENSORED).length,
                openCount,
                unresolvedCount: openCount,
                suppressedDuplicateCount: this._sessionSuppressedDuplicateCount
            });
        }

        getSessionMetadata(sessionId = this._sessionId) {
            if (!sessionId) return null;
            const stored = this._sessionRecords.get(sessionId);
            if (stored) return immutableCopy(stored.session);
            if (!this._sessionActive || sessionId !== this._sessionId) return null;

            const faults = faultDelta(
                this._activeSession.faultStart,
                this._readFaultSummary()
            );
            return immutableCopy(this._buildSessionMetadata({ faults }));
        }

        getSessionIds() {
            const sessionIds = [...this._sessionRecords.keys()];
            if (this._sessionActive && this._sessionId) sessionIds.push(this._sessionId);
            return Object.freeze(sessionIds);
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
                true,
                this._snapshotDefaults()
            );
        }

        exportSession(sessionId = this._sessionId, options = {}) {
            const record = this._exportRecordForSession(sessionId);
            const exportedAt = normalizeTimestamp(options.exportedAt, this.timestampFactory);
            const events = this._sessionEvents(sessionId).map(cloneValue);
            if (this._sessionActive && sessionId === this._sessionId && this._openEvent) {
                events.push(cloneValue(this._openEvent));
            }
            const payload = {
                schemaVersion: EXPORT_SCHEMA_VERSION,
                exportedAt,
                session: cloneValue(record.session),
                configuration: cloneValue(record.configuration),
                calibrationSnapshot: record.calibrationSnapshot
                    ? cloneValue(record.calibrationSnapshot)
                    : null,
                events,
                faults: cloneValue(record.faults),
                notes: cloneValue(record.notes)
            };
            return deepFreeze(payload);
        }

        exportSessionJSON(sessionId = this._sessionId, options = {}) {
            return JSON.stringify(this.exportSession(sessionId, options), null, 2);
        }

        exportSessionJson(sessionId = this._sessionId, options = {}) {
            return this.exportSessionJSON(sessionId, options);
        }

        exportEventsCSV(sessionId = this._sessionId, options = {}) {
            const payload = this.exportSession(sessionId, options);
            const lines = [EVENT_CSV_COLUMNS.join(',')];

            for (const event of payload.events) {
                const row = {
                    exportSchemaVersion: payload.schemaVersion,
                    exportedAt: payload.exportedAt,
                    eventId: event.eventId,
                    sessionId: payload.session.sessionId,
                    participantLabel: payload.session.participantLabel,
                    playStyleLabel: payload.session.playStyleLabel,
                    evaluationMode: payload.session.evaluationMode,
                    sourceType: payload.session.sourceType,
                    status: event.status,
                    openedAt: event.openedAt,
                    resolvedAt: event.resolvedAt,
                    predictionLatencyMs: event.predictionLatencyMs,
                    currentState: event.currentState,
                    predictedNextState: event.predictedNextState,
                    actualNextState: event.actualNextState,
                    correct: event.correct,
                    predictionAvailable: event.predictionAvailable,
                    probabilityAssignedToActualState:
                        event.probabilityAssignedToActualState,
                    fullProbabilityRow: event.fullProbabilityRow,
                    stateEpochId: event.stateEpochId,
                    currentPositionSerial: event.currentPositionSerial,
                    nextPositionSerial: event.nextPositionSerial,
                    sector: event.sector,
                    gameTime: event.gameTime,
                    evaluatorConfigurationVersion:
                        payload.session.evaluatorConfigurationVersion,
                    calibrationSnapshotId: payload.session.calibrationSnapshotId,
                    sessionNotes: payload.notes.sessionNotes,
                    evaluatorFaultCount: payload.session.evaluatorFaultCount
                };
                lines.push(
                    EVENT_CSV_COLUMNS.map(column => encodeCsvValue(row[column])).join(',')
                );
            }

            return lines.join('\r\n');
        }

        exportSessionCSV(sessionId = this._sessionId, options = {}) {
            const payload = this.exportSession(sessionId, options);
            const row = {
                exportSchemaVersion: payload.schemaVersion,
                exportedAt: payload.exportedAt,
                sessionId: payload.session.sessionId,
                participantLabel: payload.session.participantLabel,
                playStyleLabel: payload.session.playStyleLabel,
                evaluationMode: payload.session.evaluationMode,
                sourceType: payload.session.sourceType,
                calibrationSnapshotId: payload.session.calibrationSnapshotId,
                startTimestamp: payload.session.startTimestamp,
                endTimestamp: payload.session.endTimestamp,
                durationMs: payload.session.durationMs,
                startingSector: payload.session.startingSector,
                finalSector: payload.session.finalSector,
                totalEventCount: payload.session.totalEventCount,
                resolvedCount: payload.session.resolvedCount,
                noPredictionCount: payload.session.noPredictionCount,
                censoredCount: payload.session.censoredCount,
                unresolvedCount: payload.session.unresolvedCount,
                evaluatorFaultCount: payload.session.evaluatorFaultCount,
                evaluatorConfigurationVersion:
                    payload.session.evaluatorConfigurationVersion,
                buildVersion: payload.session.buildVersion,
                sessionNotes: payload.notes.sessionNotes
            };
            return [
                SESSION_CSV_COLUMNS.join(','),
                SESSION_CSV_COLUMNS.map(column => encodeCsvValue(row[column])).join(',')
            ].join('\r\n');
        }

        _exportRecordForSession(sessionId) {
            const stored = this._sessionRecords.get(sessionId);
            if (stored) return stored;
            if (!this._sessionActive || sessionId !== this._sessionId || !this._activeSession) {
                throw new Error('Unknown evaluation session');
            }

            const faults = faultDelta(
                this._activeSession.faultStart,
                this._readFaultSummary()
            );
            return deepFreeze({
                session: this._buildSessionMetadata({ faults }),
                configuration: immutableCopy(this._activeSession.configuration),
                calibrationSnapshot: this._activeSession.calibrationSnapshot
                    ? immutableCopy(this._activeSession.calibrationSnapshot)
                    : null,
                faults: immutableCopy(faults),
                notes: deepFreeze({
                    sessionNotes: this._activeSession.lockedStartMetadata.notes
                })
            });
        }

        _snapshotDefaults() {
            return {
                timestampFactory: this.timestampFactory,
                snapshotIdFactory: this.snapshotIdFactory,
                evaluatorConfigurationVersion: this.evaluatorConfigurationVersion,
                applicationVersion: this.applicationVersion,
                buildVersion: this.buildVersion
            };
        }

        _configurationForSession(sourceType, buildVersion) {
            return deepFreeze({
                schemaVersion: CONFIGURATION_SCHEMA_VERSION,
                evaluatorConfigurationVersion: this.evaluatorConfigurationVersion,
                algorithmConfigurationVersion: this.algorithmConfigurationVersion,
                evaluationMode: this.evaluationMode,
                sourceType,
                totalStates: this.totalStates,
                minTransitions: this.minTransitions,
                predictionTarget: 'next-position-observation',
                deduplicationPolicy: 'state-epoch',
                probabilityNormalization: 'row-counts-divided-by-row-total',
                transitionProbabilitySmoothing: 'none',
                top1TieBreak: 'lowest-numeric-state',
                applicationVersion: this.applicationVersion,
                buildVersion
            });
        }

        _readFaultSummary() {
            if (typeof this.faultSummaryProvider !== 'function') {
                return unavailableFaultSummary();
            }
            return normalizeFaultSummary(this.faultSummaryProvider());
        }

        _sessionEvents(sessionId) {
            return this._ledger.filter(event => event.sessionId === sessionId);
        }

        _buildSessionMetadata(options = {}) {
            if (!this._activeSession) return null;
            const start = this._activeSession.lockedStartMetadata;
            const sessionEvents = this._sessionEvents(start.sessionId);
            const openCount = this._sessionActive && this._openEvent ? 1 : 0;
            const faults = options.faults || faultDelta(
                this._activeSession.faultStart,
                this._readFaultSummary()
            );
            const durationMs = Number.isFinite(options.endClock) &&
                Number.isFinite(this._activeSession.startClock)
                ? Math.max(0, options.endClock - this._activeSession.startClock)
                : null;

            return deepFreeze({
                schemaVersion: start.schemaVersion,
                sessionId: start.sessionId,
                participantLabel: start.participantLabel,
                playStyleLabel: start.playStyleLabel,
                evaluationMode: start.evaluationMode,
                sourceType: start.sourceType,
                startTimestamp: start.startTimestamp,
                endTimestamp: options.endTimestamp || null,
                durationMs,
                applicationVersion: start.applicationVersion,
                buildVersion: start.buildVersion,
                evaluatorConfigurationVersion: start.evaluatorConfigurationVersion,
                calibrationSnapshotId: start.calibrationSnapshotId,
                startingSector: start.startingSector,
                finalSector: finiteOrNull(options.finalSector),
                totalEventCount: sessionEvents.length + openCount,
                resolvedCount: sessionEvents.filter(
                    event => event.status === STATUS.RESOLVED
                ).length,
                censoredCount: sessionEvents.filter(
                    event => event.status === STATUS.CENSORED
                ).length,
                noPredictionCount: sessionEvents.filter(
                    event => event.status === STATUS.NO_PREDICTION
                ).length,
                unresolvedCount: openCount,
                evaluatorFaultCount: faults.available ? faults.totalFaultCount : null,
                endReason: options.reason || null,
                notes: start.notes
            });
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
        CALIBRATION_SNAPSHOT_SCHEMA_VERSION,
        SESSION_METADATA_SCHEMA_VERSION,
        EXPORT_SCHEMA_VERSION,
        DEFAULT_PARTICIPANT_LABEL,
        DEFAULT_PLAY_STYLE_LABEL,
        EVENT_CSV_COLUMNS,
        SESSION_CSV_COLUMNS,
        createPredictionEvaluationDevelopmentApi,
        createPredictionEvaluationFaultBoundary
    });
});
