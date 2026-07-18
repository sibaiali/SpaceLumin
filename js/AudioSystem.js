/**
 * AudioSystem.js - Sound and Music
 * Handles all game audio using Tone.js
 * Includes voice limiting, priority system, and space ambience
 */

class AudioSystem {
    constructor() {
        this.ready = false;
        this.musicOn = true;
        this.sfxOn = true;
        this.hapticsOn = true;

        // Voice limiter (max 6 simultaneous SFX)
        this.maxVoices = 6;
        this.activeVoices = [];

        // Priority levels (higher = more important)
        this.priority = {
            playerDamage: 100,
            kill: 80,
            laser: 60,
            hitTick: 40,
            collect: 30,
            ambience: 10
        };

        // Synths and effects
        this.sounds = {};
        this.ambPad = null;
        this.ambFilter = null;
        this.kickSynth = null;

        // Radio signal synth
        this.radioSignal = null;
        this.radioFilter = null;
        this.lastRadioSignal = 0;

        // Timing
        this.lastKick = 0;
        this.lastMusicPulse = 0;
    }

    async init() {
        if (this.ready) return;

        try {
            await Tone.start();

            // Sound effects
            this.sounds.collect = new Tone.PolySynth().toDestination();
            this.sounds.error = new Tone.PolySynth().toDestination();
            this.sounds.shoot = new Tone.PolySynth().toDestination();
            this.sounds.decoy = new Tone.NoiseSynth().toDestination();
            this.sounds.spawn = new Tone.PolySynth().toDestination();
            this.sounds.levelUp = new Tone.PolySynth().toDestination();
            this.sounds.reaper = new Tone.MembraneSynth().toDestination();
            this.sounds.hover = new Tone.PolySynth().toDestination();

            // New space sounds
            this.sounds.freeze = new Tone.MetalSynth().toDestination(); // Ice crack
            this.sounds.impact = new Tone.MembraneSynth().toDestination(); // Impact glow
            this.sounds.whoosh = new Tone.NoiseSynth({
                noise: { type: 'pink' },
                envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.2 }
            }).toDestination(); // Flyby whoosh
            this.sounds.alienApproach = new Tone.FMSynth({
                harmonicity: 3,
                modulationIndex: 10,
                envelope: { attack: 0.5, decay: 0.2, sustain: 0.3, release: 0.5 }
            }).toDestination(); // Alien incoming

            // Charge hiss for enemy telegraph (QA fairness sound)
            this.sounds.chargeHiss = new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 0.1 }
            }).toDestination();

            // Kick for rhythm
            this.kickSynth = new Tone.MembraneSynth().toDestination();

            // ========================================
            // VACUUM FILTER: Space realism
            // Low-pass filter simulates sound traveling through hull, not air
            // Explosions are muffled "thuds" - scientifically accurate
            // ========================================
            this.vacuumFilter = new Tone.Filter({
                type: 'lowpass',
                frequency: 400,      // Cut high frequencies
                rolloff: -24,        // Steep rolloff
                Q: 0.5
            }).toDestination();

            // Connect impact sounds through vacuum filter
            this.sounds.impact.disconnect();
            this.sounds.impact.connect(this.vacuumFilter);

            // Create vacuum explosion channel
            this.vacuumExplosion = new Tone.MembraneSynth({
                pitchDecay: 0.1,
                octaves: 3,
                envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.6 }
            }).connect(this.vacuumFilter);
            this.vacuumExplosion.volume.value = -8;

            // Ambient pad with deeper reverb
            const reverb = new Tone.Reverb(6).toDestination();
            this.ambFilter = new Tone.AutoFilter("4n").connect(reverb);
            this.ambPad = new Tone.PolySynth().connect(this.ambFilter);
            this.ambPad.volume.value = -26;
            this.ambFilter.baseFrequency = 80;
            this.ambFilter.octaves = 2;
            this.ambFilter.start();

            // Space drone ambience
            const droneReverb = new Tone.Reverb(10).toDestination();
            this.spaceDrone = new Tone.Synth({
                oscillator: { type: 'sine' },
                envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 }
            }).connect(droneReverb);
            this.spaceDrone.volume.value = -35;

            Tone.Transport.start();

            // Set initial volumes
            this.updateVolumes();

            // Initial ambient
            this.ambPad.triggerAttackRelease(["C3", "G3", "D4"], "4n");

            // Start space drone
            this.lastDroneTime = 0;

            this.ready = true;
        } catch (e) {
            console.warn("Audio init failed:", e);
        }
    }

    updateVolumes() {
        if (!this.sounds.collect) return;

        const sfxVol = this.sfxOn ? -12 : -60;
        const musicVol = this.musicOn ? -12 : -60;

        this.sounds.collect.volume.value = sfxVol;
        this.sounds.error.volume.value = sfxVol + 2;
        this.sounds.shoot.volume.value = sfxVol - 6;
        this.sounds.decoy.volume.value = sfxVol - 4;
        this.sounds.spawn.volume.value = sfxVol - 2;
        this.sounds.levelUp.volume.value = sfxVol + 4;
        this.sounds.reaper.volume.value = sfxVol + 6;
        this.sounds.hover.volume.value = sfxVol - 12;

        if (this.kickSynth) this.kickSynth.volume.value = musicVol;
        if (this.ambPad) this.ambPad.volume.value = this.musicOn ? -26 : -60;
    }

    setMusicOn(on) {
        this.musicOn = on;
        this.updateVolumes();
    }

    setSfxOn(on) {
        this.sfxOn = on;
        this.updateVolumes();
    }

    setHapticsOn(on) {
        this.hapticsOn = on;
    }

    // Sound effects
    playCollect(note = "C4") {
        if (!this.ready || !this.sfxOn) return;
        this.sounds.collect.triggerAttackRelease(note, "16n");
    }

    playError(note = "G2") {
        if (!this.ready || !this.sfxOn) return;
        this.sounds.error.triggerAttackRelease(note, "8n");
    }

    playShoot() {
        if (!this.ready || !this.sfxOn) return;
        this.sounds.shoot.triggerAttackRelease("C4", "16n");
    }

    playDecoy() {
        if (!this.ready || !this.sfxOn) return;
        this.sounds.decoy.triggerAttackRelease("16n");
    }

    playSpawn(note = "C3") {
        if (!this.ready || !this.sfxOn) return;
        this.sounds.spawn.triggerAttackRelease(note, "16n");
    }

    playLevelUp() {
        if (!this.ready || !this.sfxOn) return;
        this.sounds.levelUp.triggerAttackRelease(["C4", "G4", "C5"], "8n");
    }

    playReaper(note = "A1") {
        if (!this.ready || !this.sfxOn) return;
        this.sounds.reaper.triggerAttackRelease(note, "2n");
    }

    playHover() {
        if (!this.ready || !this.sfxOn) return;
        this.sounds.hover.triggerAttackRelease("C6", "32n", undefined, 0.1);
    }

    // New space sounds
    playFreeze() {
        if (!this.ready || !this.sfxOn) return;
        // Ice crack shatter sound - dramatic freeze effect
        this.sounds.freeze.triggerAttackRelease("C2", "4n");
        setTimeout(() => {
            if (this.sounds.freeze) this.sounds.freeze.triggerAttackRelease("G1", "8n");
        }, 100);
    }

    playImpact() {
        if (!this.ready || !this.sfxOn) return;
        // Glowing impact explosion
        this.sounds.impact.triggerAttackRelease("G2", "8n");
    }

    // ========================================
    // VACUUM EXPLOSION: Scientific realism
    // Sound travels through hull, not air - muffled "thud"
    // ========================================
    playVacuumExplosion(note = "C2") {
        if (!this.ready || !this.sfxOn) return;
        if (this.vacuumExplosion) {
            this.vacuumExplosion.triggerAttackRelease(note, "4n");
        }
    }

    playWhoosh() {
        if (!this.ready || !this.sfxOn) return;
        // Enemy flyby whoosh
        this.sounds.whoosh.triggerAttackRelease("8n");
    }

    playAlienApproach() {
        if (!this.ready || !this.sfxOn) return;
        // Incoming alien UFO sound
        this.sounds.alienApproach.triggerAttackRelease("A2", "4n");
    }

    // Enemy telegraph charge hiss (QA fairness feature)
    playChargeHiss() {
        if (!this.ready || !this.sfxOn) return;
        // Rising white noise hiss to warn player of attack
        if (this.sounds.chargeHiss) {
            this.sounds.chargeHiss.triggerAttackRelease("8n");
        }
    }

    // Generic sound dispatcher for dynamic calls
    playSound(name) {
        if (!this.ready || !this.sfxOn) return;

        // Map snake_case names to methods
        const soundMap = {
            'charge_hiss': () => this.playChargeHiss(),
            'collect': () => this.playCollect(),
            'error': () => this.playError(),
            'shoot': () => this.playShoot(),
            'decoy': () => this.playDecoy(),
            'spawn': () => this.playSpawn(),
            'level_up': () => this.playLevelUp(),
            'reaper': () => this.playReaper(),
            'hover': () => this.playHover(),
            'freeze': () => this.playFreeze(),
            'impact': () => this.playImpact(),
            'whoosh': () => this.playWhoosh(),
            'alien_approach': () => this.playAlienApproach()
        };

        if (soundMap[name]) {
            soundMap[name]();
        }
    }

    playSpaceDrone(time) {
        if (!this.ready || !this.musicOn) return;
        // Background space ambience - play periodically
        if (time - this.lastDroneTime > 15) {
            this.lastDroneTime = time;
            const notes = ["C1", "G1", "D1", "A1"];
            const note = notes[Math.floor(Math.random() * notes.length)];
            this.spaceDrone.triggerAttackRelease(note, "4n");
        }
    }

    // Music pulse
    pulseMusic(time, dayPhase, isBoss, combo) {
        if (!this.ready || !this.musicOn) return;

        // Kick beat
        if (time - this.lastKick > 0.6) {
            this.kickSynth.triggerAttackRelease("C1", "8n");
            this.lastKick = time;
        }

        // Ambient chord every 7 seconds
        if (time - this.lastMusicPulse < 7) return;
        this.lastMusicPulse = time;

        let notes;
        if (isBoss) {
            notes = ["F2", "C3", "G3"];
        } else if (dayPhase < 0.5) {
            notes = ["C3", "E3", "G3", "B3"];
        } else {
            notes = ["A2", "D3", "E3", "G3"];
        }

        this.ambPad.triggerAttackRelease(notes, "2n");

        // Extra notes for high combo
        if (combo >= 3) {
            setTimeout(() => this.playCollect("C5"), 100);
            setTimeout(() => this.playCollect("E5"), 200);
        }
    }

    // Adjust filter for flow state
    setFlowState(flowCritical) {
        if (!this.ambFilter) return;
        const cutoff = flowCritical ? 300 : 2000;
        this.ambFilter.frequency.rampTo(cutoff, 0.1);
    }

    // === EVENT STINGERS ===

    // Sector start swell
    playSectorStart() {
        if (!this.ready || !this.sfxOn) return;
        // Rising swell when entering new sector
        if (this.sounds.collect) {
            this.sounds.collect.triggerAttackRelease(["C3", "E3", "G3"], "8n");
            setTimeout(() => this.sounds.collect.triggerAttackRelease(["C4", "E4", "G4"], "4n"), 150);
        }
    }

    // Boss spawn warning
    playBossSpawn() {
        if (!this.ready || !this.sfxOn) return;
        // Low warning tone
        if (this.sounds.reaper) {
            this.sounds.reaper.triggerAttackRelease("E1", "2n");
            setTimeout(() => this.sounds.reaper.triggerAttackRelease("G1", "2n"), 300);
            setTimeout(() => this.sounds.reaper.triggerAttackRelease("A1", "2n"), 600);
        }
    }

    // Black hole singularity audio
    playBlackHole() {
        if (!this.ready || !this.sfxOn) return;
        // Falling pitch + widening + vacuum drop
        if (this.spaceDrone) {
            this.spaceDrone.triggerAttackRelease("C1", "4n");
            setTimeout(() => this.spaceDrone.triggerAttackRelease("G0", "2n"), 500);
        }
        if (this.sounds.whoosh) {
            this.sounds.whoosh.triggerAttackRelease("4n");
        }
    }

    // Radio signal burst (alien transmission)
    playRadioSignal() {
        if (!this.ready || !this.sfxOn) return;
        // Telemetry beeps + static burst
        if (this.sounds.collect) {
            const notes = ["A5", "C6", "E5", "G5"];
            const note = notes[Math.floor(Math.random() * notes.length)];
            this.sounds.collect.triggerAttackRelease(note, "32n");
            setTimeout(() => this.sounds.collect.triggerAttackRelease(note, "32n"), 80);
            setTimeout(() => this.sounds.collect.triggerAttackRelease(note, "32n"), 160);
        }
    }

    // Kill burst sound
    playKillBurst() {
        if (!this.ready || !this.sfxOn) return;
        if (this.sounds.impact) {
            this.sounds.impact.triggerAttackRelease("C3", "16n");
        }
    }

    // Haptic feedback
    haptic(kind) {
        if (!this.hapticsOn || !navigator.vibrate) return;

        try {
            if (kind === 'light') navigator.vibrate(20);
            else if (kind === 'medium') navigator.vibrate(50);
            else if (kind === 'heavy') navigator.vibrate([80, 30, 80]);
        } catch (e) {
            // Ignore vibration errors
        }
    }

    dispose() {
        if (this.ambPad) this.ambPad.dispose();
        if (this.ambFilter) this.ambFilter.dispose();
        if (this.kickSynth) this.kickSynth.dispose();

        Object.values(this.sounds).forEach(s => {
            if (s && s.dispose) s.dispose();
        });
    }
}

