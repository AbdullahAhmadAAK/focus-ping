# Building FocusPing as a PWA

## Current Status
✅ PWA configuration added to `app.json`
✅ Web manifest created
✅ Dark theme configured (#000000 background, #8B5CF6 purple theme)

## How to Build & Deploy as PWA

### Option 1: Test Locally (Development)
```bash
npm run web
```
- Opens in browser at http://localhost:8081
- Works as a web app immediately
- Can test all features in browser

### Option 2: Build for Production (PWA)
```bash
# Build the web version
npx expo export:web

# This creates a 'dist' folder with your PWA
```

The build will include:
- Service worker for offline support
- Web manifest for "Add to Home Screen"
- Optimized production build
- All PWA requirements

### Option 3: Deploy to Hosting

After building, deploy the `dist` folder to:

**Vercel (Recommended - Free)**
```bash
npm install -g vercel
vercel
```

**Netlify (Also Free)**
```bash
npm install -g netlify-cli
netlify deploy
```

**GitHub Pages**
- Push to GitHub
- Enable GitHub Pages in settings
- Point to the `dist` folder

### PWA Features Configured:

✅ **Installable**: Users can "Add to Home Screen"
✅ **Offline Ready**: Service worker caches for offline use
✅ **Dark Theme**: Black background (#000000)
✅ **Purple Branding**: Theme color (#8B5CF6)
✅ **Standalone Mode**: Opens like a native app
✅ **Portrait Lock**: Optimized for mobile
✅ **Local Storage**: AsyncStorage works via web storage APIs

### Testing PWA Features:

1. Run `npm run web`
2. Open in Chrome/Edge
3. Open DevTools > Application > Manifest
4. Click "Add to Home Screen" in browser menu
5. App installs on desktop/mobile like native app

### Mobile PWA Installation:

**iOS (Safari):**
1. Visit your deployed URL
2. Tap Share button
3. Tap "Add to Home Screen"

**Android (Chrome):**
1. Visit your deployed URL
2. Tap menu (⋮)
3. Tap "Install app" or "Add to Home Screen"

## Next Steps:

1. Test locally: `npm run web`
2. Build production: `npx expo export:web`
3. Deploy to Vercel/Netlify
4. Share the URL - users can install as PWA!

