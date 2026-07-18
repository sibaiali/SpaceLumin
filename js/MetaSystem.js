/**
 * MetaSystem.js - Progression, Upgrades, Achievements
 * Handles persistent game state and meta-progression
 */

// Upgrade definitions
const META_UPGRADES = {
    maxFlowI: { key: "maxFlowI", cost: 15, desc: "+10% max Flow" },
    maxFlowII: { key: "maxFlowII", cost: 35, desc: "+20% max Flow" },
    shieldStart: { key: "shieldStart", cost: 25, desc: "Start each run with a shield" },
    fruitPlus: { key: "fruitPlus", cost: 30, desc: "More high-tier fruits" },
    auraPlus: { key: "auraPlus", cost: 25, desc: "+40% Aura crystal gain" },
    kineticAmp: { key: "kineticAmp", cost: 20, desc: "Base gun damage +10%" },
    fireAmpI: { key: "fireAmpI", cost: 40, desc: "Fire rounds +15% dmg (unlock Sector 2)", requiredSector: 2 },
    fireAmpII: { key: "fireAmpII", cost: 60, desc: "Fire rounds +15% more (Sector 4)", requiredSector: 4 },
    electricAmpI: { key: "electricAmpI", cost: 50, desc: "Electric rounds +12% dmg (Sector 3)", requiredSector: 3 },
    electricAmpII: { key: "electricAmpII", cost: 75, desc: "Electric rounds +12% more (Sector 5)", requiredSector: 5 },
    flowRegen: { key: "flowRegen", cost: 45, desc: "Flow regen +10% per sector" },
    shieldBoost: { key: "shieldBoost", cost: 40, desc: "Shield duration +35%" },
    fruitSynergy: { key: "fruitSynergy", cost: 40, desc: "Void Plums boost future Plum gain" },
    toxicMastery: { key: "toxicMastery", cost: 50, desc: "Toxic fruits heal, more enemies spawn" },
    orbitalDrone: { key: "orbitalDrone", cost: 60, desc: "Orbital drone damages enemies" }
};

// Achievement definitions
const ACHIEVEMENTS = {
    firstGate: { id: "firstGate", label: "First Gate", desc: "Purify your first gate." },
    fruitHoard: { id: "fruitHoard", label: "Fruit Hoarder", desc: "Collect 30 fruits in one run." },
    wraithKill: { id: "wraithKill", label: "Wraith Slayer", desc: "Defeat a Quantum Wraith." },
    bossClear: { id: "bossClear", label: "Void Colossus Down", desc: "Clear a boss sector." }
};

// Daily modifiers
const DAILY_MODIFIERS = {
    lowGravity: {
        id: "lowGravity",
        label: "Low Gravity",
        desc: "Smoother movement, slightly less Flow drain.",
        jerkFactor: 0.7,
        flowDrainFactor: 0.85,
        fruitFactor: 1.0,
        nightBias: 1.0,
        enemyFactor: 1.0
    },
    fruitStorm: {
        id: "fruitStorm",
        label: "Fruit Storm",
        desc: "More fruits everywhere, slightly more enemies.",
        jerkFactor: 1.0,
        flowDrainFactor: 1.0,
        fruitFactor: 1.6,
        nightBias: 1.0,
        enemyFactor: 1.15
    },
    nightForever: {
        id: "nightForever",
        label: "Night Forever",
        desc: "The rim lives in permanent dusk. Higher risk, higher reward.",
        jerkFactor: 1.1,
        flowDrainFactor: 1.1,
        fruitFactor: 1.2,
        nightBias: 1.4,
        enemyFactor: 1.25
    }
};

// Planet sectors
const PLANET_SECTORS = [
    { sector: 1, name: "Mercury" },
    { sector: 2, name: "Venus" },
    { sector: 3, name: "Earth" },
    { sector: 4, name: "Mars" },
    { sector: 5, name: "Jupiter" },
    { sector: 6, name: "Saturn" },
    { sector: 7, name: "Uranus" },
    { sector: 8, name: "Neptune" },
    { sector: 9, name: "Kepler-452b" },
    { sector: 10, name: "TRAPPIST-1e" }
];

// Journey stages for roadmap
const JOURNEY_STAGES = [
    { id: "mercury", title: "Mercury · Scorched Orbit", range: "Sector 1", boss: "Solar Warden", unlockAt: 1 },
    { id: "venus", title: "Venus · Acidic Veil", range: "Sector 2", boss: "Cloud Leviathan", unlockAt: 2 },
    { id: "earth", title: "Earth · Home Sky", range: "Sector 3", boss: "Orbital Sentinel", unlockAt: 3 },
    { id: "mars", title: "Mars · Red Frontier", range: "Sector 4", boss: "Dust Titan", unlockAt: 4 },
    { id: "jupiter", title: "Jupiter · Storm Giant", range: "Sector 5", boss: "Great Eye", unlockAt: 5 },
    { id: "saturn", title: "Saturn · Broken Rings", range: "Sector 6", boss: "Ring Sentinel", unlockAt: 6 },
    { id: "uranus", title: "Uranus · Tilted Twilight", range: "Sector 7", boss: "Azure Colossus", unlockAt: 7 },
    { id: "neptune", title: "Neptune · Deep Blue", range: "Sector 8", boss: "Storm Reaper", unlockAt: 8 },
    { id: "kepler452b", title: "Kepler-452b · Old Earth", range: "Sector 9", boss: "Ancient Echo", unlockAt: 9 },
    { id: "trappist1e", title: "TRAPPIST-1e · Dusk World", range: "Sector 10+", boss: "Void Colossus", unlockAt: 10 }
];

class MetaSystem {
    constructor() {
        this.currentDailyMod = DAILY_MODIFIERS.lowGravity;
        this.loadDailyModifier();
    }
    
    // Storage helpers
    getMetaState() {
        try {
            return JSON.parse(localStorage.getItem("luminMeta") || "{}");
        } catch {
            return {};
        }
    }
    
    setMetaState(state) {
        try {
            localStorage.setItem("luminMeta", JSON.stringify(state));
        } catch (e) {
            console.warn("Save failed:", e);
        }
    }
    
    // High score
    getHighScore() {
        return parseInt(localStorage.getItem("luminFlowBest") || "0", 10);
    }
    
    setHighScore(value) {
        localStorage.setItem("luminFlowBest", String(value));
    }
    
    // Archive shards
    getArchiveShards() {
        const meta = this.getMetaState();
        return meta.archiveShards || 0;
    }
    
    addArchiveShards(amount) {
        const meta = this.getMetaState();
        meta.archiveShards = (meta.archiveShards || 0) + amount;
        this.setMetaState(meta);
    }
    
    // Max sector reached
    getMaxSector() {
        const meta = this.getMetaState();
        return meta.maxSector || 1;
    }
    
    setMaxSector(value) {
        const meta = this.getMetaState();
        meta.maxSector = Math.max(meta.maxSector || 1, value);
        this.setMetaState(meta);
    }
    
    // Upgrades
    getUnlockedUpgrades() {
        const meta = this.getMetaState();
        return meta.upgrades || [];
    }
    
    hasUpgrade(key) {
        return this.getUnlockedUpgrades().includes(key);
    }
    
    unlockUpgrade(key) {
        const meta = this.getMetaState();
        const arr = meta.upgrades || [];
        if (!arr.includes(key)) {
            arr.push(key);
            meta.upgrades = arr;
            this.setMetaState(meta);
            return true;
        }
        return false;
    }
    
    canAffordUpgrade(key) {
        const upgrade = META_UPGRADES[key];
        if (!upgrade) return false;
        if (this.hasUpgrade(key)) return false;
        if (upgrade.requiredSector && this.getMaxSector() < upgrade.requiredSector) return false;
        return this.getArchiveShards() >= upgrade.cost;
    }
    
    purchaseUpgrade(key) {
        const upgrade = META_UPGRADES[key];
        if (!upgrade || !this.canAffordUpgrade(key)) return false;
        
        this.addArchiveShards(-upgrade.cost);
        this.unlockUpgrade(key);
        return true;
    }
    
    // Achievements
    getAchievementsState() {
        const meta = this.getMetaState();
        return meta.achievements || {};
    }
    
    hasAchievement(id) {
        return !!this.getAchievementsState()[id];
    }
    
    unlockAchievement(id) {
        const meta = this.getMetaState();
        meta.achievements = meta.achievements || {};
        if (!meta.achievements[id]) {
            meta.achievements[id] = true;
            this.setMetaState(meta);
            return true;
        }
        return false;
    }
    
    // Daily modifier
    loadDailyModifier() {
        const today = new Date().toISOString().slice(0, 10);
        const meta = this.getMetaState();
        
        if (meta.dailyDate === today && meta.dailyId && DAILY_MODIFIERS[meta.dailyId]) {
            this.currentDailyMod = DAILY_MODIFIERS[meta.dailyId];
        } else {
            const keys = Object.keys(DAILY_MODIFIERS);
            const idx = Math.floor(Math.random() * keys.length);
            const id = keys[idx];
            this.currentDailyMod = DAILY_MODIFIERS[id];
            meta.dailyDate = today;
            meta.dailyId = id;
            this.setMetaState(meta);
        }
    }
    
    getDailyMod() {
        return this.currentDailyMod;
    }
    
    // Story/onboard flags
    hasSeenStory() {
        return localStorage.getItem("luminFlowStorySeen") === "1";
    }
    
    markStorySeen() {
        localStorage.setItem("luminFlowStorySeen", "1");
    }
    
    hasSeenOnboard() {
        return localStorage.getItem("luminOnboardSeen") === "1";
    }
    
    markOnboardSeen() {
        localStorage.setItem("luminOnboardSeen", "1");
    }
    
    // Helpers
    getPlanetName(sector) {
        const entry = PLANET_SECTORS.find(p => p.sector === sector);
        if (entry) return entry.name;
        if (sector < 1) return "Deep Space";
        if (sector <= 12) return "Outer Rim";
        return "Unknown Expanse";
    }
    
    computeFlowMax() {
        const BASE = 100;
        let factor = 1.0;
        if (this.hasUpgrade("maxFlowI")) factor += 0.10;
        if (this.hasUpgrade("maxFlowII")) factor += 0.20;
        return BASE * factor;
    }
    
    computeShieldDuration(sector) {
        const base = 4 + Math.min(4, sector * 0.12);
        return this.hasUpgrade("shieldBoost") ? base * 1.35 : base;
    }
    
    computeBulletDamage(sector, mode) {
        let mult = 1 + 0.15 * Math.max(0, sector - 1);
        
        if (mode === 'fire') {
            mult *= 1.35 + 0.08 * (sector - 2);
            if (this.hasUpgrade("fireAmpI")) mult *= 1.15;
            if (this.hasUpgrade("fireAmpII")) mult *= 1.15;
        } else if (mode === 'electric') {
            mult *= 1.6 + 0.1 * (sector - 3);
            if (this.hasUpgrade("electricAmpI")) mult *= 1.12;
            if (this.hasUpgrade("electricAmpII")) mult *= 1.12;
        } else {
            if (this.hasUpgrade("kineticAmp")) mult *= 1.1;
        }
        
        return Math.max(1, mult);
    }
    
    getWeaponMode(sector) {
        if (sector >= 3) return 'electric';
        if (sector >= 2) return 'fire';
        return 'basic';
    }
}
