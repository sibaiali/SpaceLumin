/*!
 * Copyright (c) 2026 Lumin Flow Studios. All Rights Reserved.
 * LUMIN FLOW: UTOPIA RUN (SPACELUMIN) — PROPRIETARY & CONFIDENTIAL
 * Protected under German Urheberrechtsgesetz (UrhG §§ 69a-69g, §§ 95a-95d, §§ 97, 106, 108a),
 * EU Software Directive 2009/24/EC, EU InfoSoc Directive 2001/29/EC, and EU DSM Directive (EU) 2019/790 Art. 4.
 * Unauthorized cloning, reproduction, reverse-engineering, scraping, or commercial sale is strictly prohibited.
 */
/**
 * CopyrightGuard.js - European Union & German Law (UrhG) IP Protection, Anti-Cloning Shield,
 * Frame-Busting, TDM Opt-Out Enforcement, and Tamper-Proof Rights Management Information (RMI)
 */

(function () {
    'use strict';

    const COPYRIGHT_SEAL = Object.freeze({
        title: 'Lumin Flow: Utopia Run (SpaceLumin)',
        edition: 'v4.5 · Cyber-Creative Gravity & Singularity Studio',
        owner: 'Lumin Flow Studios',
        jurisdiction: 'Federal Republic of Germany (DE) & European Union (EU)',
        copyright: '© 2026 Lumin Flow Studios. Alle Rechte vorbehalten / All Rights Reserved.',
        legalStatutes: Object.freeze([
            'German Copyright Act (Urheberrechtsgesetz — UrhG) §§ 69a–69g (Schutz von Computerprogrammen)',
            'German UrhG §§ 95a–95d (Schutz technischer Maßnahmen & Rechtewahrnehmungsinformationen)',
            'German UrhG §§ 97, 106, 108a (Unterlassung, Schadensersatz & Strafbarkeit gewerblicher unerlaubter Verwertung)',
            'EU Directive 2009/24/EC on the Legal Protection of Computer Programs',
            'EU Directive (EU) 2019/790 (DSM Directive) Art. 4(3) — Explicit Opt-Out from Text & Data Mining (TDM) and AI Scraping',
            'EU General Data Protection Regulation (GDPR / DSGVO) Art. 25 Privacy-by-Design Pseudonymous Telemetry'
        ]),
        protectedAlgorithms: Object.freeze([
            'PredictiveAI (36-State Non-Homogeneous Markov Chain + EWM Smoothing)',
            'NystromKernel (m=60 Low-Rank Eigen-Approximation)',
            'KernelMapper (RBF Kernel Logistic Regression)',
            'NeuroFlowController (Kalman AR(2) + Catmull-Rom Spline)',
            'CognitiveOverloadDetector (KLR + LASSO Sparsity)',
            'EnemyDNA (Genetic Crossover & Mutation Engine)',
            'Director (Adaptive Skill + Playtime + Predictive Escalation)',
            'PlanetAtlas & SymbolBadges (20-World Procedural Astronomical & Ecosystem Engine)'
        ]),
        tdmReservation: 1, // Machine-readable EU DSM Directive Art. 4 Opt-Out
        signatureHash: 'DE-EU-LFS-2026-9F8A4D2C-7E1B63A0-URHG69A-95A-SEAL',
        registeredYear: 2026
    });

    // 1. Expose immutable Rights Management Information (RMI under § 95c UrhG)
    if (typeof window !== 'undefined') {
        try {
            Object.defineProperty(window, '__SPACELUMIN_COPYRIGHT__', {
                value: COPYRIGHT_SEAL,
                writable: false,
                configurable: false,
                enumerable: true
            });
        } catch (_) {
            window.__SPACELUMIN_COPYRIGHT__ = COPYRIGHT_SEAL;
        }
    }

    // 2. Anti-Cloning Frame-Buster: Prevent unauthorized third-party websites from embedding/cloning in an iframe
    function enforceFrameBuster() {
        if (typeof window === 'undefined') return;
        try {
            if (window.self !== window.top) {
                window.top.location = window.self.location;
            }
        } catch (_) {
            // Cross-origin iframe detected — blank out unauthorized embed
            if (typeof document !== 'undefined' && document.body) {
                document.body.innerHTML = '<div style="padding:40px;color:#ef4444;background:#030712;font-family:monospace;text-align:center;">' +
                    '<h1>⚠️ UNAUTHORIZED EMBED / CLONE BLOCKED (§ 95a UrhG / EU Directive 2009/24/EC)</h1>' +
                    '<p>© 2026 Lumin Flow Studios. All Rights Reserved. Unauthorized framing or redistribution is prohibited under German and European law.</p></div>';
            }
        }
    }

    // Check if developer / evaluation mode is explicitly active
    function isDevModeActive() {
        if (typeof window === 'undefined' || !window.location) return false;
        const search = window.location.search || '';
        return search.includes('dev=1') || search.includes('evaluate=1');
    }

    // 3. Print German & EU Legal Warning Banner in Console
    function printConsoleCopyrightBanner() {
        if (typeof console === 'undefined' || typeof console.log !== 'function') return;
        console.log(
            '%c🛡️ LUMIN FLOW: UTOPIA RUN — © 2026 LUMIN FLOW STUDIOS (EU / DE URHEBERRECHTSSCHUTZ)',
            'background:#030712;color:#22d3ee;font-size:14px;font-weight:bold;padding:8px 14px;border:1px solid #22d3ee;border-radius:6px;'
        );
        console.log(
            '%c⚖️ GESCHÜTZTES COMPUTERPROGRAMM & DATENBANKWERK (§§ 69a ff., 87a ff., 95a ff. UrhG · EU-Richtlinie 2009/24/EG)\n' +
            'Alle Rechte vorbehalten / All Rights Reserved. Jede unbefugte Vervielfältigung, Dekompilierung, Klonung, Verbreitung oder gewerbliche Verwertung (§§ 97, 106, 108a UrhG) wird zivil- und strafrechtlich verfolgt.\n' +
            'EU DSM Directive (EU) 2019/790 Art. 4(3): Text & Data Mining (TDM) and AI scraping are expressly prohibited (tdm-reservation: 1).\n' +
            'Cryptographic RMI Seal: ' + COPYRIGHT_SEAL.signatureHash,
            'color:#f87171;font-size:11px;line-height:1.5;font-family:monospace;'
        );
    }

    // 4. Tamper-Proof Watermark Watchdog (§ 95c UrhG Rights Management Information)
    function enforceWatermarkIntegrity() {
        if (typeof document === 'undefined' || !document.body) return;

        const ensureBadge = () => {
            let badge = document.getElementById('copyright-watermark');
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'copyright-watermark';
                document.body.appendChild(badge);
            }
            const expectedText = '© 2026 Lumin Flow Studios · Protected under EU & German Law (§§ 69a, 95a UrhG) · All Rights Reserved';
            if (badge.textContent !== expectedText) {
                badge.textContent = expectedText;
            }
            badge.style.cssText = [
                'position:fixed',
                'bottom:6px',
                'right:10px',
                'z-index:9999',
                'pointer-events:none',
                'user-select:none',
                'font-family:JetBrains Mono,Inter,monospace',
                'font-size:9.5px',
                'letter-spacing:0.05em',
                'color:rgba(148,163,184,0.68)',
                'text-shadow:0 1px 3px rgba(0,0,0,0.9)',
                'display:block',
                'visibility:visible',
                'opacity:1'
            ].join(';');
        };

        ensureBadge();

        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(() => {
                const badge = document.getElementById('copyright-watermark');
                if (!badge || badge.style.display === 'none' || badge.style.visibility === 'hidden' || parseFloat(badge.style.opacity) < 0.2) {
                    ensureBadge();
                }
            });
            observer.observe(document.body, { childList: true, subtree: false, attributes: true });
        }
    }

    // 5. Anti-Theft, Anti-Copy & Anti-Scraping Guards (§ 95a UrhG Effective Technological Measures)
    function installAntiTheftGuards() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        // Block image/canvas drag-saving & copy-stealing
        document.addEventListener('dragstart', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('copy', (e) => {
            if (isDevModeActive()) return;
            e.preventDefault();
            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', '© 2026 Lumin Flow Studios. Protected under German UrhG §§ 69a, 95a & EU Directive 2009/24/EC. Unauthorized copying prohibited.');
            }
        });

        // Prevent right-click context menu & source-saving shortcuts in production mode
        document.addEventListener('contextmenu', (e) => {
            if (isDevModeActive()) return;
            e.preventDefault();
        }, { passive: false });

        window.addEventListener('keydown', (e) => {
            if (isDevModeActive()) return;

            const key = (e.key || '').toUpperCase();
            const ctrlOrCmd = e.ctrlKey || e.metaKey;

            // Block Ctrl+U (View Source), Ctrl+S (Save Page), Ctrl+P (Print/Rip), Ctrl+C
            if (ctrlOrCmd && (key === 'U' || key === 'S' || key === 'P')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block F12 & Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C in non-dev mode
            if (e.key === 'F12' || (ctrlOrCmd && e.shiftKey && (key === 'I' || key === 'J' || key === 'C'))) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, true);
    }

    if (typeof window !== 'undefined') {
        enforceFrameBuster();
        printConsoleCopyrightBanner();
        installAntiTheftGuards();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', enforceWatermarkIntegrity);
        } else {
            enforceWatermarkIntegrity();
        }
    }
})();
