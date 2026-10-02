// Ashen Spire desktop wrapper — Electron main process.
// Serves a game folder unmodified (the Windows installer's `game\`, the Steam
// package's dist-embed, or the repo's dist) and shows it in a window; under the
// spike harness the preload probe measures boot-to-playable, gamepad API, and
// save persistence, and this file measures fullscreen toggle and clean quit.
const { app, BrowserWindow, ipcMain, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Spike runs pin userData so restart runs share inspectable storage; a real
// install keeps Electron's default (~/.config/AshenSpire on Linux,
// %APPDATA%\AshenSpire on Windows).
if (process.env.SPIKE_USERDATA) app.setPath('userData', process.env.SPIKE_USERDATA);
const USER_DATA = app.getPath('userData');

// HARDWARE ACCELERATION — and the seam Bjorn found (#70). This used to read
// `if (process.env.SPIKE_T0) app.disableHardwareAcceleration()`, so the wrapper
// behaved ONE WAY UNDER TEST AND ANOTHER FOR A PLAYER: with the spike variable
// set it ran, and a plain launch on a machine with no usable GPU hung forever
// with no window and no message. Measured here: `xvfb-run AshenSpire` exits 124
// on a 45s timeout; with the fallback below it boots.
//
// Keying real behaviour to a test-only variable is the defect, not the flag. So:
// an explicit opt-out anybody can use, and — because a player will not know to
// use it — an automatic, once-only relaunch when the GPU process actually dies.
const GPU_OFF_ENV = 'ASHEN_DISABLE_GPU';
const gpuOptOut = process.env[GPU_OFF_ENV] === '1' || process.argv.includes('--disable-gpu');
if (gpuOptOut) app.disableHardwareAcceleration();

// A GPU that never comes up produces no crash event, only silence, so silence
// is what we time out on: if nothing has painted shortly after start, relaunch
// once with acceleration off rather than leaving a player at a dead window.
// ASHEN_GPU_RETRY guards against a relaunch loop — the second attempt either
// works or fails visibly.
const gpuRetried = process.env.ASHEN_GPU_RETRY === '1';
function relaunchWithoutGpu(why) {
  if (gpuOptOut || gpuRetried) return false;
  console.warn(`[ashen] ${why} — relaunching once with hardware acceleration off`);
  app.relaunch({ args: process.argv.slice(1).concat('--disable-gpu') , env: { ...process.env, ASHEN_GPU_RETRY: '1' } });
  app.exit(0);
  return true;
}
app.on('child-process-gone', (_e, details) => {
  if (details && details.type === 'GPU') relaunchWithoutGpu('the GPU process went away');
});

// WHERE THE GAME IS. First match wins:
//   ASHEN_GAME_DIR          an explicit folder (testing)
//   <exe dir>\game          the Windows installer (desktop/windows/), the web
//                           edition with its packs/ and objects/ beside it
//   dist-embed/             the Steam package (package.sh)
//   ../../dist              a repo checkout
// Each holds AshenSpire.html.
const GAME_ENTRY = 'AshenSpire.html';
const GAME_DIR = [
  process.env.ASHEN_GAME_DIR,
  path.join(path.dirname(process.execPath), 'game'),
  path.join(__dirname, 'dist-embed'),
  path.join(__dirname, '..', '..', 'dist'),
].filter(Boolean).map((d) => path.resolve(d)).find((d) => fs.existsSync(path.join(d, GAME_ENTRY)));

// WHY HTTPS, NOT file://. The web edition loads its art packs, fonts, music and
// map tiles with fetch() and only over http(s) (src/ui/assetPacks.js isHttp);
// a single file reads music/ and map-detail/ beside itself the same way. So the
// game folder is served at a fixed https origin that never reaches the network:
// requests for GAME_HOST are answered from disk, every other https request
// passes through untouched (settings sync to GitHub). The origin is fixed, so
// localStorage — the saves — is the same on every launch. `.invalid` is a
// reserved name (RFC 2606): it can never be a real site.
const GAME_HOST = 'ashenspire.invalid';
const GAME_URL = `https://${GAME_HOST}/${GAME_ENTRY}`;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

async function serveGameFile(request) {
  const url = new URL(request.url);
  let rel;
  try { rel = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch { return new Response('bad path', { status: 400 }); }
  const file = path.resolve(GAME_DIR, rel || GAME_ENTRY);
  // Nothing outside the game folder is ever served.
  if (!file.startsWith(GAME_DIR + path.sep)) return new Response('forbidden', { status: 403 });
  try {
    const data = await fs.promises.readFile(file);
    return new Response(data, {
      headers: {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache',
      },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}

function serveGame() {
  protocol.handle('https', (request) => {
    if (new URL(request.url).hostname === GAME_HOST) return serveGameFile(request);
    return net.fetch(request, { bypassCustomProtocolHandlers: true });
  });
}

const out = (obj) => console.log('SPIKE ' + JSON.stringify(obj));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs ipcRenderer; page itself stays isolated
    },
  });

  // Links out of the game (credits, the repository) open in the player's
  // browser, never inside the game window.
  const isGame = (u) => { try { return new URL(u).hostname === GAME_HOST; } catch { return false; } };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isGame(url) && /^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isGame(url)) return;
    event.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });

  win.loadURL(GAME_URL);

  // The watchdog: 'ready-to-show' is the first proof a frame exists. If it has
  // not fired in time, the compositor never came up — that is the hang.
  let painted = false;
  win.once('ready-to-show', () => { painted = true; });
  const paintDeadline = setTimeout(() => {
    if (!painted) relaunchWithoutGpu('no frame after 12s');
  }, 12000);
  win.on('closed', () => clearTimeout(paintDeadline));

  // Measurement path only runs under the spike harness; a normal launch is
  // just the game in a window.
  if (!process.env.SPIKE_T0) return;

  ipcMain.once('spike-report', async (_ev, payload) => {
    out(payload);
    if (payload.event !== 'playable') { app.exit(2); return; }

    // Fullscreen toggle — both edges: enter and leave, verified on the window.
    const sizeJs = 'JSON.stringify({w: window.innerWidth, h: window.innerHeight})';
    const before = JSON.parse(await win.webContents.executeJavaScript(sizeJs));
    win.setFullScreen(true);
    await new Promise((r) => setTimeout(r, 800));
    const fsOn = win.isFullScreen();
    const during = JSON.parse(await win.webContents.executeJavaScript(sizeJs));
    win.setFullScreen(false);
    await new Promise((r) => setTimeout(r, 800));
    const fsOff = win.isFullScreen();
    const after = JSON.parse(await win.webContents.executeJavaScript(sizeJs));
    out({
      event: 'fullscreen',
      enter_ok: fsOn === true,
      leave_ok: fsOff === false,
      inner_before: before,
      inner_during: during,
      inner_after: after,
    });

    out({ event: 'quitting', userData: USER_DATA, quit_requested_at: Date.now() });
    app.quit(); // clean quit path — runner checks exit code 0
  });
}

// One window per player: a second launch focuses the first, so two copies
// never write the same saves at once.
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  if (!GAME_DIR) {
    const { dialog } = require('electron');
    dialog.showErrorBox('Ashen Spire', `The game files were not found (${GAME_ENTRY}). Reinstall the game.`);
    app.exit(1);
    return;
  }
  serveGame();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
