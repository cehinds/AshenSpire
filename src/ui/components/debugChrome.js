// src/ui/components/debugChrome.js — the command log's chrome, on the kit.
//
// WHY THIS IS NOT INSIDE ui/debuglog.js. debuglog.js is a LEAF: fx.js imports
// its `dlog`, tooltip.js imports fx.js, the shell imports tooltip.js and the
// kit re-exports the shell. If debuglog.js imported the kit, the graph would
// close into a loop, and tools/bundle.mjs evaluates modules in one order —
// in that loop tooltip.js ran before fx.js and `viewportLocalBox` was not a
// function in the shipped bundle (release-shots MISS on title-slots). So the
// chrome lives here, imports the kit freely, and hands debuglog.js its two
// pieces through registerDebugChrome(); main.js imports this module once.

import { el, openModal, button, logBox, flavour, prose, titleS, blocker } from '../kit/index.js';
import { registerDebugChrome, logText, MAX_ENTRIES } from '../debuglog.js';
import { t } from '../strings.js';
import { consoleRecorder, consoleLogText } from '../consoleLog.js';
import { BUILD_STAMP_TEXT } from '../../buildversion.js';
import { saveTextFile } from '../services/saveTextFile.js';

/** The failure banner: the kit's Blocker with a Title·S, Prose and the one Button. */
function banner({ title, body, onOpen }) {
  const head = titleS(title, { tag: 'div' });
  const open = button({ label: t('settings.row.commandLog'), className: 'vb-log' });
  open.addEventListener('click', onOpen);
  const node = blocker('', { attrs: { class: 'validation-banner', role: 'alert' } });
  node.append(head, ...String(body).split('\n').map((line) => prose(line)), open);
  return { el: node, head, open, more: () => { const m = flavour(''); node.insertBefore(m, open); return m; } };
}

/** The log viewer: a lg door through openModal, the log as the kit's LogBox. */
function door() {
  const body = logBox('', { class: 'debug-log-body' });
  const copy = button({ label: 'Copy', id: 'dbg-copy' });
  const refresh = button({ label: t('debugChrome.refresh'), id: 'dbg-refresh' });
  const close = button({ label: 'Close', role: 'exit', id: 'dbg-close' });
  const modal = openModal({
    size: 'lg',
    className: 'debug-modal',
    eyebrow: 'Advanced',
    title: t('settings.row.commandLog'),
    body: el('div', { class: 'as-pane' }, [
      flavour(`The last ${MAX_ENTRIES} commands and results between the interface and the engine, newest at the bottom. Copy this into a bug report if the game misbehaves.`),
      body,
    ]),
    secondary: [copy, refresh],
    primary: close,
    footSize: 'short',
  });
  modal.veil.style.zIndex = '700'; // above the in-run overlay
  const fill = () => {
    body.textContent = logText();
    body.scrollTop = body.scrollHeight;
  };
  fill();
  refresh.addEventListener('click', fill);
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(logText());
      copy.textContent = t('common.copied');
    } catch (e) {
      // Clipboard blocked (e.g. file://): select the text for manual copy.
      const range = document.createRange();
      range.selectNodeContents(body);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      copy.textContent = 'Select+Ctrl C';
    }
    setTimeout(() => (copy.textContent = 'Copy'), 1500);
  });
  close.addEventListener('click', modal.close);
  return modal;
}

/** Session console viewer: event-driven updates, touch-selectable text, shared focus/escape. */
function consoleDoor({ opener = document.activeElement, onClose = null } = {}) {
  const body = el('textarea', { class: 'console-log-text', readonly: '', 'aria-label': 'Console output', wrap: 'soft', spellcheck: 'false' });
  const status = el('p', { class: 'as-flavor', role: 'status', 'aria-live': 'polite' });
  const copy = button({ label: 'Copy', id: 'console-copy' });
  const download = button({ label: 'Export', id: 'console-export' });
  const close = button({ label: 'Close', role: 'exit' });
  let closed = false, queued = false, manual = false;
  const text = () => consoleLogText({ Build: BUILD_STAMP_TEXT, Device: globalThis.navigator?.userAgent || 'unavailable',
    Viewport: `${window.innerWidth} × ${window.innerHeight}`, 'Device pixel ratio': window.devicePixelRatio || 1 });
  const fill = () => {
    const top = body.scrollTop;
    const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 4;
    body.value = text();
    body.scrollTop = atEnd ? body.scrollHeight : top;
  };
  const unsubscribe = consoleRecorder.subscribe(() => {
    if (queued || closed || manual) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (!closed && !manual) fill(); });
  });
  const modal = openModal({ size: 'lg', className: 'console-modal', title: 'Console', opener,
    body: el('div', { class: 'console-log-pane' }, [flavour('Game console output and uncaught errors from this session. Browser network and DevTools-only messages may be unavailable. Review messages before sharing.'), body, status]),
    secondary: [copy, download], primary: close, footSize: 'short',
    onClose: () => { closed = true; unsubscribe(); onClose?.(); },
  });
  modal.veil.style.zIndex = '700';
  modal.veil.setAttribute('data-combat-read-only', '');
  fill();
  body.scrollTop = body.scrollHeight;
  copy.addEventListener('click', async () => {
    const snapshot = text();
    try {
      await navigator.clipboard.writeText(snapshot);
      if (!closed) status.textContent = 'Copied.';
    } catch {
      if (closed) return;
      manual = true;
      body.value = snapshot;
      body.focus();
      body.select();
      status.textContent = 'Text selected. Touch and hold to copy, or use your copy shortcut. Live updates are paused until you reopen Console.';
    }
  });
  download.addEventListener('click', async () => {
    download.disabled = true;
    const result = await saveTextFile(text());
    if (closed) return;
    download.disabled = false;
    status.textContent = result.ok ? result.method === 'share' ? 'Shared.' : 'Download requested.'
      : result.method === 'cancelled' ? 'Export cancelled.' : 'Export unavailable. Use Copy, or select the console text to copy it.';
  });
  close.addEventListener('click', modal.close);
  return modal;
}

registerDebugChrome({ banner, door, consoleDoor });

/** Imported by name from main.js: tools/bundle.mjs has no bare side-effect import, and this module must load once. */
export const DEBUG_CHROME_READY = true;
