# Prediction Evaluator Implementation

## Scope

`js/PredictionEvaluationAdapter.js` implements the minimum development-only evaluation core described by `docs/PREDICTION_EVALUATION_DESIGN.md`. It does not change PredictiveAI state encoding, transition thresholds, prediction cadence, risk calculations, Director behaviour, or gameplay. It does not call `predictiveAI.predict()`.

The adapter is separate from `PredictionDebugOverlay` and contains no UI, timers, network calls, persistence, charts, CSV export, or external dependencies.

## Development activation

The browser evaluator is disabled unless both explicit query parameters are present:

```text
?dev=1&evaluate=1
```

Example:

```text
http://localhost:3000/?dev=1&evaluate=1
```

Mode B is the default. Select Mode A with:

```text
?dev=1&evaluate=1&evaluationMode=A
```

Use `evaluationSource=synthetic` only for declared synthetic correctness checks. Otherwise `sourceType` is `human`.

Without both `dev=1` and `evaluate=1`, the script returns before defining a browser class, registering a listener, constructing an adapter, or allocating a ledger. `window.game.predictionEvaluator` and `window.PredictionEvaluationAdapter` therefore remain absent.

When enabled, `index.html` invokes the gated initializer immediately after `window.game` is created. The document root receives `data-prediction-evaluator="A"` or `"B"` as a non-interactive verification marker. Development console lifecycle messages report session start, event open/finalization/censoring, and duplicate suppression; they do not create events or expose a mutation API.

## Runtime ownership and hooks

The enabled adapter is owned by `window.game.predictionEvaluator`. Three minimal runtime hook locations are used:

1. **Position observation:** `Game.updateGame()` calls `observePosition()` immediately after the genuine `telemetryService.recordPosition()` event. The state is the already-computed `predictiveAI.lastState`; the evaluator does not encode or record it again.
2. **Production prediction opportunity:** the one-second Director path calls `openPredictionOpportunity()` after its existing `telemetryService.getPrediction()` call. The hook receives the measured latency of that one production call. It does not invoke prediction itself.
3. **Run lifecycle:** `Game.startRun()` starts a new evaluator session. `Game.showResults()` and `Game.endRun()` censor an unresolved event and end the session.

Ghost Console, the F3 overlay, legacy developer metrics, and other diagnostics do not call the opportunity hook and cannot create evaluator events.

## Exception isolation

All browser integration calls enter through the development-only
`window.invokePredictionEvaluatorSafely(hookName, callback)` boundary. The
boundary exists only after the `dev=1&evaluate=1` gate succeeds. It protects
evaluator initialization, Game session start, Game position observation, Game
session/results termination, and the Director prediction-opportunity
notification.

The callback passed to the boundary contains only evaluation work. Production
`telemetryService.getPrediction()`, state reads, prediction thresholds,
multiplier application, and gameplay processing remain outside the boundary, so
unrelated production exceptions are not caught or relabelled as evaluator
faults. A failed evaluator callback returns control to the caller without
fabricating, resolving, or mutating a ledger event.

Each fault increments a page-lifetime total and per-hook count. The read-only
`window.getPredictionEvaluatorFaultSummary()` helper returns those counts.
The first occurrence of each `hookName + error message` combination is logged
with its stack when available; identical repeats remain counted but are not
logged again. Logger failures are also contained so diagnostics cannot interrupt
gameplay.

## Event lifecycle

### Session start

`beginSession()` creates a unique session ID unless one is supplied, resets session-local serial and epoch counters, and retains all previously finalized ledger entries. It does not clear the frozen or online model.

### Position observation and epochs

Each valid encoded state observation increments `currentPositionSerial`. Valid states are integers from zero through `totalStates - 1`; invalid observations are ignored.

The first valid observation begins state epoch 1. A new epoch begins only when a later valid encoded state differs from the immediately preceding valid state. Repeated observations of the same state remain in the same epoch.

When an observation arrives:

1. any open event is resolved against that state;
2. Mode B scores from the row stored at prediction time;
3. only after scoring, Mode B increments its isolated previous-to-current shadow transition;
4. the new state becomes the shadow model's previous observation.

### Opening

The first production-origin prediction call in an epoch opens one event. The adapter selects the Mode A frozen model or Mode B online shadow, copies and normalizes the relevant transition row, and stores the complete probability row before the outcome exists.

If the model is below `minTransitions`, no model has been loaded, or the current row sums to zero, the event opens with `predictionAvailable = false`, `predictedNextState = null`, and `fullProbabilityRow = null`.

### Resolution

The next valid position observation supplies `actualNextState`, `nextPositionSerial`, and `resolvedAt`. An available prediction becomes `RESOLVED`; an unavailable prediction becomes `NO_PREDICTION`. Correctness is exact top-1 equality. `probabilityAssignedToActualState` is read only from the probability row stored when the event opened.

The finalized event is deeply frozen and appended once. It cannot be rescored or mutated. The internal open event is then discarded.

### Censoring

If a run or session ends before the next valid position observation, the open event becomes `CENSORED`. Its outcome, next serial, and correctness remain `null`. The frozen censored record is appended to the ledger.

## State-epoch deduplication

`stateEpochId` increases only on a valid state change. The first production prediction opportunity marks that epoch as used. Every later opportunity in the same consecutive-state epoch is suppressed, including calls after the first event has already resolved to a self-transition.

Suppressed calls do not create or alter events. They increment cumulative and session-local counters exposed through `getSuppressedDuplicateCount()` and `getSessionSummary()`.

This prevents long runs of the same frame-level state from inflating the scored sample count.

## Top-1 and tie-breaking

For a nonempty transition-count row `C[i]`, the adapter stores:

```text
p(j | i) = C[i,j] / sum_k C[i,k]
```

Top-1 is the numeric state with the greatest probability. The scan proceeds from state 0 upward and replaces the winner only on a strictly greater value, so equal maxima deterministically select the lowest numeric state ID.

No confidence field is invented. The full genuine normalized row is retained for later probability metrics.

## Mode A — frozen evaluation

Mode A reads only an evaluator-owned immutable copy of a calibration snapshot. Evaluation observations never update that copy. Normal production PredictiveAI learning may continue, but it cannot change Mode A rows or results.

Load a snapshot before starting any session:

```js
window.game.predictionEvaluator.loadFrozenSnapshot(snapshot);
```

Expected shape:

```js
{
    snapshotId: 'calibration-id',
    totalStates: 36,
    minTransitions: 20,
    totalTransitions: 1234,
    transitions: [
        /* 36 rows, each containing 36 non-negative counts */
    ]
}
```

The loader validates dimensions and counts, clones every row, and deep-freezes its copy. It rejects loading after evaluation has begun. `PredictionEvaluationAdapter.createSnapshotFromPredictor()` is a read-only copy helper; it never calls `predict()`.

Calibration-session collection and snapshot persistence are intentionally not implemented yet.

## Mode B — prequential shadow evaluation

Mode B owns a transition matrix that is separate from `predictiveAI.transitions`. It starts empty unless an `onlineSnapshot` is supplied to the constructor.

For every adjacent valid observation pair, it follows:

```text
store prediction row -> observe actual state -> score stored row -> update shadow
```

The event's stored probability row therefore cannot contain the outcome used to score that event. Self-transitions are learned normally. Session starts break the observation chain so no artificial last-state-to-new-run transition is added, while existing shadow counts remain available.

`feedPositiveVector()` currently mutates only production PredictiveAI. The evaluator does not silently copy that mutation. A future approved implementation may represent it as an explicitly timestamped, weighted synthetic-training mutation, queued until any pending event is scored and identified by a separate model/configuration version.

## Immutable append-only ledger

The in-memory ledger contains only finalized `RESOLVED`, `NO_PREDICTION`, or `CENSORED` events. The one pending `OPEN` event is held separately and returned only as a frozen copy.

`getEvents()` returns a frozen array containing frozen event records. Starting a new session resets only session counters and never removes prior ledger entries. Event IDs combine the unique session ID with a monotonically increasing within-session ordinal.

Every finalized record contains:

- event and session identity;
- evaluation mode and source type;
- open/resolve timestamps and position serials;
- epoch, current, predicted, and actual states;
- correctness and availability;
- the full immutable probability row and actual-state probability;
- production prediction latency;
- sector and game time at opening;
- algorithm configuration version and terminal status.

## Development read helpers

The following return immutable values or copies:

- `getSessionSummary()`
- `getEvents()`
- `getOpenEvent()`
- `getSuppressedDuplicateCount()`
- `getModelSnapshot()`

No helper exposes a mutable resolved event or production transition row.

## Reproducible correctness tests

Run with the bundled Node executable:

```powershell
& "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe" tests\prediction_evaluation_adapter.test.js
```

The 16-test deterministic synthetic harness covers correct and incorrect resolution, missing rows, repeated states, duplicate calls, censoring, frozen snapshot isolation, score-before-update Mode B learning, double-score prevention, production-predictor isolation, all integration hook classes, continued Director output processing, and fault-log deduplication. Synthetic results are correctness checks only and are not human-performance evidence.

## Known limitations

- Calibration collection, snapshot persistence, and session export are not implemented.
- `feedPositiveVector()` mutations are documented but not mirrored into the shadow model.
- Results aggregation, impossible-event metrics, clipped log loss, Brier score, confidence intervals, charts, and CSV export remain future work.
- Mode A produces `NO_PREDICTION` until a valid calibration snapshot is explicitly loaded.
- The evaluator observes the currently wired states, which remain constrained by PredictiveAI's default HP and nearby-enemy inputs.
- A failed evaluator remains enabled for later hooks; repeated identical failures are counted but logged only once.
- The Director ownership defect and inactive KernelMapper, NeuroFlow, and Cognitive Overload paths remain untouched.
