// src/ui/debuglog.js — in-game command log (Settings → Advanced → Command log).
//
// A ring buffer of everything the UI asks the engine to do and everything that
// comes back: dispatches, rejections, ignored inputs, timeline lifecycle, and
// uncaught page errors. Exists so a stuck game can be diagnosed from inside the
// game — open the log, read the last commands, copy them into a bug report.
//
// THIS MODULE IS A LEAF, AND THAT IS LOAD-BEARING: fx.js imports `dlog`,
// tooltip.js imports fx.js, the shell imports tooltip.js and the kit
// re-exports the shell — so this file may not import the kit, or the graph
// closes into a loop that tools/bundle.mjs evaluates in one order (tooltip
// before fx: `viewportLocalBox is not a function` in the shipped bundle).
// The chrome — the failure banner as the kit's Blocker, the viewer as a lg
// door — lives in ui/components/debugChrome.js and registers itself here
// through registerDebugChrome(); main.js imports that module once. Until it
// has, a banner still stands (plain DOM wearing the kit's classes) — a
// failure at boot must never wait for chrome.

export const MAX_ENTRIES = 300;
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

// ---------------------------------------------------------------------------
// A CONTROL THAT STOPS WORKING TELLS SOMEONE
// ---------------------------------------------------------------------------
//
// The ☰ button died and the game said nothing. Measured on six channels at
// once: the TypeError is REAL and it IS emitted — CDP Runtime.exceptionThrown,
// a page `error` listener installed before navigation, the same listener
// installed after load, and the log below all carry it, identically over
// http:// and over the file:// bundle. Nothing swallows it and no listener is
// late. It is invisible to exactly two audiences, and they are the two that
// matter: THE PLAYER, who sees no change at all, and EVERY INSTRUMENT THIS
// HOUSE OWNS — not one tool in tools/ subscribes to an error channel.
//
// The game already captured it. This file has held the `error` listener below
// since long before anyone looked. THE RECORD WAS THERE THE WHOLE TIME, AND THE
// ONLY DOOR TO IT WAS THE THING THAT BROKE: mid-run, Settings → Advanced →
// Command log is reachable only through the overlay, because `onSettings` is
// handed to mountMap and mountCombat and read by neither. When the overlay is
// the control that died, the account of why it died is behind it.
//
// SO THE FIX IS NOT A FOURTH SUBSCRIBER. It is one banner, and the collapse is
// that it is the banner ALREADY IN THE TREE: main.js hand-built `.validation-
// banner` twice, for content validation and the surface join, and a third
// hand-built copy is exactly the defect I exist to catch. Both are gone; all
// three call failureBanner().
//
// AND IT IS WORTH MORE THAN A GUARD ON menuTabs() BECAUSE THE FAILURE IS NOW IN
// THE PAGE. tools/release-shots.mjs has ALWAYS scored a `.validation-banner` as
// a MISS. So it sees a throwing screen through an assertion it already had —
// and so does any other instrument that looks at a rendered page, with no
// subscription, no wiring, and nothing per-tool to rot. One report, two
// audiences.

const banners = new Map();

let chrome = null;
/** registerDebugChrome({ banner, door }) — the kit's pieces, handed in by ui/components/debugChrome.js. */
export function registerDebugChrome(impl) { chrome = impl; }

/** The banner without chrome: the same classes, plain DOM, for a failure before the chrome has loaded. */
function bareBanner({ title, body, onOpen }) {
  const node = document.createElement('div');
  node.className = 'as-blocker validation-banner';
  node.setAttribute('role', 'alert');
  const head = document.createElement('div');
  head.className = 'as-title-s';
  head.textContent = title;
  node.appendChild(head);
  for (const line of String(body).split('\n')) {
    const p = document.createElement('p');
    p.className = 'as-prose';
    p.textContent = line;
    node.appendChild(p);
  }
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'as-btn vb-log';
  open.textContent = 'Command log';
  open.addEventListener('click', onOpen);
  node.appendChild(open);
  const more = () => { const m = document.createElement('span'); m.className = 'as-flavor'; node.insertBefore(m, open); return m; };
  return { el: node, head, open, more };
}

// AND THE SCREEN IS FINITE — the half the dedupe does not cover. Deduping on
// the message string is right and it only reaches IDENTICAL messages; a message
// carrying a varying number ("reading 'card7'") never repeats, so N distinct
// failures are N banners, prepended down the page. Measured on the shipped
// bundle at 390x844, Text XL, six banners standing: THE TOPBAR SAT AT y=830.06
// IN AN 844 px VIEWPORT. The banner's own body sentence says "the game is still
// running", and there was fourteen pixels of it left to see.
//
// So the stack has a ceiling, and the overflow sentence is NOT a new idea: it
// is the one main.js already uses when the validation list is longer than the
// screen ("…and N more — all N are in the browser console.", #67, Sunna's D19).
// One truncation vocabulary in this game, not two. The door it names is the
// Command log rather than the console, because that is the door a PLAYER has.
//
// THREE is measured, not chosen: at the worst cell above three banners stand
// ~452 px tall, which leaves the topbar and the top of the map on screen. A
// fourth kind of failure becomes a number on the NEWEST banner — which is the
// topmost one, because these are prepended — and every one of them is still in
// the log that banner opens.
const MAX_BANNERS = 3;
const overflowed = new Set();

/**
 * failureBanner(key, title, body) → the banner element.
 *
 * One banner per distinct failure, DEDUPED BY KEY, because a person presses a
 * dead button more than once and three identical red blocks is not three facts.
 * A repeat bumps a count instead. Every banner carries the Command log door,
 * including the two boot checks, whose wording is unchanged.
 */
export function failureBanner(key, title, body) {
  if (typeof document === 'undefined' || !document.body) return null;
  const seen = banners.get(key);
  if (seen && seen.el.isConnected) {
    seen.n += 1;
    seen.head.textContent = `${title} (×${seen.n})`;
    return seen.el;
  }
  const standing = [...banners.values()].filter((b) => b.el.isConnected);
  if (standing.length >= MAX_BANNERS) {
    overflowed.add(key);
    const last = standing[standing.length - 1];
    if (!last.more) last.more = last.makeMore();
    const n = overflowed.size;
    last.more.textContent = ` · …and ${n} more kind${n === 1 ? '' : 's'} of failure — all of them are in the Command log.`;
    return last.el;
  }
  const built = (chrome ? chrome.banner : bareBanner)({ title, body, onOpen: () => openDebugLog() });
  document.body.prepend(built.el);
  banners.set(key, { el: built.el, head: built.head, open: built.open, makeMore: built.more, more: null, n: 1 });
  return built.el;
}

// Uncaught errors are invisible in most consoles players look at — capture them
// into the log so "it just stopped working" becomes a stack trace, AND raise the
// banner so it becomes something a player and an instrument can both see.
//
// `ev.message` is the filter, deliberately: an <img> that 404s is not a script
// error and must not raise this. Measured — a resource 404 was present in both
// the red and the green run and raised nothing.
if (typeof window !== 'undefined') {
  const where = (ev) => (ev.filename ? ` at ${String(ev.filename).split('/').pop()}:${ev.lineno}` : '');
  window.addEventListener('error', (ev) => {
    if (!ev.message) return;
    dlog('ERROR', String(ev.message), ev.error && ev.error.stack ? String(ev.error.stack).split('\n').slice(0, 4).join(' | ') : '');
    failureBanner(`uncaught:${ev.message}`, 'SOMETHING JUST STOPPED WORKING',
      `${ev.message}${where(ev)}\nThe game is still running. What you last pressed did not.`);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const msg = String((ev.reason && ev.reason.message) || ev.reason || 'unhandled promise rejection');
    dlog('ERROR', 'unhandled promise rejection', String((ev.reason && ev.reason.stack) || ev.reason).slice(0, 300));
    failureBanner(`rejection:${msg}`, 'SOMETHING JUST STOPPED WORKING',
      `${msg}\nThe game is still running. What you last asked for did not finish.`);
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
  if (chrome) return chrome.door();
  // No chrome registered: the log is still reachable, as text on the page.
  const pre = document.createElement('pre');
  pre.className = 'as-log debug-log-body';
  pre.textContent = logText();
  document.body.appendChild(pre);
  return null;
}
