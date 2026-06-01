const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getBinPath(name) {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const exeName = name + ext;
  const tries = [
    path.join(app.getAppPath(), 'bin', exeName),
    path.join(__dirname, '..', 'bin', exeName),
    path.join(process.cwd(), 'bin', exeName),
    path.join(process.resourcesPath || '', 'bin', exeName),
  ];
  for (const p of tries) {
    if (fs.existsSync(p)) return p;
  }
  return tries[0];
}

function getSystemInfo() {
  const cpuCount = os.cpus().length;
  const totalMem = Math.round(os.totalmem() / (1024 ** 3));
  const freeMem  = Math.round(os.freemem()  / (1024 ** 3));
  const optimalThreads = Math.max(1, Math.floor(cpuCount * 0.75));
  return { cpuCount, totalMem, freeMem, optimalThreads, platform: process.platform };
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 740,
    minWidth: 900, minHeight: 650,
    frame: false,
    backgroundColor: '#0d0d0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {

  createWindow();

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    console.log('Update available');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded');
    autoUpdater.quitAndInstall();
  });

});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

// ─── Window Controls ──────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window-close',    () => mainWindow?.close());
ipcMain.handle('get-system-info', async () => getSystemInfo());
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.on('open-folder', (_, p) => shell.openPath(p));

// ─── Fetch Info ───────────────────────────────────────────────────────────────
ipcMain.handle('fetch-info', async (_, url) => {
  return new Promise((resolve) => {
    const ytdlp = getBinPath('yt-dlp');
    if (!fs.existsSync(ytdlp)) return resolve({ error: 'yt-dlp.exe not found! Path: ' + ytdlp });

    const ffmpegPath = getBinPath('ffmpeg');
    const hasFfmpeg  = fs.existsSync(ffmpegPath);
    console.log('FFmpeg available:', hasFfmpeg, ffmpegPath);

    const args = ['--dump-json', '--no-playlist', '--socket-timeout', '20', '--no-warnings','--cookies-from-browser', getBestBrowser(), url];
    let output = '', errorOut = '';
    const proc = spawn(ytdlp, args);
    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { errorOut += d.toString(); });
    const timeout = setTimeout(() => { proc.kill(); resolve({ error: 'Timed out fetching video info.' }); }, 35000);

    proc.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) return resolve({ error: 'Could not fetch video info.\n' + errorOut.slice(0, 300) });
      try {
        const info = JSON.parse(output.split('\n')[0]);
        const formats = [];

        if (hasFfmpeg) {
          // With FFmpeg: offer qualities — will download best video+audio and merge to MP4
          const videoQualities = ['360', '480', '720', '1080', '1440', '2160'];
          videoQualities.forEach(q => {
            const found = (info.formats || []).find(f =>
              f.height && Math.abs(f.height - parseInt(q)) <= 30 &&
              f.vcodec && f.vcodec !== 'none'
            );
            if (found) {
              formats.push({
                type: 'video',
                quality: q + 'p',
                ext: 'mp4',
                formatId: found.format_id,
                needsMerge: true
              });
            }
          });
        } else {
          // Without FFmpeg: only pre-muxed MP4 formats (no separate streams, no merging)
          const prebuilt = (info.formats || []).filter(f =>
            f.vcodec && f.vcodec !== 'none' &&
            f.acodec && f.acodec !== 'none' &&
            f.ext === 'mp4'
          ).sort((a, b) => (b.height || 0) - (a.height || 0));

          const seen = new Set();
          prebuilt.forEach(f => {
            const q = f.height ? f.height + 'p' : 'unknown';
            if (!seen.has(q)) {
              seen.add(q);
              formats.push({ type: 'video', quality: q, ext: 'mp4', formatId: f.format_id, needsMerge: false });
            }
          });

          if (formats.length === 0) {
            formats.push({ type: 'video', quality: 'Best (MP4)', ext: 'mp4', formatId: 'best[ext=mp4]/best', needsMerge: false });
          }
        }

        if (formats.length === 0) {
          formats.push({ type: 'video', quality: 'Best', ext: 'mp4', formatId: 'best[ext=mp4]/best', needsMerge: false });
        }

        // Audio formats
        if (hasFfmpeg) {
          formats.push({ type: 'audio', quality: 'MP3 320kbps', ext: 'mp3', formatId: 'bestaudio/best', kbps: 320 });
          formats.push({ type: 'audio', quality: 'MP3 192kbps', ext: 'mp3', formatId: 'bestaudio/best', kbps: 192 });
          formats.push({ type: 'audio', quality: 'MP3 128kbps', ext: 'mp3', formatId: 'bestaudio/best', kbps: 128 });
        }
        formats.push({ type: 'audio', quality: 'M4A (original)', ext: 'm4a', formatId: 'bestaudio[ext=m4a]/bestaudio', kbps: 0 });

        resolve({
          title:       info.title       || 'Unknown',
          uploader:    info.uploader    || info.channel || '',
          duration:    info.duration    || 0,
          thumbnail:   info.thumbnail   || '',
          platform:    info.extractor_key || 'Unknown',
          view_count:  info.view_count  || 0,
          hasFfmpeg,
          formats,
          webpage_url: info.webpage_url || url
        });
      } catch (e) {
        resolve({ error: 'Failed to parse video info: ' + e.message });
      }
    });
  });
  function getBestBrowser() {
  const checks = [
    {
      name: 'edge',
      path: process.env.LOCALAPPDATA + '\\Microsoft\\Edge'
    },
    {
      name: 'chrome',
      path: process.env.LOCALAPPDATA + '\\Google\\Chrome'
    },
    {
      name: 'brave',
      path: process.env.LOCALAPPDATA + '\\BraveSoftware\\Brave-Browser'
    },
    {
      name: 'firefox',
      path: process.env.APPDATA + '\\Mozilla\\Firefox'
    }
  ];

  for (const b of checks) {
    if (fs.existsSync(b.path)) {
      console.log('Using browser cookies:', b.name);
      return b.name;
    }
  }

  return 'edge';
}
});

// ─── Download ─────────────────────────────────────────────────────────────────
const activeDownloads = new Map();

ipcMain.handle('start-download', async (_, { url, formatId, ext, quality, outputDir, kbps, type, title, needsMerge }) => {
  return new Promise((resolve) => {
    const ytdlp    = getBinPath('yt-dlp');
    const ffmpeg   = getBinPath('ffmpeg');
    const hasFfmpeg = fs.existsSync(ffmpeg);
    const sysInfo  = getSystemInfo();

    if (!fs.existsSync(outputDir)) {
      try { fs.mkdirSync(outputDir, { recursive: true }); } catch (e) {}
    }

    const safeTitle = (title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 80);
    const outputTemplate = path.join(outputDir, safeTitle + '.%(ext)s');

    let args = [
  '--no-playlist',
  '--socket-timeout', '30',
  '--retries', '5',
  '--fragment-retries', '5',
  '--concurrent-fragments', String(sysInfo.optimalThreads),
  '--progress',
  '--newline',
  '--no-quiet',
  '-o', outputTemplate,
  '--cookies-from-browser', getBestBrowser()
];

    if (hasFfmpeg) {
      args.push('--ffmpeg-location', path.dirname(ffmpeg));
    }

    if (type === 'audio') {
      if (hasFfmpeg && ext === 'mp3') {
        args.push('-x', '--audio-format', 'mp3');
        if (kbps && kbps > 0) args.push('--audio-quality', kbps + 'k');
        args.push('-f', 'bestaudio/best');
      } else {
        // M4A: download directly without conversion
        args.push('-f', 'bestaudio[ext=m4a]/bestaudio');
      }
    } else {
      if (hasFfmpeg && needsMerge) {
        // ✅ FIX: Prefer MP4-compatible codecs (H.264 + AAC) so FFmpeg outputs true MP4
        // Fallback chain ensures we always get something usable
        const h = quality?.replace('p', '') || '720';
        args.push(
          '-f',
          `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/` +
          `bestvideo[height<=${h}][vcodec^=avc]+bestaudio[acodec^=mp4a]/` +
          `bestvideo[height<=${h}]+bestaudio/` +
          `best[height<=${h}]/best`
        );
        // Force output container to MP4 and remux if needed
        args.push('--merge-output-format', 'mp4');
        args.push('--remux-video', 'mp4');
        // Clean up partial temp files on completion
        args.push('--no-keep-video');
      } else {
        // Without FFmpeg: use pre-muxed MP4 only
        args.push('-f', formatId || 'best[ext=mp4]/best');
      }
    }

    args.push(url);
    console.log('▶ Download args:', args.join(' '));

    const downloadId = Date.now().toString();
    const proc = spawn(ytdlp, args, { env: { ...process.env } });
    activeDownloads.set(downloadId, proc);

    resolve({ started: true, downloadId });

    let buffer = '';
    const parseProgress = (line) => {
      if (line.includes('[download]')) {
        const pctMatch = line.match(/(\d+\.?\d*)\s*%/);
        if (pctMatch) {
          const pct   = parseFloat(pctMatch[1]);
          const speed = (line.match(/([\d.]+\s*[KMG]iB\/s)/) || [])[1] || '';
          const eta   = (line.match(/ETA\s+([\d:]+)/)         || [])[1] || '';
          const size  = (line.match(/of\s+([\d.]+\s*[KMG]iB)/) || [])[1] || '';
          mainWindow?.webContents.send('download-progress', {
            downloadId, percent: Math.min(pct, 99), speed, eta, size
          });
        }
      }
      if (line.includes('[Merger]') || line.includes('[ffmpeg]') || line.includes('Merging') || line.includes('[VideoRemuxer]')) {
        mainWindow?.webContents.send('download-progress', {
          downloadId, percent: 99, speed: 'Merging to MP4...', eta: '', size: ''
        });
      }
    };

    const onData = (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(line => { console.log('[yt-dlp]', line); parseProgress(line); });
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('close', code => {
      activeDownloads.delete(downloadId);
      if (code === 0) {
        mainWindow?.webContents.send('download-progress', {
          downloadId, percent: 100, speed: '', eta: '', size: ''
        });
      } else {
        mainWindow?.webContents.send('download-progress', {
          downloadId, percent: -1, speed: '', eta: '', size: ''
        });
      }
    });
  });
});

ipcMain.on('cancel-download', (_, downloadId) => {
  const proc = activeDownloads.get(downloadId);
  if (proc) { proc.kill('SIGTERM'); activeDownloads.delete(downloadId); }
});
