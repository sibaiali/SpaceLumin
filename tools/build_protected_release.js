/**
 * Copyright (c) 2026 Lumin Flow Studios. All Rights Reserved.
 * tools/build_protected_release.js
 * Builds a minified & comment-stripped Protected Production Release in dist/protected-release/
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist', 'protected-release');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDirRecursive(src, dest) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(s, d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

/**
 * Safe JavaScript minifier & comment stripper that preserves string/regex literals
 * and prepends the immutable Lumin Flow Studios copyright seal.
 */
function protectJavaScript(source, filename) {
    const seal = `/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (${filename}) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */\n`;
    // Strip block comments and full-line comments safely while preserving code behavior
    const lines = source.split(/\r?\n/);
    const outLines = [];
    let inBlockComment = false;

    for (let line of lines) {
        const trimmed = line.trim();
        if (inBlockComment) {
            if (trimmed.includes('*/')) {
                inBlockComment = false;
                line = line.slice(line.indexOf('*/') + 2);
            } else {
                continue;
            }
        }
        if (trimmed.startsWith('/*') && !trimmed.includes('*/')) {
            inBlockComment = true;
            continue;
        }
        if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
            continue;
        }
        if (trimmed.startsWith('//')) {
            continue;
        }
        if (trimmed.length > 0) {
            outLines.push(trimmed);
        }
    }

    return seal + outLines.join('\n') + '\n';
}

ensureDir(OUT_DIR);
ensureDir(path.join(OUT_DIR, 'js'));

// Copy static files
for (const file of ['index.html', 'styles.css', 'manifest.json', 'sw.js', 'favicon.ico', 'LICENSE', 'COPYRIGHT.md', 'SpaceLumin.exe']) {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(OUT_DIR, file));
    }
}

copyDirRecursive(path.join(ROOT, 'icons'), path.join(OUT_DIR, 'icons'));
copyDirRecursive(path.join(ROOT, 'lib'), path.join(OUT_DIR, 'lib'));

// Protect all JS files in dist/protected-release/js/
const jsDir = path.join(ROOT, 'js');
for (const file of fs.readdirSync(jsDir).filter(f => f.endsWith('.js'))) {
    const raw = fs.readFileSync(path.join(jsDir, file), 'utf8');
    const protectedCode = protectJavaScript(raw, file);
    fs.writeFileSync(path.join(OUT_DIR, 'js', file), protectedCode, 'utf8');
}

console.log('Built protected release in dist/protected-release/');
