# Prediction Runtime Debug Overlay

## Access and shortcut

The prediction runtime overlay is a development-only diagnostic. It is available when the page hostname is `localhost` or `127.0.0.1`, or when the URL explicitly contains `?dev=1`. On ordinary public deployments it creates no DOM, installs no F3 listener, and remains unavailable by default.

Press **F3** to open the overlay and press **F3** again to close it. The browser's default F3 action is prevented when the overlay handles the key. F3 is ignored while focus is inside an input, textarea, select, or editable element. The overlay is hidden after every reload and does not persist visibility in browser storage.

## Architecture

`js/PredictionDebugOverlay.js` contains two isolated components:

- `PredictionDebugSnapshotAdapter` reads current cached fields from the existing runtime objects and returns frozen plain records.
- `PredictionDebugOverlay` creates the DOM once, handles F3, and renders snapshot fields.

The adapter resolves Director through `window.game.director`. This is a read-only observation and does not fix or work around the separate bare-`director` defect in Cognitive Overload or Ghost Console. The overlay does not attach data to `Game`, create a second Director, call update methods, or write values back to any runtime system.

`index.html` loads the overlay after the Game initialization block, when all required script-level definitions are available. The adapter resolves `window.game` dynamically on each read, so it does not depend on initialization callback timing. `sw.js` pre-caches the new source file and increments the cache version so an installed cache cannot retain the older script order.

## Displayed field sources

| Display | Runtime source | Availability rule |
|---|---|---|
| Game status/state/sector/run time | `window.game`, `game.state`, `game.runData` | Game status is active after construction; run fields are `N/A` outside a run |
| Telemetry status | Global lexical `telemetryService` | Active because the committed Game loop calls it during play |
| Movement jerk | Latest `telemetryService.jerkHistory[].j` | `N/A` until a jerk derivative exists |
| Jerk score | `telemetryService.jerkScore` | `N/A` until at least 10 jerk samples, matching the service's minimum |
| Entropy | `telemetryService.entropyScore` | `N/A` until at least five shot outcomes, matching the service's minimum |
| Chaos and playstyle | `telemetryService.chaosFactor` and side-effect-free `getPlaystyle()` | `N/A` until both jerk and shot metrics have enough samples |
| Derivative sample counts | Position, velocity, acceleration, jerk, and shot history lengths | Always shows genuine counts, including zero |
| Predictive status/model readiness | Global lexical `predictiveAI`; `totalTransitions >= MIN_TRANSITIONS` | Status is active; model is warm-up until the threshold is reached |
| Encoded behavioural state | `predictiveAI.lastState` | `N/A` until the first position event encodes a state |
| Transition count | `predictiveAI.totalTransitions` | Genuine current counter |
| Shot window | `predictiveAI.shotWindow` | Rendered as `H` for hit and `M` for miss; `empty` before outcomes |
| Recent misses | `predictiveAI.recentMisses` | Genuine current rolling count |
| Missed-burst and panic risk | Cached `missedBurstRisk` and `panicRisk` fields | `N/A` until the transition model reaches its minimum sample threshold |
| Prediction-call count | No current field | `N/A`; the overlay does not wrap or call `predict()` merely to count it |
| Last prediction latency | No current timing field | `N/A`; measuring it would require prediction instrumentation |
| Director shots/hits | `window.game.director.shotsFired` and `shotsHit` | Genuine counters from committed call sites |
| Director accuracy/skill | `window.game.director.accuracy` and `skillScore` | Existing calculated fields; some skill inputs remain incompletely wired |
| Director multipliers | `enemySpeedMult`, `spawnDensityMult`, `eliteChance`, `hazardFrequency` | Genuine calculated values, explicitly labelled as not consumed by gameplay |

The runtime-system labels follow `docs/PREDICTION_RUNTIME_TRACE.md`: Game, TelemetryService, PredictiveAI, and Director are `ACTIVE`; NeuroFlowController is `CONSTRUCTED / INACTIVE`; KernelMapper and CognitiveOverloadDetector are `UNREACHABLE` in the committed browser update path. A missing runtime object is labelled `N/A` rather than guessed.

## Why values display `N/A`

The following values are unavailable in the verified runtime and remain `N/A`:

- genuine collision-risk calibration, because Game does not supply live HP or nearby-enemy inputs to PredictiveAI;
- live HP and enemy-density brackets;
- Kernel flow classification, because `kernelMapper.classify()` has no shipped caller;
- cortical phi and live NeuroFlow state, because NeuroFlow's update/observation path is inactive;
- overload probability and stimulus attribution, because Cognitive Overload's update path is unreachable;
- active adaptive intervention, because intervention dispatch is unreachable;
- prediction-call count and prediction latency, because no read-only cached fields currently exist.

Constructor defaults are not displayed as simulated live values.

## Update frequency and performance precautions

The overlay builds its DOM once. While visible, it reads and renders once every 200 ms (approximately 5 Hz) and performs one immediate render when opened. Closing it clears the timer. It does not add work to `Game.loop()`, use `requestAnimationFrame`, rebuild the DOM per frame, or retain copies of telemetry histories. Text nodes update only when their rendered value changes.

The root uses `pointer-events: none`, so it cannot intercept movement, combat, or menu input. It is fixed in the upper-right portion of the viewport and uses a two-column compact layout on desktop, collapsing for narrow screens.

## Gameplay isolation and known limitations

The overlay never calls `predict()`, `getPrediction()`, debug getters that proxy to prediction, `update()`, `record*()`, `classify()`, training, DNA mutation, or intervention methods. It does not change prediction thresholds, state transitions, Director ownership, inactive AI reachability, or gameplay behavior.

Known limitations:

- collision risk, HP/enemy brackets, Kernel/NeuroFlow/Cognitive values, intervention state, prediction-call count, and prediction latency remain `N/A` until separately approved instrumentation exists;
- Director multipliers are observable but remain unconsumed by gameplay;
- the existing localhost Ghost Console independently polls stateful prediction APIs; this overlay does not add to that behavior;
- visibility is intentionally not persisted across reloads.
