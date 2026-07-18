/**
 * GhostConsole.js  —  Space Lumin Developer Debug HUD
 * =====================================================
 * A Canvas-based floating overlay that renders real-time sparkline
 * graphs and live metrics for every AI subsystem.
 *
 * ACTIVATION  (localhost only):
 *   • Press  Shift + Alt + L   at any time, OR
 *   • Click the version text 7× and enter the Neural Auth credentials
 *
 * NON-LOCALHOST GATE:
 *   If window.location.hostname is not 'localhost' / '127.0.0.1',
 *   the console is permanently disabled — it never touches the DOM.
 *
 * PANELS (all render in a floating dark-glass overlay):
 *   ① RBF Kernel Stability       — σ bandwidth + Nyström fit history
 *   ② Flow State (Kalman φ)      — NeuroFlowController extrapolate
 *   ③ Cognitive Overload Index   — OI(t) = φ_attn − φ_dmn
 *   ④ Difficulty Curve           — f(L) = 1.55^(L-1) + neuro modifier
 *   ⑤ Risk Signals               — PredictiveAI collision/panic/missed
 *   ⑥ DNA Gene Pool              — avg speed/aggro + generation
 *   ⑦ Telemetry / KLR State      — jerk/entropy/chaos + P(FLOW)
 *
 * Budget: < 0.5ms/frame on average hardware (Canvas 2D path batching).
 */

const GhostConsole = (() => {

    // ================================================================
    // LOCALHOST GATE — hard-coded, tamper-evident
    // ================================================================
    const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(
        window.location.hostname
    );

    if (!IS_LOCAL) {
        // On production domains: export a no-op API, touch nothing
        return {
            init: () => {},
            toggle: () => {},
            update: () => {},
            isVisible: () => false
        };
    }

    // ================================================================
    // CONSTANTS
    // ================================================================
    const W           = 420;        // Overlay width (px)
    const SPARK_PTS   = 80;         // Sparkline history length
    const UPDATE_MS   = 100;        // Data poll rate
    const FONT_MONO   = '11px "Courier New", monospace';
    const FONT_LABEL  = 'bold 10px "Courier New", monospace';
    const FONT_TITLE  = 'bold 12px "Courier New", monospace';

    // Palette
    const C = {
        bg:      'rgba(4, 8, 20, 0.96)',
        border:  '#0ac8b9',
        border2: '#334155',
        title:   '#c8aa6e',
        cyan:    '#22d3ee',
        green:   '#22c55e',
        orange:  '#f97316',
        red:     '#ef4444',
        purple:  '#a855f7',
        slate:   '#64748b',
        white:   '#e2e8f0',
        gold:    '#eab308',
    };

    // ================================================================
    // STATE
    // ================================================================
    let visible   = false;
    let canvas    = null;
    let ctx       = null;
    let rafId     = null;
    let pollTimer = null;

    // Sparkline ring buffers  (all values normalised 0..1 for graph)
    const spark = {
        phi:       new RingBuffer(SPARK_PTS),   // Kalman φ
        oi:        new RingBuffer(SPARK_PTS),   // Overload Index
        jerk:      new RingBuffer(SPARK_PTS),   // jerkScore / 100
        chaos:     new RingBuffer(SPARK_PTS),   // chaosFactor / 2
        collision: new RingBuffer(SPARK_PTS),   // collisionRisk
        panic:     new RingBuffer(SPARK_PTS),   // panicRisk
        missed:    new RingBuffer(SPARK_PTS),   // missedBurstRisk
        sigma:     new RingBuffer(SPARK_PTS),   // Nyström σ (normalised)
        flowProb:  new RingBuffer(SPARK_PTS),   // KLR P(FLOW)
        diffMult:  new RingBuffer(SPARK_PTS),   // neuro difficulty modifier
    };

    // Snapshot of latest values (updated by poll loop, read by draw loop)
    let snap = {};

    // ================================================================
    // RING BUFFER  (tiny circular array, no GC pressure)
    // ================================================================
    function RingBuffer(size) {
        this.buf  = new Float32Array(size);
        this.size = size;
        this.head = 0;
        this.push = function(v) {
            this.buf[this.head] = v;
            this.head = (this.head + 1) % this.size;
        };
        this.get = function(i) {      // i=0 → oldest, i=size-1 → newest
            return this.buf[(this.head + i) % this.size];
        };
    }

    // ================================================================
    // DOM SETUP
    // ================================================================
    function init() {
        if (!IS_LOCAL) return;

        // Overlay container
        const container = document.createElement('div');
        container.id    = 'ghost-console';
        Object.assign(container.style, {
            position:    'fixed',
            top:         '10px',
            right:       '10px',
            width:       W + 'px',
            zIndex:      '99999',
            display:     'none',
            flexDirection: 'column',
            borderRadius: '10px',
            overflow:    'hidden',
            boxShadow:   '0 0 24px rgba(10,200,185,0.25), 0 0 2px #0ac8b9',
            fontFamily:  '"Courier New", monospace',
            userSelect:  'none',
        });

        // Title bar
        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            background:     'rgba(4,8,20,0.98)',
            borderBottom:   '1px solid #0ac8b9',
            padding:        '7px 12px',
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            cursor:         'move',
        });
        titleBar.innerHTML = `
            <span style="color:#c8aa6e;font-weight:bold;font-size:12px;letter-spacing:0.08em;">
                ◈ GHOST CONSOLE  <span style="color:#0ac8b9;font-size:10px;">[localhost]</span>
            </span>
            <span style="color:#64748b;font-size:10px;">Shift+Alt+L to hide</span>
        `;

        // Canvas
        canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = 560;
        canvas.style.display = 'block';
        canvas.style.background = C.bg;
        ctx = canvas.getContext('2d');

        container.appendChild(titleBar);
        container.appendChild(canvas);
        document.body.appendChild(container);

        // Draggable title bar
        _makeDraggable(container, titleBar);

        // Keyboard shortcut: Shift + Alt + L
        window.addEventListener('keydown', e => {
            if (e.shiftKey && e.altKey && e.key === 'L') toggle();
        });

        // Start loops
        pollTimer = setInterval(pollData, UPDATE_MS);
        drawLoop();

        console.log('[GhostConsole] Ready — press Shift+Alt+L to toggle');
    }

    // ================================================================
    // TOGGLE
    // ================================================================
    function toggle() {
        if (!IS_LOCAL) return;
        visible = !visible;
        const el = document.getElementById('ghost-console');
        if (el) el.style.display = visible ? 'flex' : 'none';
    }

    // ================================================================
    // DATA POLL (every 100ms, not every frame)
    // ================================================================
    function pollData() {
        const s = {};

        // --- NeuroFlowController ---
        if (typeof neuroFlow !== 'undefined') {
            const d  = neuroFlow.getDebugInfo();
            s.phi        = parseFloat(d.phi);
            s.flowBand   = d.flowBand;
            s.diffMult   = parseFloat(d.diffMult);
            s.spawnAdj   = parseFloat(d.spawnAdjust);
            s.aggroAdj   = parseFloat(d.aggroAdjust);
            s.kalmanCov  = parseFloat(d.kalmanCov);
            spark.phi.push(s.phi);
            spark.diffMult.push(s.diffMult);
        }

        // --- CognitiveOverloadDetector ---
        if (typeof cogOverload !== 'undefined') {
            const d  = cogOverload.getDebugInfo();
            s.oi         = parseFloat(d.overloadIndex);
            s.oiDot      = parseFloat(d.dOI);
            s.overloadP  = parseFloat(d.overloadProb);
            s.isOverload = d.isOverloaded;
            s.preWarn    = d.preWarning;
            s.attr       = d.stimAttribution || {};
            spark.oi.push((s.oi + 1) / 2);  // normalise [-1,1] → [0,1]
        }

        // --- NystromKernel ---
        if (typeof nystromKernel !== 'undefined') {
            const d  = nystromKernel.getDebugInfo();
            s.sigma      = parseFloat(d.sigma) || 0;
            s.kFitted    = d.fitted;
            s.bufSize    = d.bufferSize;
            s.landmarks  = d.landmarks;
            const normSigma = Math.min(1, s.sigma / 500);  // 0–500 → 0–1
            spark.sigma.push(normSigma);
        }

        // --- KernelMapper ---
        if (typeof kernelMapper !== 'undefined') {
            const d   = kernelMapper.getDebugInfo();
            s.klrState   = d.lastState;
            s.flowProb   = parseFloat(d.flowProb);
            s.mutGate    = parseFloat(d.mutationGate);
            spark.flowProb.push(s.flowProb);
        }

        // --- TelemetryService ---
        if (typeof telemetryService !== 'undefined') {
            const m  = telemetryService.getMetrics();
            s.jerk       = m.jerkScore;
            s.entropy    = m.entropyScore;
            s.chaos      = parseFloat(m.chaosFactor);
            s.playstyle  = m.playstyle;
            spark.jerk.push(s.jerk / 100);
            spark.chaos.push(Math.min(1, s.chaos / 2));
        }

        // --- PredictiveAI ---
        if (typeof predictiveAI !== 'undefined') {
            const p  = predictiveAI.predict();
            s.collision  = p.collisionRisk;
            s.panic      = p.panicRisk;
            s.missed     = p.missedBurstRisk;
            s.transitions = predictiveAI.totalTransitions;
            spark.collision.push(s.collision);
            spark.panic.push(s.panic);
            spark.missed.push(s.missed);
        }

        // --- EnemyDNA ---
        if (typeof enemyDNA !== 'undefined') {
            const d  = enemyDNA.getStats();
            s.dnaGen     = d.generation;
            s.dnaPool    = d.poolSize;
            s.dnaSpeed   = parseFloat(d.averageGenes.speed);
            s.dnaAggro   = parseFloat(d.averageGenes.aggro);
        }

        // --- Director ---
        if (typeof director !== 'undefined') {
            const p  = director.getDifficultyParams();
            s.skillScore    = director.skillScore;
            s.skillTier     = director.getSkillTier();
            s.enemySpeed    = p.enemySpeedMult;
            s.spawnDensity  = p.spawnDensityMult;
        }

        // --- DifficultySystem ---
        if (typeof difficultySystem !== 'undefined') {
            const p  = difficultySystem.getParams();
            s.sector     = p.sector;
            s.element    = p.element;
            s.sectorMult = difficultySystem.sectorMult(p.sector);
            const L      = p.sector;
            s.fL         = Math.pow(1.55, L - 1);
        }

        snap = s;
    }

    // ================================================================
    // DRAW LOOP (rAF — only runs when visible)
    // ================================================================
    function drawLoop() {
        rafId = requestAnimationFrame(drawLoop);
        if (!visible || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let y = 10;
        y = _drawKernelPanel(y);
        y = _drawFlowPanel(y);
        y = _drawOverloadPanel(y);
        y = _drawDifficultyPanel(y);
        y = _drawRiskPanel(y);
        y = _drawDNAPanel(y);
        y = _drawTelemetryPanel(y);

        // Resize canvas if needed
        if (y + 10 !== canvas.height) {
            canvas.height = y + 10;
        }
    }

    // ================================================================
    // PANEL RENDERERS
    // ================================================================

    function _panelHeader(y, icon, title, color) {
        ctx.fillStyle = 'rgba(10,200,185,0.07)';
        ctx.fillRect(8, y, W - 16, 18);
        ctx.fillStyle = color || C.title;
        ctx.font      = FONT_TITLE;
        ctx.fillText(`${icon}  ${title}`, 14, y + 13);
        return y + 22;
    }

    function _row(y, label, value, vColor) {
        ctx.font      = FONT_MONO;
        ctx.fillStyle = C.slate;
        ctx.fillText(label, 14, y);
        ctx.fillStyle = vColor || C.cyan;
        ctx.fillText(String(value), 180, y);
        return y + 15;
    }

    // --- ① RBF Kernel Stability ---
    function _drawKernelPanel(y) {
        y = _panelHeader(y, '◎', 'RBF KERNEL / NYSTRÖM', C.title);
        const s = snap;

        y = _row(y, 'σ bandwidth',
            s.sigma != null ? s.sigma.toFixed(2) : '--',
            s.sigma > 200 ? C.green : C.orange);
        y = _row(y, 'Fitted',
            s.kFitted ? 'YES' : 'NO (warm-up)',
            s.kFitted ? C.green : C.orange);
        y = _row(y, 'Buffer / Landmarks',
            `${s.bufSize ?? '--'} / ${s.landmarks ?? 60}`, C.cyan);
        y = _row(y, 'KLR State',  s.klrState ?? '--',
            s.klrState === 'FLOW' ? C.green : s.klrState === 'FRUSTRATION' ? C.orange : C.purple);
        y = _row(y, 'P(FLOW)',
            s.flowProb != null ? (s.flowProb * 100).toFixed(1) + '%' : '--',
            _lerpc(s.flowProb ?? 0.5));
        y = _row(y, 'Mutation gate',
            s.mutGate != null ? (s.mutGate * 100).toFixed(1) + '%' : '--', C.cyan);

        y = _sparkPanel(y, 'σ history', spark.sigma, C.cyan);
        y = _sparkPanel(y, 'P(FLOW) history', spark.flowProb, C.purple, true);
        return y + 4;
    }

    // --- ② Flow State ---
    function _drawFlowPanel(y) {
        y = _panelHeader(y, '⟳', 'NEURO FLOW  (Kalman φ̂)', C.border);
        const s = snap;

        const bandColor = { FLOW: C.green, OVER: C.orange, UNDER: C.purple }[s.flowBand] || C.slate;
        y = _row(y, 'φ̂  current',    s.phi != null ? s.phi.toFixed(4) : '--', _lerpc(s.phi ?? 0.5));
        y = _row(y, 'Flow band',      s.flowBand ?? '--', bandColor);
        y = _row(y, 'Kalman cov',     s.kalmanCov != null ? s.kalmanCov.toFixed(5) : '--', C.slate);
        y = _row(y, 'Difficulty mod', s.diffMult != null ? s.diffMult.toFixed(3) : '--',
            s.diffMult > 0.9 ? C.green : C.orange);
        y = _row(y, 'Spawn adjust',   s.spawnAdj?.toFixed(2) ?? '--', C.cyan);
        y = _row(y, 'Aggro adjust',   s.aggroAdj?.toFixed(2) ?? '--', C.cyan);

        y = _sparkPanel(y, 'φ̂ over time', spark.phi, C.border);
        return y + 4;
    }

    // --- ③ Cognitive Overload ---
    function _drawOverloadPanel(y) {
        y = _panelHeader(y, '⚠', 'COGNITIVE OVERLOAD INDEX', C.red);
        const s = snap;

        const oiColor = (s.oi ?? 0.2) > 0.15 ? C.green : C.red;
        y = _row(y, 'OI(t)',    s.oi != null ? s.oi.toFixed(4) : '--', oiColor);
        y = _row(y, 'dOI/dt',  s.oiDot != null ? s.oiDot.toFixed(4) : '--',
            (s.oiDot ?? 0) < -0.03 ? C.red : C.slate);
        y = _row(y, 'P(Load)', s.overloadP != null ? (s.overloadP * 100).toFixed(1) + '%' : '--',
            (s.overloadP ?? 0) > 0.65 ? C.red : C.green);
        y = _row(y, 'State',   s.isOverload ? '⚠ OVERLOADED' : '✓ OK',
            s.isOverload ? C.red : C.green);
        y = _row(y, 'Pre-warn', s.preWarn ? '🔴 FIRING' : '○ idle',
            s.preWarn ? C.red : C.slate);

        // Attribution bar chart
        if (s.attr && Object.keys(s.attr).length) {
            ctx.font = FONT_LABEL;
            ctx.fillStyle = C.slate;
            ctx.fillText('STIMULUS ATTRIBUTION:', 14, y + 11);
            y += 15;
            const labels = ['Enemy', 'Bullet', 'Audio', 'Visual', 'Aggro', 'Timer'];
            const vals   = Object.values(s.attr).map(v => parseFloat(v));
            const maxV   = Math.max(...vals, 0.001);
            const barW   = (W - 28) / labels.length;
            vals.forEach((v, i) => {
                const bx = 14 + i * barW;
                const bh = Math.min(28, (v / maxV) * 28);
                const bColor = i === vals.indexOf(Math.max(...vals)) ? C.red : C.border2;
                ctx.fillStyle = bColor;
                ctx.fillRect(bx, y + 30 - bh, barW - 3, bh);
                ctx.fillStyle = C.slate;
                ctx.font = '9px monospace';
                ctx.fillText(labels[i], bx, y + 42);
            });
            y += 48;
        }

        y = _sparkPanel(y, 'OI(t) history (norm)', spark.oi, C.red, false, 0.5);
        return y + 4;
    }

    // --- ④ Difficulty Curve ---
    function _drawDifficultyPanel(y) {
        y = _panelHeader(y, 'ƒ', 'DIFFICULTY  f(L) = 1.55^(L−1)', C.gold);
        const s = snap;

        y = _row(y, 'Sector  L', s.sector ?? '--', C.cyan);
        y = _row(y, 'f(L) raw', s.fL != null ? s.fL.toFixed(3) : '--', C.gold);
        y = _row(y, 'f̃(L,φ)',
            s.sectorMult != null ? s.sectorMult.toFixed(3) : '--', _lerpc(s.diffMult ?? 1));
        y = _row(y, 'Element', s.element ?? '--',
            ({ ICE: C.cyan, FIRE: C.red, NATURE: C.green, WIND: C.purple }[s.element]) || C.white);
        y = _row(y, 'Director skill',
            s.skillScore != null ? `${s.skillScore} · ${s.skillTier}` : '--', C.cyan);
        y = _row(y, 'Enemy speed×', s.enemySpeed?.toFixed(3) ?? '--', C.orange);
        y = _row(y, 'Spawn density×', s.spawnDensity?.toFixed(3) ?? '--', C.orange);

        // Mini sector ladder
        y = _drawSectorLadder(y, s.sector ?? 1);
        y = _sparkPanel(y, 'Difficulty mod φ-gated', spark.diffMult, C.gold);
        return y + 4;
    }

    function _drawSectorLadder(y, currentL) {
        ctx.font = '9px monospace';
        const cellW = (W - 28) / 20;
        for (let L = 1; L <= 20; L++) {
            const cx = 14 + (L - 1) * cellW;
            const isActive = L === currentL;
            const elColor = L <= 5 ? C.cyan : L <= 10 ? C.red : L <= 15 ? C.green : C.purple;
            ctx.fillStyle = isActive ? elColor : 'rgba(255,255,255,0.08)';
            ctx.fillRect(cx, y, cellW - 1, 12);
            if (isActive) {
                ctx.fillStyle = '#000';
                ctx.fillText(L, cx + 1, y + 10);
            }
        }
        return y + 18;
    }

    // --- ⑤ Risk Signals ---
    function _drawRiskPanel(y) {
        y = _panelHeader(y, '⟁', 'PREDICTIVE AI  RISK SIGNALS', C.orange);
        const s = snap;

        y = _row(y, 'Collision risk', _pct(s.collision), _riskColor(s.collision));
        y = _row(y, 'Panic risk',     _pct(s.panic),     _riskColor(s.panic));
        y = _row(y, 'MissedBurst',    _pct(s.missed),    _riskColor(s.missed));
        y = _row(y, 'Transitions',    s.transitions ?? '--', C.slate);

        // Mini 3-row spark side by side
        const panelW = (W - 28) / 3 - 2;
        y = _sparkInline(y, 'Coll.', spark.collision, C.orange,  14);
        _sparkInline(y - 50, 'Panic', spark.panic,     C.red,     14 + panelW + 2);
        _sparkInline(y - 50, 'Miss.',  spark.missed,    C.purple,  14 + 2*(panelW + 2));
        return y + 4;
    }

    // --- ⑥ DNA Gene Pool ---
    function _drawDNAPanel(y) {
        y = _panelHeader(y, '🧬', 'ENEMY DNA  GENE POOL', C.green);
        const s = snap;

        y = _row(y, 'Generation',  s.dnaGen  ?? '--', C.green);
        y = _row(y, 'Pool size',   s.dnaPool ?? '--', C.cyan);
        y = _row(y, 'Avg speed ⟨g⟩', s.dnaSpeed?.toFixed(3) ?? '--', C.orange);
        y = _row(y, 'Avg aggro ⟨g⟩', s.dnaAggro?.toFixed(3) ?? '--', C.red);
        return y + 4;
    }

    // --- ⑦ Telemetry ---
    function _drawTelemetryPanel(y) {
        y = _panelHeader(y, '◈', 'TELEMETRY / CHAOS METRICS', C.cyan);
        const s = snap;

        y = _row(y, 'Jerk score',    s.jerk     ?? '--', _lerpc((s.jerk ?? 50) / 100));
        y = _row(y, 'Entropy score', s.entropy  ?? '--', C.slate);
        y = _row(y, 'Chaos factor',  s.chaos?.toFixed(2) ?? '--',
            (s.chaos ?? 1) > 1.2 ? C.red : (s.chaos ?? 1) > 0.8 ? C.orange : C.green);
        y = _row(y, 'Playstyle',     s.playstyle ?? '--',
            s.playstyle === 'Chaotic' ? C.red : s.playstyle === 'Precise' ? C.green : C.cyan);

        y = _sparkPanel(y, 'Jerk history', spark.jerk, C.orange);
        return y + 8;
    }

    // ================================================================
    // SPARKLINE PRIMITIVES
    // ================================================================

    function _sparkPanel(y, label, ring, color, filled = false, baseline = null) {
        const H = 36;
        const xOff = 14, graphW = W - 28;

        ctx.font      = FONT_LABEL;
        ctx.fillStyle = C.slate;
        ctx.fillText(label, xOff, y + 10);
        y += 13;

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(xOff, y, graphW, H);

        // Baseline at 0.5
        if (baseline != null) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.moveTo(xOff, y + H * (1 - baseline));
            ctx.lineTo(xOff + graphW, y + H * (1 - baseline));
            ctx.stroke();
        }

        _drawSparkline(xOff, y, graphW, H, ring, color, filled);
        return y + H + 4;
    }

    function _sparkInline(y, label, ring, color, xOff) {
        const H = 44, panelW = (W - 28) / 3 - 2;
        ctx.font      = '9px monospace';
        ctx.fillStyle = C.slate;
        ctx.fillText(label, xOff, y + 10);
        _drawSparkline(xOff, y + 12, panelW, H, ring, color);
        return y + H + 16;
    }

    function _drawSparkline(x, y, w, h, ring, color, filled = false) {
        const pts = ring.size;
        if (pts < 2) return;

        ctx.beginPath();
        for (let i = 0; i < pts; i++) {
            const v  = ring.get(i);
            const px = x + (i / (pts - 1)) * w;
            const py = y + h - Math.max(0, Math.min(1, v)) * h;
            if (i === 0) ctx.moveTo(px, py);
            else         ctx.lineTo(px, py);
        }

        if (filled) {
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x,     y + h);
            ctx.closePath();
            ctx.fillStyle = color + '22';
            ctx.fill();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Latest value dot
        const last  = ring.get(pts - 1);
        const dotX  = x + w;
        const dotY  = y + h - Math.max(0, Math.min(1, last)) * h;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }

    // ================================================================
    // UTILITIES
    // ================================================================

    function _pct(v) { return v != null ? (v * 100).toFixed(1) + '%' : '--'; }

    function _riskColor(v) {
        if (v == null) return C.slate;
        if (v > 0.70)  return C.red;
        if (v > 0.45)  return C.orange;
        return C.green;
    }

    // Green → orange → red based on [0,1] normalised value
    function _lerpc(v) {
        const t = Math.max(0, Math.min(1, v ?? 0.5));
        if (t > 0.6) return C.green;
        if (t > 0.35) return C.orange;
        return C.red;
    }

    // Simple draggable widget
    function _makeDraggable(el, handle) {
        let ox = 0, oy = 0, startX = 0, startY = 0;
        handle.addEventListener('mousedown', e => {
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            const r = el.getBoundingClientRect();
            ox = r.left;
            oy = r.top;
            const onMove = mv => {
                el.style.left   = (ox + mv.clientX - startX) + 'px';
                el.style.top    = (oy + mv.clientY - startY) + 'px';
                el.style.right  = 'auto';
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',  onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });
    }

    // ================================================================
    // PUBLIC API
    // ================================================================
    return { init, toggle, update: pollData, isVisible: () => visible };

})();

// Auto-init after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GhostConsole.init());
} else {
    GhostConsole.init();
}
