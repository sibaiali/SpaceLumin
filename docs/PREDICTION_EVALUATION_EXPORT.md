# Prediction Evaluation Export

## Scope

This milestone adds in-memory calibration snapshots, controlled session metadata, complete JSON packages, separate event/session CSV products, and development-only downloads. It does not calculate aggregate metrics, create charts, persist data, send analytics, change gameplay, change prediction thresholds, or call the production predictor.

The interface exists only when both query flags are present:

```text
?dev=1&evaluate=1
```

Without both flags, `window.spaceLuminEvaluation` is not defined.

## Calibration snapshot schema

`PredictionEvaluationAdapter.createSnapshotFromPredictor()` and `loadFrozenSnapshot()` use an immutable object with these fields, in stable property order:

| Field | Representation |
|---|---|
| `schemaVersion` | `spacelumin.prediction-calibration/1.0.0` |
| `snapshotId` | Explicit ID or an evaluator-generated calibration-copy ID |
| `createdAt` | ISO timestamp |
| `evaluatorConfigurationVersion` | Evaluator/algorithm configuration identifier or `null` |
| `sourceModelType` | `PredictiveAI.MarkovTransitionCounts` when copied from production, otherwise `null` |
| `stateLabels` | Numeric state IDs serialized as strings |
| `stateVocabulary` | State ID and available HP/zone/jerk bracket coordinates |
| `totalStates` | Matrix dimension |
| `minTransitions` | Readiness threshold copied from the source |
| `totalTransitions` | Source counter, or the deterministically derived matrix total when absent |
| `transitions` | Deep-copied transition-count matrix |
| `normalizedProbabilityRows` | Row-normalized distributions; a zero-count row is `null` |
| `rowTotals` | Sum of each transition-count row |
| `globalStateCounts` | Column totals (next-state counts) |
| `calibrationSessionIds` | Supplied controlled calibration IDs, otherwise `null` |
| `calibrationObservationCount` | Supplied observation count, otherwise `null` |
| `modelDimensions` | HP, zone, jerk, and total-state dimensions; unavailable dimensions are `null` |
| `smoothingConfiguration` | Transition smoothing is explicitly `none`; risk EWM alpha is copied when available |
| `applicationVersion` | Supplied application version or `null` |
| `buildVersion` | Supplied build/commit version or `null` |

Mutable source arrays are copied before freezing. Production-model changes after creation cannot alter the snapshot. Exports make another copy and never expose the adapter-owned object.

## Session metadata schema

Each session uses `spacelumin.prediction-session/1.0.0` and contains:

```text
schemaVersion, sessionId, participantLabel, playStyleLabel,
evaluationMode, sourceType, startTimestamp, endTimestamp, durationMs,
applicationVersion, buildVersion, evaluatorConfigurationVersion,
calibrationSnapshotId, startingSector, finalSector, totalEventCount,
resolvedCount, censoredCount, noPredictionCount, unresolvedCount,
evaluatorFaultCount, endReason, notes
```

Participant, play-style, build, source, session ID, and notes defaults are copied when the session begins. Later calls cannot rewrite an active or historical session. The default participant label is `participant-unknown`; the default play style is `play-style-unknown`.

## Complete JSON package

`exportJSON()` in the guarded API and `exportSessionJSON()` on the adapter return a JSON string with this complete top-level order:

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

Ended sessions export their finalized ledger. An active session also exports a copy of its pending `OPEN` event so unresolved state is not lost. Stable field/event ordering and an explicit `exportedAt` value produce byte-for-byte repeatable output.

## Event CSV

`exportEventsCSV()` returns one row per event. An empty ledger returns the header only. The exact header order is:

```text
exportSchemaVersion,exportedAt,eventId,sessionId,participantLabel,playStyleLabel,evaluationMode,sourceType,status,openedAt,resolvedAt,predictionLatencyMs,currentState,predictedNextState,actualNextState,correct,predictionAvailable,probabilityAssignedToActualState,fullProbabilityRow,stateEpochId,currentPositionSerial,nextPositionSerial,sector,gameTime,evaluatorConfigurationVersion,calibrationSnapshotId,sessionNotes,evaluatorFaultCount
```

The probability row is deterministic compact JSON inside one escaped CSV cell.

## Session-summary CSV

`exportSessionCSV()` returns exactly one summary row for the selected session. The exact header order is:

```text
exportSchemaVersion,exportedAt,sessionId,participantLabel,playStyleLabel,evaluationMode,sourceType,calibrationSnapshotId,startTimestamp,endTimestamp,durationMs,startingSector,finalSector,totalEventCount,resolvedCount,noPredictionCount,censoredCount,unresolvedCount,evaluatorFaultCount,evaluatorConfigurationVersion,buildVersion,sessionNotes
```

Event-level and session-summary CSV files are distinct products and cannot be confused by their method names, headers, or filenames.

## Value and lifecycle representation

- Numeric zero is serialized as `0`.
- Boolean false is serialized as `false`.
- JSON null remains `null`; CSV null is the literal `null`, not an empty cell or zero.
- A missing JavaScript property would be the CSV literal `unavailable`; exported schemas normally materialize unavailable values as `null`.
- Commas, quotes, carriage returns, and newlines follow standard double-quoted CSV escaping; embedded quotes are doubled.
- `RESOLVED` retains prediction, outcome, correctness, and the complete probability row.
- `NO_PREDICTION` retains the opportunity and actual outcome; predicted state and probability row remain `null`, and `predictionAvailable` is `false`.
- `CENSORED` retains the opened opportunity; actual state and correctness remain `null`.
- `OPEN` represents an unresolved event in an active-session export; actual state, resolution serial, resolution time, and correctness remain `null`.

## Guarded development API

When enabled, `window.spaceLuminEvaluation` is frozen and exposes only:

```text
setSessionMetadata(metadata)
startSession(options)
endSession(reason, options)
createCalibrationSnapshot(options)
loadCalibrationSnapshot(snapshot)
exportJSON(sessionId, options)
exportEventsCSV(sessionId, options)
exportSessionCSV(sessionId, options)
downloadJSON(sessionId, options)
downloadEventsCSV(sessionId, options)
downloadSessionCSV(sessionId, options)
```

Every method passes through the evaluator fault boundary. A serialization, snapshot, metadata, or download failure is counted and logged once per hook/message combination without interrupting gameplay. Returned snapshots/packages are immutable copies; export methods return strings and expose no mutable ledger or production-model reference.

Downloads use in-memory `Blob` object URLs and deterministic sanitized filenames:

```text
spacelumin-evaluation-<sanitized-session-id>.json
spacelumin-events-<sanitized-session-id>.csv
spacelumin-session-<sanitized-session-id>.csv
```

Sanitization lowercases the session ID, replaces unsupported/path characters with hyphens, trims leading/trailing separators, and limits the component to 80 characters.

## Controlled calibration-session procedure

1. Open Mode B with explicit pseudonymous metadata:

   ```text
   http://localhost:3000/?dev=1&evaluate=1&evaluationMode=B&evaluationBuild=40cce33
   ```

2. Before starting gameplay, run:

   ```js
   spaceLuminEvaluation.setSessionMetadata({
       sessionId: 'calibration-session-001',
       participantLabel: 'participant-001',
       playStyleLabel: 'balanced',
       sourceType: 'human',
       buildVersion: '40cce33',
       notes: 'controlled calibration; no identifying data'
   });
   ```

3. Start and play the run normally. `Game.startRun()` consumes the pending session ID/metadata. Let normal run termination end the session, or explicitly end it:

   ```js
   spaceLuminEvaluation.endSession('CALIBRATION_COMPLETE');
   ```

4. Create the frozen calibration copy only after calibration is complete. Supply only counts and IDs actually recorded by the controlled procedure:

   ```js
   const calibrationSnapshot = spaceLuminEvaluation.createCalibrationSnapshot({
       snapshotId: 'calibration-001',
       calibrationSessionIds: ['calibration-session-001'],
       calibrationObservationCount: null,
       buildVersion: '40cce33'
   });
   const calibrationSnapshotJSON = JSON.stringify(calibrationSnapshot, null, 2);
   console.log(calibrationSnapshotJSON);
   ```

5. Copy `calibrationSnapshotJSON` manually for the next page load. No persistence or remote upload is performed. If production `feedPositiveVector()` occurred, the production snapshot may contain pseudo-count reinforcement and must not be described as human-only calibration.

## Controlled Mode A procedure

1. Open:

   ```text
   http://localhost:3000/?dev=1&evaluate=1&evaluationMode=A&evaluationBuild=40cce33
   ```

2. Paste the previously copied JSON string, then load it before starting the first run:

   ```js
   const calibrationSnapshot = JSON.parse(`PASTE_CALIBRATION_SNAPSHOT_JSON_HERE`);
   spaceLuminEvaluation.loadCalibrationSnapshot(calibrationSnapshot);
   spaceLuminEvaluation.setSessionMetadata({
       sessionId: 'mode-a-session-001',
       participantLabel: 'participant-001',
       playStyleLabel: 'balanced',
       sourceType: 'human',
       buildVersion: '40cce33',
       notes: 'held-out Mode A evaluation'
   });
   ```

3. Start and play normally. End normally or call:

   ```js
   spaceLuminEvaluation.endSession('MODE_A_COMPLETE');
   ```

4. Export locally:

   ```js
   spaceLuminEvaluation.downloadJSON('mode-a-session-001');
   spaceLuminEvaluation.downloadEventsCSV('mode-a-session-001');
   spaceLuminEvaluation.downloadSessionCSV('mode-a-session-001');
   ```

## Controlled Mode B procedure

Open the Mode B URL, call `setSessionMetadata()` with a new pseudonymous session ID, then start gameplay normally. Mode B snapshots its starting shadow model for export, stores each prediction before its outcome, scores it, and updates only afterward. Export it with the same three export/download methods. Mode A and Mode B session IDs and reports must remain separate.

## Privacy and current limitations

- Never enter names, emails, IP addresses, precise locations, device identifiers, or other personal data.
- No cookies, analytics, networking, backend, or remote storage are used.
- Data exists only in the current page memory unless a developer explicitly downloads/copies it.
- Reloading loses sessions and snapshots; manual snapshot transfer is required for a fresh Mode A page.
- Production `feedPositiveVector()` provenance is not independently captured.
- Calibration collection automation and observation-count derivation are not implemented.
- Aggregate accuracy, baselines, impossible-event rate, log loss, Brier score, confidence intervals, charts, human-performance claims, gameplay adaptation, and AI improvements are intentionally excluded.
