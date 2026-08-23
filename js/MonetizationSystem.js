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
        
        console.log([MonetizationSystem] Initialized with SDK provider: );
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
        console.log([Monetization] Requesting Rewarded Ad for: );
        
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
        if (!runData) return;
        this.showRewardedAd('doubleCrystals', () => {
            const extra = runData.crystals || 0;
            runData.crystals += extra;
            this.meta?.addCrystals(extra);
            this.ui?.showToast(💎 Doubled! + Shards, 2000, '#00ffff');
        });
    }
    
    resetRun() {
        this.hasRevivedThisRun = false;
    }
}
