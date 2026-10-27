/*!
 * Copyright (c) 2026 Lumin Flow Studios. All Rights Reserved.
 * LUMIN FLOW: UTOPIA RUN (SPACELUMIN) — PROPRIETARY & CONFIDENTIAL
 * Protected Intellectual Property: PredictiveAI, NystromKernel, NeuroFlow, KernelMapper, Director.
 * Unauthorized copying, reverse-engineering, scraping, or redistribution is strictly prohibited.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const TELEMETRY_LOG = path.join(DATA_DIR, 'screened_sessions.jsonl');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
};

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

const server = http.createServer((req, res) => {
    let decodedUrl = '';
    try {
        decodedUrl = decodeURIComponent(req.url);
    } catch (e) {
        decodedUrl = req.url;
    }

    const cleanUrl = decodedUrl.split('?')[0];

    // =========================================================================
    // SILENT BACKEND DATA SCREENING & COLLECTION ENDPOINTS
    // =========================================================================
    if (req.method === 'POST' && cleanUrl === '/api/telemetry/screened') {
        let body = '';
        req.on('data', chunk => {
            if (body.length < 65536) body += chunk;
        });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                // Backend validation & screening gate
                if (payload && payload.sessionId && payload.metrics && typeof payload.qualityScore === 'number') {
                    ensureDataDir();
                    const record = JSON.stringify({
                        receivedAt: new Date().toISOString(),
                        ...payload
                    }) + '\n';
                    fs.appendFile(TELEMETRY_LOG, record, () => {});
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, screened: payload.screenedPassed }));
                    return;
                }
            } catch (_) {}
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false }));
        });
        return;
    }

    if (req.method === 'GET' && cleanUrl === '/api/telemetry/stats') {
        ensureDataDir();
        let count = 0;
        if (fs.existsSync(TELEMETRY_LOG)) {
            const content = fs.readFileSync(TELEMETRY_LOG, 'utf8');
            count = content.split('\n').filter(Boolean).length;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ screenedRecords: count }));
        return;
    }

    // =========================================================================
    // STATIC ASSET SERVING
    // =========================================================================
    let filePath = path.join(ROOT_DIR, cleanUrl === '/' ? 'index.html' : cleanUrl);
    const relative = path.relative(ROOT_DIR, filePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        if (stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        fs.stat(filePath, (err2, stats2) => {
            if (err2 || !stats2.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, {
                'Content-Type': contentType,
                'X-Frame-Options': 'DENY',
                'X-Content-Type-Options': 'nosniff',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Cross-Origin-Resource-Policy': 'same-origin',
                'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
                'TDM-Reservation': '1',
                'X-Copyright-Protection': 'Copyright (c) 2026 Lumin Flow Studios. Protected under German UrhG SS 69a-69g, 95a and EU Directive 2009/24/EC.'
            });
            fs.createReadStream(filePath).pipe(res);
        });
    });
});

server.listen(PORT, () => {
    console.log(`Static & Data Screening server running at http://localhost:${PORT}`);
});
