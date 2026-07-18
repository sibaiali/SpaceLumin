# Lumin Flow: Play Store Deployment Guide

## Files Created for Mobile/PWA:

1. **manifest.json** - PWA manifest (app name, icons, theme)
2. **sw.js** - Service worker for offline caching
3. **icons/icon.svg** - App icon (convert to PNG for stores)

## To Deploy as Android App:

### Option 1: PWABuilder (Easiest)
1. Deploy updated files to Netlify
2. Go to https://pwabuilder.com
3. Enter: `https://spacelumin.netlify.app`
4. Click "Start" → "Build" → "Android"
5. Download the APK
6. Upload to Google Play Console

### Option 2: Bubblewrap CLI
```bash
npm install -g @aspect-build/aspect @aspect-build/aspect-bazel
npx @aspect-build/aspect init
npx @aspect-build/aspect build
```

## Icon Sizes Needed:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

Convert SVG using: https://svgtopng.com or imagemagick

## Testing PWA on Phone:
1. Open Chrome on Android
2. Go to https://spacelumin.netlify.app
3. Tap menu (⋮) → "Install app" or "Add to Home screen"
