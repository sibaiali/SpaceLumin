/*!
 * Copyright (c) 2026 Lumin Flow Studios. All Rights Reserved.
 * LUMIN FLOW: UTOPIA RUN (SPACELUMIN) — PROPRIETARY & CONFIDENTIAL
 * Protected Intellectual Property: PredictiveAI, NystromKernel, NeuroFlow, KernelMapper, Director.
 * Unauthorized copying, reverse-engineering, scraping, or redistribution is strictly prohibited.
 */
/**
 * MonetizationSystem.js - Hybrid Ad Rewards & In-App Economy Controller
 * 
 * Bridges CrazyGames SDK, Poki SDK, Google AdMob, and local fallbacks:
 * 1. Emergency Warp (Rewarded Revive on Death)
 * 2. Quantum Multiplier (2x Post-Run Crystals)
 * 3. Daily Supply Crate Drops
 * 4. Starter Pack & Cosmetic Shop Hooks
 */

class MonetizationSystem {
    constructor(uiController, metaSystem, audioSystem) {
        this.ui = uiController;
        this.meta = metaSystem;
        this.audio = audioSystem;
        
        this.hasRevivedThisRun = false;
        this.sdkType = this.detectSDK();
        
        console.log('[MonetizationSystem] Initialized with SDK provider: ' + this.sdkType);
    }
    
    detectSDK() {
        if (typeof window.CrazyGames !== 'undefined') return 'crazygames';
        if (typeof window.PokiSDK !== 'undefined') return 'poki';
        return 'simulation_fallback';
    }
    
    /**
     * Request a rewarded video ad for a specific in-game perk
     * @param {'revive' | 'doubleCrystals' | 'dailyCrate'} rewardType 
     * @param {Function} onRewardGranted 
     */
    showRewardedAd(rewardType, onRewardGranted) {
        console.log('[Monetization] Requesting Rewarded Ad for: ' + rewardType);
        
        // CrazyGames SDK
        if (this.sdkType === 'crazygames' && window.CrazyGames?.SDK?.ad) {
            window.CrazyGames.SDK.ad.requestAd('rewarded', {
                adStarted: () => {
                    if (this.audio && this.audio.mute) this.audio.mute();
                },
                adFinished: () => {
                    if (this.audio && this.audio.unmute) this.audio.unmute();
                    onRewardGranted?.();
                },
                adError: (error) => {
                    console.warn('[Monetization] Ad Error:', error);
                    // Grant reward anyway on error to prevent frustrating players
                    onRewardGranted?.();
                }
            });
            return;
        }
        
        // Poki SDK
        if (this.sdkType === 'poki' && window.PokiSDK) {
            window.PokiSDK.rewardedBreak().then((success) => {
                if (success) onRewardGranted?.();
            });
            return;
        }
        
        // Simulation Fallback: Show a clean high-tech reward confirmation modal
        this.showSimulationAdModal(rewardType, onRewardGranted);
    }
    
    showSimulationAdModal(rewardType, onRewardGranted) {
        const descriptions = {
            revive: '📺 Emergency Warp: 100% Flow & 5s Invulnerability Shield Restored!',
            doubleCrystals: '📺 Quantum Resonance: All Shards Collected This Run Doubled (2x)!',
            dailyCrate: '📺 Quantum Supply Pod: +500 Crystals & Weapon Tech Unlocked!'
        };
        
        const message = descriptions[rewardType] || '📺 Reward Granted!';
        
        // Instant simulated reward for testing & smooth web play
        if (this.ui && this.ui.showToast) {
            this.ui.showToast(message, 2500, '#22d3ee');
        }
        
        if (this.audio && this.audio.playPowerup) {
            this.audio.playPowerup('C5');
        }
        
        onRewardGranted?.();
    }
    
    canRevive() {
        return !this.hasRevivedThisRun;
    }
    
    triggerRevive(game) {
        if (!this.canRevive()) return false;
        
        this.showRewardedAd('revive', () => {
            this.hasRevivedThisRun = true;
            if (game && game.runData && game.player) {
                game.runData.flow = game.runData.flowMax || 55;
                game.player.activateShield(game.runData.time, 5.0);
                game.ui?.showToast('⚡ EMERGENCY WARP ENGAGED', 2000, '#00ffcc');
            }
        });
        return true;
    }
    
    doubleRunCrystals(runData) {
        if (!runData || runData._doubled) return;
        this.showRewardedAd('doubleCrystals', () => {
            const extra = runData.crystals || 0;
            runData.crystals += extra;
            runData._doubled = true;

            const extraShards = Math.max(1, Math.floor(extra / 1000) + 2);
            this.meta?.addArchiveShards(extraShards);

            if (this.meta && runData.crystals > this.meta.getHighScore()) {
                this.meta.setHighScore(runData.crystals);
            }

            // Update results DOM immediately
            const crystalsEl = document.getElementById('results-crystals');
            const bestEl = document.getElementById('results-best');
            const shardsEl = document.getElementById('results-shards');
            if (crystalsEl) crystalsEl.textContent = `Crystals: ${runData.crystals} 💎 (2x!)`;
            if (bestEl && this.meta) bestEl.textContent = `Best Archive: ${this.meta.getHighScore()} 💎`;
            if (shardsEl) shardsEl.textContent = `Bonus Shards gained: +${extraShards} ✶`;

            this.ui?.updateMenuStats();
            this.ui?.showToast(`💎 Doubled! +${extra} Crystals & +${extraShards} ✶ Shards`, 2200, '#00ffff');
        });
    }
    
    resetRun() {
        this.hasRevivedThisRun = false;
    }
}
