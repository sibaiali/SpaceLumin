/**
 * PredictionEvaluationMetrics.js
 * Pure, offline aggregation for exported SpaceLumin prediction-evaluation packages.
 */
'use strict';

const METRICS_SCHEMA_VERSION = 'spacelumin.prediction-metrics/1.0.0';
const SUPPORTED_EXPORT_SCHEMA = 'spacelumin.prediction-export/1.0.0';
const CLIPPING_EPSILON = 1e-12;
const DEFAULT_BOOTSTRAP_REPLICATES = 2000;
const DEFAULT_BOOTSTRAP_SEED = 20260720;
const NO_PREDICTION = 'NO_PREDICTION';
const VALID_STATUSES = new Set(['OPEN', 'RESOLVED', 'CENSORED', NO_PREDICTION]);

function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, clone(child)])
    );
}

function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function integer(value) {
    return Number.isInteger(value) && value >= 0;
}

function divide(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : null;
}

function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentile(values, probability) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(probability * sorted.length) - 1);
    return sorted[index];
}

function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sortedNumeric(values) {
    return [...new Set(values)].sort((a, b) => a - b);
}

function sortedText(values) {
    return [...new Set(values)].sort((left, right) => {
        const leftText = String(left);
        const rightText = String(right);
        return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
    });
}

function stableObject(entries) {
    return Object.fromEntries(entries.sort(([left], [right]) => {
        const leftText = String(left);
        const rightText = String(right);
        return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
    }));
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function validateProbabilityRow(row, totalStates, path) {
    assert(Array.isArray(row), `${path} must be an array`);
    assert(row.length === totalStates, `${path} must contain ${totalStates} probabilities`);
    let total = 0;
    row.forEach((probability, index) => {
        assert(finite(probability) && probability >= 0 && probability <= 1,
            `${path}[${index}] must be a finite probability`);
        total += probability;
    });
    assert(Math.abs(total - 1) <= 1e-9, `${path} must sum to 1`);
}

function packageDimensions(pkg) {
    const configuredStates = pkg.configuration?.totalStates;
    if (integer(configuredStates) && configuredStates > 0) return configuredStates;
    const snapshotStates = pkg.calibrationSnapshot?.modelDimensions?.totalStates;
    if (integer(snapshotStates) && snapshotStates > 0) return snapshotStates;
    const labelCount = pkg.calibrationSnapshot?.stateLabels?.length;
    if (integer(labelCount) && labelCount > 0) return labelCount;
    const row = pkg.events.find(event => Array.isArray(event.fullProbabilityRow))
        ?.fullProbabilityRow;
    assert(row && row.length > 0,
        'Cannot determine state count without snapshot labels or a probability row');
    return row.length;
}

function validatePackage(input, packageIndex) {
    const path = `packages[${packageIndex}]`;
    assert(input && typeof input === 'object' && !Array.isArray(input),
        `${path} must be an exported JSON object`);
    assert(input.schemaVersion === SUPPORTED_EXPORT_SCHEMA,
        `${path}.schemaVersion must be ${SUPPORTED_EXPORT_SCHEMA}`);
    assert(input.session && typeof input.session === 'object', `${path}.session is required`);
    assert(typeof input.session.sessionId === 'string' && input.session.sessionId.length > 0,
        `${path}.session.sessionId is required`);
    assert(['A', 'B'].includes(input.session.evaluationMode),
        `${path}.session.evaluationMode must be A or B`);
    assert(['human', 'synthetic'].includes(input.session.sourceType),
        `${path}.session.sourceType must be human or synthetic`);
    assert(Array.isArray(input.events), `${path}.events must be an array`);
    if (input.session.calibrationSnapshotId && input.calibrationSnapshot?.snapshotId) {
        assert(input.session.calibrationSnapshotId === input.calibrationSnapshot.snapshotId,
            `${path} session and calibration snapshot IDs disagree`);
    }

    const totalStates = packageDimensions(input);
    if (integer(input.configuration?.totalStates) &&
        integer(input.calibrationSnapshot?.modelDimensions?.totalStates)) {
        assert(input.configuration.totalStates ===
            input.calibrationSnapshot.modelDimensions.totalStates,
        `${path} configuration and snapshot model dimensions disagree`);
    }
    if (input.calibrationSnapshot?.stateLabels !== undefined) {
        assert(Array.isArray(input.calibrationSnapshot.stateLabels) &&
            input.calibrationSnapshot.stateLabels.length === totalStates,
        `${path}.calibrationSnapshot.stateLabels must match the model dimension`);
        assert(input.calibrationSnapshot.stateLabels.every(label => typeof label === 'string'),
            `${path}.calibrationSnapshot.stateLabels must be textual`);
    }
    if (input.calibrationSnapshot?.stateVocabulary !== undefined) {
        assert(Array.isArray(input.calibrationSnapshot.stateVocabulary) &&
            input.calibrationSnapshot.stateVocabulary.length === totalStates,
        `${path}.calibrationSnapshot.stateVocabulary must match the model dimension`);
        input.calibrationSnapshot.stateVocabulary.forEach((entry, stateId) => {
            assert(entry && entry.stateId === stateId,
                `${path}.calibrationSnapshot.stateVocabulary must map by numeric index`);
        });
    }
    const eventIds = new Set();
    input.events.forEach((event, eventIndex) => {
        const eventPath = `${path}.events[${eventIndex}]`;
        assert(event && typeof event === 'object', `${eventPath} must be an object`);
        assert(typeof event.eventId === 'string' && event.eventId.length > 0,
            `${eventPath}.eventId is required`);
        assert(!eventIds.has(event.eventId), `${eventPath}.eventId is duplicated`);
        eventIds.add(event.eventId);
        assert(event.sessionId === input.session.sessionId,
            `${eventPath}.sessionId does not match its package session`);
        assert(VALID_STATUSES.has(event.status), `${eventPath}.status is unsupported`);
        assert(integer(event.currentState) && event.currentState < totalStates,
            `${eventPath}.currentState is outside the state vocabulary`);

        if (event.status === 'RESOLVED' || event.status === NO_PREDICTION) {
            assert(integer(event.actualNextState) && event.actualNextState < totalStates,
                `${eventPath}.actualNextState is required for a resolved opportunity`);
        } else {
            assert(event.actualNextState === null,
                `${eventPath}.actualNextState must be null while unresolved or censored`);
        }

        if (event.status === 'RESOLVED') {
            assert(event.predictionAvailable === true,
                `${eventPath}.predictionAvailable must be true for RESOLVED`);
            assert(integer(event.predictedNextState) && event.predictedNextState < totalStates,
                `${eventPath}.predictedNextState is invalid`);
            validateProbabilityRow(event.fullProbabilityRow, totalStates,
                `${eventPath}.fullProbabilityRow`);
            assert(event.predictedNextState === lowestArgmax(event.fullProbabilityRow),
                `${eventPath}.predictedNextState disagrees with the documented tie rule`);
            assert(event.correct === (event.predictedNextState === event.actualNextState),
                `${eventPath}.correct disagrees with exact top-1 equality`);
            const actualProbability = event.fullProbabilityRow[event.actualNextState];
            assert(finite(event.probabilityAssignedToActualState) &&
                Math.abs(event.probabilityAssignedToActualState - actualProbability) <= 1e-12,
            `${eventPath}.probabilityAssignedToActualState disagrees with its stored row`);
        } else if (event.status === NO_PREDICTION) {
            assert(event.predictionAvailable === false,
                `${eventPath}.predictionAvailable must be false for NO_PREDICTION`);
            assert(event.predictedNextState === null && event.fullProbabilityRow === null,
                `${eventPath} must not contain a prediction or probability row`);
            assert(event.correct === false,
                `${eventPath}.correct must be false for a resolved missing prediction`);
            assert(event.probabilityAssignedToActualState === null,
                `${eventPath}.probabilityAssignedToActualState must be null`);
        }
        if (event.predictionLatencyMs !== null && event.predictionLatencyMs !== undefined) {
            assert(finite(event.predictionLatencyMs) && event.predictionLatencyMs >= 0,
                `${eventPath}.predictionLatencyMs must be non-negative or null`);
        }

        if (event.status === 'OPEN' || event.status === 'CENSORED') {
            assert(event.correct === null, `${eventPath}.correct must be null`);
            if (event.predictionAvailable === true) {
                assert(integer(event.predictedNextState) && event.predictedNextState < totalStates,
                    `${eventPath}.predictedNextState is invalid`);
                validateProbabilityRow(event.fullProbabilityRow, totalStates,
                    `${eventPath}.fullProbabilityRow`);
                assert(event.predictedNextState === lowestArgmax(event.fullProbabilityRow),
                    `${eventPath}.predictedNextState disagrees with the documented tie rule`);
            } else {
                assert(event.predictionAvailable === false &&
                    event.predictedNextState === null && event.fullProbabilityRow === null,
                `${eventPath} has inconsistent missing-prediction fields`);
            }
        }
    });

    return { package: input, totalStates };
}

function snapshotIdentity(pkg) {
    const snapshot = pkg.calibrationSnapshot;
    return snapshot?.snapshotId || 'snapshot-unavailable';
}

function cohortKey(pkg) {
    const session = pkg.session;
    return [
        session.evaluationMode,
        session.sourceType,
        session.evaluatorConfigurationVersion || 'configuration-unavailable',
        snapshotIdentity(pkg)
    ].join('|');
}

function comparableSnapshot(snapshot) {
    if (!snapshot) return null;
    return JSON.stringify({
        snapshotId: snapshot.snapshotId ?? null,
        stateLabels: snapshot.stateLabels ?? null,
        stateVocabulary: snapshot.stateVocabulary ?? null,
        minTransitions: snapshot.minTransitions ?? null,
        totalTransitions: snapshot.totalTransitions ?? null,
        transitions: snapshot.transitions ?? null,
        globalStateCounts: snapshot.globalStateCounts ?? null,
        modelDimensions: snapshot.modelDimensions ?? null,
        smoothingConfiguration: snapshot.smoothingConfiguration ?? null
    });
}

function calibrationModel(pkg, totalStates) {
    const snapshot = pkg.calibrationSnapshot;
    if (!snapshot) {
        return { available: false, reason: 'calibration snapshot unavailable' };
    }
    const counts = snapshot.globalStateCounts;
    const transitions = snapshot.transitions;
    if (!Array.isArray(counts) || counts.length !== totalStates ||
        !counts.every(count => finite(count) && count >= 0)) {
        return { available: false, reason: 'calibration global state counts unavailable' };
    }
    if (!Array.isArray(transitions) || transitions.length !== totalStates ||
        !transitions.every(row => Array.isArray(row) && row.length === totalStates &&
            row.every(count => finite(count) && count >= 0))) {
        return { available: false, reason: 'calibration transition matrix unavailable' };
    }
    const total = counts.reduce((sum, count) => sum + count, 0);
    const derivedCounts = Array(totalStates).fill(0);
    transitions.forEach(row => row.forEach((count, state) => {
        derivedCounts[state] += count;
    }));
    assert(derivedCounts.every((count, state) =>
        Math.abs(count - counts[state]) <= 1e-9
    ), 'Calibration global state counts disagree with transition columns');
    const validStates = counts.map((count, state) => count > 0 ? state : null)
        .filter(state => state !== null);
    if (total <= 0 || !validStates.length) {
        return { available: false, reason: 'calibration snapshot has no observed next states' };
    }
    return {
        available: true,
        validStates,
        globalDistribution: counts.map(count => count / total),
        transitions: transitions.map(row => [...row]),
        modelReady: (finite(snapshot.totalTransitions)
            ? snapshot.totalTransitions
            : transitions.flat().reduce((sum, count) => sum + count, 0)) >=
            (finite(snapshot.minTransitions) ? snapshot.minTransitions : 0)
    };
}

function lowestArgmax(row) {
    let selected = 0;
    for (let index = 1; index < row.length; index++) {
        if (row[index] > row[selected]) selected = index;
    }
    return selected;
}

function distributionForBaseline(kind, event, calibration, totalStates) {
    if (kind === 'persistence') {
        const row = Array(totalStates).fill(0);
        row[event.currentState] = 1;
        return row;
    }
    if (!calibration.available) return null;
    if (kind === 'globalMajority') return [...calibration.globalDistribution];
    if (kind === 'frozenMarkov' || kind === 'frozenPerStateMajority') {
        if (!calibration.modelReady) return null;
        const counts = calibration.transitions[event.currentState];
        const total = counts.reduce((sum, count) => sum + count, 0);
        return total > 0 ? counts.map(count => count / total) : null;
    }
    throw new Error(`Unknown baseline ${kind}`);
}

function projectEvent(event, distribution) {
    if (!distribution) {
        return {
            ...event,
            status: NO_PREDICTION,
            predictedNextState: null,
            predictionAvailable: false,
            fullProbabilityRow: null,
            correct: false,
            probabilityAssignedToActualState: null
        };
    }
    const predictedNextState = lowestArgmax(distribution);
    return {
        ...event,
        status: 'RESOLVED',
        predictedNextState,
        predictionAvailable: true,
        fullProbabilityRow: distribution,
        correct: predictedNextState === event.actualNextState,
        probabilityAssignedToActualState: distribution[event.actualNextState]
    };
}

function metricEvent(event) {
    if (event.status === NO_PREDICTION) return { ...event, correct: false };
    return {
        ...event,
        correct: event.predictedNextState === event.actualNextState
    };
}

function probabilityMetrics(predictedEvents) {
    const probabilistic = predictedEvents.filter(event =>
        event.status === 'RESOLVED' && Array.isArray(event.fullProbabilityRow)
    );
    if (!probabilistic.length) {
        return {
            evaluatedDistributionCount: 0,
            impossibleEventCount: 0,
            impossibleEventRate: null,
            clippedLogLoss: null,
            clippingEpsilon: CLIPPING_EPSILON,
            brierScore: null,
            meanProbabilityAssignedToActualState: null
        };
    }
    let impossible = 0;
    let logLoss = 0;
    let brier = 0;
    let actualProbabilityTotal = 0;
    for (const event of probabilistic) {
        const actualProbability = event.fullProbabilityRow[event.actualNextState];
        if (actualProbability === 0) impossible++;
        logLoss -= Math.log(Math.max(actualProbability, CLIPPING_EPSILON));
        actualProbabilityTotal += actualProbability;
        event.fullProbabilityRow.forEach((probability, state) => {
            const target = state === event.actualNextState ? 1 : 0;
            brier += (probability - target) ** 2;
        });
    }
    return {
        evaluatedDistributionCount: probabilistic.length,
        impossibleEventCount: impossible,
        impossibleEventRate: impossible / probabilistic.length,
        clippedLogLoss: logLoss / probabilistic.length,
        clippingEpsilon: CLIPPING_EPSILON,
        brierScore: brier / probabilistic.length,
        meanProbabilityAssignedToActualState:
            actualProbabilityTotal / probabilistic.length
    };
}

function reliabilityAnalysis(events) {
    const predicted = events.filter(event =>
        event.status === 'RESOLVED' && Array.isArray(event.fullProbabilityRow)
    );
    const boundaries = [0, 0.2, 0.4, 0.6, 0.8, 1];
    return boundaries.slice(0, -1).map((lower, index) => {
        const upper = boundaries[index + 1];
        const included = predicted.filter(event => {
            const confidence = event.fullProbabilityRow[event.predictedNextState];
            return confidence >= lower && (index === boundaries.length - 2
                ? confidence <= upper
                : confidence < upper);
        });
        const confidences = included.map(event =>
            event.fullProbabilityRow[event.predictedNextState]
        );
        const correct = included.filter(event => event.correct === true).length;
        return {
            lowerInclusive: lower,
            upperInclusive: index === boundaries.length - 2 ? upper : null,
            upperExclusive: index === boundaries.length - 2 ? null : upper,
            count: included.length,
            meanTop1Probability: mean(confidences),
            observedTop1Accuracy: divide(correct, included.length),
            sparse: included.length < 20
        };
    });
}

function basicMetrics(events, totalStates) {
    const eligible = events.filter(event =>
        event.status === 'RESOLVED' || event.status === NO_PREDICTION
    ).map(metricEvent);
    const predicted = eligible.filter(event => event.status === 'RESOLVED');
    const correctEligible = eligible.filter(event => event.correct === true).length;
    const correctPredicted = predicted.filter(event => event.correct === true).length;
    const actualStates = sortedNumeric(eligible.map(event => event.actualNextState));
    const strictRecallByActualState = stableObject(actualStates.map(state => {
        const stateEvents = eligible.filter(event => event.actualNextState === state);
        const correct = stateEvents.filter(event => event.correct === true).length;
        return [String(state), { support: stateEvents.length, correct, recall: divide(correct, stateEvents.length) }];
    }));
    const conditionalRecallByActualState = stableObject(actualStates.map(state => {
        const stateEvents = predicted.filter(event => event.actualNextState === state);
        const correct = stateEvents.filter(event => event.correct === true).length;
        return [String(state), {
            support: stateEvents.length,
            correct,
            recall: divide(correct, stateEvents.length)
        }];
    }));
    const strictRecalls = Object.values(strictRecallByActualState).map(item => item.recall);
    const conditionalRecalls = Object.values(conditionalRecallByActualState)
        .map(item => item.recall).filter(value => value !== null);
    const probability = probabilityMetrics(predicted);
    return {
        counts: {
            totalEventCount: events.length,
            resolvedOpportunities: eligible.length,
            predictionAvailableOpportunities: predicted.length,
            noPredictionOpportunities: eligible.length - predicted.length,
            validProbabilityCount: probability.evaluatedDistributionCount,
            openEvents: events.filter(event => event.status === 'OPEN').length,
            censoredEvents: events.filter(event => event.status === 'CENSORED').length,
            unresolvedEvents: events.filter(event =>
                event.status === 'OPEN' || event.status === 'CENSORED'
            ).length,
            malformedEvents: 0,
            skippedEvents: 0
        },
        accuracy: {
            strictTop1Accuracy: divide(correctEligible, eligible.length),
            conditionalTop1Accuracy: divide(correctPredicted, predicted.length),
            predictionCoverage: divide(predicted.length, eligible.length),
            strictBalancedAccuracy: mean(strictRecalls),
            conditionalBalancedAccuracy: mean(conditionalRecalls),
            correctPredictions: correctEligible,
            includedActualStates: actualStates,
            strictRecallByActualState,
            conditionalRecallByActualState
        },
        probability,
        reliability: {
            type: 'top-1 reliability',
            bins: reliabilityAnalysis(predicted)
        },
        confusionMatrix: confusionMatrix(eligible, totalStates)
    };
}

function confusionMatrix(events, totalStates) {
    const actualStates = [...Array(totalStates).keys()];
    const columns = [...Array(totalStates).keys()].map(String).concat(NO_PREDICTION);
    const counts = {};
    const rowPercentages = {};
    for (const actual of actualStates) {
        const row = Object.fromEntries(columns.map(column => [column, 0]));
        events.filter(event => event.actualNextState === actual).forEach(event => {
            const column = event.status === NO_PREDICTION
                ? NO_PREDICTION
                : String(event.predictedNextState);
            row[column]++;
        });
        const support = Object.values(row).reduce((sum, value) => sum + value, 0);
        counts[String(actual)] = row;
        rowPercentages[String(actual)] = Object.fromEntries(
            columns.map(column => [column, divide(row[column], support)])
        );
    }
    return { actualStateRows: actualStates.map(String), predictedStateColumns: columns, counts, rowPercentages };
}

function latencyMetrics(events) {
    const all = events.filter(event => finite(event.predictionLatencyMs))
        .map(event => event.predictionLatencyMs);
    const ready = events.filter(event => event.status === 'RESOLVED' && finite(event.predictionLatencyMs))
        .map(event => event.predictionLatencyMs);
    const warmup = events.filter(event => event.status === NO_PREDICTION && finite(event.predictionLatencyMs))
        .map(event => event.predictionLatencyMs);
    function summarize(values) {
        return {
            count: values.length,
            minimumMs: values.length ? Math.min(...values) : null,
            maximumMs: values.length ? Math.max(...values) : null,
            meanMs: mean(values),
            medianMs: median(values),
            p95Ms: percentile(values, 0.95)
        };
    }
    return { allOpportunities: summarize(all), readyModel: summarize(ready), warmupOrMissing: summarize(warmup) };
}

function groupMetrics(events, property, totalStates) {
    const values = sortedText(events.map(event => event[property] ?? 'unavailable'));
    return stableObject(values.map(value => {
        const grouped = events.filter(event => (event[property] ?? 'unavailable') === value);
        const metrics = basicMetrics(grouped, totalStates);
        return [String(value), {
            totalEventCount: metrics.counts.totalEventCount,
            resolvedOpportunities: metrics.counts.resolvedOpportunities,
            predictionAvailableOpportunities:
                metrics.counts.predictionAvailableOpportunities,
            noPredictionOpportunities: metrics.counts.noPredictionOpportunities,
            strictTop1Accuracy: metrics.accuracy.strictTop1Accuracy,
            conditionalTop1Accuracy: metrics.accuracy.conditionalTop1Accuracy,
            strictBalancedAccuracy: metrics.accuracy.strictBalancedAccuracy,
            conditionalBalancedAccuracy: metrics.accuracy.conditionalBalancedAccuracy,
            predictionCoverage: metrics.accuracy.predictionCoverage,
            validProbabilityCount: metrics.counts.validProbabilityCount,
            impossibleEventCount: metrics.probability.impossibleEventCount,
            impossibleEventRate: metrics.probability.impossibleEventRate,
            clippedLogLoss: metrics.probability.clippedLogLoss,
            brierScore: metrics.probability.brierScore,
            meanProbabilityAssignedToActualState:
                metrics.probability.meanProbabilityAssignedToActualState,
            interpretation: metrics.counts.resolvedOpportunities < 20
                ? 'counts only; fewer than 20 evaluated transitions'
                : metrics.counts.resolvedOpportunities < 50
                    ? 'exploratory; 20-49 evaluated transitions'
                    : 'descriptive rate has at least 50 evaluated transitions'
        }];
    }));
}

function sessionDistribution(events, totalStates) {
    const bySession = groupMetrics(events, 'sessionId', totalStates);
    const accuracies = Object.values(bySession)
        .map(item => item.strictTop1Accuracy)
        .filter(finite);
    return {
        sessions: bySession,
        summary: {
            sessionCount: Object.keys(bySession).length,
            minimumStrictAccuracy: accuracies.length ? Math.min(...accuracies) : null,
            firstQuartileStrictAccuracy: percentile(accuracies, 0.25),
            medianStrictAccuracy: median(accuracies),
            thirdQuartileStrictAccuracy: percentile(accuracies, 0.75),
            maximumStrictAccuracy: accuracies.length ? Math.max(...accuracies) : null
        }
    };
}

function baselineAnalysis(kind, eligible, calibration, totalStates) {
    if (kind === 'uniformExpected') {
        const sampleCount = eligible.length;
        const expectedAccuracy = sampleCount ? 1 / totalStates : null;
        return {
            available: true,
            definition: 'expected uniform reference; not an observed classifier',
            observedClassifier: false,
            counts: {
                totalEventCount: sampleCount,
                resolvedOpportunities: sampleCount,
                predictionAvailableOpportunities: sampleCount,
                noPredictionOpportunities: 0,
                validProbabilityCount: sampleCount,
                openEvents: 0,
                censoredEvents: 0,
                unresolvedEvents: 0,
                malformedEvents: 0,
                skippedEvents: 0
            },
            accuracy: {
                strictTop1Accuracy: expectedAccuracy,
                conditionalTop1Accuracy: expectedAccuracy,
                strictBalancedAccuracy: expectedAccuracy,
                conditionalBalancedAccuracy: expectedAccuracy,
                predictionCoverage: sampleCount ? 1 : null,
                correctPredictions: null,
                includedActualStates: sortedNumeric(eligible.map(event => event.actualNextState)),
                strictRecallByActualState: null,
                conditionalRecallByActualState: null
            },
            probability: {
                evaluatedDistributionCount: sampleCount,
                impossibleEventCount: 0,
                impossibleEventRate: sampleCount ? 0 : null,
                clippedLogLoss: sampleCount ? Math.log(totalStates) : null,
                clippingEpsilon: CLIPPING_EPSILON,
                brierScore: sampleCount ? 1 - (1 / totalStates) : null,
                meanProbabilityAssignedToActualState: sampleCount ? 1 / totalStates : null
            },
            reliability: null,
            confusionMatrix: null,
            missingRowCount: 0,
            validSampleCount: sampleCount,
            predictionEventIds: eligible.map(event => event.eventId).sort()
        };
    }
    if (kind !== 'persistence' && !calibration.available) {
        return { available: false, reason: calibration.reason };
    }
    const projected = eligible.map(event => projectEvent(
        event,
        distributionForBaseline(kind, event, calibration, totalStates)
    ));
    const metrics = basicMetrics(projected, totalStates);
    return {
        available: true,
        observedClassifier: true,
        definition: kind === 'frozenPerStateMajority'
            ? 'equivalence sanity check for frozen Markov top-1'
            : kind,
        ...metrics,
        missingRowCount: metrics.counts.noPredictionOpportunities,
        validSampleCount: metrics.counts.resolvedOpportunities,
        predictionEventIds: projected.filter(event => event.status === 'RESOLVED')
            .map(event => event.eventId).sort()
    };
}

function improvementValue(modelAccuracy, baselineAccuracy) {
    if (!finite(modelAccuracy) || !finite(baselineAccuracy)) return {
        absoluteImprovement: null,
        normalizedImprovement: null,
        warning: 'metric denominator is zero or unavailable'
    };
    if (baselineAccuracy === 1) return {
        absoluteImprovement: modelAccuracy - baselineAccuracy,
        normalizedImprovement: null,
        warning: 'normalized improvement is undefined because baseline accuracy equals 1'
    };
    return {
        absoluteImprovement: modelAccuracy - baselineAccuracy,
        normalizedImprovement:
            (modelAccuracy - baselineAccuracy) / (1 - baselineAccuracy),
        warning: null
    };
}

function comparison(model, baseline, modelPredictionEventIds) {
    if (!baseline.available) return { available: false, reason: baseline.reason };
    const modelStrict = model.accuracy.strictTop1Accuracy;
    const baselineStrict = baseline.accuracy.strictTop1Accuracy;
    if (modelStrict === null || baselineStrict === null) {
        return { available: false, reason: 'no evaluated transitions' };
    }
    const comparableConditionalSamples = JSON.stringify(modelPredictionEventIds) ===
        JSON.stringify(baseline.predictionEventIds);
    return {
        available: true,
        strict: {
            modelAccuracy: modelStrict,
            baselineAccuracy: baselineStrict,
            ...improvementValue(modelStrict, baselineStrict)
        },
        conditional: comparableConditionalSamples
            ? {
                comparableSamples: true,
                modelAccuracy: model.accuracy.conditionalTop1Accuracy,
                baselineAccuracy: baseline.accuracy.conditionalTop1Accuracy,
                ...improvementValue(
                    model.accuracy.conditionalTop1Accuracy,
                    baseline.accuracy.conditionalTop1Accuracy
                )
            }
            : {
                comparableSamples: false,
                modelAccuracy: model.accuracy.conditionalTop1Accuracy,
                baselineAccuracy: baseline.accuracy.conditionalTop1Accuracy,
                absoluteImprovement: null,
                normalizedImprovement: null,
                warning: 'conditional predictions were available on different sample sets'
            }
    };
}

function mulberry32(seed) {
    let state = seed >>> 0;
    return function random() {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function bootstrapInterval(values) {
    const usable = values.filter(finite).sort((a, b) => a - b);
    return usable.length
        ? { lower: percentile(usable, 0.025), upper: percentile(usable, 0.975), validReplicates: usable.length }
        : { lower: null, upper: null, validReplicates: 0 };
}

function clusteredBootstrap(events, totalStates, calibration, options, declaredSessionIds = []) {
    const sessionIds = sortedText([
        ...declaredSessionIds,
        ...events.map(event => event.sessionId)
    ]);
    const replicates = options.bootstrapReplicates;
    const seed = options.bootstrapSeed;
    if (sessionIds.length < 2 || replicates === 0) {
        return {
            available: false,
            reason: replicates === 0 ? 'bootstrap disabled' : 'at least two sessions are required',
            method: 'session-clustered percentile bootstrap',
            confidenceLevel: 0.95,
            seed,
            requestedReplicates: replicates,
            intervals: null
        };
    }
    const bySession = new Map(sessionIds.map(id => [id, events.filter(event => event.sessionId === id)]));
    const random = mulberry32(seed);
    const samples = {
        strictTop1Accuracy: [], conditionalTop1Accuracy: [], predictionCoverage: [],
        impossibleEventRate: [], clippedLogLoss: [], brierScore: [],
        meanProbabilityAssignedToActualState: [], meanLatencyMs: [], medianLatencyMs: [],
        p95LatencyMs: [], persistenceBaselineStrictAccuracy: [],
        persistenceBaselineConditionalAccuracy: [],
        persistenceStrictImprovement: [], persistenceConditionalImprovement: [],
        globalMajorityStrictImprovement: [], globalMajorityConditionalImprovement: [],
        uniformExpectedStrictImprovement: [], uniformExpectedConditionalImprovement: [],
        frozenMarkovStrictImprovement: [], frozenMarkovConditionalImprovement: []
    };
    const groupedSamples = {
        currentState: Object.fromEntries(sortedText(events.map(event => event.currentState))
            .map(value => [String(value), []])),
        sector: Object.fromEntries(sortedText(events.map(event => event.sector ?? 'unavailable'))
            .map(value => [String(value), []])),
        participant: Object.fromEntries(sortedText(events.map(event =>
            event.participantLabel ?? 'participant-unknown'
        )).map(value => [String(value), []]))
    };
    const reliabilitySamples = Array.from({ length: 5 }, () => ({
        observedTop1Accuracy: [],
        meanTop1Probability: []
    }));
    function strictAccuracy(groupedEvents) {
        const eligible = groupedEvents.filter(event =>
            event.status === 'RESOLVED' || event.status === NO_PREDICTION
        );
        return divide(eligible.filter(event =>
            event.status === 'RESOLVED' && event.predictedNextState === event.actualNextState
        ).length, eligible.length);
    }
    function difference(modelValue, baseline) {
        const baselineValue = baseline.available
            ? baseline.accuracy.strictTop1Accuracy
            : null;
        return finite(modelValue) && finite(baselineValue)
            ? modelValue - baselineValue
            : null;
    }
    for (let replicate = 0; replicate < replicates; replicate++) {
        const sampled = [];
        for (let index = 0; index < sessionIds.length; index++) {
            const selectedId = sessionIds[Math.floor(random() * sessionIds.length)];
            sampled.push(...bySession.get(selectedId));
        }
        const model = basicMetrics(sampled, totalStates);
        const latency = latencyMetrics(sampled).allOpportunities;
        samples.strictTop1Accuracy.push(model.accuracy.strictTop1Accuracy);
        samples.conditionalTop1Accuracy.push(model.accuracy.conditionalTop1Accuracy);
        samples.predictionCoverage.push(model.accuracy.predictionCoverage);
        samples.impossibleEventRate.push(model.probability.impossibleEventRate);
        samples.clippedLogLoss.push(model.probability.clippedLogLoss);
        samples.brierScore.push(model.probability.brierScore);
        samples.meanProbabilityAssignedToActualState.push(
            model.probability.meanProbabilityAssignedToActualState
        );
        samples.meanLatencyMs.push(latency.meanMs);
        samples.medianLatencyMs.push(latency.medianMs);
        samples.p95LatencyMs.push(latency.p95Ms);
        const eligible = sampled.filter(event =>
            event.status === 'RESOLVED' || event.status === NO_PREDICTION
        );
        const persistence = baselineAnalysis('persistence', eligible, calibration, totalStates);
        const globalMajority = baselineAnalysis(
            'globalMajority', eligible, calibration, totalStates
        );
        const uniformExpected = baselineAnalysis(
            'uniformExpected', eligible, calibration, totalStates
        );
        const frozen = baselineAnalysis('frozenMarkov', eligible, calibration, totalStates);
        const modelPredictionIds = eligible.filter(event => event.status === 'RESOLVED')
            .map(event => event.eventId).sort();
        const baselineItems = {
            persistence,
            globalMajority,
            uniformExpected,
            frozenMarkov: frozen
        };
        samples.persistenceBaselineStrictAccuracy.push(
            persistence.accuracy.strictTop1Accuracy
        );
        samples.persistenceBaselineConditionalAccuracy.push(
            persistence.accuracy.conditionalTop1Accuracy
        );
        samples.persistenceStrictImprovement.push(difference(
            model.accuracy.strictTop1Accuracy, persistence
        ));
        samples.globalMajorityStrictImprovement.push(difference(
            model.accuracy.strictTop1Accuracy, globalMajority
        ));
        samples.uniformExpectedStrictImprovement.push(difference(
            model.accuracy.strictTop1Accuracy, uniformExpected
        ));
        samples.frozenMarkovStrictImprovement.push(difference(
            model.accuracy.strictTop1Accuracy, frozen
        ));
        for (const [name, baseline] of Object.entries(baselineItems)) {
            const comparable = JSON.stringify(modelPredictionIds) ===
                JSON.stringify(baseline.predictionEventIds);
            samples[`${name}ConditionalImprovement`].push(comparable
                ? model.accuracy.conditionalTop1Accuracy -
                    baseline.accuracy.conditionalTop1Accuracy
                : null);
        }
        for (const [name, property] of [
            ['currentState', 'currentState'],
            ['sector', 'sector'],
            ['participant', 'participantLabel']
        ]) {
            for (const key of Object.keys(groupedSamples[name])) {
                groupedSamples[name][key].push(strictAccuracy(sampled.filter(event =>
                    String(event[property] ?? (property === 'participantLabel'
                        ? 'participant-unknown'
                        : 'unavailable')) === key
                )));
            }
        }
        reliabilityAnalysis(sampled).forEach((bin, index) => {
            reliabilitySamples[index].observedTop1Accuracy.push(bin.observedTop1Accuracy);
            reliabilitySamples[index].meanTop1Probability.push(bin.meanTop1Probability);
        });
    }
    return {
        available: true,
        method: 'session-clustered percentile bootstrap',
        confidenceLevel: 0.95,
        seed,
        requestedReplicates: replicates,
        intervals: stableObject(Object.entries(samples).map(([name, values]) =>
            [name, bootstrapInterval(values)]
        )),
        groupedStrictAccuracyIntervals: stableObject(Object.entries(groupedSamples).map(
            ([groupName, groups]) => [groupName, stableObject(Object.entries(groups).map(
                ([key, values]) => [key, bootstrapInterval(values)]
            ))]
        )),
        reliabilityIntervals: reliabilitySamples.map((bin, index) => ({
            binIndex: index,
            observedTop1Accuracy: bootstrapInterval(bin.observedTop1Accuracy),
            meanTop1Probability: bootstrapInterval(bin.meanTop1Probability)
        }))
    };
}

function participantClusteredBootstrap(
    events,
    totalStates,
    calibration,
    options,
    sessionDescriptors = []
) {
    const validEvents = events.filter(event =>
        event.participantLabel && event.participantLabel !== 'participant-unknown'
    );
    const participantIds = sortedText([
        ...validEvents.map(event => event.participantLabel),
        ...sessionDescriptors.map(session => session.participantLabel)
            .filter(label => label && label !== 'participant-unknown')
    ]);
    const replicates = options.bootstrapReplicates;
    const seed = options.bootstrapSeed;
    if (participantIds.length < 2 || replicates === 0) {
        return {
            available: false,
            reason: replicates === 0
                ? 'bootstrap disabled'
                : 'at least two genuine participant labels are required',
            warning: participantIds.length < 2
                ? 'participant-unknown is not treated as multiple people'
                : null,
            method: 'participant-clustered percentile bootstrap',
            confidenceLevel: 0.95,
            seed,
            requestedReplicates: replicates,
            validParticipantCount: participantIds.length,
            excludedUnknownParticipantEvents: events.length - validEvents.length,
            intervals: null
        };
    }
    const byParticipant = new Map(participantIds.map(id => [
        id,
        validEvents.filter(event => event.participantLabel === id)
    ]));
    const random = mulberry32(seed ^ 0x9E3779B9);
    const samples = {
        strictTop1Accuracy: [], conditionalTop1Accuracy: [], predictionCoverage: [],
        meanProbabilityAssignedToActualState: [], clippedLogLoss: [], brierScore: [],
        meanLatencyMs: [], persistenceBaselineStrictAccuracy: [],
        persistenceBaselineConditionalAccuracy: [],
        persistenceStrictImprovement: [], persistenceConditionalImprovement: [],
        globalMajorityStrictImprovement: [], globalMajorityConditionalImprovement: [],
        uniformExpectedStrictImprovement: [], uniformExpectedConditionalImprovement: [],
        frozenMarkovStrictImprovement: [], frozenMarkovConditionalImprovement: []
    };
    for (let replicate = 0; replicate < replicates; replicate++) {
        const sampled = [];
        for (let index = 0; index < participantIds.length; index++) {
            const selected = participantIds[Math.floor(random() * participantIds.length)];
            sampled.push(...byParticipant.get(selected));
        }
        const model = basicMetrics(sampled, totalStates);
        const latency = latencyMetrics(sampled).allOpportunities;
        const eligible = sampled.filter(event =>
            event.status === 'RESOLVED' || event.status === NO_PREDICTION
        );
        const baselines = {
            persistence: baselineAnalysis('persistence', eligible, calibration, totalStates),
            globalMajority: baselineAnalysis(
                'globalMajority', eligible, calibration, totalStates
            ),
            uniformExpected: baselineAnalysis(
                'uniformExpected', eligible, calibration, totalStates
            ),
            frozenMarkov: baselineAnalysis('frozenMarkov', eligible, calibration, totalStates)
        };
        samples.strictTop1Accuracy.push(model.accuracy.strictTop1Accuracy);
        samples.conditionalTop1Accuracy.push(model.accuracy.conditionalTop1Accuracy);
        samples.predictionCoverage.push(model.accuracy.predictionCoverage);
        samples.meanProbabilityAssignedToActualState.push(
            model.probability.meanProbabilityAssignedToActualState
        );
        samples.clippedLogLoss.push(model.probability.clippedLogLoss);
        samples.brierScore.push(model.probability.brierScore);
        samples.meanLatencyMs.push(latency.meanMs);
        samples.persistenceBaselineStrictAccuracy.push(
            baselines.persistence.accuracy.strictTop1Accuracy
        );
        samples.persistenceBaselineConditionalAccuracy.push(
            baselines.persistence.accuracy.conditionalTop1Accuracy
        );
        const modelPredictionIds = eligible.filter(event => event.status === 'RESOLVED')
            .map(event => event.eventId).sort();
        for (const [name, baseline] of Object.entries(baselines)) {
            samples[`${name}StrictImprovement`].push(
                baseline.available && finite(model.accuracy.strictTop1Accuracy) &&
                    finite(baseline.accuracy.strictTop1Accuracy)
                    ? model.accuracy.strictTop1Accuracy -
                        baseline.accuracy.strictTop1Accuracy
                    : null
            );
            const comparable = baseline.available &&
                JSON.stringify(modelPredictionIds) ===
                    JSON.stringify(baseline.predictionEventIds);
            samples[`${name}ConditionalImprovement`].push(comparable &&
                finite(model.accuracy.conditionalTop1Accuracy) &&
                finite(baseline.accuracy.conditionalTop1Accuracy)
                ? model.accuracy.conditionalTop1Accuracy -
                    baseline.accuracy.conditionalTop1Accuracy
                : null);
        }
    }
    return {
        available: true,
        method: 'participant-clustered percentile bootstrap',
        confidenceLevel: 0.95,
        seed,
        deterministicSeedTransform: 'seed XOR 0x9E3779B9',
        requestedReplicates: replicates,
        validParticipantCount: participantIds.length,
        participantLabels: participantIds,
        participantClusters: stableObject(participantIds.map(participantId => [
            participantId,
            {
                sessionIds: sortedText([
                    ...byParticipant.get(participantId).map(event => event.sessionId),
                    ...sessionDescriptors.filter(session =>
                        session.participantLabel === participantId
                    ).map(session => session.sessionId)
                ]),
                eventCount: byParticipant.get(participantId).length
            }
        ])),
        excludedUnknownParticipantEvents: events.length - validEvents.length,
        intervals: stableObject(Object.entries(samples).map(([name, values]) =>
            [name, bootstrapInterval(values)]
        ))
    };
}

function metricSummary(events, totalStates) {
    const metrics = basicMetrics(events, totalStates);
    const latency = latencyMetrics(events).allOpportunities;
    return {
        totalEventCount: metrics.counts.totalEventCount,
        resolvedOpportunities: metrics.counts.resolvedOpportunities,
        predictionAvailableOpportunities:
            metrics.counts.predictionAvailableOpportunities,
        noPredictionOpportunities: metrics.counts.noPredictionOpportunities,
        censoredEvents: metrics.counts.censoredEvents,
        unresolvedEvents: metrics.counts.unresolvedEvents,
        conditionalTop1Accuracy: metrics.accuracy.conditionalTop1Accuracy,
        strictTop1Accuracy: metrics.accuracy.strictTop1Accuracy,
        conditionalBalancedAccuracy: metrics.accuracy.conditionalBalancedAccuracy,
        strictBalancedAccuracy: metrics.accuracy.strictBalancedAccuracy,
        coverage: metrics.accuracy.predictionCoverage,
        validProbabilityCount: metrics.counts.validProbabilityCount,
        meanProbabilityAssignedToActualState:
            metrics.probability.meanProbabilityAssignedToActualState,
        clippedLogLoss: metrics.probability.clippedLogLoss,
        brierScore: metrics.probability.brierScore,
        impossibleEventCount: metrics.probability.impossibleEventCount,
        impossibleEventRate: metrics.probability.impossibleEventRate,
        latencyCount: latency.count,
        minimumLatencyMs: latency.minimumMs,
        maximumLatencyMs: latency.maximumMs,
        meanLatencyMs: latency.meanMs,
        medianLatencyMs: latency.medianMs,
        p95LatencyMs: latency.p95Ms,
        lowSampleWarning: metrics.counts.resolvedOpportunities < 20
            ? 'fewer than 20 resolved opportunities; counts only'
            : metrics.counts.resolvedOpportunities < 50
                ? '20-49 resolved opportunities; exploratory'
                : null
    };
}

function breakdownValue(event, dimension) {
    if (dimension === 'actualState') return event.actualNextState ?? 'unavailable';
    if (dimension === 'predictedState') {
        return event.predictedNextState ??
            (event.predictionAvailable === false ? NO_PREDICTION : 'unavailable');
    }
    return event[dimension] ?? 'unavailable';
}

function createBreakdownRows(events, totalStates, cohortId) {
    const dimensions = [
        'evaluationMode',
        'sessionId',
        'participantLabel',
        'playStyleLabel',
        'currentState',
        'actualState',
        'predictedState',
        'sector',
        'calibrationSnapshotId',
        'evaluatorConfigurationVersion',
        'buildVersion',
        'sourceType',
        'dataCohort'
    ];
    const rows = [];
    for (const dimension of dimensions) {
        const values = sortedText(events.map(event => breakdownValue(event, dimension)));
        for (const value of values) {
            const grouped = events.filter(event =>
                String(breakdownValue(event, dimension)) === String(value)
            );
            rows.push({
                groupingDimension: dimension,
                groupingValue: String(value),
                cohort: cohortId,
                evaluationMode: grouped[0]?.evaluationMode ?? null,
                sourceType: grouped[0]?.sourceType ?? null,
                ...metricSummary(grouped, totalStates)
            });
        }
    }
    return rows;
}

function analyzeCohort(packages, totalStates, options) {
    const first = packages[0];
    const snapshotFingerprint = comparableSnapshot(first.calibrationSnapshot);
    packages.slice(1).forEach(pkg => {
        assert(comparableSnapshot(pkg.calibrationSnapshot) === snapshotFingerprint,
            `Cohort ${cohortKey(first)} contains conflicting calibration snapshots`);
    });
    const events = packages.flatMap(pkg => pkg.events.map(event => ({
        ...clone(event),
        sessionId: pkg.session.sessionId,
        participantLabel: pkg.session.participantLabel || 'participant-unknown',
        playStyleLabel: pkg.session.playStyleLabel || 'play-style-unknown',
        evaluationMode: pkg.session.evaluationMode,
        sourceType: pkg.session.sourceType,
        dataCohort: pkg.session.sourceType === 'synthetic' ? 'synthetic' : 'human',
        calibrationSnapshotId: pkg.session.calibrationSnapshotId ||
            pkg.calibrationSnapshot?.snapshotId || null,
        evaluatorConfigurationVersion:
            pkg.session.evaluatorConfigurationVersion || null,
        buildVersion: pkg.session.buildVersion || null
    })));
    const eligible = events.filter(event =>
        event.status === 'RESOLVED' || event.status === NO_PREDICTION
    );
    const calibration = calibrationModel(first, totalStates);
    const model = basicMetrics(events, totalStates);
    const baselines = {
        persistence: baselineAnalysis('persistence', eligible, calibration, totalStates),
        globalMajority: baselineAnalysis('globalMajority', eligible, calibration, totalStates),
        uniformExpected: baselineAnalysis('uniformExpected', eligible, calibration, totalStates),
        frozenMarkov: baselineAnalysis('frozenMarkov', eligible, calibration, totalStates),
        frozenPerStateMajority: baselineAnalysis(
            'frozenPerStateMajority', eligible, calibration, totalStates
        )
    };
    if (first.session.evaluationMode === 'A' && baselines.frozenMarkov.available) {
        baselines.frozenMarkov.comparisonRole =
            'Mode A consistency check against the associated immutable snapshot; not independent superiority evidence';
    }
    const modelPredictionEventIds = eligible.filter(event => event.status === 'RESOLVED')
        .map(event => event.eventId).sort();
    const comparisons = stableObject(Object.entries(baselines).map(([name, baseline]) =>
        [name, comparison(model, baseline, modelPredictionEventIds)]
    ));
    const participantGroups = groupMetrics(events, 'participantLabel', totalStates);
    const participantAccuracies = Object.values(participantGroups)
        .map(item => item.strictTop1Accuracy).filter(finite);
    const primaryBaseline = first.session.evaluationMode === 'A'
        ? 'persistence'
        : 'frozenMarkov';
    const sessionDescriptors = packages.map(pkg => ({
        sessionId: pkg.session.sessionId,
        participantLabel: pkg.session.participantLabel || 'participant-unknown'
    }));
    const sessionBootstrap = clusteredBootstrap(
        events,
        totalStates,
        calibration,
        options,
        sessionDescriptors.map(session => session.sessionId)
    );
    const participantBootstrap = participantClusteredBootstrap(
        events, totalStates, calibration, options, sessionDescriptors
    );
    const cohortId = cohortKey(first);
    const sessionSummaries = packages.map(pkg => ({
        cohort: cohortId,
        evaluationMode: pkg.session.evaluationMode,
        sourceType: pkg.session.sourceType,
        sessionId: pkg.session.sessionId,
        participantLabel: pkg.session.participantLabel || 'participant-unknown',
        playStyleLabel: pkg.session.playStyleLabel || 'play-style-unknown',
        calibrationSnapshotId: pkg.session.calibrationSnapshotId ||
            pkg.calibrationSnapshot?.snapshotId || null,
        evaluatorConfigurationVersion:
            pkg.session.evaluatorConfigurationVersion || null,
        buildVersion: pkg.session.buildVersion || null,
        ...metricSummary(events.filter(event =>
            event.sessionId === pkg.session.sessionId
        ), totalStates)
    })).sort((left, right) => left.sessionId < right.sessionId ? -1 : 1);

    return {
        cohortId,
        evaluationMode: first.session.evaluationMode,
        sourceType: first.session.sourceType,
        evaluatorConfigurationVersion:
            first.session.evaluatorConfigurationVersion || null,
        calibrationSnapshotId: first.session.calibrationSnapshotId ||
            first.calibrationSnapshot?.snapshotId || null,
        totalStates,
        stateLabels: first.calibrationSnapshot?.stateLabels
            ? clone(first.calibrationSnapshot.stateLabels)
            : Array.from({ length: totalStates }, (_, state) => String(state)),
        stateVocabulary: first.calibrationSnapshot?.stateVocabulary
            ? clone(first.calibrationSnapshot.stateVocabulary)
            : null,
        sessionIds: packages.map(pkg => pkg.session.sessionId).sort(),
        sessions: sessionSummaries,
        primaryBaseline,
        model: {
            ...model,
            latency: latencyMetrics(events),
            byCurrentState: groupMetrics(events, 'currentState', totalStates),
            bySector: groupMetrics(events, 'sector', totalStates),
            bySession: sessionDistribution(events, totalStates),
            byParticipant: {
                participants: participantGroups,
                participantCount: Object.keys(participantGroups).length,
                unweightedParticipantMacroStrictAccuracy: mean(participantAccuracies)
            },
            impossibleEventsBySession: impossibleGroup(events, 'sessionId'),
            impossibleEventsByCurrentState: impossibleGroup(events, 'currentState')
        },
        calibration: calibration.available
            ? { available: true, validStates: calibration.validStates }
            : calibration,
        baselines,
        improvements: comparisons,
        breakdowns: createBreakdownRows(events, totalStates, cohortId),
        confidenceIntervals: {
            sessionClustered: sessionBootstrap,
            participantClustered: participantBootstrap
        },
        excludedEventSummary: {
            malformedEvents: 0,
            skippedEvents: 0,
            openEvents: model.counts.openEvents,
            censoredEvents: model.counts.censoredEvents,
            unresolvedEvents: model.counts.unresolvedEvents,
            scoringPolicy: 'OPEN and CENSORED excluded; malformed packages rejected'
        },
        interpretationLimits: interpretationLimits(model, packages.length, events)
    };
}

function impossibleGroup(events, property) {
    const predicted = events.filter(event =>
        event.status === 'RESOLVED' && Array.isArray(event.fullProbabilityRow)
    );
    const values = sortedText(predicted.map(event => event[property] ?? 'unavailable'));
    return stableObject(values.map(value => {
        const grouped = predicted.filter(event => (event[property] ?? 'unavailable') === value);
        const impossible = grouped.filter(event =>
            event.fullProbabilityRow[event.actualNextState] === 0
        ).length;
        return [String(value), {
            impossibleEventCount: impossible,
            evaluatedDistributionCount: grouped.length,
            impossibleEventRate: divide(impossible, grouped.length)
        }];
    }));
}

function interpretationLimits(model, sessionCount, events) {
    const limits = [
        'Consecutive transitions are correlated; transition counts are not independent samples.',
        'Synthetic sessions are correctness checks and must not be reported as human performance.',
        'Clipped log loss must always be interpreted beside impossible-event rate.',
        'This output is descriptive analysis and makes no human-performance claim.'
    ];
    if (model.counts.resolvedOpportunities < 30) {
        limits.push('Fewer than 30 evaluated transitions: smoke-test evidence only.');
    }
    if (sessionCount < 12) {
        limits.push('Fewer than 12 evaluation sessions: below the documented human protocol.');
    }
    if (model.counts.resolvedOpportunities < 1000) {
        limits.push('Fewer than 1,000 evaluated transitions: below the documented human protocol.');
    }
    if (events.filter(event => finite(event.predictionLatencyMs)).length < 100) {
        limits.push('Fewer than 100 latency samples: p95 latency is not stable.');
    }
    const supports = Object.values(model.accuracy.strictRecallByActualState)
        .map(item => item.support);
    if (supports.some(support => support < 20)) {
        limits.push('Balanced accuracy includes a class with fewer than 20 outcomes and is unstable.');
    }
    return limits;
}

function normalizeOptions(options) {
    const bootstrapReplicates = options.bootstrapReplicates === undefined
        ? DEFAULT_BOOTSTRAP_REPLICATES
        : options.bootstrapReplicates;
    const bootstrapSeed = options.bootstrapSeed === undefined
        ? DEFAULT_BOOTSTRAP_SEED
        : options.bootstrapSeed;
    assert(Number.isInteger(bootstrapReplicates) && bootstrapReplicates >= 0,
        'bootstrapReplicates must be a non-negative integer');
    assert(Number.isInteger(bootstrapSeed), 'bootstrapSeed must be an integer');
    if (options.generatedAt !== undefined) {
        assert(typeof options.generatedAt === 'string' &&
            Number.isFinite(Date.parse(options.generatedAt)),
        'generatedAt must be an ISO-compatible timestamp');
    }
    return { bootstrapReplicates, bootstrapSeed, generatedAt: options.generatedAt || null };
}

function analyzeEvaluationPackages(inputPackages, options = {}) {
    const packages = Array.isArray(inputPackages) ? inputPackages : [inputPackages];
    assert(packages.length > 0, 'At least one evaluation package is required');
    const normalizedOptions = normalizeOptions(options);
    const validated = packages.map(validatePackage);
    const sessionIds = new Set();
    validated.forEach(({ package: pkg }) => {
        assert(!sessionIds.has(pkg.session.sessionId),
            `Duplicate session ID ${pkg.session.sessionId}`);
        sessionIds.add(pkg.session.sessionId);
    });
    const cohorts = new Map();
    validated.forEach(({ package: pkg, totalStates }) => {
        const key = cohortKey(pkg);
        if (!cohorts.has(key)) cohorts.set(key, { packages: [], totalStates });
        const cohort = cohorts.get(key);
        assert(cohort.totalStates === totalStates,
            `Cohort ${key} contains incompatible state dimensions`);
        cohort.packages.push(pkg);
    });
    const analyses = [...cohorts.entries()]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([, cohort]) => analyzeCohort(
            cohort.packages.sort((a, b) => a.session.sessionId < b.session.sessionId
                ? -1
                : a.session.sessionId > b.session.sessionId ? 1 : 0),
            cohort.totalStates,
            normalizedOptions
        ));

    const generatedAt = normalizedOptions.generatedAt || validated
        .map(({ package: pkg }) => pkg.exportedAt)
        .filter(value => typeof value === 'string' && Number.isFinite(Date.parse(value)))
        .sort()
        .at(-1) || null;
    const byCohort = selector => stableObject(analyses.map(cohort =>
        [cohort.cohortId, selector(cohort)]
    ));
    const allWarnings = analyses.flatMap(cohort => [
        ...cohort.interpretationLimits.map(message => `${cohort.cohortId}: ${message}`),
        ...(!cohort.confidenceIntervals.participantClustered.available
            ? [`${cohort.cohortId}: ${cohort.confidenceIntervals.participantClustered.reason}`]
            : [])
    ]);
    const sessions = validated.map(({ package: pkg }) => pkg.session);

    return {
        schemaVersion: METRICS_SCHEMA_VERSION,
        generatedAt,
        sourceExportSchemaVersion: SUPPORTED_EXPORT_SCHEMA,
        analysisConfiguration: {
            clippingEpsilon: CLIPPING_EPSILON,
            bootstrapReplicates: normalizedOptions.bootstrapReplicates,
            bootstrapSeed: normalizedOptions.bootstrapSeed,
            confidenceLevel: 0.95,
            tieRule: 'lowest numeric state ID',
            unresolvedPolicy: 'OPEN and CENSORED excluded from scoring denominators',
            missingPredictionPolicy: 'NO_PREDICTION included as incorrect in strict accuracy',
            uniformExpectedPolicy: '1 / total number of validated states',
            malformedPolicy: 'reject package; never silently skip malformed events'
        },
        inputSummary: {
            packageCount: packages.length,
            sessionCount: sessions.length,
            participantLabels: sortedText(sessions.map(session =>
                session.participantLabel || 'participant-unknown'
            )),
            genuineParticipantCount: new Set(sessions
                .map(session => session.participantLabel)
                .filter(label => label && label !== 'participant-unknown')).size,
            evaluationModes: sortedText(sessions.map(session => session.evaluationMode)),
            sourceTypes: sortedText(sessions.map(session => session.sourceType)),
            syntheticSessionCount: sessions.filter(session =>
                session.sourceType === 'synthetic'
            ).length,
            humanSessionCount: sessions.filter(session => session.sourceType === 'human').length,
            cohortCount: analyses.length,
            sessionIds: sessions.map(session => session.sessionId).sort()
        },
        warnings: allWarnings,
        errors: [],
        counts: byCohort(cohort => cohort.model.counts),
        metrics: byCohort(cohort => ({
            accuracy: cohort.model.accuracy,
            probability: cohort.model.probability
        })),
        baselines: byCohort(cohort => cohort.baselines),
        improvements: byCohort(cohort => cohort.improvements),
        latency: byCohort(cohort => cohort.model.latency),
        reliability: byCohort(cohort => cohort.model.reliability),
        confusionMatrices: byCohort(cohort => ({
            model: cohort.model.confusionMatrix,
            persistence: cohort.baselines.persistence.confusionMatrix || null,
            globalMajority: cohort.baselines.globalMajority.available
                ? cohort.baselines.globalMajority.confusionMatrix
                : null,
            frozenMarkov: cohort.baselines.frozenMarkov.available
                ? cohort.baselines.frozenMarkov.confusionMatrix
                : null
        })),
        breakdowns: byCohort(cohort => cohort.breakdowns),
        confidenceIntervals: byCohort(cohort => cohort.confidenceIntervals),
        excludedEventSummary: byCohort(cohort => cohort.excludedEventSummary),
        notes: {
            syntheticData: 'Synthetic cohorts are correctness checks, not human-performance evidence.',
            claims: 'This descriptive output makes no effectiveness or statistical-superiority claim.',
            inputMutation: 'Source packages and probability rows are never modified.'
        },
        inputPackageCount: packages.length,
        cohortCount: analyses.length,
        cohorts: analyses
    };
}

const SUMMARY_METRIC_COLUMNS = Object.freeze([
    'totalEventCount',
    'resolvedOpportunities',
    'predictionAvailableOpportunities',
    'noPredictionOpportunities',
    'censoredEvents',
    'unresolvedEvents',
    'conditionalTop1Accuracy',
    'strictTop1Accuracy',
    'conditionalBalancedAccuracy',
    'strictBalancedAccuracy',
    'coverage',
    'validProbabilityCount',
    'meanProbabilityAssignedToActualState',
    'clippedLogLoss',
    'brierScore',
    'impossibleEventCount',
    'impossibleEventRate',
    'latencyCount',
    'minimumLatencyMs',
    'maximumLatencyMs',
    'meanLatencyMs',
    'medianLatencyMs',
    'p95LatencyMs',
    'lowSampleWarning'
]);

const SESSION_CSV_COLUMNS = Object.freeze([
    'cohort',
    'evaluationMode',
    'sourceType',
    'sessionId',
    'participantLabel',
    'playStyleLabel',
    'calibrationSnapshotId',
    'evaluatorConfigurationVersion',
    'buildVersion',
    ...SUMMARY_METRIC_COLUMNS
]);

const GROUP_CSV_COLUMNS = Object.freeze([
    'groupingDimension',
    'groupingValue',
    'cohort',
    'evaluationMode',
    'sourceType',
    ...SUMMARY_METRIC_COLUMNS
]);

const CONFUSION_CSV_COLUMNS = Object.freeze([
    'matrixType',
    'cohort',
    'actualState',
    'predictedState',
    'count',
    'rowSupport',
    'rowRate'
]);

function csvValue(value) {
    if (value === null || value === undefined) return 'null';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvFromRows(columns, rows) {
    return [
        columns.join(','),
        ...rows.map(row => columns.map(column => csvValue(row[column])).join(','))
    ].join('\r\n');
}

function createSessionMetricsCSV(result) {
    assert(result?.schemaVersion === METRICS_SCHEMA_VERSION,
        'A metrics analysis result is required');
    const rows = result.cohorts.flatMap(cohort => cohort.sessions)
        .sort((left, right) => {
            if (left.cohort !== right.cohort) return left.cohort < right.cohort ? -1 : 1;
            return left.sessionId < right.sessionId ? -1 : left.sessionId > right.sessionId ? 1 : 0;
        });
    return csvFromRows(SESSION_CSV_COLUMNS, rows);
}

function createGroupMetricsCSV(result) {
    assert(result?.schemaVersion === METRICS_SCHEMA_VERSION,
        'A metrics analysis result is required');
    const rows = result.cohorts.flatMap(cohort => cohort.breakdowns);
    return csvFromRows(GROUP_CSV_COLUMNS, rows);
}

function createConfusionMatrixCSV(result) {
    assert(result?.schemaVersion === METRICS_SCHEMA_VERSION,
        'A metrics analysis result is required');
    const rows = [];
    for (const cohort of result.cohorts) {
        const matrices = {
            model: cohort.model.confusionMatrix,
            persistence: cohort.baselines.persistence.confusionMatrix,
            globalMajority: cohort.baselines.globalMajority.available
                ? cohort.baselines.globalMajority.confusionMatrix
                : null,
            frozenMarkov: cohort.baselines.frozenMarkov.available
                ? cohort.baselines.frozenMarkov.confusionMatrix
                : null
        };
        for (const [matrixType, matrix] of Object.entries(matrices)) {
            if (!matrix) continue;
            for (const actualState of matrix.actualStateRows) {
                const rowSupport = Object.values(matrix.counts[actualState])
                    .reduce((sum, count) => sum + count, 0);
                for (const predictedState of matrix.predictedStateColumns) {
                    rows.push({
                        matrixType,
                        cohort: cohort.cohortId,
                        actualState,
                        predictedState,
                        count: matrix.counts[actualState][predictedState],
                        rowSupport,
                        rowRate: matrix.rowPercentages[actualState][predictedState]
                    });
                }
            }
        }
    }
    return csvFromRows(CONFUSION_CSV_COLUMNS, rows);
}

function formatMetric(value) {
    return finite(value) ? String(Number(value.toFixed(6))) : 'N/A';
}

function createMarkdownReport(result) {
    assert(result?.schemaVersion === METRICS_SCHEMA_VERSION,
        'A metrics analysis result is required');
    const lines = [
        '# SpaceLumin Prediction Evaluation Metrics',
        '',
        `Generated from exported data at: ${result.generatedAt || 'unavailable'}`,
        '',
        '## Input summary',
        '',
        `- Packages: ${result.inputSummary.packageCount}`,
        `- Sessions: ${result.inputSummary.sessionCount}`,
        `- Genuine participant labels: ${result.inputSummary.genuineParticipantCount}`,
        `- Cohorts: ${result.inputSummary.cohortCount}`,
        `- Human sessions: ${result.inputSummary.humanSessionCount}`,
        `- Synthetic sessions: ${result.inputSummary.syntheticSessionCount}`,
        '',
        'Synthetic results are correctness checks only and are not human-performance evidence.',
        ''
    ];
    for (const cohort of result.cohorts) {
        const model = cohort.model;
        const sessionCI = cohort.confidenceIntervals.sessionClustered;
        lines.push(
            `## Cohort: ${cohort.cohortId}`,
            '',
            `- Mode: ${cohort.evaluationMode}`,
            `- Source: ${cohort.sourceType}${cohort.sourceType === 'synthetic' ? ' (synthetic)' : ''}`,
            `- Sessions: ${cohort.sessionIds.length}`,
            `- Participants: ${model.byParticipant.participantCount}`,
            `- Resolved opportunities: ${model.counts.resolvedOpportunities}`,
            `- Strict top-1 accuracy: ${formatMetric(model.accuracy.strictTop1Accuracy)}`,
            `- Conditional top-1 accuracy: ${formatMetric(model.accuracy.conditionalTop1Accuracy)}`,
            `- Coverage: ${formatMetric(model.accuracy.predictionCoverage)}`,
            `- Impossible-event rate: ${formatMetric(model.probability.impossibleEventRate)}`,
            `- Clipped log loss: ${formatMetric(model.probability.clippedLogLoss)}`,
            `- Brier score: ${formatMetric(model.probability.brierScore)}`,
            `- Mean prediction latency: ${formatMetric(model.latency.allOpportunities.meanMs)} ms`,
            `- Median prediction latency: ${formatMetric(model.latency.allOpportunities.medianMs)} ms`,
            `- P95 prediction latency: ${formatMetric(model.latency.allOpportunities.p95Ms)} ms`,
            '',
            '### Baselines',
            ''
        );
        for (const [name, baseline] of Object.entries(cohort.baselines)) {
            lines.push(baseline.available
                ? `- ${name}: strict accuracy ${formatMetric(baseline.accuracy.strictTop1Accuracy)}, coverage ${formatMetric(baseline.accuracy.predictionCoverage)}`
                : `- ${name}: unavailable (${baseline.reason})`);
        }
        lines.push('', '### Confidence intervals', '');
        if (sessionCI.available) {
            const interval = sessionCI.intervals.strictTop1Accuracy;
            lines.push(`- Session-clustered strict accuracy 95% interval: ${formatMetric(interval.lower)} to ${formatMetric(interval.upper)}`);
        } else {
            lines.push(`- Session-clustered intervals unavailable: ${sessionCI.reason}`);
        }
        const participantCI = cohort.confidenceIntervals.participantClustered;
        lines.push(participantCI.available
            ? `- Participant-clustered intervals: ${participantCI.validParticipantCount} participant clusters`
            : `- Participant-clustered intervals unavailable: ${participantCI.reason}`);
        lines.push(
            '',
            '### Excluded and unresolved events',
            '',
            `- Open: ${cohort.excludedEventSummary.openEvents}`,
            `- Censored: ${cohort.excludedEventSummary.censoredEvents}`,
            `- Malformed/skipped: ${cohort.excludedEventSummary.malformedEvents}/${cohort.excludedEventSummary.skippedEvents}`,
            '',
            '### Warnings and limitations',
            '',
            ...cohort.interpretationLimits.map(limit => `- ${limit}`),
            ''
        );
    }
    lines.push(
        '## Interpretation boundary',
        '',
        'This report is descriptive. It makes no effectiveness or statistical-superiority claim.',
        ''
    );
    return lines.join('\n');
}

module.exports = Object.freeze({
    analyzeEvaluationPackages,
    createSessionMetricsCSV,
    createGroupMetricsCSV,
    createConfusionMatrixCSV,
    createMarkdownReport,
    METRICS_SCHEMA_VERSION,
    SUPPORTED_EXPORT_SCHEMA,
    CLIPPING_EPSILON,
    DEFAULT_BOOTSTRAP_REPLICATES,
    DEFAULT_BOOTSTRAP_SEED,
    SESSION_CSV_COLUMNS,
    GROUP_CSV_COLUMNS,
    CONFUSION_CSV_COLUMNS
});
