#!/usr/bin/env node
/**
 * setup-bins.js
 * Downloads yt-dlp.exe and ffmpeg.exe into the /bin folder
 * Run: node setup-bins.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BIN_DIR = path.join(__dirname, 'bin');

if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

const BINARIES = [
  {
    name: 'yt-dlp.exe',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    description: 'yt-dlp (video downloader engine)'
  },
  {
    name: 'ffmpeg.exe',
    url: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    description: 'FFmpeg (media processing)'
  }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const handleResponse = (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, handleResponse);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const total = parseInt(response.headers['content-length'] || '0');
      let downloaded = 0;
      response.on('data', chunk => {
        downloaded += chunk.length;
        if (total) {
          const pct = Math.round(downloaded / total * 100);
          process.stdout.write(`\r  Progress: ${pct}% (${(downloaded/1024/1024).toFixed(1)} MB)`);
        }
      });
      response.pipe(file);
      file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve(); });
    };
    https.get(url, handleResponse).on('error', reject);
  });
}

async function main() {
  console.log('🚀 Vortex Downloader - Binary Setup\n');
  console.log(`📁 Saving to: ${BIN_DIR}\n`);

  // Download yt-dlp
  const ytdlpPath = path.join(BIN_DIR, 'yt-dlp.exe');
  if (fs.existsSync(ytdlpPath)) {
    console.log('✅ yt-dlp.exe already exists, skipping...');
  } else {
    console.log('⬇️  Downloading yt-dlp.exe...');
    try {
      await download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', ytdlpPath);
      console.log('✅ yt-dlp.exe downloaded successfully!');
    } catch (e) {
      console.error('❌ Failed to download yt-dlp:', e.message);
    }
  }

  console.log('\n📝 NOTE for FFmpeg:');
  console.log('   Download ffmpeg.exe from: https://www.gyan.dev/ffmpeg/builds/');
  console.log('   Get the "ffmpeg-release-essentials.zip" and extract ffmpeg.exe to the /bin folder');
  console.log('   OR run: winget install ffmpeg (on Windows)');
  console.log('\n   The app works without FFmpeg but MP3 conversion requires it.\n');

  console.log('✅ Setup complete! Now run:');
  console.log('   npm install');
  console.log('   npm start          (to test)');
  console.log('   npm run build      (to create installer .exe)');
}

main().catch(console.error);
