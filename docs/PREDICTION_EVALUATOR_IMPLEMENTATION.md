# Prediction Evaluator Implementation

## Scope

`js/PredictionEvaluationAdapter.js` implements the minimum development-only evaluation core described by `docs/PREDICTION_EVALUATION_DESIGN.md`. It does not change PredictiveAI state encoding, transition thresholds, prediction cadence, risk calculations, Director behaviour, or gameplay. It does not call `predictiveAI.predict()`.

The adapter is separate from `PredictionDebugOverlay` and contains no UI, timers, network calls, persistence, charts, aggregate metrics, or external dependencies. Ended sessions can be serialized locally as deterministic JSON or CSV strings; the adapter does not upload or save them.

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

Controlled sessions may also declare pseudonymous metadata in the development URL:

```text
&evaluationParticipant=participant-001&evaluationPlayStyle=balanced
&evaluationBuild=40cce33&evaluationNotes=keyboard-only
```

`evaluationParticipant` must start with `participant-` and contain only letters, numbers, dots, underscores, or hyphens; invalid values become `participant-unknown`. Play-style labels use the same slug-like character set. Notes are optional and limited to 500 characters. These fields must never contain a name, email address, IP address, device identifier, precise location, or other identifying data.

Without both `dev=1` and `evaluate=1`, the script returns before defining a browser class, registering a listener, constructing an adapter, or allocating a ledger. `window.game.predictionEvaluator` and `window.PredictionEvaluationAdapter` therefore remain absent.

The guarded `window.spaceLuminEvaluation` interface is also absent. When enabled, it exposes only fault-contained metadata, lifecycle, snapshot, export, and download methods documented in `docs/PREDICTION_EVALUATION_EXPORT.md`.

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

The legacy minimum input shape remains supported:

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

The loader validates dimensions and counts, clones every row, derives row totals and normalized rows, and deep-freezes its copy. It rejects loading after evaluation has begun. `PredictionEvaluationAdapter.createSnapshotFromPredictor()` is a read-only copy helper; it never calls `predict()`.

The explicit calibration snapshot schema contains:

- schema version, snapshot ID, creation timestamp, evaluator configuration version, source model type, application version, and build version;
- numeric state labels plus the HP/zone/jerk vocabulary when production dimensions are available;
- the deep-copied transition-count matrix, normalized probability rows, row totals, and global next-state counts;
- calibration session IDs and observation count when supplied by a controlled calibration process;
- model dimensions and an explicit `transitionProbabilitySmoothing: "none"` declaration.

A controlled calibration process can create and load the copy before the first Mode A run:

```js
const snapshot = PredictionEvaluationAdapter.createSnapshotFromPredictor(predictiveAI, {
    snapshotId: 'calibration-001',
    calibrationSessionIds: ['calibration-session-001'],
    calibrationObservationCount: 1200,
    buildVersion: '40cce33'
});
window.game.predictionEvaluator.loadFrozenSnapshot(snapshot);
```

The supplied session IDs and observation count must come from the actual calibration process; omit them to export `null` rather than guessing.

Unavailable provenance is represented as `null`; the adapter does not reinterpret `totalTransitions` as a human-observation count because production pseudo-count reinforcement may be present. A generated snapshot ID identifies the evaluator copy and does not claim missing calibration provenance.

At session start, Mode A locks the already-frozen snapshot reference into the session record. Every opportunity in that session projects from that exact snapshot even if production `predictiveAI.transitions` continues changing. Mode B similarly records an immutable copy of its session-start shadow model for export, while its separate online matrix continues score-before-update learning.

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

## Session metadata

`beginSession()` locks a start descriptor containing the session schema version, session ID, pseudonymous participant label, play-style label, mode, source type, start timestamp, build/configuration versions, calibration snapshot ID, starting sector, and optional notes. Later changes to constructor defaults or caller-owned option objects cannot rewrite those values.

`endSession()` censors any pending event once, captures the end timestamp and final sector, calculates monotonic duration in milliseconds, records the terminal reason and event-status counts, and stores an immutable historical session record. Repeated end calls are no-ops and cannot overwrite the first terminal record. Starting a later session retains prior ledger entries and metadata.

The browser fault boundary is sampled at session start and end. When available, the metadata and `faults` export contain only the session delta, including per-hook counts. If a fault provider is unavailable, fault fields are `null` rather than an invented zero.

The evaluator stores no names, emails, IP addresses, device fingerprints, precise locations, analytics identifiers, or cookies. All session data remains in page memory unless a developer explicitly copies an export string.

## JSON and CSV export

Ended sessions and the current active session can be exported. Active export adds a frozen copy of the pending `OPEN` event, if any, so unresolved state is represented without mutating or finalizing it. `exportSession(sessionId, options)` returns a deeply frozen copy with the complete structure:

```json
{
  "schemaVersion": "spacelumin.prediction-export/1.0.0",
  "exportedAt": "...",
  "session": {},
  "configuration": {},
  "calibrationSnapshot": {},
  "events": [],
  "faults": {},
  "notes": {}
}
```

`exportSessionJSON()` / `exportSessionJson()` serialize that structure with stable field and event order. `exportEventsCSV()` emits one row per event with a fixed event header and genuine probability rows encoded as compact JSON cells. `exportSessionCSV()` emits exactly one session-summary row with a distinct fixed header. A zero-event session produces an event CSV header only and a valid session-summary row.

For byte-for-byte reproducible output, supply the same explicit ISO export timestamp:

```js
const evaluator = window.game.predictionEvaluator;
const sessionId = evaluator.getSessionIds()[0];
const json = evaluator.exportSessionJSON(sessionId, {
    exportedAt: '2026-07-20T12:00:00.000Z'
});
const eventCsv = evaluator.exportEventsCSV(sessionId, {
    exportedAt: '2026-07-20T12:00:00.000Z'
});
const sessionCsv = evaluator.exportSessionCSV(sessionId, {
    exportedAt: '2026-07-20T12:00:00.000Z'
});
```

Without `exportedAt`, the current ISO export time is used. Export methods return strings or immutable copies only. They do not download, persist, transmit, aggregate, score, or chart the data.

## Development read helpers

The following return immutable values or copies:

- `getSessionSummary()`
- `getEvents()`
- `getOpenEvent()`
- `getSuppressedDuplicateCount()`
- `getModelSnapshot()`
- `getSessionMetadata(sessionId)`
- `getSessionIds()`
- `exportSession(sessionId, options)`
- `exportSessionJSON(sessionId, options)`
- `exportEventsCSV(sessionId, options)`
- `exportSessionCSV(sessionId, options)`

No helper exposes a mutable resolved event or production transition row.

## Reproducible correctness tests

Run with the bundled Node executable:

```powershell
& "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe" tests\prediction_evaluation_adapter.test.js
```

The 31-test deterministic synthetic harness covers correct and incorrect resolution, missing rows, repeated states, duplicate calls, censoring, frozen snapshot isolation, score-before-update Mode B learning, double-score prevention, production-predictor isolation, explicit snapshot derivation and provenance, session locking and fault deltas, distinct deterministic JSON/event-CSV/session-CSV output, scalar/null/escaping preservation, all lifecycle states, empty and active exports, historical exports, privacy defaults, disabled browser gating, guarded browser methods/download construction, forced serialization/download failures, all integration hook classes, continued Director output processing, and fault-log deduplication. Synthetic results are correctness checks only and are not human-performance evidence.

## Known limitations

- Calibration collection automation, snapshot persistence, and remote storage are not implemented. Guarded downloads are explicit local browser actions only.
- `feedPositiveVector()` mutations are documented but not mirrored into the shadow model.
- Results aggregation, impossible-event metrics, clipped log loss, Brier score, confidence intervals, and charts remain future work.
- Mode A produces `NO_PREDICTION` until a valid calibration snapshot is explicitly loaded.
- The evaluator observes the currently wired states, which remain constrained by PredictiveAI's default HP and nearby-enemy inputs.
- A failed evaluator remains enabled for later hooks; repeated identical failures are counted but logged only once.
- The Director ownership defect and inactive KernelMapper, NeuroFlow, and Cognitive Overload paths remain untouched.
