/*!
 * Copyright (c) 2026 Lumin Flow Studios. All Rights Reserved.
 * LUMIN FLOW: UTOPIA RUN (SPACELUMIN) — PROPRIETARY & CONFIDENTIAL
 * Protected under German Urheberrechtsgesetz (UrhG §§ 44b, 69a-69g, 87a-87e, 95a-95d, 97, 106, 108a),
 * German Digitale-Dienste-Gesetz (§ 5 DDG), GDPR / DSGVO (Art. 13, 17, 21, 25),
 * EU Software Directive 2009/24/EC, EU InfoSoc Directive 2001/29/EC, and EU DSM Directive (EU) 2019/790 Art. 4.
 * Unauthorized cloning, reproduction, reverse-engineering, scraping, or commercial sale is strictly prohibited.
 */
/**
 * CopyrightGuard.js - European Union & German Law (UrhG / DDG / DSGVO) IP Protection,
 * Anti-Cloning Shield, Frame-Busting, TDM Opt-Out Enforcement, Tamper-Proof Watermark,
 * and Interactive 1-Click Impressum / DSGVO / UrhG Legal Compliance Modal.
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
            'German UrhG §§ 87a–87e (Schutz von Datenbankwerken & 20-Planeten-Atlas)',
            'German UrhG §§ 95a–95d (Schutz technischer Maßnahmen & Rechtewahrnehmungsinformationen)',
            'German UrhG § 44b Abs. 3 & EU DSM Directive (EU) 2019/790 Art. 4(3) (W3C TDM & AI-Scraping Vorbehalt / Opt-Out)',
            'German UrhG §§ 97, 106, 108a (Unterlassung, Schadensersatz & Strafbarkeit gewerblicher unerlaubter Verwertung)',
            'German Digitale-Dienste-Gesetz (§ 5 DDG) & Medienstaatsvertrag (§ 18 MStV) Anbieterkennzeichnung',
            'EU Directive 2009/24/EC on the Legal Protection of Computer Programs',
            'EU General Data Protection Regulation (GDPR / DSGVO) Art. 13, 17, 21, 25 Privacy-by-Design'
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
        tdmReservation: 1, // Machine-readable EU DSM Directive Art. 4 & § 44b Abs. 3 UrhG Opt-Out
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
            if (typeof document !== 'undefined' && document.body) {
                document.body.innerHTML = '<div style="padding:40px;color:#ef4444;background:#030712;font-family:monospace;text-align:center;">' +
                    '<h1>⚠️ UNAUTHORIZED EMBED / CLONE BLOCKED (§ 95a UrhG / EU Directive 2009/24/EC)</h1>' +
                    '<p>© 2026 Lumin Flow Studios. All Rights Reserved. Unauthorized framing or redistribution is prohibited under German and European law.</p></div>';
            }
        }
    }

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
            'EU DSM Directive (EU) 2019/790 Art. 4(3) & § 44b Abs. 3 UrhG: Text & Data Mining (TDM) and AI scraping are expressly prohibited (tdm-reservation: 1).\n' +
            'Cryptographic RMI Seal: ' + COPYRIGHT_SEAL.signatureHash,
            'color:#f87171;font-size:11px;line-height:1.5;font-family:monospace;'
        );
    }

    // 4. Create Interactive German & EU Legal Compliance Center Modal (§ 5 DDG / DSGVO / UrhG)
    function ensureLegalModal() {
        if (typeof document === 'undefined' || !document.body) return null;
        let modal = document.getElementById('eu-legal-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'eu-legal-modal';
        modal.style.cssText = [
            'display:none',
            'position:fixed',
            'inset:0',
            'z-index:10050',
            'background:rgba(2, 6, 23, 0.88)',
            'backdrop-filter:blur(12px)',
            'align-items:center',
            'justify-content:center',
            'padding:16px',
            'font-family:Inter,system-ui,sans-serif',
            'color:#e2e8f0'
        ].join(';');

        modal.innerHTML = `
            <div style="max-width:680px;width:100%;max-height:88vh;display:flex;flex-direction:column;background:rgba(9,13,28,0.97);border:1px solid rgba(34,211,238,0.45);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.9),0 0 30px rgba(34,211,238,0.15);overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(34,211,238,0.2);background:rgba(15,23,42,0.9);">
                    <div>
                        <div style="font-family:Orbitron,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#22d3ee;">
                            ⚖️ EU & DE RECHTSSCHUTZ · IMPRESSUM · DSGVO
                        </div>
                        <div style="font-family:JetBrains Mono,monospace;font-size:10px;color:#94a3b8;margin-top:2px;">
                            RMI SEAL: ${COPYRIGHT_SEAL.signatureHash}
                        </div>
                    </div>
                    <button id="eu-legal-close" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.45);color:#fca5a5;border-radius:8px;padding:5px 12px;font-family:JetBrains Mono,monospace;font-size:11px;cursor:pointer;">
                        ✕ ESC
                    </button>
                </div>

                <div style="display:flex;gap:6px;padding:10px 18px;background:rgba(2,6,23,0.65);border-bottom:1px solid rgba(148,163,184,0.15);">
                    <button class="eu-tab-btn" data-tab="urhg" style="flex:1;padding:7px 10px;border-radius:7px;border:1px solid rgba(34,211,238,0.5);background:rgba(34,211,238,0.16);color:#67e8f9;font-family:Orbitron,sans-serif;font-size:10.5px;font-weight:700;cursor:pointer;">
                        🛡️ Urheberrecht (UrhG)
                    </button>
                    <button class="eu-tab-btn" data-tab="impressum" style="flex:1;padding:7px 10px;border-radius:7px;border:1px solid rgba(148,163,184,0.25);background:rgba(15,23,42,0.6);color:#cbd5e1;font-family:Orbitron,sans-serif;font-size:10.5px;font-weight:700;cursor:pointer;">
                        🏛️ Impressum (§ 5 DDG)
                    </button>
                    <button class="eu-tab-btn" data-tab="dsgvo" style="flex:1;padding:7px 10px;border-radius:7px;border:1px solid rgba(148,163,184,0.25);background:rgba(15,23,42,0.6);color:#cbd5e1;font-family:Orbitron,sans-serif;font-size:10.5px;font-weight:700;cursor:pointer;">
                        🔒 Datenschutz (DSGVO)
                    </button>
                </div>

                <div style="padding:16px 18px;overflow-y:auto;font-size:12px;line-height:1.6;space-y:10px;flex:1;">
                    <!-- TAB 1: URHEBERRECHT & ANTI-CLONING -->
                    <div id="eu-tab-urhg" class="eu-tab-pane">
                        <div style="padding:10px 12px;border-radius:8px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.28);margin-bottom:12px;">
                            <strong style="color:#67e8f9;">© 2026 Lumin Flow Studios. Alle Rechte vorbehalten / All Rights Reserved.</strong><br/>
                            Dieses Werk (Quellcode, 3D-Shader, 20-Planeten-Atlas, Audio-Synthese und mathematische Algorithmen) ist nach deutschem und europäischem Recht gesetzlich geschützt.
                        </div>
                        <p style="margin:0 0 8px 0;"><strong style="color:#a78bfa;">1. Schutz von Computerprogrammen & Datenbankwerken (§§ 69a–69g, 87a–87e UrhG · Richtlinie 2009/24/EG):</strong><br/>
                        Jede unbefugte Vervielfältigung, Klonung, Spiegelung, Dekompilierung, Disassemblierung, Bearbeitung oder gewerbliche Weiterveräußerung (auch in abgewandelter Form) ist ohne ausdrückliche schriftliche Lizenz von <em>Lumin Flow Studios</em> strengstens untersagt und wird gemäß <strong>§§ 97, 106, 108a UrhG</strong> zivil- und strafrechtlich verfolgt.</p>

                        <p style="margin:0 0 8px 0;"><strong style="color:#a78bfa;">2. Schutz technischer Schutzmaßnahmen (§§ 95a, 95c UrhG):</strong><br/>
                        Das Umgehen der integrierten Anti-Cloning-Sperren, Frame-Buster oder das Entfernen kryptografischer Rechtewahrnehmungsinformationen (RMI) stellt einen Rechtsverstoß nach §§ 95a, 95c UrhG dar.</p>

                        <p style="margin:0 0 8px 0;"><strong style="color:#a78bfa;">3. Widerspruch gegen KI-Scraping & Text/Data Mining (§ 44b Abs. 3 UrhG · Art. 4 Abs. 3 Richtlinie (EU) 2019/790):</strong><br/>
                        Lumin Flow Studios erklärt hiermit ausdrücklich den maschinenlesbaren Nutzungsvorbehalt (<code>tdm-reservation: 1</code> in HTML-Meta, HTTP-Headern und <code>/.well-known/tdmrep.json</code>). Jegliches automatisierte Auslesen für KI-Training oder Dataset-Scraping ist verboten.</p>

                        <div style="padding:8px 10px;border-radius:6px;background:rgba(15,23,42,0.9);border:1px solid rgba(148,163,184,0.2);font-family:JetBrains Mono,monospace;font-size:10.5px;color:#94a3b8;">
                            Geschützte Kernmodule: PredictiveAI (36-State Markov) · NystromKernel (m=60) · KernelMapper (RBF-KLR) · NeuroFlow (Kalman AR(2)) · PlanetAtlas (20 Worlds) · EnemyDNA
                        </div>
                    </div>

                    <!-- TAB 2: IMPRESSUM (§ 5 DDG) -->
                    <div id="eu-tab-impressum" class="eu-tab-pane" style="display:none;">
                        <h3 style="margin:0 0 8px 0;font-family:Orbitron,sans-serif;font-size:12.5px;color:#67e8f9;">
                            Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG) & § 18 Abs. 2 MStV
                        </h3>
                        <p style="margin:0 0 10px 0;">
                            <strong>Herausgeber, Rechteinhaber & Verantwortlicher:</strong><br/>
                            Lumin Flow Studios — Interactive Cyber-Creative & AI Systems<br/>
                            Urheber & Projektleitung: Ali Sibai (Lumin Flow Studios)<br/>
                            Rechtsraum / Jurisdiction: Bundesrepublik Deutschland (DE) & Europäische Union (EU)<br/>
                            Offizielles Repository & Kontakt: <a href="https://github.com/sibaiali/SpaceLumin" target="_blank" rel="noopener noreferrer" style="color:#22d3ee;text-decoration:underline;">github.com/sibaiali/SpaceLumin</a>
                        </p>
                        <p style="margin:0 0 10px 0;">
                            <strong style="color:#a78bfa;">EU-Streitschlichtung & Verbraucherstreitbeilegung (§ 36 VSBG):</strong><br/>
                            Dieses interaktive Web-Kunst- und Forschungsprojekt wird kostenfrei zu Demonstrations- und Kreativzwecken bereitgestellt. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
                        </p>
                        <p style="margin:0;">
                            <strong style="color:#a78bfa;">Haftung für Inhalte & Urheberrecht:</strong><br/>
                            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Alle Inhalte, Grafiken, 3D-Modelle, Klänge und Quellcodes unterliegen dem deutschen Urheberrecht (UrhG).
                        </p>
                    </div>

                    <!-- TAB 3: DATENSCHUTZ (DSGVO / GDPR) -->
                    <div id="eu-tab-dsgvo" class="eu-tab-pane" style="display:none;">
                        <h3 style="margin:0 0 8px 0;font-family:Orbitron,sans-serif;font-size:12.5px;color:#34d399;">
                            Datenschutzerklärung gemäß Art. 13, 14, 25 DSGVO (Privacy-by-Design)
                        </h3>
                        <p style="margin:0 0 8px 0;">
                            <strong>1. Keine Erhebung personenbezogener Daten (Zero-PII Architecture):</strong><br/>
                            <em>Lumin Flow: Utopia Run</em> speichert <strong>keine Namen, keine E-Mail-Adressen, keine IP-Adressen, keine Werbe-Cookies und keine Geräte-Fingerprints</strong>.
                        </p>
                        <p style="margin:0 0 10px 0;">
                            <strong>2. Pseudonyme Kinästhetische Spielmechanik (Art. 25 DSGVO):</strong><br/>
                            Zur Berechnung der dynamischen Gravitations- und Musik-Harmonie wertet die Anwendung während des Spiels rein mathematische Bewegungsvektoren <code>(x, y, vx, vy)</code> lokal im Browser (<code>localStorage</code>) aus.
                        </p>

                        <div style="padding:12px;border-radius:8px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);margin-top:10px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
                                <div>
                                    <strong style="color:#6ee7b7;font-size:11.5px;">Art. 21 DSGVO — Hintergrund-Telemetrie-Screening</strong>
                                    <div style="font-size:10.5px;color:#94a3b8;">Sie können die lokale kinästhetische Sitzungsanalyse jederzeit deaktivieren (Opt-Out).</div>
                                </div>
                                <input id="eu-dsgvo-toggle" type="checkbox" checked style="width:18px;height:18px;accent-color:#10b981;cursor:pointer;" />
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.15);">
                                <div style="font-size:10.5px;color:#cbd5e1;">
                                    <strong>Art. 17 DSGVO — Recht auf Löschung:</strong> Alle lokal gespeicherten Spiel- & Sitzungsdaten sofort löschen.
                                </div>
                                <button id="eu-dsgvo-erase-btn" style="background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.5);color:#fca5a5;padding:5px 10px;border-radius:6px;font-family:JetBrains Mono,monospace;font-size:10.5px;cursor:pointer;white-space:nowrap;">
                                    🗑️ Daten löschen
                                </button>
                            </div>
                            <div id="eu-dsgvo-status" style="font-family:JetBrains Mono,monospace;font-size:10px;color:#34d399;margin-top:6px;display:none;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Wire Close button & backdrop click
        const closeBtn = modal.querySelector('#eu-legal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        // Wire Tabs
        const tabBtns = modal.querySelectorAll('.eu-tab-btn');
        const panes = {
            urhg: modal.querySelector('#eu-tab-urhg'),
            impressum: modal.querySelector('#eu-tab-impressum'),
            dsgvo: modal.querySelector('#eu-tab-dsgvo')
        };
        tabBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                tabBtns.forEach((b) => {
                    const active = b.getAttribute('data-tab') === target;
                    b.style.borderColor = active ? 'rgba(34,211,238,0.5)' : 'rgba(148,163,184,0.25)';
                    b.style.background = active ? 'rgba(34,211,238,0.16)' : 'rgba(15,23,42,0.6)';
                    b.style.color = active ? '#67e8f9' : '#cbd5e1';
                });
                Object.keys(panes).forEach((k) => {
                    if (panes[k]) panes[k].style.display = k === target ? 'block' : 'none';
                });
            });
        });

        // Wire DSGVO Toggle & Erase Button
        const dsgvoToggle = modal.querySelector('#eu-dsgvo-toggle');
        const eraseBtn = modal.querySelector('#eu-dsgvo-erase-btn');
        const statusEl = modal.querySelector('#eu-dsgvo-status');

        if (dsgvoToggle) {
            const optedOut = typeof dataScreeningService !== 'undefined' && dataScreeningService.isDsgvoOptedOut();
            dsgvoToggle.checked = !optedOut;
            dsgvoToggle.addEventListener('change', () => {
                const optOut = !dsgvoToggle.checked;
                if (typeof dataScreeningService !== 'undefined') {
                    dataScreeningService.setDsgvoOptOut(optOut);
                }
                if (statusEl) {
                    statusEl.style.display = 'block';
                    statusEl.textContent = optOut
                        ? '✓ Art. 21 DSGVO Widerspruch gespeichert: Hintergrund-Screening deaktiviert.'
                        : '✓ Hintergrund-Screening aktiviert (Privacy-by-Design Art. 25 DSGVO).';
                }
            });
        }

        if (eraseBtn) {
            eraseBtn.addEventListener('click', () => {
                if (typeof dataScreeningService !== 'undefined') {
                    dataScreeningService.eraseAllSessionData();
                }
                try {
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && k.startsWith('spacelumin_')) keysToRemove.push(k);
                    }
                    keysToRemove.forEach((k) => localStorage.removeItem(k));
                } catch (_) {}
                if (statusEl) {
                    statusEl.style.display = 'block';
                    statusEl.textContent = '✓ Art. 17 DSGVO ausgeführt: Alle lokalen Sitzungsdaten wurden vollständig gelöscht.';
                }
            });
        }

        return modal;
    }

    function openEuLegalModal(defaultTab) {
        const modal = ensureLegalModal();
        if (!modal) return;
        modal.style.display = 'flex';
        if (defaultTab) {
            const btn = modal.querySelector(`.eu-tab-btn[data-tab="${defaultTab}"]`);
            if (btn) btn.click();
        }
    }

    if (typeof window !== 'undefined') {
        window.openEuLegalModal = openEuLegalModal;
    }

    // 5. Tamper-Proof Watermark & 1-Click Legal Pill Watchdog (§ 95c UrhG & § 5 DDG)
    function enforceWatermarkIntegrity() {
        if (typeof document === 'undefined' || !document.body) return;

        ensureLegalModal();

        const ensureBadge = () => {
            let badge = document.getElementById('copyright-watermark');
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'copyright-watermark';
                document.body.appendChild(badge);
            }
            const expectedText = '⚖️ © 2026 Lumin Flow Studios · DE/EU UrhG §§ 69a, 95a · Impressum & DSGVO';
            if (badge.textContent !== expectedText) {
                badge.textContent = expectedText;
            }
            badge.title = 'Click to view EU/German Copyright (UrhG), Impressum (§ 5 DDG) & Privacy (DSGVO)';
            badge.style.cssText = [
                'position:fixed',
                'bottom:6px',
                'right:10px',
                'z-index:9999',
                'pointer-events:auto',
                'cursor:pointer',
                'user-select:none',
                'font-family:JetBrains Mono,Inter,monospace',
                'font-size:9.5px',
                'letter-spacing:0.04em',
                'color:rgba(165,243,252,0.82)',
                'background:rgba(3,7,18,0.75)',
                'border:1px solid rgba(34,211,238,0.28)',
                'border-radius:6px',
                'padding:3px 8px',
                'text-shadow:0 1px 3px rgba(0,0,0,0.9)',
                'display:block',
                'visibility:visible',
                'opacity:1'
            ].join(';');

            if (!badge.dataset.boundLegalClick) {
                badge.dataset.boundLegalClick = '1';
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEuLegalModal('urhg');
                });
            }
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

    // 6. Anti-Theft, Anti-Copy & Anti-Scraping Guards (§ 95a UrhG Effective Technological Measures)
    function installAntiTheftGuards() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        document.addEventListener('dragstart', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('copy', (e) => {
            if (isDevModeActive()) return;
            e.preventDefault();
            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', '© 2026 Lumin Flow Studios. Protected under German UrhG §§ 69a, 95a & EU Directive 2009/24/EC. Unauthorized copying prohibited.');
            }
        });

        document.addEventListener('contextmenu', (e) => {
            if (isDevModeActive()) return;
            e.preventDefault();
        }, { passive: false });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('eu-legal-modal');
                if (modal && modal.style.display !== 'none') {
                    modal.style.display = 'none';
                }
            }

            if (isDevModeActive()) return;

            const key = (e.key || '').toUpperCase();
            const ctrlOrCmd = e.ctrlKey || e.metaKey;

            // Block Ctrl+U (View Source), Ctrl+S (Save Page), Ctrl+P (Print/Rip)
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
