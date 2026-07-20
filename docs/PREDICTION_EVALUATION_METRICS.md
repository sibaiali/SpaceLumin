# Offline Prediction Evaluation Metrics

## Scope and isolation

`js/PredictionEvaluationMetrics.js` is a pure CommonJS reducer for one or more complete `spacelumin.prediction-export/1.0.0` JSON packages. It returns plain serializable data and never imports the game, invokes `PredictiveAI`, learns from evaluation outcomes, mutates an input package, accesses the network, or uses browser APIs.

`scripts/analyze_prediction_evaluation.js` is the dependency-free Node CLI. It can write five independent local analysis products. No game file, runtime predictor, calibration snapshot, exported source package, threshold, cadence, or gameplay state is modified.

This milestone does not implement charts, dashboards, persistence services, analytics, gameplay adaptation, AI improvements, real-session collection, or human-performance claims.

## Validation policy

The reducer rejects an invalid package instead of silently repairing or skipping it. Validation covers schema/mode/source/status values, event and session IDs, lifecycle fields, state bounds, model dimensions, calibration identity/content, probability length/range/sum, stable top-1 tie-breaking, exact-match correctness, and actual-state probability.

Successful results report `malformedEvents: 0` and `skippedEvents: 0`, plus the policy that malformed packages are rejected. An invalid input produces a CLI error and no analysis claim.

Event state IDs are integers. Snapshot `stateLabels` are textual display labels. Probability index `k` maps directly to numeric vocabulary state ID `k`; labels never reorder a row.

## Opportunity and denominator definitions

Let:

```text
T = every exported event
E = RESOLVED plus NO_PREDICTION events (ground truth known)
P = RESOLVED events (stored distribution/prediction available)
Q = P with a validated genuine probability row
K_E = actual classes represented in E
K_P = actual classes represented in P
```

- `RESOLVED` belongs to `E`, `P`, and `Q`.
- `NO_PREDICTION` belongs to `E`, not `P`/`Q`, and is incorrect for strict metrics.
- `CENSORED` and `OPEN` are unresolved and outside scoring denominators.

```text
totalEventCount                   = |T|
resolvedOpportunities             = |E|
predictionAvailableOpportunities  = |P|
noPredictionOpportunities         = |E| - |P|
censoredEvents                    = count(CENSORED)
unresolvedEvents                  = count(OPEN or CENSORED)
validProbabilityCount             = |Q|
```

Every division returns `null` when its denominator is zero. Unavailable metrics are never converted to zero.

## Accuracy and probability formulas

```text
conditionalTop1Accuracy = correct(P) / |P|
strictTop1Accuracy      = correct(E) / |E|
coverage                = |P| / |E|

conditionalRecall(k) = correct(P with actual k) / count(P with actual k)
conditionalBalancedAccuracy = mean conditionalRecall(k), k in K_P

strictRecall(k) = correct(E with actual k) / count(E with actual k)
strictBalancedAccuracy = mean strictRecall(k), k in K_E
```

A class represented only by missing predictions affects strict balanced accuracy but is absent from the conditional denominator.

Only genuine rows in `Q` are used for probability metrics:

```text
meanProbabilityAssignedToActualState = mean(p[actual])
impossibleEventCount = count(p[actual] == 0)
impossibleEventRate  = impossibleEventCount / |Q|
reporting epsilon    = 1e-12
clippedLogLoss       = -mean(log(max(p[actual], 1e-12)))
multiclassBrierScore = mean(sum_k (p[k] - 1[actual == k])^2)
```

Clipping is reporting-only and never changes a row, prediction, impossible-event count, Brier score, or source export.

Top-1 reliability uses fixed bins `[0,.2)`, `[.2,.4)`, `[.4,.6)`, `[.6,.8)`, and `[.8,1]`. Each bin reports count, mean genuine top-1 probability, observed accuracy, and a sparse marker below 20 samples.

## Latency

Finite non-negative `predictionLatencyMs` values are summarized for all opportunities, ready `RESOLVED` events, and warm-up/missing `NO_PREDICTION` events. Each summary contains count, minimum, maximum, arithmetic mean, conventional median, and nearest-rank p95 at `ceil(.95 * n)`. Values are `null` with no samples; fewer than 100 samples produces a p95 warning.

## Baselines

- **Persistence:** predicts `currentState -> currentState` with a point mass. It is the primary independent Mode A baseline.
- **Frozen Markov:** uses only the associated immutable snapshot, its readiness threshold, and unsmoothed normalized rows. A missing/not-ready row stays missing. Ties select the lowest state index in stable vocabulary order. Evaluation events never update it. In Mode A it is labelled a consistency check, not independent superiority evidence.
- **Calibration global majority:** uses only frozen `globalStateCounts`; it is never fitted from evaluation outcomes.
- **Uniform expected reference:** an expected reference, not an observed classifier. Accuracy is `1 / total numberOfStates`, Brier is `1 - 1/numberOfStates`, and log loss is `log(numberOfStates)`.
- **Frozen per-state majority:** identical to frozen Markov top-1 and labelled an equivalence/sanity check only.

Applicable baselines report conditional/strict accuracy, conditional/strict balanced accuracy, coverage, valid sample count, prediction-available count, and missing-row count. Calibration-derived baselines are explicitly unavailable when calibration evidence is missing.

## Improvements

Strict compares only with strict on the identical `E` set. Conditional compares only when the exact available-prediction event-ID sets match.

```text
absoluteImprovement = modelAccuracy - baselineAccuracy
normalizedImprovement =
    (modelAccuracy - baselineAccuracy) / (1 - baselineAccuracy)
```

Unavailable denominators or incomparable conditional samples return `null` with a warning. If baseline accuracy is 1, absolute improvement remains available, normalized improvement is `null`, and the output explains why. Negative results are preserved.

## Cohorts and breakdowns

Inputs are pooled only when mode, source type, evaluator configuration, and calibration snapshot match. Mode A/B and human/synthetic packages are never silently pooled; conflicting snapshot content is rejected.

Deterministically ordered breakdowns cover:

```text
evaluationMode, sessionId, participantLabel, playStyleLabel,
currentState, actualState, predictedState, sector,
calibrationSnapshotId, evaluatorConfigurationVersion, buildVersion,
sourceType, dataCohort (human or synthetic)
```

Every row includes total/resolved/available/missing/censored/unresolved counts, conditional/strict accuracy, conditional/strict balanced accuracy, coverage, probability count and metrics, impossible-event metrics, and latency count/minimum/maximum/mean/median/p95. Groups are never suppressed: fewer than 20 resolved opportunities is counts-only; 20-49 is exploratory.

## Confusion matrices

Rows are actual states and columns are every validated predicted state plus `NO_PREDICTION`. Raw zero cells are materialized for the complete vocabulary, including zero-support actual rows. `rowRate` is `null` when support is zero. Uniform expected has no fabricated observed matrix.

## Confidence intervals

Defaults are deterministic 95% percentile intervals, 2,000 replicates, seed `20260720`.

### Session-clustered

Whole sessions are sampled with replacement, retaining all their transitions. Intervals cover conditional/strict accuracy, coverage, mean actual-state probability, clipped log loss, Brier score, mean/median/p95 latency, persistence conditional/strict accuracy, applicable conditional/strict improvements, grouped strict accuracy, and reliability bins. At least two sessions are required.

### Participant-clustered

With at least two genuine participant labels, complete participant clusters are sampled with replacement and every session/event for a selected participant is retained. `participant-unknown` is excluded and repeated unknown labels are never treated as separate people.

Participant intervals cover conditional/strict accuracy, coverage, mean actual-state probability, clipped log loss, Brier score, mean latency, persistence conditional/strict accuracy, and applicable conditional/strict improvements. Fewer than two genuine labels is explicitly unavailable with a warning.

Consecutive transitions remain correlated. These intervals are descriptive and establish neither effectiveness nor statistical superiority.

## Complete metrics JSON

`spacelumin.prediction-metrics/1.0.0` contains:

```text
schemaVersion, generatedAt, analysisConfiguration, inputSummary,
warnings, errors, counts, metrics, baselines, improvements, latency,
reliability, confusionMatrices, breakdowns, confidenceIntervals,
excludedEventSummary, notes, cohorts
```

For deterministic output, `generatedAt` defaults to the latest valid input `exportedAt`, not wall-clock time. A caller can supply an explicit timestamp.

## Exact CSV headers

Session CSV (`--session-csv-output`):

```text
cohort,evaluationMode,sourceType,sessionId,participantLabel,playStyleLabel,calibrationSnapshotId,evaluatorConfigurationVersion,buildVersion,totalEventCount,resolvedOpportunities,predictionAvailableOpportunities,noPredictionOpportunities,censoredEvents,unresolvedEvents,conditionalTop1Accuracy,strictTop1Accuracy,conditionalBalancedAccuracy,strictBalancedAccuracy,coverage,validProbabilityCount,meanProbabilityAssignedToActualState,clippedLogLoss,brierScore,impossibleEventCount,impossibleEventRate,latencyCount,minimumLatencyMs,maximumLatencyMs,meanLatencyMs,medianLatencyMs,p95LatencyMs,lowSampleWarning
```

Group CSV (`--group-csv-output`):

```text
groupingDimension,groupingValue,cohort,evaluationMode,sourceType,totalEventCount,resolvedOpportunities,predictionAvailableOpportunities,noPredictionOpportunities,censoredEvents,unresolvedEvents,conditionalTop1Accuracy,strictTop1Accuracy,conditionalBalancedAccuracy,strictBalancedAccuracy,coverage,validProbabilityCount,meanProbabilityAssignedToActualState,clippedLogLoss,brierScore,impossibleEventCount,impossibleEventRate,latencyCount,minimumLatencyMs,maximumLatencyMs,meanLatencyMs,medianLatencyMs,p95LatencyMs,lowSampleWarning
```

Confusion CSV (`--confusion-csv-output`) exact required header:

```text
matrixType,cohort,actualState,predictedState,count,rowSupport,rowRate
```

CSV null/unavailable values are literal `null`; text uses standard quote/comma/newline escaping.

## Markdown and CLI

`--report-output` writes input/cohort separation, session/participant counts, core metrics, baselines, latency, intervals, excluded events, warnings, and limitations. Synthetic cohorts are explicitly labelled and no effectiveness/superiority claim is made.

All five outputs can be generated independently or together:

```powershell
& "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe" scripts\analyze_prediction_evaluation.js `
  --bootstrap-replicates 2000 `
  --bootstrap-seed 20260720 `
  --json-output evaluation_metrics.json `
  --session-csv-output evaluation_sessions.csv `
  --group-csv-output evaluation_groups.csv `
  --confusion-csv-output evaluation_confusion.csv `
  --report-output evaluation_report.md `
  evaluation_exports\*.json
```

Without output flags, complete JSON goes to stdout. Inputs are sorted/deduplicated and final-component `*`/`?` wildcards are expanded. Output paths must be distinct and cannot overwrite an input export.

## Tests and interpretation boundary

Run:

```powershell
& "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe" tests\prediction_evaluation_metrics.test.js
```

The 30-test deterministic synthetic suite covers adapter-package compatibility, all denominator/formula rules, zero-denominator nulls, genuine probability metrics, reliability, latency, baselines/equivalence, improvements, all breakdown dimensions, complete vocabulary confusion cells, bootstrap defaults, both cluster methods, unknown participants, immutable inputs, malformed/conflicting input rejection, complete JSON, stable CSV/Markdown, the five-output CLI, wildcard inputs, deterministic reruns, invalid JSON, and source-overwrite prevention.

Synthetic fixtures validate formulas and isolation only. They are not SpaceLumin prediction-quality or human-performance evidence.
