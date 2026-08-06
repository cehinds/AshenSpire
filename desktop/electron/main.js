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

if (process.env.SPIKE_T0) app.disableHardwareAcceleration(); // Xvfb has no GL; keep timing noise down.

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
