'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const {
    analyzeEvaluationPackages,
    createSessionMetricsCSV,
    createGroupMetricsCSV,
    createConfusionMatrixCSV,
    createMarkdownReport,
    CLIPPING_EPSILON,
    METRICS_SCHEMA_VERSION,
    SESSION_CSV_COLUMNS,
    GROUP_CSV_COLUMNS,
    CONFUSION_CSV_COLUMNS
} = require('../js/PredictionEvaluationMetrics.js');
const {
    PredictionEvaluationAdapter
} = require('../js/PredictionEvaluationAdapter.js');

function snapshot(id = 'calibration-1') {
    return {
        snapshotId: id,
        stateLabels: ['0', '1', '2'],
        stateVocabulary: [
            { stateId: 0, hpBracket: 0, zoneBracket: 0, jerkBracket: 0 },
            { stateId: 1, hpBracket: 0, zoneBracket: 0, jerkBracket: 1 },
            { stateId: 2, hpBracket: 0, zoneBracket: 0, jerkBracket: 2 }
        ],
        transitions: [[3, 1, 0], [1, 1, 0], [0, 1, 1]],
        globalStateCounts: [4, 3, 1],
        modelDimensions: { totalStates: 3 },
        smoothingConfiguration: { transitionProbabilitySmoothing: 'none' }
    };
}

function event(sessionId, ordinal, overrides = {}) {
    return {
        eventId: `${sessionId}-event-${ordinal}`,
        sessionId,
        status: 'RESOLVED',
        openedAt: ordinal,
        resolvedAt: ordinal + 0.5,
        predictionLatencyMs: ordinal,
        currentState: 0,
        predictedNextState: 0,
        actualNextState: 0,
        correct: true,
        predictionAvailable: true,
        probabilityAssignedToActualState: 0.75,
        fullProbabilityRow: [0.75, 0.25, 0],
        stateEpochId: ordinal,
        currentPositionSerial: ordinal,
        nextPositionSerial: ordinal + 1,
        sector: 1,
        gameTime: ordinal * 10,
        ...overrides
    };
}

function exportedPackage(sessionId, options = {}) {
    const mode = options.mode || 'A';
    const events = options.events || [];
    const calibrationSnapshot = options.calibrationSnapshot === undefined
        ? snapshot(options.snapshotId)
        : options.calibrationSnapshot;
    return {
        schemaVersion: 'spacelumin.prediction-export/1.0.0',
        exportedAt: '2026-07-20T10:00:00.000Z',
        session: {
            sessionId,
            participantLabel: options.participantLabel || 'participant-001',
            playStyleLabel: 'balanced',
            evaluationMode: mode,
            sourceType: options.sourceType || 'human',
            evaluatorConfigurationVersion: 'config-1',
            calibrationSnapshotId: calibrationSnapshot?.snapshotId || null
        },
        configuration: { totalStates: 3 },
        calibrationSnapshot,
        events,
        faults: {},
        notes: {}
    };
}

function fixtures() {
    const firstId = 'session-a';
    const secondId = 'session-b';
    return [
        exportedPackage(firstId, { events: [
            event(firstId, 1),
            event(firstId, 2, {
                actualNextState: 1,
                correct: false,
                probabilityAssignedToActualState: 0.25
            }),
            event(firstId, 3, {
                status: 'NO_PREDICTION',
                currentState: 2,
                predictedNextState: null,
                actualNextState: 1,
                correct: false,
                predictionAvailable: false,
                probabilityAssignedToActualState: null,
                fullProbabilityRow: null
            }),
            event(firstId, 4, {
                status: 'CENSORED',
                currentState: 1,
                predictedNextState: 0,
                actualNextState: null,
                correct: null,
                predictionAvailable: true,
                probabilityAssignedToActualState: null,
                fullProbabilityRow: [0.5, 0.5, 0]
            }),
            event(firstId, 5, {
                status: 'OPEN',
                currentState: 1,
                predictedNextState: 0,
                actualNextState: null,
                correct: null,
                predictionAvailable: true,
                probabilityAssignedToActualState: null,
                fullProbabilityRow: [0.5, 0.5, 0]
            })
        ] }),
        exportedPackage(secondId, { participantLabel: 'participant-002', events: [
            event(secondId, 1, {
                currentState: 1,
                predictedNextState: 0,
                actualNextState: 1,
                correct: false,
                probabilityAssignedToActualState: 0.5,
                fullProbabilityRow: [0.5, 0.5, 0],
                sector: 2
            }),
            event(secondId, 2, {
                currentState: 2,
                predictedNextState: 1,
                actualNextState: 2,
                correct: false,
                probabilityAssignedToActualState: 0.5,
                fullProbabilityRow: [0, 0.5, 0.5],
                sector: 2
            }),
            event(secondId, 3, {
                actualNextState: 2,
                correct: false,
                probabilityAssignedToActualState: 0,
                sector: 2
            })
        ] })
    ];
}

const tests = [
    ['aggregates strict conditional coverage and lifecycle counts', () => {
        const result = analyzeEvaluationPackages(fixtures(), { bootstrapReplicates: 0 });
        const model = result.cohorts[0].model;
        assert.equal(result.schemaVersion, METRICS_SCHEMA_VERSION);
        assert.equal(model.counts.totalEventCount, 8);
        assert.equal(model.counts.resolvedOpportunities, 6);
        assert.equal(model.counts.predictionAvailableOpportunities, 5);
        assert.equal(model.counts.noPredictionOpportunities, 1);
        assert.equal(model.counts.openEvents, 1);
        assert.equal(model.counts.censoredEvents, 1);
        assert.equal(model.counts.unresolvedEvents, 2);
        assert.equal(model.counts.malformedEvents, 0);
        assert.equal(model.counts.skippedEvents, 0);
        assert.equal(model.accuracy.strictTop1Accuracy, 1 / 6);
        assert.equal(model.accuracy.conditionalTop1Accuracy, 1 / 5);
        assert.equal(model.accuracy.predictionCoverage, 5 / 6);
        assert.equal(model.accuracy.strictBalancedAccuracy, 1 / 3);
        assert.equal(model.accuracy.conditionalBalancedAccuracy, 1 / 3);
    }],
    ['uses separate strict and conditional balanced-accuracy denominators', () => {
        const id = 'balanced-denominators';
        const pkg = exportedPackage(id, { events: [
            event(id, 1),
            event(id, 2, {
                status: 'NO_PREDICTION',
                currentState: 1,
                predictedNextState: null,
                actualNextState: 2,
                correct: false,
                predictionAvailable: false,
                probabilityAssignedToActualState: null,
                fullProbabilityRow: null
            })
        ] });
        const accuracy = analyzeEvaluationPackages(pkg, {
            bootstrapReplicates: 0
        }).cohorts[0].model.accuracy;
        assert.equal(accuracy.conditionalBalancedAccuracy, 1);
        assert.equal(accuracy.strictBalancedAccuracy, 0.5);
    }],
    ['consumes the adapter complete JSON package without translation', () => {
        let time = 10;
        const adapter = new PredictionEvaluationAdapter({
            evaluationMode: 'A',
            totalStates: 3,
            minTransitions: 1,
            clock: () => ++time,
            timestampFactory: () => '2026-07-20T12:00:00.000Z',
            frozenSnapshot: {
                snapshotId: 'adapter-calibration',
                totalStates: 3,
                minTransitions: 1,
                totalTransitions: 4,
                transitions: [[3, 1, 0], [0, 0, 0], [0, 0, 0]]
            }
        });
        adapter.beginSession({ sessionId: 'adapter-session' });
        adapter.observePosition(0);
        adapter.openPredictionOpportunity({ predictionLatencyMs: 0.25 });
        adapter.observePosition(0);
        adapter.endSession('TEST_COMPLETE');
        const exported = adapter.exportSession('adapter-session', {
            exportedAt: '2026-07-20T12:30:00.000Z'
        });
        const result = analyzeEvaluationPackages(exported, { bootstrapReplicates: 0 });
        assert.equal(result.cohorts[0].model.counts.resolvedOpportunities, 1);
        assert.equal(result.cohorts[0].model.accuracy.strictTop1Accuracy, 1);
    }],
    ['computes probability metrics from untouched rows', () => {
        const probability = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 0
        }).cohorts[0].model.probability;
        assert.equal(probability.evaluatedDistributionCount, 5);
        assert.equal(probability.impossibleEventCount, 1);
        assert.equal(probability.impossibleEventRate, 0.2);
        assert.equal(probability.clippingEpsilon, CLIPPING_EPSILON);
        assert.equal(probability.meanProbabilityAssignedToActualState, 0.4);
        assert.ok(Number.isFinite(probability.clippedLogLoss));
        assert.ok(probability.brierScore > 0);
    }],
    ['reports impossible events by session and current state', () => {
        const model = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 0
        }).cohorts[0].model;
        assert.equal(model.impossibleEventsBySession['session-a'].impossibleEventCount, 0);
        assert.equal(model.impossibleEventsBySession['session-b'].impossibleEventCount, 1);
        assert.equal(model.impossibleEventsByCurrentState['0'].impossibleEventCount, 1);
    }],
    ['builds raw and row-normalized confusion matrices with missing column', () => {
        const matrix = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 0
        }).cohorts[0].model.confusionMatrix;
        assert.ok(matrix.predictedStateColumns.includes('NO_PREDICTION'));
        assert.equal(matrix.counts['1'].NO_PREDICTION, 1);
        assert.equal(matrix.counts['0']['0'], 1);
        assert.equal(matrix.rowPercentages['0']['0'], 1);
    }],
    ['computes independent and frozen baselines from calibration only', () => {
        const cohort = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 0
        }).cohorts[0];
        assert.equal(cohort.primaryBaseline, 'persistence');
        assert.equal(cohort.baselines.persistence.accuracy.strictTop1Accuracy, 3 / 6);
        assert.equal(cohort.baselines.globalMajority.accuracy.strictTop1Accuracy, 1 / 6);
        assert.equal(cohort.baselines.uniformExpected.accuracy.strictTop1Accuracy, 1 / 3);
        assert.equal(cohort.baselines.uniformExpected.observedClassifier, false);
        assert.equal(cohort.baselines.frozenMarkov.accuracy.strictTop1Accuracy, 2 / 6);
        assert.deepEqual(
            cohort.baselines.frozenMarkov.accuracy,
            cohort.baselines.frozenPerStateMajority.accuracy
        );
        assert.match(cohort.baselines.frozenPerStateMajority.definition, /sanity check/);
        assert.match(cohort.baselines.frozenMarkov.comparisonRole, /consistency check/);
        assert.equal(cohort.baselines.persistence.validSampleCount, 6);
        assert.equal(cohort.baselines.persistence.missingRowCount, 0);
        assert.equal(cohort.baselines.frozenMarkov.missingRowCount, 0);
        assert.equal(cohort.baselines.uniformExpected.accuracy.strictBalancedAccuracy, 1 / 3);
    }],
    ['uniform reference uses one over the validated total state count', () => {
        const cohort = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 0
        }).cohorts[0];
        assert.equal(cohort.totalStates, 3);
        assert.equal(cohort.baselines.uniformExpected.accuracy.strictTop1Accuracy, 1 / 3);
        assert.match(cohort.baselines.uniformExpected.definition, /expected uniform reference/);
    }],
    ['preserves negative baseline improvement', () => {
        const improvement = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 0
        }).cohorts[0].improvements.persistence;
        assert.ok(Math.abs(improvement.strict.absoluteImprovement - (-1 / 3)) < 1e-12);
        assert.ok(Math.abs(improvement.strict.normalizedImprovement - (-2 / 3)) < 1e-12);
        assert.equal(improvement.conditional.comparableSamples, false);
        assert.equal(improvement.conditional.absoluteImprovement, null);
    }],
    ['returns null normalized improvement and warning for a perfect baseline', () => {
        const id = 'perfect-persistence';
        const pkg = exportedPackage(id, { events: [event(id, 1)] });
        const improvement = analyzeEvaluationPackages(pkg, {
            bootstrapReplicates: 0
        }).cohorts[0].improvements.persistence.strict;
        assert.equal(improvement.baselineAccuracy, 1);
        assert.equal(improvement.normalizedImprovement, null);
        assert.match(improvement.warning, /baseline accuracy equals 1/);
    }],
    ['reports latency and grouped session sector state and participant results', () => {
        const model = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 0
        }).cohorts[0].model;
        assert.equal(model.latency.allOpportunities.count, 8);
        assert.equal(model.latency.allOpportunities.minimumMs, 1);
        assert.equal(model.latency.allOpportunities.maximumMs, 5);
        assert.equal(model.latency.allOpportunities.medianMs, 2.5);
        assert.equal(Object.keys(model.bySession.sessions).length, 2);
        assert.equal(Object.keys(model.bySector).length, 2);
        assert.equal(Object.keys(model.byCurrentState).length, 3);
        assert.equal(model.byParticipant.participantCount, 2);
        assert.ok(model.bySector['2'].brierScore > 0);
    }],
    ['reports fixed reliability bins from genuine top-1 probabilities', () => {
        const reliability = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 0
        }).cohorts[0].model.reliability;
        assert.equal(reliability.bins.length, 5);
        assert.equal(reliability.bins.reduce((sum, bin) => sum + bin.count, 0), 5);
        assert.equal(reliability.bins[2].count, 2);
        assert.equal(reliability.bins[3].count, 3);
        assert.equal(reliability.bins[2].sparse, true);
    }],
    ['produces every required deterministic breakdown dimension with counts', () => {
        const cohort = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 0
        }).cohorts[0];
        const dimensions = [...new Set(cohort.breakdowns.map(row => row.groupingDimension))];
        assert.deepEqual(dimensions, [
            'evaluationMode', 'sessionId', 'participantLabel', 'playStyleLabel',
            'currentState', 'actualState', 'predictedState', 'sector',
            'calibrationSnapshotId', 'evaluatorConfigurationVersion', 'buildVersion',
            'sourceType', 'dataCohort'
        ]);
        for (const row of cohort.breakdowns) {
            assert.equal(typeof row.totalEventCount, 'number');
            assert.ok(Object.hasOwn(row, 'resolvedOpportunities'));
            assert.ok(Object.hasOwn(row, 'conditionalTop1Accuracy'));
            assert.ok(Object.hasOwn(row, 'strictTop1Accuracy'));
            assert.ok(Object.hasOwn(row, 'validProbabilityCount'));
            assert.ok(Object.hasOwn(row, 'meanLatencyMs'));
            assert.ok(Object.hasOwn(row, 'p95LatencyMs'));
            assert.ok(row.lowSampleWarning);
        }
    }],
    ['session-clustered bootstrap is seeded and deterministic', () => {
        const first = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 50,
            bootstrapSeed: 42
        });
        const second = analyzeEvaluationPackages(fixtures(), {
            bootstrapReplicates: 50,
            bootstrapSeed: 42
        });
        assert.deepEqual(first, second);
        const intervals = first.cohorts[0].confidenceIntervals;
        assert.equal(intervals.sessionClustered.available, true);
        assert.equal(intervals.sessionClustered.requestedReplicates, 50);
        assert.equal(intervals.sessionClustered.seed, 42);
        assert.ok(intervals.sessionClustered.intervals
            .globalMajorityStrictImprovement.validReplicates > 0);
        assert.ok(intervals.sessionClustered.intervals
            .persistenceBaselineStrictAccuracy.validReplicates > 0);
        assert.ok(intervals.sessionClustered.groupedStrictAccuracyIntervals
            .currentState['0'].validReplicates > 0);
        assert.equal(intervals.sessionClustered.reliabilityIntervals.length, 5);
        assert.equal(intervals.participantClustered.available, true);
        assert.equal(intervals.participantClustered.validParticipantCount, 2);
        assert.ok(Object.hasOwn(intervals.participantClustered.intervals,
            'persistenceConditionalImprovement'));
    }],
    ['bootstrap defaults are 2000 replicates at deterministic seed 20260720', () => {
        const result = analyzeEvaluationPackages(fixtures());
        assert.equal(result.analysisConfiguration.bootstrapReplicates, 2000);
        assert.equal(result.analysisConfiguration.bootstrapSeed, 20260720);
        assert.equal(result.analysisConfiguration.confidenceLevel, 0.95);
        assert.equal(result.cohorts[0].confidenceIntervals.sessionClustered
            .requestedReplicates, 2000);
        assert.equal(result.cohorts[0].confidenceIntervals.participantClustered
            .requestedReplicates, 2000);
    }],
    ['single-session bootstrap is explicitly unavailable', () => {
        const result = analyzeEvaluationPackages(fixtures()[0], {
            bootstrapReplicates: 50
        });
        assert.equal(result.cohorts[0].confidenceIntervals.sessionClustered.available, false);
        assert.match(result.cohorts[0].confidenceIntervals.sessionClustered.reason,
            /two sessions/);
    }],
    ['participant bootstrap does not split repeated unknown labels into people', () => {
        const first = exportedPackage('unknown-a', {
            participantLabel: 'participant-unknown',
            events: [event('unknown-a', 1)]
        });
        const second = exportedPackage('unknown-b', {
            participantLabel: 'participant-unknown',
            events: [event('unknown-b', 1)]
        });
        const interval = analyzeEvaluationPackages([first, second], {
            bootstrapReplicates: 20
        }).cohorts[0].confidenceIntervals.participantClustered;
        assert.equal(interval.available, false);
        assert.equal(interval.validParticipantCount, 0);
        assert.match(interval.warning, /not treated as multiple people/);
    }],
    ['participant bootstrap preserves all sessions in each participant cluster', () => {
        const first = exportedPackage('participant-a-1', {
            participantLabel: 'participant-a',
            events: [event('participant-a-1', 1)]
        });
        const second = exportedPackage('participant-a-2', {
            participantLabel: 'participant-a',
            events: [event('participant-a-2', 1)]
        });
        const third = exportedPackage('participant-b-1', {
            participantLabel: 'participant-b',
            events: [event('participant-b-1', 1)]
        });
        const interval = analyzeEvaluationPackages([first, second, third], {
            bootstrapReplicates: 20
        }).cohorts[0].confidenceIntervals.participantClustered;
        assert.deepEqual(interval.participantClusters['participant-a'].sessionIds,
            ['participant-a-1', 'participant-a-2']);
        assert.deepEqual(interval.participantClusters['participant-b'].sessionIds,
            ['participant-b-1']);
    }],
    ['empty sessions produce explicit null metrics without invented samples', () => {
        const result = analyzeEvaluationPackages(exportedPackage('empty-session'), {
            bootstrapReplicates: 0
        });
        const model = result.cohorts[0].model;
        assert.equal(model.counts.resolvedOpportunities, 0);
        assert.equal(model.accuracy.strictTop1Accuracy, null);
        assert.equal(model.accuracy.predictionCoverage, null);
        assert.equal(model.probability.clippedLogLoss, null);
        assert.equal(model.latency.allOpportunities.meanMs, null);
        assert.equal(model.latency.allOpportunities.minimumMs, null);
        assert.equal(model.latency.allOpportunities.maximumMs, null);
    }],
    ['separates Mode A Mode B and synthetic cohorts', () => {
        const base = fixtures()[0];
        const modeB = exportedPackage('session-mode-b', {
            mode: 'B', events: [event('session-mode-b', 1)]
        });
        const synthetic = exportedPackage('session-synthetic', {
            sourceType: 'synthetic', events: [event('session-synthetic', 1)]
        });
        const result = analyzeEvaluationPackages([base, modeB, synthetic], {
            bootstrapReplicates: 0
        });
        assert.equal(result.cohortCount, 3);
        assert.equal(result.cohorts.find(item => item.evaluationMode === 'B').primaryBaseline,
            'frozenMarkov');
    }],
    ['does not mutate source packages or probability rows', () => {
        const input = fixtures();
        const before = JSON.stringify(input);
        const result = analyzeEvaluationPackages(input, { bootstrapReplicates: 10 });
        result.cohorts[0].model.confusionMatrix.counts['0']['0'] = 999;
        result.cohorts[0].stateLabels[0] = 'changed';
        result.cohorts[0].stateVocabulary[0].stateId = 999;
        assert.equal(JSON.stringify(input), before);
        assert.deepEqual(input[0].events[0].fullProbabilityRow, [0.75, 0.25, 0]);
    }],
    ['does not derive calibration baselines from evaluation outcomes', () => {
        const id = 'no-snapshot';
        const pkg = exportedPackage(id, {
            calibrationSnapshot: null,
            events: [event(id, 1)]
        });
        const result = analyzeEvaluationPackages(pkg, { bootstrapReplicates: 0 });
        const cohort = result.cohorts[0];
        assert.equal(cohort.baselines.persistence.available, true);
        assert.equal(cohort.baselines.globalMajority.available, false);
        assert.equal(cohort.baselines.uniformExpected.available, true);
        assert.equal(cohort.baselines.frozenMarkov.available, false);
    }],
    ['complete JSON result exposes every required analysis section', () => {
        const result = analyzeEvaluationPackages(fixtures(), { bootstrapReplicates: 0 });
        for (const key of [
            'schemaVersion', 'generatedAt', 'analysisConfiguration', 'inputSummary',
            'warnings', 'errors', 'counts', 'metrics', 'baselines', 'improvements',
            'latency', 'reliability', 'confusionMatrices', 'breakdowns',
            'confidenceIntervals', 'excludedEventSummary', 'notes'
        ]) assert.ok(Object.hasOwn(result, key), key);
        assert.equal(result.generatedAt, '2026-07-20T10:00:00.000Z');
        assert.deepEqual(result.errors, []);
    }],
    ['creates stable session group confusion CSV and Markdown products', () => {
        const result = analyzeEvaluationPackages(fixtures(), { bootstrapReplicates: 0 });
        const sessionCsv = createSessionMetricsCSV(result);
        const groupCsv = createGroupMetricsCSV(result);
        const confusionCsv = createConfusionMatrixCSV(result);
        const report = createMarkdownReport(result);
        assert.equal(sessionCsv.split('\r\n')[0], SESSION_CSV_COLUMNS.join(','));
        assert.equal(sessionCsv.split('\r\n').length, 3);
        assert.equal(groupCsv.split('\r\n')[0], GROUP_CSV_COLUMNS.join(','));
        assert.equal(confusionCsv.split('\r\n')[0], CONFUSION_CSV_COLUMNS.join(','));
        assert.match(confusionCsv, /model,[^\r\n]+,2,2,0,2,0/);
        assert.match(report, /Input summary/);
        assert.match(report, /no effectiveness or statistical-superiority claim/i);
    }],
    ['rejects malformed distributions and lifecycle states', () => {
        const malformed = fixtures()[0];
        malformed.events[0].fullProbabilityRow = [0.8, 0.3, 0];
        assert.throws(() => analyzeEvaluationPackages(malformed), /sum to 1/);
        const malformedStatus = fixtures()[0];
        malformedStatus.events[0].status = 'UNKNOWN';
        assert.throws(() => analyzeEvaluationPackages(malformedStatus), /unsupported/);
    }],
    ['rejects duplicate sessions and conflicting snapshots', () => {
        const first = fixtures()[0];
        assert.throws(() => analyzeEvaluationPackages([first, first]), /Duplicate session ID/);
        const second = exportedPackage('different-session', {
            events: [event('different-session', 1)]
        });
        second.calibrationSnapshot.transitions[0][0] = 2;
        assert.throws(() => analyzeEvaluationPackages([first, second]), /conflicting/);
    }],
    ['CLI accepts multiple files and emits deterministic JSON', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spacelumin-metrics-'));
        try {
            const inputs = fixtures();
            fs.writeFileSync(path.join(directory, 'a.json'), JSON.stringify(inputs[0]));
            fs.writeFileSync(path.join(directory, 'b.json'), JSON.stringify(inputs[1]));
            const script = path.resolve(__dirname, '../scripts/analyze_prediction_evaluation.js');
            const args = [script, '--bootstrap-replicates', '10', '--bootstrap-seed', '7',
                path.join(directory, '*.json')];
            const first = execFileSync(process.execPath, args, { encoding: 'utf8' });
            const second = execFileSync(process.execPath, args, { encoding: 'utf8' });
            assert.equal(first, second);
            const parsed = JSON.parse(first);
            assert.equal(parsed.inputPackageCount, 2);
            assert.equal(parsed.analysisConfiguration.bootstrapSeed, 7);
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    }],
    ['CLI independently writes all five required deterministic products', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spacelumin-products-'));
        try {
            const inputDirectory = path.join(directory, 'inputs');
            const outputDirectory = path.join(directory, 'outputs');
            fs.mkdirSync(inputDirectory);
            fs.mkdirSync(outputDirectory);
            const inputs = fixtures();
            fs.writeFileSync(path.join(inputDirectory, 'a.json'), JSON.stringify(inputs[0]));
            fs.writeFileSync(path.join(inputDirectory, 'b.json'), JSON.stringify(inputs[1]));
            const outputs = {
                json: path.join(outputDirectory, 'metrics.json'),
                session: path.join(outputDirectory, 'sessions.csv'),
                group: path.join(outputDirectory, 'groups.csv'),
                confusion: path.join(outputDirectory, 'confusion.csv'),
                report: path.join(outputDirectory, 'report.md')
            };
            const script = path.resolve(__dirname, '../scripts/analyze_prediction_evaluation.js');
            const args = [script, '--bootstrap-replicates', '10', '--bootstrap-seed', '7',
                '--json-output', outputs.json,
                '--session-csv-output', outputs.session,
                '--group-csv-output', outputs.group,
                '--confusion-csv-output', outputs.confusion,
                '--report-output', outputs.report,
                path.join(inputDirectory, '*.json')];
            const stdout = execFileSync(process.execPath, args, { encoding: 'utf8' });
            assert.equal(stdout, '');
            const firstContents = Object.fromEntries(Object.entries(outputs).map(
                ([name, filename]) => [name, fs.readFileSync(filename, 'utf8')]
            ));
            execFileSync(process.execPath, args, { encoding: 'utf8' });
            const secondContents = Object.fromEntries(Object.entries(outputs).map(
                ([name, filename]) => [name, fs.readFileSync(filename, 'utf8')]
            ));
            assert.deepEqual(firstContents, secondContents);
            assert.equal(JSON.parse(firstContents.json).inputSummary.sessionCount, 2);
            assert.match(firstContents.session, /^cohort,evaluationMode/);
            assert.match(firstContents.group, /^groupingDimension,groupingValue/);
            assert.match(firstContents.confusion,
                /^matrixType,cohort,actualState,predictedState,count,rowSupport,rowRate/);
            assert.match(firstContents.report, /^# SpaceLumin Prediction Evaluation Metrics/);
            for (const [flag, extension] of [
                ['--json-output', 'json'],
                ['--session-csv-output', 'csv'],
                ['--group-csv-output', 'csv'],
                ['--confusion-csv-output', 'csv'],
                ['--report-output', 'md']
            ]) {
                const filename = path.join(outputDirectory,
                    `independent-${flag.slice(2)}.${extension}`);
                const separateStdout = execFileSync(process.execPath, [
                    script, '--bootstrap-replicates', '0', flag, filename,
                    path.join(inputDirectory, '*.json')
                ], { encoding: 'utf8' });
                assert.equal(separateStdout, '');
                assert.equal(fs.existsSync(filename), true);
                assert.ok(fs.statSync(filename).size > 0);
            }
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    }],
    ['CLI rejects invalid JSON with a nonzero exit status', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spacelumin-metrics-bad-'));
        try {
            const filename = path.join(directory, 'bad.json');
            fs.writeFileSync(filename, '{not-json');
            const script = path.resolve(__dirname, '../scripts/analyze_prediction_evaluation.js');
            const result = spawnSync(process.execPath, [script, filename], { encoding: 'utf8' });
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /analysis failed/);
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    }],
    ['CLI refuses to overwrite an input export', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spacelumin-metrics-safe-'));
        try {
            const filename = path.join(directory, 'input.json');
            const pkg = fixtures()[0];
            const original = JSON.stringify(pkg);
            fs.writeFileSync(filename, original);
            const script = path.resolve(__dirname, '../scripts/analyze_prediction_evaluation.js');
            const result = spawnSync(process.execPath,
                [script, '--json-output', filename, filename], { encoding: 'utf8' });
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /must not overwrite/);
            assert.equal(fs.readFileSync(filename, 'utf8'), original);
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    }]
];

let passed = 0;
for (const [name, test] of tests) {
    try {
        test();
        passed++;
        console.log(`PASS ${passed}/${tests.length}: ${name}`);
    } catch (error) {
        console.error(`FAIL ${passed + 1}/${tests.length}: ${name}`);
        throw error;
    }
}
console.log(`PredictionEvaluationMetrics tests passed: ${passed}/${tests.length}`);
