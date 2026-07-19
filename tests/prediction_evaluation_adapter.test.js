'use strict';

const assert = require('node:assert/strict');
const {
    PredictionEvaluationAdapter,
    STATUS,
    createPredictionEvaluationFaultBoundary
} = require('../js/PredictionEvaluationAdapter.js');

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
