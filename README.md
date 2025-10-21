# FocusPing

A React Native app by DevNauts, inspired by Dan Martell's time audit methodology. Track your daily activities in 15-minute blocks to understand where your time really goes and make better decisions about delegation, automation, and elimination.

## Features

### 🎯 Core Features
- **Welcome Screen**: Beautiful onboarding explaining the time audit methodology
- **About/Inspiration**: Learn about the 4 D's framework (Delete, Delegate, Automate, Do)
- **15-Minute Blocks**: Fixed time blocks aligned to the clock (00:00-00:15, 00:15-00:30, etc.)
- **Complete Timeline**: View all 96 time slots from midnight to midnight
- **Smart Suggestions**: Dropdown list of previously used activities with real-time search filtering
- **Sleep Mode**: Toggle sleep mode to automatically respond with "Sleeping" for all prompts
- **Edit History**: Fill in missing past activities or edit any previous entries
- **Activity History**: View all your logged activities with color-coded status
- **Daily Audit Summary**: View a breakdown of your activities with percentages and time in minutes
- **Progress Visualization**: Beautiful progress bars showing time distribution
- **Dan Martell Branding**: Styled with vibrant orange and deep blue color scheme

### 💾 Data Persistence
- All data is stored locally using AsyncStorage
- Automatic reset at midnight (new day detection)
- No database required - everything stays on your device

### 🎨 User Interface & Branding
- **Dark Theme**: Pure black background (#000000) with attractive neon accents
- **DevNauts Brand Colors**: Bright Purple (#A78BFA) and Bright Blue (#60A5FA)
- **Visual Style**: 
  - Black backgrounds across all screens
  - Dark card backgrounds (#1A1A1A) with subtle borders
  - Vibrant neon purple and blue accents that pop against the dark background
  - Glowing shadows on buttons and interactive elements
- DevNauts logo displayed prominently on all screens
- "Powered by DevNauts" branding on header
- Modern, sleek design with high contrast
- Welcome screen explaining the time audit concept
- Dedicated "About" screen with the 4 D's framework
- Color-coded status indicators (green, blue, orange, red)
- Smooth animations and glowing effects

## How to Use

1. **Welcome Screen** (First Time)
   - Read about the FocusPing methodology
   - Learn how 15-minute tracking helps you understand your time
   - Tap "Get Started" to begin or "Learn About This Method" for more details

2. **About Screen** (Optional)
   - Learn about the 4 D's framework: Delete, Delegate, Automate, Do
   - Understand how to use your audit data to make decisions
   - Access anytime via the info button (ℹ️) in the header

3. **Enable Tracking Mode**
   - Toggle the "Tracking Mode" switch to ON
   - This enables:
     - Push notifications every 15 minutes
     - Real-time activity tracking
     - Timeline and analytics view
   - See all 96 time slots from midnight to midnight
   - Current slot is highlighted in blue

4. **Log Activities**
   - Tap any empty slot (current or past) to fill it
   - Type what you were doing
   - **Smart Suggestions**: See a dropdown of previously used activities
   - **Search & Filter**: Start typing to filter suggestions (e.g., type "bing" to find "binging")
   - Click a suggestion to quickly select it
   - Press Submit or hit Enter/Return

5. **Edit Past Entries**
   - Tap any filled slot to edit it
   - Change the activity as needed
   - Can't edit future slots (they're grayed out)

6. **Sleep Mode**
   - Toggle "Sleep Mode" when going to bed
   - All current prompts will automatically be filled with "Sleeping"
   - No interruptions during the night!

7. **View Your Summary**
   - Tap "View Summary" button anytime to see your daily audit
   - Shows completion rate (filled vs total slots)
   - Activity breakdown with percentages
   - Time in minutes for each activity
   - Visual progress bars
   - Tap the back arrow (←) or "Back to Timeline" to return to tracking

8. **Stop Tracking**
   - Toggle "Tracking Mode" switch to OFF to pause tracking
   - All notifications will be cancelled
   - Your data is preserved

9. **Reset Day**
   - Tap "Reset Day" link to clear all data
   - Starts completely fresh
   - Data persists across days until manually reset

## Installation

```bash
# Install dependencies
npm install

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on Web (PWA)
npm run web
```

## PWA Support

FocusPing is fully configured as a Progressive Web App (PWA)!

### Features:
- ✅ Install on any device (iOS, Android, Desktop)
- ✅ Works offline with service worker
- ✅ Runs like a native app in standalone mode
- ✅ Dark theme optimized (#000000 background, #8B5CF6 purple)
- ✅ Local data storage via AsyncStorage

### Build for Production:
```bash
# Export as PWA
npx expo export:web

# Deploy the 'dist' folder to any hosting:
# - Vercel (recommended)
# - Netlify
# - GitHub Pages
# - Any static hosting
```

### Install as PWA:
1. Visit the deployed URL
2. **iOS**: Tap Share → "Add to Home Screen"
3. **Android**: Tap menu → "Install app"
4. **Desktop**: Click install icon in address bar

The app runs exactly like a native app with full offline support!

## Technical Details

- **Framework**: React Native with Expo
- **Storage**: AsyncStorage for local persistence
- **Interval**: 15 minutes (configurable in code via INTERVAL_MINUTES constant)
- **Platform**: iOS, Android, and Web compatible

## Customization

You can easily customize the tracking interval by changing the `INTERVAL_MINUTES` constant at the top of `App.js`:

```javascript
const INTERVAL_MINUTES = 15; // Change to your preferred interval
```

## The 4 D's Framework

After tracking your time, analyze each activity:

1. **Delete** - Tasks that don't move the needle
2. **Delegate** - Tasks others can do 80% as well
3. **Automate** - Recurring tasks that can be systematized
4. **Do** - Your highest-value activities only you can do

## Inspiration

This app is inspired by Dan Martell's "Buy Back Your Time" methodology and productivity principles for entrepreneurs who want to scale their impact without sacrificing their freedom.

## Future Enhancements (Optional)

- Export data as CSV/JSON for deeper analysis
- Custom activity categories and presets
- Weekly/monthly analytics and trends
- Activity categorization (high-value vs low-value)
- Integration with calendar apps
- Cloud sync (backend integration)

---

**FocusPing** - Built with ❤️ by **DevNauts** using React Native and Expo | Inspired by Dan Martell's "Buy Back Your Time" Methodology

