// Does the PACKAGED app actually render? Launches it plainly (no spike env, no
// --disable-gpu), attaches over CDP and checks the title screen painted.
// Run:   node desktop/electron/render-check.mjs <path-to-packaged-binary>
// Env:   PKG_PORT (debug port, default 9741). Needs xvfb-run.
// Exit:  0 pass, 1 no target / nothing painted, 2 wrong target.
import { spawn } from 'node:child_process';

/**
 * @typedef {object} CdpTarget
 * @property {string} type
 * @property {string} url
 * @property {string} webSocketDebuggerUrl
 */

const BIN = process.argv[2];
const PORT = Number(process.env.PKG_PORT || 9741);
const DEBUG_URL = `http://127.0.0.1:${PORT}`;

/** @param {number} milliseconds */
function sleep(milliseconds)
{
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
async function fetchJson(path)
{
  const response = await fetch(`${DEBUG_URL}${path}`);
  return await response.json();
}

// ---- 1. Launch the packaged app ----

const launchArgs = [
  '-a',
  BIN,
  '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
];
const launchEnv = {
  ...process.env,
  SPIKE_T0: '',
  SPIKE_MODE: '',
  SPIKE_USERDATA: '',
};
/** @type {import('node:child_process').SpawnOptions} */
const launchOptions = {
  stdio: 'ignore',
  env: launchEnv,
};
const proc = spawn('xvfb-run', launchArgs, launchOptions);

/**
 * @param {number} exitCode
 * @returns {never}
 */
function killAndExit(exitCode)
{
  proc.kill('SIGKILL');
  process.exit(exitCode);
}

// ---- 2. Wait for a debug target (up to 60 x 1s) ----

/** @type {CdpTarget[] | null} */
let targets = null;
const startedAt = Date.now();
for (let attempt = 0; attempt < 60; attempt++)
{
  await sleep(1000);
  try
  {
    const targetList = await fetchJson('/json/list');
    if (targetList.length)
    {
      targets = targetList;
      break;
    }
  }
  catch
  {
    // Debug port not up yet; try again.
  }
}
if (!targets)
{
  console.log('NO TARGET — the packaged app never exposed a page (this is the hang)');
  killAndExit(1);
}

// ---- 3. Confirm the target is our app ----
// A stray HeadlessChrome once answered this port and a "PASS" measured the
// wrong browser. The page must be the game's URL (file:// or the wrapper's
// https://ashenspire.invalid/ origin, main.js) and the browser must be Electron.

const version = await fetchJson('/json/version');
const userAgent = version['User-Agent'] || '';
const page = /** @type {CdpTarget} */ (targets.find((target) => target.type === 'page'));
const isElectron = /Electron/i.test(userAgent);
const isGameUrl = /^(file:\/\/|https:\/\/ashenspire\.invalid\/)/.test(page.url);
const isOurs = isElectron && isGameUrl && /AshenSpire/.test(page.url);
if (!isOurs)
{
  console.log(`WRONG TARGET — refusing to measure. browser=${userAgent.slice(0, 60)} url=${page.url.slice(0, 70)}`);
  killAndExit(2);
}
const secondsToAttach = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`target confirmed: Electron, ${page.url.slice(-38)}`);
console.log(`attached in ${secondsToAttach}s · ${targets.length} target(s) · url=${targets[0].url.slice(0, 60)}`);

// ---- 4. Connect over CDP ----

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) =>
{
  socket.onopen = resolve;
  socket.onerror = reject;
});

let lastMessageId = 0;
/** @type {Map<number, { resolve: (result: any) => void }>} */
const pendingReplies = new Map();

/** @param {MessageEvent} event */
socket.onmessage = (event) =>
{
  const reply = JSON.parse(event.data);
  const pending = reply.id != null ? pendingReplies.get(reply.id) : undefined;
  if (pending)
  {
    pendingReplies.delete(reply.id);
    pending.resolve(reply.result);
  }
};

/**
 * @param {string} method
 * @param {object} [params]
 * @returns {Promise<any>}
 */
function send(method, params = {})
{
  const messageId = ++lastMessageId;
  const message = { id: messageId, method, params };
  socket.send(JSON.stringify(message));
  /** @type {Promise<any>} */
  const reply = new Promise((resolve) => pendingReplies.set(messageId, { resolve }));
  return reply;
}

/**
 * @param {string} expression
 * @returns {Promise<any>}
 */
async function evaluateInPage(expression)
{
  const params = { expression, returnByValue: true };
  /** @type {any} */
  const reply = await send('Runtime.evaluate', params);
  return reply.result.value;
}

await send('Runtime.enable');

// ---- 5. Read the title screen ----

await sleep(2500);
/** @type {{ title: string, buttons: string[], textLen: number } | null} */
const seen = await evaluateInPage(`({
  title: document.title,
  buttons: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).slice(0,3),
  textLen: document.body.innerText.length,
})`);
console.log('RENDERED:', JSON.stringify(seen));

// ---- 6. Verdict ----

const hasStartButton = seen && seen.textLen > 0 && seen.buttons.some((button) => /climb|continue|new/i.test(button));
if (hasStartButton)
{
  console.log('PASS — the packaged app boots and paints its title screen on a PLAIN launch');
}
else
{
  console.log('FAIL — attached but nothing playable painted');
}
killAndExit(hasStartButton ? 0 : 1);
