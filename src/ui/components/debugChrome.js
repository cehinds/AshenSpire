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

/** The failure banner: the kit's Blocker with a Title·S, Prose and the one Button. */
function banner({ title, body, onOpen }) {
  const head = titleS(title, { tag: 'div' });
  const open = button({ label: 'Command log', className: 'vb-log' });
  open.addEventListener('click', onOpen);
  const node = blocker('', { attrs: { class: 'validation-banner', role: 'alert' } });
  node.append(head, ...String(body).split('\n').map((line) => prose(line)), open);
  return { el: node, head, open, more: () => { const m = flavour(''); node.insertBefore(m, open); return m; } };
}

/** The log viewer: a lg door through openModal, the log as the kit's LogBox. */
function door() {
  const body = logBox('', { class: 'debug-log-body' });
  const copy = button({ label: 'Copy', id: 'dbg-copy' });
  const refresh = button({ label: 'Refresh', id: 'dbg-refresh' });
  const close = button({ label: 'Close', weight: 'primary', id: 'dbg-close' });
  const modal = openModal({
    size: 'lg',
    className: 'debug-modal',
    eyebrow: 'Advanced',
    title: 'Command log',
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
      copy.textContent = 'Copied';
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

registerDebugChrome({ banner, door });

/** Imported by name from main.js: tools/bundle.mjs has no bare side-effect import, and this module must load once. */
export const DEBUG_CHROME_READY = true;
