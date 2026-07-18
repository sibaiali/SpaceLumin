/**
 * UIController.js - HTML UI Management
 * Handles menus, HUD updates, notifications, and results
 */

class UIController {
    constructor(metaSystem) {
        this.meta = metaSystem;

        // Cache DOM elements
        this.cacheElements();

        // Toast container
        this.notificationContainer = document.getElementById('notification-container');

        // Story slides
        this.storySlides = [
            { title: "In the End, You Become the Signal", body: "One day, the archivists will say your ship vanished into a black hole. They will never know the truth: that you chose to become its heart.", subtitle: "A few hours before the last decision..." },
            { title: "The Ship: LUMINARIS", body: "You command the LUMINARIS, a fractured research vessel caught at the rim of a rotating singularity. Its core AI, LUMEN, runs the Hybrid Predictive Inertia Model — H-PIM — to forecast every mistake you might make before you make it.", subtitle: "Edge of Ares Rim · Time dilation field unstable" },
            { title: "The Inner Creature: Lyra", body: "Deep inside the ship's biosphere, a small bio-synthetic wanderer named Lyra wakes, eats, sketches constellations on the bulkheads, and builds tiny glowing homes between the cables. She is you, and not you — the part that still dreams of a life beyond this orbit.", subtitle: "A life growing inside a dying hull" },
            { title: "Day & Night in the Void", body: "By day, you sweep the debris field, harvesting resonance crystals and luminous fruits so Lyra can grow her hidden habitat. By night, the sky tears open: asteroids, space beasts and quantum wraiths pour in, drawn to the singularity and the noise of your fear.", subtitle: "Every sunset is a warning" },
            { title: "The Mission That Wasn't", body: "Officially, you were sent to observe the singularity. Unofficially, command fed your ship into the black hole's outer wake to see if an AI–human hybrid could stay sane in endless threat. They did not expect you to build a home here.", subtitle: "You were an experiment, not a rescue target" },
            { title: "The Ending You Already Saw", body: "H-PIM has already run the last timeline: there will be a moment when your only way to save Lyra's little world — and a future sky for somebody else — is to dive straight into the singularity and become the signal that guides lost ships home.", subtitle: "The game has already seen your final move" }
        ];
        this.storyIndex = 0;
    }

    cacheElements() {
        // Overlays
        this.overlays = {
            menu: document.getElementById('menu-overlay'),
            story: document.getElementById('story-overlay'),
            tutorial: document.getElementById('tutorial-overlay'),
            onboard: document.getElementById('onboard-overlay'),
            roadmap: document.getElementById('roadmap-overlay'),
            meta: document.getElementById('meta-overlay'),
            settings: document.getElementById('settings-overlay'),
            results: document.getElementById('results-overlay'),
            pause: document.getElementById('pause-overlay')
        };

        // HUD
        this.hud = {
            container: document.getElementById('game-hud'),
            flowBar: document.getElementById('flow-bar-fill'),
            scoreLabel: document.getElementById('score-label'),
            planetLabel: document.getElementById('planet-label'),
            objectiveLabel: document.getElementById('objective-label'),
            modeLabel: document.getElementById('mode-label'),
            habitatLabel: document.getElementById('habitat-label'),
            ringDecoy: document.getElementById('ring-decoy'),
            ringFreeze: document.getElementById('ring-freeze'),
            ringAura: document.getElementById('ring-aura')
        };

        // Results
        this.results = {
            title: document.getElementById('results-title'),
            subtitle: document.getElementById('results-subtitle'),
            crystals: document.getElementById('results-crystals'),
            best: document.getElementById('results-best'),
            planets: document.getElementById('results-planets'),
            shards: document.getElementById('results-shards'),
            style: document.getElementById('results-style')
        };

        // Story
        this.storyElements = {
            title: document.getElementById('story-title'),
            body: document.getElementById('story-body'),
            subtitle: document.getElementById('story-subtitle')
        };

        // Menu stats
        this.menuStats = {
            highscore: document.getElementById('highscore-line'),
            meta: document.getElementById('meta-line'),
            shards: document.getElementById('meta-shards'),
            upgradesList: document.getElementById('meta-upgrades-list'),
            achievementsList: document.getElementById('meta-achievements-list'),
            roadmapList: document.getElementById('roadmap-list'),
            roadmapMeta: document.getElementById('roadmap-meta-line')
        };

        // Settings toggles
        this.toggles = {
            music: document.getElementById('toggle-music'),
            sfx: document.getElementById('toggle-sfx'),
            haptics: document.getElementById('toggle-haptics'),
            performance: document.getElementById('toggle-performance'),
            shake: document.getElementById('toggle-shake')
        };
    }

    // Overlay management
    showOverlay(key) {
        const el = this.overlays[key];
        if (el) {
            el.classList.remove('overlay-hidden');
            el.classList.add('overlay-visible');
        }
    }

    hideOverlay(key) {
        const el = this.overlays[key];
        if (el) {
            el.classList.remove('overlay-visible');
            el.classList.add('overlay-hidden');
        }
    }

    hideAllOverlays() {
        Object.keys(this.overlays).forEach(key => this.hideOverlay(key));
    }

    // HUD
    showHUD() {
        if (this.hud.container) {
            this.hud.container.style.display = 'block';
        }
    }

    hideHUD() {
        if (this.hud.container) {
            this.hud.container.style.display = 'none';
        }
    }

    updateHUD(data) {
        const { flow, flowMax, crystals, sector, planetName, nodesRemaining, isBoss, isNight, habitatTier } = data;

        // Flow bar
        if (this.hud.flowBar) {
            const percent = Math.max(0, Math.min(100, (flow / flowMax) * 100));
            this.hud.flowBar.style.width = `${percent}%`;
        }

        // Score
        if (this.hud.scoreLabel) {
            this.hud.scoreLabel.textContent = `💎 ${crystals}`;
        }

        // Planet
        if (this.hud.planetLabel) {
            this.hud.planetLabel.textContent = `${planetName} · Sector ${sector}`;
        }

        // Objective
        if (this.hud.objectiveLabel) {
            const bossText = isBoss ? ' · ⚠ Boss' : '';
            const timeText = isNight ? ' · Nightfall' : '';
            const remaining = nodesRemaining || 0;
            this.hud.objectiveLabel.textContent = `Objective: Purify Gate (${1 - remaining}/1)${timeText}${bossText}`;
        }

        // Habitat
        if (this.hud.habitatLabel) {
            const tierNames = ['Seedling', 'Outpost', 'Colony', 'Sanctuary', 'Myth'];
            const name = tierNames[Math.min(habitatTier || 0, tierNames.length - 1)];
            this.hud.habitatLabel.textContent = `Habitat: Tier ${habitatTier || 0} · ${name} (Lyra)`;
        }
    }

    updateCooldowns(data) {
        const { decoyProgress, freezeProgress, auraProgress } = data;
        const glowColor = 'rgba(34,211,238,0.8)';

        if (this.hud.ringDecoy) {
            const deg = decoyProgress * 360;
            this.hud.ringDecoy.style.background = decoyProgress < 1
                ? `conic-gradient(${glowColor} ${deg}deg, transparent ${deg}deg)`
                : 'transparent';
        }

        if (this.hud.ringFreeze) {
            const deg = freezeProgress * 360;
            this.hud.ringFreeze.style.background = freezeProgress < 1
                ? `conic-gradient(${glowColor} ${deg}deg, transparent ${deg}deg)`
                : 'transparent';
        }

        if (this.hud.ringAura) {
            const deg = auraProgress * 360;
            this.hud.ringAura.style.background = auraProgress < 1
                ? `conic-gradient(${glowColor} ${deg}deg, transparent ${deg}deg)`
                : 'transparent';
        }
    }

    // Toasts
    showToast(text, duration = 2000, color = '#e5e7eb') {
        if (!this.notificationContainer) return;

        const div = document.createElement('div');
        div.className = 'notification-toast';
        div.style.animationDuration = '0.2s, 0.25s';
        div.style.animationDelay = `0s, ${duration / 1000}s`;
        div.style.color = color;
        div.textContent = text;

        this.notificationContainer.appendChild(div);

        setTimeout(() => {
            if (div.parentElement) {
                this.notificationContainer.removeChild(div);
            }
        }, duration + 400);
    }

    // Story
    showStorySlide(index) {
        const slide = this.storySlides[index];
        if (!slide) return;

        if (this.storyElements.title) this.storyElements.title.textContent = slide.title;
        if (this.storyElements.body) this.storyElements.body.textContent = slide.body;
        if (this.storyElements.subtitle) this.storyElements.subtitle.textContent = slide.subtitle;
    }

    nextStorySlide() {
        this.storyIndex++;
        if (this.storyIndex >= this.storySlides.length) {
            return false; // Story complete
        }
        this.showStorySlide(this.storyIndex);
        return true;
    }

    resetStory() {
        this.storyIndex = 0;
        this.showStorySlide(0);
    }

    // Results screen
    showResults(data) {
        const { crystals, bestCrystals, sector, gatesPurified, shardGain, style, win } = data;

        if (this.results.title) {
            this.results.title.textContent = win ? 'SECTOR AWAKENED' : 'ARCHIVE LOST';
            this.results.title.style.color = win ? '#22c55e' : '#f97316';
        }

        if (this.results.subtitle) {
            this.results.subtitle.textContent = win ? 'Resonance stabilized.' : 'Resonance collapsed.';
        }

        if (this.results.crystals) {
            this.results.crystals.textContent = `Crystals: ${crystals} 💎`;
        }

        if (this.results.best) {
            this.results.best.textContent = `Best Archive: ${bestCrystals} 💎`;
        }

        if (this.results.planets) {
            const planetName = this.meta.getPlanetName(sector);
            this.results.planets.textContent = `Best Sector: ${sector} (${planetName}) · Gates purified: ${gatesPurified}`;
        }

        if (this.results.shards) {
            this.results.shards.textContent = `Archive Shards gained: ${shardGain} ✶`;
        }

        if (this.results.style) {
            this.results.style.textContent = `Style: ${style}`;
        }

        this.showOverlay('results');
    }

    // Menu updates
    updateMenuStats() {
        const highScore = this.meta.getHighScore();
        const shards = this.meta.getArchiveShards();
        const dailyMod = this.meta.getDailyMod();

        if (this.menuStats.highscore) {
            this.menuStats.highscore.textContent = `High-Archive: ${highScore} 💎`;
        }

        if (this.menuStats.meta) {
            this.menuStats.meta.textContent = `Archive Shards: ${shards} ✶ · Daily Mod: ${dailyMod.label}`;
        }

        if (this.menuStats.shards) {
            this.menuStats.shards.textContent = `${shards} ✶`;
        }
    }

    // Meta/upgrades UI
    refreshMetaUI(onPurchase) {
        const shards = this.meta.getArchiveShards();
        const maxSector = this.meta.getMaxSector();
        const unlocked = new Set(this.meta.getUnlockedUpgrades());

        if (this.menuStats.shards) {
            this.menuStats.shards.textContent = `${shards} ✶`;
        }

        // Upgrades list
        if (this.menuStats.upgradesList) {
            this.menuStats.upgradesList.innerHTML = '';

            Object.values(META_UPGRADES).forEach(up => {
                const row = document.createElement('div');
                row.className = 'meta-row';

                const left = document.createElement('div');
                left.innerHTML = `
                    <div class="font-semibold text-xs" style="color: #f0e6d2;">${up.desc}</div>
                    <div class="text-xs" style="color: #a09b8c; font-size: 0.7rem;">Cost: ${up.cost} ✶${up.requiredSector ? ` · Req Sector ${up.requiredSector}` : ''}</div>
                `;

                const btn = document.createElement('button');
                btn.className = 'meta-btn';
                btn.textContent = unlocked.has(up.key) ? 'Unlocked' : 'Buy';

                const lockedBySector = up.requiredSector && maxSector < up.requiredSector;
                if (unlocked.has(up.key) || shards < up.cost || lockedBySector) {
                    btn.disabled = true;
                }

                btn.addEventListener('click', () => {
                    if (this.meta.purchaseUpgrade(up.key)) {
                        this.showToast(`Upgrade unlocked: ${up.desc}`, 2000, '#22c55e');
                        this.showToast('Progress Saved', 1500, '#94a3b8');
                        this.updateMenuStats();
                        this.refreshMetaUI(onPurchase);
                        if (onPurchase) onPurchase(up.key);
                    }
                });

                row.appendChild(left);
                row.appendChild(btn);
                this.menuStats.upgradesList.appendChild(row);
            });
        }

        // Achievements list
        if (this.menuStats.achievementsList) {
            this.menuStats.achievementsList.innerHTML = '';
            const achState = this.meta.getAchievementsState();

            Object.values(ACHIEVEMENTS).forEach(a => {
                const div = document.createElement('div');
                const isUnlocked = !!achState[a.id];
                div.innerHTML = `
                    <span class="${isUnlocked ? 'ach-unlocked' : 'ach-locked'}">● ${a.label}</span>
                    <span style="color: #64748b; margin-left: 0.25rem;">– ${a.desc}</span>
                `;
                this.menuStats.achievementsList.appendChild(div);
            });
        }
    }

    // Roadmap UI
    updateRoadmapUI() {
        if (!this.menuStats.roadmapList) return;

        const maxSector = this.meta.getMaxSector();
        const shards = this.meta.getArchiveShards();

        this.menuStats.roadmapList.innerHTML = '';

        JOURNEY_STAGES.forEach(stage => {
            const unlocked = maxSector >= stage.unlockAt;
            const stepsLeft = Math.max(0, stage.unlockAt - maxSector);

            let statusText, statusColor;
            if (unlocked) {
                statusText = 'Unlocked · Reach deeper sectors to meet the boss';
                statusColor = 'text-amber-300';
            } else {
                const planetName = this.meta.getPlanetName(stage.unlockAt);
                statusText = `Locked · Reach Sector ${stage.unlockAt} (${planetName}, ${stepsLeft} sector${stepsLeft === 1 ? '' : 's'} left)`;
                statusColor = 'text-slate-300';
            }

            const lockIcon = unlocked ? '🟢' : '🔒';

            const div = document.createElement('div');
            div.className = 'rounded-2xl border px-3 py-2 text-xs flex gap-3 items-center';
            div.style.borderColor = 'rgba(51, 65, 85, 0.7)';
            div.style.background = 'rgba(6, 28, 37, 0.5)';

            div.innerHTML = `
                <div class="flex flex-col flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <div class="font-semibold uppercase" style="font-size: 0.68rem; letter-spacing: 0.12em; color: #f1f5f9;">
                            ${lockIcon} ${stage.title}
                        </div>
                        <div style="font-size: 0.65rem; color: #cbd5e1;">
                            ${stage.range}
                        </div>
                    </div>
                    <div style="font-size: 0.7rem; color: #e2e8f0;">
                        Boss: <span class="font-medium">${stage.boss}</span>
                    </div>
                    <div class="mt-1 ${statusColor}" style="font-size: 0.7rem;">
                        ${statusText}
                    </div>
                </div>
            `;

            this.menuStats.roadmapList.appendChild(div);
        });

        if (this.menuStats.roadmapMeta) {
            const bestPlanet = this.meta.getPlanetName(maxSector);
            this.menuStats.roadmapMeta.textContent = `Best sector reached: ${maxSector} (${bestPlanet}) · Archive Shards: ${shards} ✶`;
        }
    }

    // Settings
    getSettings() {
        return {
            musicOn: this.toggles.music?.checked ?? true,
            sfxOn: this.toggles.sfx?.checked ?? true,
            hapticsOn: this.toggles.haptics?.checked ?? true,
            performanceMode: this.toggles.performance?.checked ?? false,
            screenShake: this.toggles.shake?.checked ?? true
        };
    }

    setupSettingsListeners(callbacks) {
        if (this.toggles.music) {
            this.toggles.music.addEventListener('change', () => {
                if (callbacks.onMusicChange) callbacks.onMusicChange(this.toggles.music.checked);
            });
        }

        if (this.toggles.sfx) {
            this.toggles.sfx.addEventListener('change', () => {
                if (callbacks.onSfxChange) callbacks.onSfxChange(this.toggles.sfx.checked);
            });
        }

        if (this.toggles.haptics) {
            this.toggles.haptics.addEventListener('change', () => {
                if (callbacks.onHapticsChange) callbacks.onHapticsChange(this.toggles.haptics.checked);
            });
        }

        if (this.toggles.performance) {
            this.toggles.performance.addEventListener('change', () => {
                if (callbacks.onPerformanceChange) callbacks.onPerformanceChange(this.toggles.performance.checked);
            });
        }

        if (this.toggles.shake) {
            this.toggles.shake.addEventListener('change', () => {
                if (callbacks.onShakeChange) callbacks.onShakeChange(this.toggles.shake.checked);
            });
        }
    }

    // ========================================
    // SHIP SELECTION (Hangar Flow)
    // ========================================

    // Selected ship state
    selectedShip = null;

    /**
     * Select a ship from the hangar
     * @param {string} shipId - Ship ID from HullDatabase (e.g., 'PHOTON_SCOUT')
     * @param {AudioSystem} audio - Audio system for playing sounds
     */
    selectShip(shipId, audio = null) {
        this.selectedShip = shipId;

        // Remove 'selected' class from all ship cards
        const allCards = document.querySelectorAll('.ship-card');
        allCards.forEach(card => card.classList.remove('selected'));

        // Add 'selected' class to clicked card
        const selectedCard = document.querySelector(`.ship-card[data-ship-id="${shipId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        // Show launch button
        const launchBtn = document.getElementById('launch-button');
        if (launchBtn) {
            launchBtn.classList.add('visible');
            launchBtn.style.display = 'block';
        }

        // Play selection sound (brown noise blip)
        if (audio && audio.playSound) {
            audio.playSound('collect'); // Use collect as Selection_Confirm
        }

        return this.selectedShip;
    }

    /**
     * Get the currently selected ship
     */
    getSelectedShip() {
        return this.selectedShip;
    }

    /**
     * Setup launch button with game init callback
     * @param {Function} onLaunch - Callback receiving selectedShip ID
     */
    setupLaunchButton(onLaunch) {
        const launchBtn = document.getElementById('launch-button');
        if (!launchBtn) return;

        // Use pointerdown for faster mobile response
        launchBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!this.selectedShip) {
                this.showToast('Select a ship first!', 1500, '#f97316');
                return;
            }

            // Hide PilotReg/modal
            const pilotReg = document.getElementById('PilotReg');
            if (pilotReg) {
                pilotReg.classList.add('hidden');
                pilotReg.style.display = 'none';
                pilotReg.style.visibility = 'hidden';
            }

            // Set UI layer to pointer-events: none for game
            const uiLayer = document.getElementById('ui-layer');
            if (uiLayer) {
                uiLayer.style.pointerEvents = 'none';
            }

            // Hide any hangar modal
            this.hideAllOverlays();

            // Call the game init with selected ship
            if (onLaunch) {
                onLaunch(this.selectedShip);
            }
        });
    }

    /**
     * Reset ship selection state
     */
    resetShipSelection() {
        this.selectedShip = null;

        // Remove selection from all cards
        const allCards = document.querySelectorAll('.ship-card');
        allCards.forEach(card => card.classList.remove('selected'));

        // Hide launch button
        const launchBtn = document.getElementById('launch-button');
        if (launchBtn) {
            launchBtn.classList.remove('visible');
            launchBtn.style.display = 'none';
        }
    }
}
