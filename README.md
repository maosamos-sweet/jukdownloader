# ⚡ Vortex Downloader

A fast, beautiful desktop app to download videos and audio from **YouTube, TikTok, Facebook, Instagram, Twitter/X, Vimeo, Twitch, Reddit, and 1000+ more platforms**.

---

## ✨ Features

- 🎬 Download **MP4** video in 360p / 480p / 720p / 1080p / 1440p / 4K
- 🎵 Download **MP3** audio in 320kbps / 192kbps / 128kbps or M4A
- 🔍 **Fetch & Preview** — paste URL, click Fetch to see title, thumbnail, platform, duration
- ⚡ **CPU-optimized** — auto-detects cores and uses optimal threads for max speed
- 🌐 Supports **1000+ platforms** via yt-dlp
- 📋 Download queue and history
- 🎨 Beautiful dark UI with smooth animations
- 📦 Installs as a proper Windows `.exe` setup

---

## 🚀 Quick Start (Development)

### Prerequisites
- **Node.js** v18+ → https://nodejs.org
- **Git** → https://git-scm.com

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Download required binaries (yt-dlp + ffmpeg instructions)
node setup-bins.js

# 3. Manually place ffmpeg.exe in /bin folder:
#    Download from: https://www.gyan.dev/ffmpeg/builds/
#    Get: ffmpeg-release-essentials.zip → extract ffmpeg.exe → put in /bin/

# 4. Run in development mode
npm start

# 5. Build Windows installer
npm run build
# Output: dist/Vortex Downloader Setup 1.0.0.exe
```

---

## 📁 Project Structure

```
videodownloader/
├── src/
│   ├── main.js          # Electron main process (backend)
│   ├── preload.js       # Secure IPC bridge
│   ├── index.html       # App UI
│   ├── style.css        # UI styles
│   └── renderer.js      # UI logic
├── bin/
│   ├── yt-dlp.exe       # Download engine (auto-downloaded)
│   └── ffmpeg.exe       # Media processor (manual install)
├── assets/
│   └── icon.ico         # App icon
├── setup-bins.js        # Binary downloader helper
└── package.json
```

---

## 🔧 Creating the App Icon

You need an `assets/icon.ico` file. Create one:
1. Go to https://convertio.co/png-ico/ or https://icoconvert.com
2. Upload a 256×256 PNG logo
3. Download as `.ico`
4. Save as `assets/icon.ico`

**Free icon option:** Search for "download app icon" on https://icons8.com

---

## 🏗️ Building the Windows Installer

```bash
npm run build
```

This creates: `dist/Vortex Downloader Setup 1.0.0.exe`

The installer:
- Shows a custom installation wizard
- Lets user choose install directory
- Creates Desktop + Start Menu shortcuts
- Includes uninstaller
- Bundles all dependencies (yt-dlp.exe, ffmpeg.exe)

---

## ⚡ Performance Tips

The app automatically detects your CPU core count and uses ~75% of cores for concurrent fragment downloading. For example:
- 8-core CPU → 6 download threads
- 16-core CPU → 12 download threads

This is especially fast for YouTube/HLS streams that support fragment parallel downloading.

---

## 🌐 Supported Platforms (via yt-dlp)

YouTube, TikTok, Facebook, Instagram, Twitter/X, Vimeo, Twitch, Reddit, Dailymotion, Bilibili, Niconico, SoundCloud, Bandcamp, Mixcloud, Rumble, Odysee, PeerTube, and **1000+ more**.

Full list: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md

---

## 📋 Recommended Enhancements (v2.0 ideas)

- [ ] GPU acceleration via NVENC/AMF for format conversion
- [ ] Batch/playlist download
- [ ] Browser extension integration
- [ ] Auto-update via electron-updater
- [ ] Download scheduler
- [ ] Dark/Light theme toggle
- [ ] Proxy/VPN support
- [ ] Subtitle download option

---

## 🛠️ Troubleshooting

**"yt-dlp binary not found"** → Run `node setup-bins.js` and ensure `bin/yt-dlp.exe` exists.

**"Could not fetch video info"** → The URL may be private, age-restricted, or region-blocked.

**MP3 conversion not working** → Ensure `bin/ffmpeg.exe` exists. Without FFmpeg, only raw audio extraction works.

**Build fails** → Ensure `assets/icon.ico` exists (even a placeholder 32×32 .ico file).
