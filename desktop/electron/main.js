// Ashen Spire desktop wrapper — Electron main process (spike).
// Loads dist/AshenSpire.html unmodified; the preload probe measures
// boot-to-playable, gamepad API, and save persistence; this file measures
// fullscreen toggle and clean quit.
const { app, BrowserWindow, ipcMain } = require('electron');
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

// Packaged build carries the game beside main.js (dist-embed); the repo
// checkout serves it from ../../dist.
const GAME_HTML = [
  path.join(__dirname, 'dist-embed', 'AshenSpire.html'),
  path.join(__dirname, '..', '..', 'dist', 'AshenSpire.html'),
].find(fs.existsSync);

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

  win.loadFile(GAME_HTML);

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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
