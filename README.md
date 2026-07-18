# 🚀 Lumin Flow: Utopia Run

A 3D space survival game where you travel from Mercury to TRAPPIST-1e. Each sector is a new planet with its own boss.

## 🎮 Play Now
[Play on Netlify](https://your-netlify-url.netlify.app) *(update with your URL)*

## ✨ Features
- **12 Planetary Sectors** - Journey from Mercury to TRAPPIST-1e
- **Flow Survival Mechanic** - Keep your energy high or perish
- **3D Graphics** - Powered by Three.js
- **Procedural Audio** - Dynamic music with Tone.js
- **PWA Support** - Install and play offline
- **Mobile Optimized** - Touch controls with virtual joystick

## 🎯 How to Play
- **Move**: Mouse/touch - ship follows cursor
- **Shoot**: Hold to auto-fire toward cursor
- **Collect**: Cyan orbs & fruits for Flow/crystals
- **Abilities**:
  - ❄️ **Freeze** (F): Time-lock enemies
  - 🌀 **Aura** (R): Wipe nearby enemies
  - 👤 **Decoy** (Space): Mislead creatures

## 🛠️ Tech Stack
- **Three.js** - 3D rendering
- **Tone.js** - Audio synthesis
- **Vanilla JS** - No frameworks
- **PWA** - Offline support

## 📁 Project Structure
```
├── index.html          # Main HTML
├── styles.css          # Styling
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
└── js/
    ├── Game.js         # Main game controller
    ├── Player.js       # Player ship
    ├── Enemy.js        # Enemy AI
    ├── World3D.js      # Three.js scene
    ├── AudioSystem.js  # Sound system
    ├── Director.js     # H-PIM adaptive difficulty
    └── ...             # Other modules
```

## 🚀 Run Locally
Just open `index.html` in a browser, or use a local server:
```bash
npx serve .
```

## 📜 License
MIT License

---
*v3.0 · 3D Hextech Core*
