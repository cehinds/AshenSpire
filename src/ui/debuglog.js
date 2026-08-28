// src/ui/debuglog.js — in-game command log (Settings → Advanced → Command log).
//
// A ring buffer of everything the UI asks the engine to do and everything that
// comes back: dispatches, rejections, ignored inputs, timeline lifecycle, and
// uncaught page errors. Exists so a stuck game can be diagnosed from inside the
// game — open the log, read the last commands, copy them into a bug report.

const MAX_ENTRIES = 300;
const entries = [];

/** Append one entry: dlog('dispatch', 'playCard strike_3 -> e1', {events: 12}) */
export function dlog(kind, msg, data) {
  let detail = '';
  if (data !== undefined) {
    try {
      detail = typeof data === 'string' ? data : JSON.stringify(data);
    } catch (e) {
      detail = String(data);
    }
  }
  entries.push({ time: new Date(), kind, msg, detail });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export function getEntries() {
  return entries;
}

// Uncaught errors are invisible in most consoles players look at — capture them
// into the log so "it just stopped working" becomes a stack trace.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => {
    dlog('ERROR', String(ev.message || 'uncaught error'), ev.error && ev.error.stack ? String(ev.error.stack).split('\n').slice(0, 4).join(' | ') : '');
  });
  window.addEventListener('unhandledrejection', (ev) => {
    dlog('ERROR', 'unhandled promise rejection', String((ev.reason && ev.reason.stack) || ev.reason).slice(0, 300));
  });
}

function formatEntry(e) {
  const hh = String(e.time.getHours()).padStart(2, '0');
  const mm = String(e.time.getMinutes()).padStart(2, '0');
  const ss = String(e.time.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} [${e.kind}] ${e.msg}${e.detail ? ' :: ' + e.detail : ''}`;
}

/** The whole log as copyable text (plus live engine/fx state header). */
export function logText() {
  const fx = typeof window !== 'undefined' && window.__fx ? JSON.stringify(window.__fx) : 'n/a';
  const c = typeof window !== 'undefined' ? window.__combat : null;
  const state = c ? `phase=${c.phase} result=${c.result} hand=${c.piles.hand.length} energy=${c.player.energy}` : 'no combat';
  const head = `AshenSpire command log — ${new Date().toISOString()}\nstate: ${state}\ntimelines: ${fx}\n---`;
  return [head, ...entries.map(formatEntry)].join('\n');
}

/** Open the log viewer modal (usable over the in-run overlay). */
export function openDebugLog() {
  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.style.zIndex = '700'; // above the in-run overlay
  veil.innerHTML = `
    <div class="modal debug-modal">
      <h2>COMMAND LOG</h2>
      <p class="set-note">The last ${MAX_ENTRIES} commands and results between the interface and the engine, newest at the bottom. Copy this into a bug report if the game misbehaves.</p>
      <pre class="debug-log-body"></pre>
      <div class="set-actions" style="gap:8px">
        <button class="subtle" id="dbg-copy">Copy</button>
        <button class="subtle" id="dbg-refresh">Refresh</button>
        <button id="dbg-close">Close</button>
      </div>
    </div>`;
  document.body.appendChild(veil);

  const body = veil.querySelector('.debug-log-body');
  const fill = () => {
    body.textContent = logText();
    body.scrollTop = body.scrollHeight;
  };
  fill();

  veil.querySelector('#dbg-refresh').addEventListener('click', fill);
  veil.querySelector('#dbg-copy').addEventListener('click', async () => {
    const btn = veil.querySelector('#dbg-copy');
    try {
      await navigator.clipboard.writeText(logText());
      btn.textContent = 'Copied';
    } catch (e) {
      // Clipboard blocked (e.g. file://): select the text for manual copy.
      const range = document.createRange();
      range.selectNodeContents(body);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = 'Select+Ctrl C';
    }
    setTimeout(() => (btn.textContent = 'Copy'), 1500);
  });
  const close = () => veil.remove();
  veil.querySelector('#dbg-close').addEventListener('click', close);
  veil.addEventListener('click', (e) => {
    if (e.target === veil) close();
  });
}
