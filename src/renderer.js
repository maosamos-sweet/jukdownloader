const state = {
  videoInfo: null,
  selectedFormat: 'video',
  selectedQuality: null,
  downloadDir: null,
  activeDownloadId: null,
  history: []
};

try { state.history = JSON.parse(localStorage.getItem('juk_history') || '[]'); } catch(e) {}

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function formatDuration(secs) {
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = Math.floor(secs%60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function formatNum(n) {
  if (n>=1e9) return (n/1e9).toFixed(1)+'B';
  if (n>=1e6) return (n/1e6).toFixed(1)+'M';
  if (n>=1e3) return (n/1e3).toFixed(1)+'K';
  return String(n);
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}


async function init() {

  try {
  const version = await window.vortex.getAppVersion();

  const versionEl = document.getElementById('appVersion');
  if (versionEl) {
    versionEl.textContent = `Version ${version}`;
  }
} catch (e) {
  console.error('Version error:', e);
}
  // Window controls
  $('btnMin').onclick   = () => window.vortex.minimize();
  $('btnMax').onclick   = () => window.vortex.maximize();
  $('btnClose').onclick = () => window.vortex.close();

  // Tabs
  $$('.nav-item').forEach(btn => {
    btn.onclick = () => {
      $$('.nav-item').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.add('active');
    };
  });

  // URL
  $('btnFetch').onclick = fetchInfo;
  $('urlInput').onkeydown = e => { if (e.key === 'Enter') fetchInfo(); };
  $('btnClear').onclick = () => { $('urlInput').value = ''; hideAll(); };

  // Format type
  $$('.fmt-type').forEach(btn => {
    btn.onclick = () => {
      $$('.fmt-type').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedFormat = btn.dataset.fmt;
      renderQualities();
    };
  });

  // Download controls
  $('btnDownload').onclick        = startDownload;
  $('btnCancel').onclick          = cancelDownload;
  $('btnChooseFolder').onclick    = chooseFolder;
  $('btnOpenFolder').onclick      = () => window.vortex.openFolder(state.downloadDir);
  $('btnDownloadAnother').onclick = resetForNew;
  $('btnClearHistory').onclick    = clearHistory;
  $('btnSettingsFolder').onclick  = chooseFolder;

  // System info
  try {
    const info = await window.vortex.getSystemInfo();
    $('cpuInfo').textContent = `CPU×${info.cpuCount} · ${info.optimalThreads}T`;
    $('sysInfoGrid').innerHTML = `
      <div class="sys-row"><span class="label">CPU Cores</span><span class="value">${info.cpuCount}</span></div>
      <div class="sys-row"><span class="label">Threads</span><span class="value">${info.optimalThreads} (auto)</span></div>
      <div class="sys-row"><span class="label">Total RAM</span><span class="value">${info.totalMem} GB</span></div>
      <div class="sys-row"><span class="label">Free RAM</span><span class="value">${info.freeMem} GB</span></div>
      <div class="sys-row"><span class="label">Platform</span><span class="value">${info.platform}</span></div>
    `;
    state.downloadDir = localStorage.getItem('juk_dir') ||
      (info.platform === 'win32'
        ? (process?.env?.USERPROFILE || 'C:\\Users\\User') + '\\Downloads'
        : (process?.env?.HOME || '') + '/Downloads');
    updateFolderDisplay();
  } catch(e) { console.error('getSystemInfo error:', e); }

  window.vortex.onProgress(handleProgress);
  renderHistory();
}

async function fetchInfo() {
  const url = $('urlInput').value.trim();
  if (!url) { showError('Please paste a video URL first.'); return; }
  if (!url.startsWith('http')) { showError('URL must start with http:// or https://'); return; }

  hideAll();
  $('fetchLoader').style.display = 'flex';
  $('btnFetch').disabled = true;

  const info = await window.vortex.fetchInfo(url);
  $('fetchLoader').style.display = 'none';
  $('btnFetch').disabled = false;

  if (info.error) { showError(info.error); return; }

  state.videoInfo = info;
  state.selectedFormat = 'video';
  $$('.fmt-type').forEach(b => b.classList.toggle('active', b.dataset.fmt === 'video'));

  $('prevThumb').src            = info.thumbnail || '';
  $('prevTitle').textContent    = info.title || 'Unknown Title';
  $('prevPlatform').textContent = info.platform || 'Unknown';
  $('prevUploader').textContent = info.uploader || '';
  $('prevViews').textContent    = info.view_count ? formatNum(info.view_count) + ' views' : '';
  $('prevDuration').textContent = info.duration   ? formatDuration(info.duration) : '';

  // Show ffmpeg warning if not available
  if (!info.hasFfmpeg) {
    showNotice('⚠️ FFmpeg not found in bin folder — only pre-built MP4 qualities are available. MP3 conversion disabled.');
  }

  renderQualities();
  $('previewSection').style.display = 'block';
}

function renderQualities() {
  const grid = $('qualityGrid');
  grid.innerHTML = '';
  if (!state.videoInfo) return;

  const formats = state.videoInfo.formats.filter(f => f.type === state.selectedFormat);
  if (formats.length === 0) {
    grid.innerHTML = '<span style="color:var(--text-2);font-size:12px">No formats available for this type</span>';
    return;
  }

  formats.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.className = 'quality-btn' + (i === 0 ? ' selected' : '');
    btn.textContent = f.quality;
    btn.onclick = () => {
      $$('.quality-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedQuality = f;
    };
    grid.appendChild(btn);
  });
  state.selectedQuality = formats[0] || null;
}

async function startDownload() {
  if (!state.videoInfo || !state.selectedQuality) {
    showError('Please fetch a video and select quality first.');
    return;
  }
  $('btnDownload').disabled = true;
  $('progressSection').style.display = 'block';
  $('doneSection').style.display = 'none';
  $('errorBox').style.display = 'none';
  $('noticeBox') && ($('noticeBox').style.display = 'none');

  const q = state.selectedQuality;
  $('progressLabel').textContent = `Downloading ${q.type === 'audio' ? '🎵' : '🎬'} · ${q.quality}`;
  $('progressBar').style.width = '0%';
  $('progressPct').textContent = '0%';

  const result = await window.vortex.startDownload({
    url:        state.videoInfo.webpage_url || $('urlInput').value.trim(),
    formatId:   q.formatId,
    ext:        q.ext,
    quality:    q.quality,
    outputDir:  state.downloadDir,
    kbps:       q.kbps || 0,
    type:       q.type,
    title:      state.videoInfo.title,
    needsMerge: q.needsMerge || false
  });

  if (result.started) {
    state.activeDownloadId = result.downloadId;
  } else {
    showError(result.error || 'Download failed to start.');
    $('btnDownload').disabled = false;
  }
}

function handleProgress(data) {
  if (data.downloadId !== state.activeDownloadId) return;

  const pct = Math.round(data.percent);

  // Download failed (exit code != 0)
  if (pct === -1) {
    $('progressSection').style.display = 'none';
    showError('Download failed. Please try a different quality or check your internet.');
    $('btnDownload').disabled = false;
    state.activeDownloadId = null;
    return;
  }

  $('progressBar').style.width  = Math.max(pct, 0) + '%';
  $('progressPct').textContent  = Math.max(pct, 0) + '%';
  if (data.speed) $('progressSpeed').textContent = data.speed;
  if (data.eta)   $('progressEta').textContent   = 'ETA: ' + data.eta;
  if (data.size)  $('progressSize').textContent  = data.size;

  if (pct >= 100) {
    setTimeout(() => {
      $('progressSection').style.display = 'none';
      $('doneSection').style.display = 'flex';
      $('doneFile').textContent = state.downloadDir;
      $('btnDownload').disabled = false;
      state.activeDownloadId = null;
      addToHistory({
        title:    state.videoInfo?.title || 'Unknown',
        platform: state.videoInfo?.platform || '',
        quality:  state.selectedQuality?.quality || '',
        type:     state.selectedQuality?.type || 'video',
        date:     new Date().toLocaleDateString()
      });
    }, 600);
  }
}

function cancelDownload() {
  if (state.activeDownloadId) { window.vortex.cancelDownload(state.activeDownloadId); state.activeDownloadId = null; }
  $('progressSection').style.display = 'none';
  $('btnDownload').disabled = false;
}

async function chooseFolder() {
  const folder = await window.vortex.chooseFolder();
  if (folder) { state.downloadDir = folder; localStorage.setItem('juk_dir', folder); updateFolderDisplay(); }
}

function addToHistory(item) {
  state.history.unshift(item);
  if (state.history.length > 100) state.history.pop();
  try { localStorage.setItem('juk_history', JSON.stringify(state.history)); } catch(e) {}
  renderHistory();
}

function renderHistory() {
  const list = $('historyList');
  if (!state.history.length) {
    list.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>No download history yet</p></div>`;
    return;
  }
  list.innerHTML = state.history.map(item => `
    <div class="history-item">
      <div class="item-icon">${item.type === 'audio' ? '🎵' : '🎬'}</div>
      <div class="item-details">
        <div class="item-title">${escHtml(item.title)}</div>
        <div class="item-meta">${escHtml(item.platform)} · ${escHtml(item.quality)} · ${escHtml(item.date)}</div>
      </div>
    </div>`).join('');
}

function clearHistory() {
  state.history = [];
  try { localStorage.removeItem('juk_history'); } catch(e) {}
  renderHistory();
}

function showError(msg) {
  $('errorBox').style.display = 'flex';
  $('errorMsg').textContent   = msg;
  $('previewSection').style.display = 'none';
  $('fetchLoader').style.display    = 'none';
}

function showNotice(msg) {
  let box = $('noticeBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'noticeBox';
    box.style.cssText = 'display:flex;align-items:center;gap:10px;background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.4);border-radius:10px;padding:12px 16px;color:#f5c842;font-size:13px;margin-bottom:16px;';
    $('previewSection').insertAdjacentElement('beforebegin', box);
  }
  box.textContent = msg;
  box.style.display = 'flex';
}

function hideAll() {
  $('previewSection').style.display  = 'none';
  $('errorBox').style.display        = 'none';
  $('fetchLoader').style.display     = 'none';
  $('doneSection').style.display     = 'none';
  $('progressSection').style.display = 'none';
  const nb = $('noticeBox');
  if (nb) nb.style.display = 'none';
}

function resetForNew() {
  $('urlInput').value = '';
  hideAll();
  state.videoInfo = null;
  state.activeDownloadId = null;
}

function updateFolderDisplay() {
  $('folderDisplay').textContent         = state.downloadDir || '';
  $('settingsFolderDisplay').textContent = state.downloadDir || '';
}

window.addEventListener('DOMContentLoaded', init);