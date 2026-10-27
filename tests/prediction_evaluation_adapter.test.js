'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { URLSearchParams } = require('node:url');
const {
    PredictionEvaluationAdapter,
    STATUS,
    EVENT_CSV_COLUMNS,
    SESSION_CSV_COLUMNS,
    createPredictionEvaluationDevelopmentApi,
    createPredictionEvaluationFaultBoundary
} = require('../js/PredictionEvaluationAdapter.js');

const browserAdapterSource = fs.readFileSync(
    require.resolve('../js/PredictionEvaluationAdapter.js'),
    'utf8'
);

function loadBrowserAdapter(search) {
    const logs = [];
    const downloads = [];
    class TestBlob {
        constructor(parts, options) {
            this.parts = parts;
            this.type = options.type;
        }
    }
    const context = {
        URLSearchParams,
        location: { search },
        Blob: TestBlob,
        URL: {
            createObjectURL: blob => {
                context.lastBlob = blob;
                return 'blob:test-download';
            },
            revokeObjectURL: url => {
                context.revokedObjectUrl = url;
            }
        },
        document: {
            documentElement: { dataset: {} },
            body: { appendChild: () => {} },
            createElement: () => ({
                href: '',
                download: '',
                style: {},
                click() {
                    downloads.push({ filename: this.download, href: this.href });
                },
                remove() {}
            })
        },
        performance: { now: () => 1 },
        console: {
            log: (...args) => logs.push(['log', ...args]),
            error: (...args) => logs.push(['error', ...args])
        },
        game: {
            runData: null
        },
        predictiveAI: {
            TOTAL_STATES: 3,
            MIN_TRANSITIONS: 1,
            totalTransitions: 0,
            transitions: matrix(3)
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(browserAdapterSource, context);
    return { context, logs, downloads };
}

function parseCsv(csv) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < csv.length; index++) {
        const character = csv[index];
        if (quoted) {
            if (character === '"' && csv[index + 1] === '"') {
                value += '"';
                index++;
            } else if (character === '"') {
                quoted = false;
            } else {
                value += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(value);
            value = '';
        } else if (character === '\r' && csv[index + 1] === '\n') {
            row.push(value);
            rows.push(row);
            row = [];
            value = '';
            index++;
        } else {
            value += character;
        }
    }
    row.push(value);
    rows.push(row);
    return rows;
}

function matrix(size) {
    return Array.from({ length: size }, () => new Array(size).fill(0));
}

function snapshot(size, edges = [], totalTransitions = 20) {
    const transitions = matrix(size);
    for (const [from, to, count] of edges) transitions[from][to] = count;
    return {
        snapshotId: 'test-calibration',
        totalStates: size,
        minTransitions: 1,
        totalTransitions,
        transitions
    };
}

function adapterOptions(overrides = {}) {
    let time = 100;
    return {
        totalStates: 3,
        minTransitions: 1,
        clock: () => ++time,
        sessionIdFactory: counter => `session-${counter}`,
        ...overrides
    };
}

function openAndResolve(adapter, currentState, actualState) {
    adapter.beginSession();
    adapter.observePosition(currentState);
    adapter.openPredictionOpportunity({
        predictionLatencyMs: 0.25,
        sector: 2,
        gameTime: 12.5
    });
    adapter.observePosition(actualState);
    return adapter.getEvents()[0];
}

const tests = [
    ['correct prediction resolution', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 3], [0, 2, 1]])
        }));
        const event = openAndResolve(adapter, 0, 1);

        assert.equal(event.status, STATUS.RESOLVED);
        assert.equal(event.predictedNextState, 1);
        assert.equal(event.actualNextState, 1);
        assert.equal(event.correct, true);
        assert.equal(event.probabilityAssignedToActualState, 0.75);
        assert.equal(event.currentPositionSerial, 1);
        assert.equal(event.nextPositionSerial, 2);
    }],

    ['incorrect prediction resolution', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 4], [0, 2, 1]])
        }));
        const event = openAndResolve(adapter, 0, 2);

        assert.equal(event.status, STATUS.RESOLVED);
        assert.equal(event.predictedNextState, 1);
        assert.equal(event.actualNextState, 2);
        assert.equal(event.correct, false);
        assert.equal(event.probabilityAssignedToActualState, 0.2);
    }],

    ['missing transition row', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3)
        }));
        const event = openAndResolve(adapter, 0, 1);

        assert.equal(event.status, STATUS.NO_PREDICTION);
        assert.equal(event.predictionAvailable, false);
        assert.equal(event.predictedNextState, null);
        assert.equal(event.fullProbabilityRow, null);
        assert.equal(event.correct, false);
    }],

    ['repeated same-state observations stay in one epoch', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 0, 5]])
        }));
        adapter.beginSession();
        adapter.observePosition(0);
        adapter.openPredictionOpportunity();
        adapter.observePosition(0);
        adapter.observePosition(0);
        adapter.openPredictionOpportunity();

        assert.equal(adapter.getEvents().length, 1);
        assert.equal(adapter.getSessionSummary().stateEpochCount, 1);
        assert.equal(adapter.getSuppressedDuplicateCount(), 1);
    }],

    ['duplicate prediction calls in one epoch are suppressed', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 5]])
        }));
        adapter.beginSession();
        adapter.observePosition(0);

        assert.ok(adapter.openPredictionOpportunity());
        assert.equal(adapter.openPredictionOpportunity(), null);
        assert.equal(adapter.getSuppressedDuplicateCount(), 1);

        adapter.observePosition(1);
        assert.equal(adapter.getEvents().length, 1);
    }],

    ['run ending censors an open event without erasing ledger history', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 5]])
        }));
        adapter.beginSession();
        adapter.observePosition(0);
        adapter.openPredictionOpportunity();
        const censored = adapter.endSession('TEST_RUN_END');

        assert.equal(censored.status, STATUS.CENSORED);
        assert.equal(censored.actualNextState, null);
        assert.equal(censored.correct, null);
        assert.ok(Object.isFrozen(censored));

        adapter.beginSession();
        assert.equal(adapter.getEvents().length, 1);
    }],

    ['Mode A snapshot remains immutable and isolated', () => {
        const calibration = snapshot(3, [[0, 1, 5]]);
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: calibration
        }));
        const frozenBefore = adapter.getModelSnapshot();

        calibration.transitions[0][1] = 0;
        openAndResolve(adapter, 0, 1);

        assert.equal(adapter.getEvents()[0].predictedNextState, 1);
        assert.throws(
            () => adapter.loadFrozenSnapshot(snapshot(3, [[0, 2, 9]])),
            /before evaluation begins/
        );
        assert.deepEqual(adapter.getModelSnapshot(), frozenBefore);
        assert.ok(Object.isFrozen(adapter.getModelSnapshot()));
        assert.ok(Object.isFrozen(adapter.getModelSnapshot().transitions[0]));
    }],

    ['Mode B updates only after scoring the stored distribution', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'B',
            onlineSnapshot: snapshot(3, [[0, 1, 20]])
        }));
        adapter.beginSession();
        adapter.observePosition(0);
        adapter.openPredictionOpportunity();

        assert.equal(adapter.getModelSnapshot().transitions[0][2], 0);
        adapter.observePosition(2);

        const event = adapter.getEvents()[0];
        assert.equal(event.fullProbabilityRow[2], 0);
        assert.equal(event.probabilityAssignedToActualState, 0);
        assert.equal(event.correct, false);
        assert.equal(adapter.getModelSnapshot().transitions[0][2], 1);
        assert.equal(adapter.getModelSnapshot().totalTransitions, 21);
    }],

    ['resolved event cannot be scored or mutated twice', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 5]])
        }));
        const event = openAndResolve(adapter, 0, 1);
        adapter.observePosition(2);

        assert.equal(adapter.getEvents().length, 1);
        assert.strictEqual(adapter.getEvents()[0], event);
        assert.ok(Object.isFrozen(event));
        assert.throws(() => {
            event.correct = false;
        }, TypeError);
    }],

    ['production predictor state remains unchanged', () => {
        const productionPredictor = {
            TOTAL_STATES: 3,
            MIN_TRANSITIONS: 1,
            totalTransitions: 5,
            transitions: snapshot(3, [[0, 1, 5]], 5).transitions,
            collisionRisk: 0.2,
            missedBurstRisk: 0.3,
            panicRisk: 0.4
        };
        const productionBefore = JSON.parse(JSON.stringify(productionPredictor));
        const safeSnapshot = PredictionEvaluationAdapter.createSnapshotFromPredictor(
            productionPredictor,
            'production-copy'
        );
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'B',
            onlineSnapshot: safeSnapshot
        }));

        openAndResolve(adapter, 0, 2);
        assert.deepEqual(productionPredictor, productionBefore);
    }],

    ['calibration snapshot contains immutable derived model data', () => {
        const productionPredictor = {
            HP_BRACKETS: 1,
            ZONE_LEVELS: 1,
            JERK_LEVELS: 3,
            TOTAL_STATES: 3,
            MIN_TRANSITIONS: 1,
            EWM_ALPHA: 0.3,
            totalTransitions: 5,
            transitions: snapshot(3, [[0, 1, 3], [0, 2, 2]], 5).transitions
        };
        const calibration = PredictionEvaluationAdapter.createSnapshotFromPredictor(
            productionPredictor,
            {
                snapshotId: 'snapshot-explicit',
                createdAt: '2026-07-20T08:00:00.000Z',
                calibrationSessionIds: ['calibration-session-1'],
                calibrationObservationCount: 5,
                applicationVersion: 'v4.0',
                buildVersion: '40cce33'
            }
        );

        assert.equal(calibration.snapshotId, 'snapshot-explicit');
        assert.equal(calibration.sourceModelType, 'PredictiveAI.MarkovTransitionCounts');
        assert.deepEqual(calibration.stateLabels, ['0', '1', '2']);
        assert.deepEqual(calibration.rowTotals, [5, 0, 0]);
        assert.deepEqual(calibration.globalStateCounts, [0, 3, 2]);
        assert.deepEqual(calibration.normalizedProbabilityRows[0], [0, 0.6, 0.4]);
        assert.equal(calibration.normalizedProbabilityRows[1], null);
        assert.equal(calibration.stateVocabulary[2].jerkBracket, 2);
        assert.equal(
            calibration.smoothingConfiguration.transitionProbabilitySmoothing,
            'none'
        );
        assert.ok(Object.isFrozen(calibration));
        assert.ok(Object.isFrozen(calibration.transitions[0]));

        productionPredictor.transitions[0][1] = 0;
        assert.equal(calibration.transitions[0][1], 3);
        assert.throws(() => {
            calibration.rowTotals[0] = 0;
        }, TypeError);
    }],

    ['session metadata is locked and records fault deltas', () => {
        let sector = 2;
        let faultCount = 4;
        let uniqueFaultCount = 2;
        const timestampValues = [
            '2026-07-20T08:58:00.000Z',
            '2026-07-20T08:59:00.000Z',
            '2026-07-20T09:00:00.000Z',
            '2026-07-20T09:05:00.000Z',
            '2026-07-20T09:10:00.000Z',
            '2026-07-20T09:11:00.000Z'
        ];
        const beginOptions = {
            sessionId: 'locked-session',
            participantLabel: 'participant-007',
            playStyleLabel: 'cautious',
            notes: 'keyboard-only calibration'
        };
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 5]]),
            contextProvider: () => ({ sector }),
            timestampFactory: () => timestampValues.shift(),
            applicationVersion: 'v4.0',
            buildVersion: '40cce33',
            faultSummaryProvider: () => ({
                totalFaultCount: faultCount,
                uniqueFaultCount,
                faultsByHook: { 'game.position-observation': faultCount }
            })
        }));

        adapter.beginSession(beginOptions);
        beginOptions.participantLabel = 'participant-changed';
        beginOptions.playStyleLabel = 'aggressive';
        beginOptions.notes = 'rewritten';
        adapter.applicationVersion = 'rewritten-version';
        assert.throws(
            () => adapter.setSessionMetadata({ participantLabel: 'participant-late' }),
            /between sessions/
        );
        adapter.observePosition(0);
        adapter.openPredictionOpportunity();
        adapter.observePosition(1);
        sector = 5;
        faultCount = 6;
        uniqueFaultCount = 3;
        adapter.endSession('TEST_COMPLETE');

        const metadata = adapter.getSessionMetadata('locked-session');
        assert.equal(metadata.participantLabel, 'participant-007');
        assert.equal(metadata.playStyleLabel, 'cautious');
        assert.equal(metadata.notes, 'keyboard-only calibration');
        assert.equal(metadata.startingSector, 2);
        assert.equal(metadata.finalSector, 5);
        assert.equal(metadata.startTimestamp, '2026-07-20T09:00:00.000Z');
        assert.equal(metadata.endTimestamp, '2026-07-20T09:05:00.000Z');
        assert.equal(metadata.applicationVersion, 'v4.0');
        assert.equal(metadata.totalEventCount, 1);
        assert.equal(metadata.resolvedCount, 1);
        assert.equal(metadata.censoredCount, 0);
        assert.equal(metadata.noPredictionCount, 0);
        assert.equal(metadata.unresolvedCount, 0);
        assert.equal(metadata.evaluatorFaultCount, 2);
        assert.equal(metadata.endReason, 'TEST_COMPLETE');
        assert.ok(Object.isFrozen(metadata));

        const beforeSecondEnd = adapter.getSessionMetadata('locked-session');
        assert.equal(adapter.endSession('SHOULD_NOT_REWRITE'), null);
        adapter.setSessionMetadata({
            sessionId: 'next-session',
            participantLabel: 'participant-next'
        });
        assert.deepEqual(adapter.getSessionMetadata('locked-session'), beforeSecondEnd);
        assert.equal(adapter.beginSession(), 'next-session');
        adapter.endSession('NEXT_DONE');
        assert.equal(
            adapter.getSessionMetadata('next-session').participantLabel,
            'participant-next'
        );
    }],

    ['JSON export is complete deterministic and copy-isolated', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 5]]),
            timestampFactory: () => '2026-07-20T10:00:00.000Z',
            buildVersion: '40cce33'
        }));
        openAndResolve(adapter, 0, 1);
        adapter.endSession('EXPORTED');
        const exportOptions = { exportedAt: '2026-07-20T10:30:00.000Z' };
        const first = adapter.exportSessionJSON('session-1', exportOptions);
        const second = adapter.exportSessionJson('session-1', exportOptions);
        const parsed = JSON.parse(first);

        assert.equal(first, second);
        assert.deepEqual(Object.keys(parsed), [
            'schemaVersion',
            'exportedAt',
            'session',
            'configuration',
            'calibrationSnapshot',
            'events',
            'faults',
            'notes'
        ]);
        assert.equal(parsed.exportedAt, exportOptions.exportedAt);
        assert.equal(parsed.session.sessionId, 'session-1');
        assert.equal(parsed.calibrationSnapshot.snapshotId, 'test-calibration');
        assert.equal(parsed.events.length, 1);
        assert.equal(parsed.events[0].correct, true);

        const payload = adapter.exportSession('session-1', exportOptions);
        assert.ok(Object.isFrozen(payload));
        assert.ok(Object.isFrozen(payload.events[0]));
        assert.ok(Object.isFrozen(payload.calibrationSnapshot));
        assert.throws(() => {
            payload.events[0].correct = false;
        }, TypeError);
        assert.throws(() => {
            payload.calibrationSnapshot.transitions[0][1] = 0;
        }, TypeError);
        assert.equal(adapter.getEvents()[0].correct, true);
        assert.equal(adapter.getModelSnapshot().transitions[0][1], 5);
    }],

    ['event and session CSV exports have distinct stable headers', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 5]]),
            timestampFactory: () => '2026-07-20T11:00:00.000Z'
        }));
        adapter.beginSession({
            sessionId: 'csv-session',
            participantLabel: 'participant-csv',
            playStyleLabel: 'balanced',
            notes: 'quiet,\nthen "burst"'
        });
        adapter.observePosition(0);
        adapter.openPredictionOpportunity({ predictionLatencyMs: 0.5 });
        adapter.observePosition(1);
        adapter.endSession('CSV_EXPORTED');

        const eventCsv = adapter.exportEventsCSV('csv-session', {
            exportedAt: '2026-07-20T11:30:00.000Z'
        });
        const sessionCsv = adapter.exportSessionCSV('csv-session', {
            exportedAt: '2026-07-20T11:30:00.000Z'
        });
        const eventRows = parseCsv(eventCsv);
        const sessionRows = parseCsv(sessionCsv);

        assert.deepEqual(eventRows[0], [...EVENT_CSV_COLUMNS]);
        assert.deepEqual(sessionRows[0], [...SESSION_CSV_COLUMNS]);
        assert.notDeepEqual(eventRows[0], sessionRows[0]);
        assert.equal(eventRows.length, 2);
        assert.equal(sessionRows.length, 2);
        assert.equal(
            eventRows[1][eventRows[0].indexOf('sessionNotes')],
            'quiet,\nthen "burst"'
        );
        assert.equal(eventRows[1][eventRows[0].indexOf('fullProbabilityRow')], '[0,1,0]');
        assert.equal(
            sessionRows[1][sessionRows[0].indexOf('sessionNotes')],
            'quiet,\nthen "burst"'
        );
    }],

    ['exports preserve zero false null and deterministic probability rows', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 4], [0, 2, 1]]),
            timestampFactory: () => '2026-07-20T11:45:00.000Z'
        }));
        adapter.beginSession({ sessionId: 'scalar-preservation' });
        adapter.observePosition(0);
        adapter.openPredictionOpportunity({
            predictionLatencyMs: 0,
            sector: 0,
            gameTime: 0
        });
        adapter.observePosition(2);
        adapter.endSession('SCALAR_EXPORTED');
        const options = { exportedAt: '2026-07-20T11:50:00.000Z' };
        const parsedJson = JSON.parse(
            adapter.exportSessionJSON('scalar-preservation', options)
        );
        const eventRows = parseCsv(
            adapter.exportEventsCSV('scalar-preservation', options)
        );
        const header = eventRows[0];
        const row = eventRows[1];

        assert.equal(parsedJson.events[0].predictionLatencyMs, 0);
        assert.equal(parsedJson.events[0].sector, 0);
        assert.equal(parsedJson.events[0].gameTime, 0);
        assert.equal(parsedJson.events[0].correct, false);
        assert.equal(parsedJson.session.evaluatorFaultCount, null);
        assert.deepEqual(parsedJson.events[0].fullProbabilityRow, [0, 0.8, 0.2]);
        assert.equal(row[header.indexOf('predictionLatencyMs')], '0');
        assert.equal(row[header.indexOf('sector')], '0');
        assert.equal(row[header.indexOf('gameTime')], '0');
        assert.equal(row[header.indexOf('correct')], 'false');
        assert.equal(row[header.indexOf('evaluatorFaultCount')], 'null');
        assert.equal(row[header.indexOf('fullProbabilityRow')], '[0,0.8,0.2]');
        assert.equal(
            adapter.exportEventsCSV('scalar-preservation', options),
            adapter.exportEventsCSV('scalar-preservation', options)
        );
    }],

    ['NO_PREDICTION and CENSORED events remain present in every event export', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3),
            timestampFactory: () => '2026-07-20T11:55:00.000Z'
        }));
        adapter.beginSession({ sessionId: 'no-prediction-export' });
        adapter.observePosition(0);
        adapter.openPredictionOpportunity();
        adapter.observePosition(1);
        adapter.endSession('NO_PREDICTION_DONE');

        adapter.beginSession({ sessionId: 'censored-export' });
        adapter.observePosition(0);
        adapter.openPredictionOpportunity();
        adapter.endSession('CENSORED_DONE');

        const options = { exportedAt: '2026-07-20T11:59:00.000Z' };
        const missingJson = JSON.parse(
            adapter.exportSessionJSON('no-prediction-export', options)
        );
        const censoredJson = JSON.parse(
            adapter.exportSessionJSON('censored-export', options)
        );
        const missingCsv = adapter.exportEventsCSV('no-prediction-export', options);
        const censoredCsv = adapter.exportEventsCSV('censored-export', options);

        assert.equal(missingJson.events[0].status, STATUS.NO_PREDICTION);
        assert.equal(missingJson.events[0].predictionAvailable, false);
        assert.equal(missingJson.events[0].predictedNextState, null);
        assert.equal(censoredJson.events[0].status, STATUS.CENSORED);
        assert.match(missingCsv, /NO_PREDICTION/);
        assert.match(censoredCsv, /CENSORED/);
    }],

    ['empty-ledger JSON event CSV and session CSV exports are valid', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3),
            timestampFactory: () => '2026-07-20T12:00:00.000Z'
        }));
        adapter.beginSession({ sessionId: 'empty-export' });
        adapter.endSession('EMPTY_DONE');
        const options = { exportedAt: '2026-07-20T12:01:00.000Z' };
        const json = JSON.parse(adapter.exportSessionJSON('empty-export', options));
        const eventRows = parseCsv(adapter.exportEventsCSV('empty-export', options));
        const sessionRows = parseCsv(adapter.exportSessionCSV('empty-export', options));

        assert.deepEqual(json.events, []);
        assert.deepEqual(eventRows, [[...EVENT_CSV_COLUMNS]]);
        assert.equal(sessionRows.length, 2);
        assert.deepEqual(sessionRows[0], [...SESSION_CSV_COLUMNS]);
        assert.equal(
            sessionRows[1][sessionRows[0].indexOf('totalEventCount')],
            '0'
        );
    }],

    ['active unresolved events and historical sessions export immutably', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3, [[0, 1, 5]]),
            timestampFactory: () => '2026-07-20T12:00:00.000Z'
        }));
        adapter.beginSession({ sessionId: 'historical-1' });
        adapter.observePosition(0);
        adapter.openPredictionOpportunity();
        const activeExport = adapter.exportSession('historical-1', {
            exportedAt: '2026-07-20T12:15:00.000Z'
        });

        assert.equal(activeExport.session.unresolvedCount, 1);
        assert.equal(activeExport.events.length, 1);
        assert.equal(activeExport.events[0].status, STATUS.OPEN);
        assert.equal(activeExport.events[0].actualNextState, null);
        const activeEventRows = parseCsv(adapter.exportEventsCSV('historical-1', {
            exportedAt: '2026-07-20T12:15:00.000Z'
        }));
        assert.equal(activeEventRows[1][activeEventRows[0].indexOf('status')], STATUS.OPEN);
        assert.equal(
            activeEventRows[1][activeEventRows[0].indexOf('actualNextState')],
            'null'
        );
        adapter.endSession('FIRST_DONE');
        adapter.beginSession({ sessionId: 'historical-2' });
        adapter.endSession('SECOND_DONE');

        assert.deepEqual(adapter.getSessionIds(), ['historical-1', 'historical-2']);
        assert.equal(
            adapter.exportSession('historical-1', {
                exportedAt: '2026-07-20T12:30:00.000Z'
            }).session.endReason,
            'FIRST_DONE'
        );
    }],

    ['Mode B export freezes the session-start model snapshot', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'B',
            onlineSnapshot: snapshot(3, [[0, 1, 20]]),
            timestampFactory: () => '2026-07-20T13:00:00.000Z'
        }));
        adapter.beginSession({ sessionId: 'mode-b-export' });
        adapter.observePosition(0);
        adapter.openPredictionOpportunity();
        adapter.observePosition(2);
        adapter.endSession('MODE_B_DONE');

        const payload = adapter.exportSession('mode-b-export', {
            exportedAt: '2026-07-20T13:30:00.000Z'
        });
        assert.equal(payload.calibrationSnapshot.transitions[0][2], 0);
        assert.equal(adapter.getModelSnapshot().transitions[0][2], 1);
        assert.equal(
            payload.session.calibrationSnapshotId,
            payload.calibrationSnapshot.snapshotId
        );
    }],

    ['session privacy defaults avoid identity and device metadata', () => {
        const adapter = new PredictionEvaluationAdapter(adapterOptions({
            evaluationMode: 'A',
            frozenSnapshot: snapshot(3),
            participantLabel: 'not-a-pseudonymous-label',
            timestampFactory: () => '2026-07-20T14:00:00.000Z'
        }));
        adapter.beginSession({ sessionId: 'privacy-defaults' });
        adapter.endSession('PRIVACY_CHECK');
        const payload = adapter.exportSession('privacy-defaults', {
            exportedAt: '2026-07-20T14:30:00.000Z'
        });
        const sessionKeys = Object.keys(payload.session);

        assert.equal(payload.session.participantLabel, 'participant-unknown');
        assert.equal(payload.session.playStyleLabel, 'play-style-unknown');
        assert.equal(sessionKeys.includes('name'), false);
        assert.equal(sessionKeys.includes('email'), false);
        assert.equal(sessionKeys.includes('ipAddress'), false);
        assert.equal(sessionKeys.includes('deviceFingerprint'), false);
        assert.equal(sessionKeys.includes('location'), false);
    }],

    ['browser gate remains inert without explicit development evaluation flags', () => {
        const { context, logs } = loadBrowserAdapter('');

        assert.equal(context.PredictionEvaluationAdapter, undefined);
        assert.equal(context.initializePredictionEvaluator, undefined);
        assert.equal(context.invokePredictionEvaluatorSafely, undefined);
        assert.equal(context.spaceLuminEvaluation, undefined);
        assert.equal(context.game.predictionEvaluator, undefined);
        assert.deepEqual(context.document.documentElement.dataset, {});
        assert.deepEqual(logs, []);
    }],

    ['enabled browser API exposes only safe methods and constructs downloads', () => {
        const { context, logs, downloads } = loadBrowserAdapter(
            '?dev=1&evaluate=1&evaluationMode=A' +
            '&evaluationParticipant=participant-browser' +
            '&evaluationPlayStyle=balanced&evaluationBuild=40cce33'
        );
        context.initializePredictionEvaluator();
        const evaluator = context.game.predictionEvaluator;
        const developmentApi = context.spaceLuminEvaluation;
        const expectedMethods = [
            'setSessionMetadata',
            'startSession',
            'endSession',
            'createCalibrationSnapshot',
            'loadCalibrationSnapshot',
            'exportJSON',
            'exportEventsCSV',
            'exportSessionCSV',
            'downloadJSON',
            'downloadEventsCSV',
            'downloadSessionCSV'
        ];

        assert.ok(evaluator);
        assert.deepEqual(Object.keys(developmentApi), expectedMethods);
        assert.equal(Object.isFrozen(developmentApi), true);
        assert.equal(context.document.documentElement.dataset.predictionEvaluator, 'A');
        const calibration = developmentApi.createCalibrationSnapshot({
            snapshotId: 'browser-calibration',
            createdAt: '2026-07-20T14:55:00.000Z'
        });
        developmentApi.loadCalibrationSnapshot(calibration);
        developmentApi.setSessionMetadata({
            participantLabel: 'participant-api',
            playStyleLabel: 'cautious',
            notes: 'browser smoke'
        });
        developmentApi.startSession({ sessionId: '../../Browser Session' });
        developmentApi.endSession('BROWSER_TEST');
        const exportOptions = {
            exportedAt: '2026-07-20T15:00:00.000Z'
        };
        const payload = JSON.parse(
            developmentApi.exportJSON('../../Browser Session', exportOptions)
        );
        const eventCsv = developmentApi.exportEventsCSV(
            '../../Browser Session',
            exportOptions
        );
        const sessionCsv = developmentApi.exportSessionCSV(
            '../../Browser Session',
            exportOptions
        );
        const jsonFilename = developmentApi.downloadJSON(
            '../../Browser Session',
            exportOptions
        );
        const eventFilename = developmentApi.downloadEventsCSV(
            '../../Browser Session',
            exportOptions
        );
        const sessionFilename = developmentApi.downloadSessionCSV(
            '../../Browser Session',
            exportOptions
        );

        assert.equal(payload.session.participantLabel, 'participant-api');
        assert.equal(payload.session.playStyleLabel, 'cautious');
        assert.equal(payload.session.buildVersion, '40cce33');
        assert.equal(payload.calibrationSnapshot.snapshotId, 'browser-calibration');
        assert.equal(payload.events.length, 0);
        assert.deepEqual(parseCsv(eventCsv)[0], [...EVENT_CSV_COLUMNS]);
        assert.deepEqual(parseCsv(sessionCsv)[0], [...SESSION_CSV_COLUMNS]);
        assert.equal(jsonFilename, 'spacelumin-evaluation-browser-session.json');
        assert.equal(eventFilename, 'spacelumin-events-browser-session.csv');
        assert.equal(sessionFilename, 'spacelumin-session-browser-session.csv');
        assert.deepEqual(downloads.map(item => item.filename), [
            jsonFilename,
            eventFilename,
            sessionFilename
        ]);
        assert.equal(context.lastBlob.type, 'text/csv;charset=utf-8');
        assert.equal(context.revokedObjectUrl, 'blob:test-download');
        assert.equal(logs.some(entry => entry[0] === 'error'), false);
    }],

    ['development API isolates forced JSON serialization failure', () => {
        const loggedFaults = [];
        const boundary = createPredictionEvaluationFaultBoundary({
            logger: fault => loggedFaults.push(fault)
        });
        const adapter = {
            getSessionSummary: () => ({ sessionId: 'json-fault-session' }),
            exportSessionJSON() {
                throw new Error('controlled JSON serialization fault');
            }
        };
        const developmentApi = createPredictionEvaluationDevelopmentApi({
            adapter,
            invokeSafely: boundary.invoke
        });
        let gameplayContinued = false;

        const result = developmentApi.exportJSON();
        gameplayContinued = true;

        assert.equal(result, undefined);
        assert.equal(gameplayContinued, true);
        assert.equal(boundary.getFaultSummary().totalFaultCount, 1);
        assert.equal(loggedFaults[0].hookName, 'development-api.export-json');
    }],

    ['development API isolates forced CSV serialization failure', () => {
        const boundary = createPredictionEvaluationFaultBoundary();
        const adapter = {
            getSessionSummary: () => ({ sessionId: 'csv-fault-session' }),
            exportEventsCSV() {
                throw new Error('controlled CSV serialization fault');
            }
        };
        const developmentApi = createPredictionEvaluationDevelopmentApi({
            adapter,
            invokeSafely: boundary.invoke
        });
        let frameContinued = false;

        const result = developmentApi.exportEventsCSV();
        frameContinued = true;

        assert.equal(result, undefined);
        assert.equal(frameContinued, true);
        assert.equal(
            boundary.getFaultSummary().faultsByHook['development-api.export-events-csv'],
            1
        );
    }],

    ['development API isolates forced download failure', () => {
        const loggedFaults = [];
        const boundary = createPredictionEvaluationFaultBoundary({
            logger: fault => loggedFaults.push(fault)
        });
        const adapter = {
            getSessionSummary: () => ({ sessionId: 'download-fault-session' }),
            exportSessionCSV: () => 'header\r\nvalue'
        };
        const developmentApi = createPredictionEvaluationDevelopmentApi({
            adapter,
            invokeSafely: boundary.invoke,
            downloader() {
                throw new Error('controlled download fault');
            }
        });
        let runTerminationContinued = false;

        const result = developmentApi.downloadSessionCSV();
        runTerminationContinued = true;

        assert.equal(result, undefined);
        assert.equal(runTerminationContinued, true);
        assert.equal(boundary.getFaultSummary().totalFaultCount, 1);
        assert.equal(loggedFaults[0].hookName, 'development-api.download-session');
    }],

    ['session-start evaluator fault is isolated', () => {
        const loggedFaults = [];
        const boundary = createPredictionEvaluationFaultBoundary({
            logger: fault => loggedFaults.push(fault)
        });
        const evaluator = {
            beginSession() {
                throw new Error('controlled session-start fault');
            }
        };
        let gameStartupContinued = false;

        boundary.invoke('game.session-start', () => evaluator.beginSession());
        gameStartupContinued = true;

        assert.equal(gameStartupContinued, true);
        assert.equal(boundary.getFaultSummary().totalFaultCount, 1);
        assert.equal(loggedFaults[0].hookName, 'game.session-start');
        assert.match(loggedFaults[0].stack, /controlled session-start fault/);
    }],

    ['position-observation evaluator fault is isolated', () => {
        const boundary = createPredictionEvaluationFaultBoundary();
        const evaluator = {
            observePosition() {
                throw new Error('controlled position fault');
            }
        };
        let frameProcessingContinued = false;

        boundary.invoke(
            'game.position-observation',
            () => evaluator.observePosition(27)
        );
        frameProcessingContinued = true;

        assert.equal(frameProcessingContinued, true);
        assert.equal(
            boundary.getFaultSummary().faultsByHook['game.position-observation'],
            1
        );
    }],

    ['prediction-opportunity fault preserves Director output processing', () => {
        const boundary = createPredictionEvaluationFaultBoundary();
        const productionPrediction = Object.freeze({
            collisionRisk: 0.8,
            missedBurstRisk: 0.1,
            panicRisk: 0.2
        });
        let productionPredictionCalls = 0;
        let enemySpeedMultiplier = 1;

        const prediction = (() => {
            productionPredictionCalls++;
            return productionPrediction;
        })();
        boundary.invoke('director.prediction-opportunity', () => {
            throw new Error('controlled prediction-opportunity fault');
        });
        if (prediction.collisionRisk > 0.70) enemySpeedMultiplier *= 0.90;

        assert.equal(productionPredictionCalls, 1);
        assert.equal(enemySpeedMultiplier, 0.90);
        assert.strictEqual(prediction, productionPrediction);
    }],

    ['session-end evaluator faults do not stop termination or results', () => {
        const boundary = createPredictionEvaluationFaultBoundary();
        const evaluator = {
            endSession() {
                throw new Error('controlled session-end fault');
            }
        };
        let runTerminationContinued = false;
        let resultsProcessingContinued = false;

        boundary.invoke(
            'game.session-end',
            () => evaluator.endSession('RUN_ENDED')
        );
        runTerminationContinued = true;
        boundary.invoke(
            'game.results-end',
            () => evaluator.endSession('RESULTS_TEST')
        );
        resultsProcessingContinued = true;

        assert.equal(runTerminationContinued, true);
        assert.equal(resultsProcessingContinued, true);
        assert.equal(boundary.getFaultSummary().totalFaultCount, 2);
    }],

    ['repeated identical evaluator faults are counted but logged once', () => {
        const loggedFaults = [];
        const boundary = createPredictionEvaluationFaultBoundary({
            logger: fault => loggedFaults.push(fault)
        });

        for (let attempt = 0; attempt < 5; attempt++) {
            boundary.invoke('game.position-observation', () => {
                throw new Error('controlled repeated fault');
            });
        }

        const summary = boundary.getFaultSummary();
        assert.equal(summary.totalFaultCount, 5);
        assert.equal(summary.uniqueFaultCount, 1);
        assert.equal(summary.faultsByHook['game.position-observation'], 5);
        assert.equal(loggedFaults.length, 1);
        assert.ok(Object.isFrozen(summary));
    }],

    ['failed evaluator hook leaves production predictor unchanged and single-called', () => {
        const boundary = createPredictionEvaluationFaultBoundary();
        const productionPredictor = {
            totalTransitions: 31,
            collisionRisk: 0.4,
            missedBurstRisk: 0.2,
            panicRisk: 0.1
        };
        const productionBefore = JSON.parse(JSON.stringify(productionPredictor));
        let productionPredictionCalls = 0;

        const prediction = (() => {
            productionPredictionCalls++;
            return {
                collisionRisk: productionPredictor.collisionRisk,
                missedBurstRisk: productionPredictor.missedBurstRisk,
                panicRisk: productionPredictor.panicRisk
            };
        })();
        boundary.invoke('director.prediction-opportunity', () => {
            throw new Error('controlled isolation fault');
        });

        assert.equal(productionPredictionCalls, 1);
        assert.deepEqual(productionPredictor, productionBefore);
        assert.deepEqual(prediction, {
            collisionRisk: 0.4,
            missedBurstRisk: 0.2,
            panicRisk: 0.1
        });
    }]
];

let passed = 0;
for (const [name, test] of tests) {
    test();
    passed++;
    console.log(`PASS ${passed}/${tests.length}: ${name}`);
}

console.log(`PredictionEvaluationAdapter tests passed: ${passed}/${tests.length}`);
