// Debug mode's in-combat Console button. A small fixed button, rendered only
// while the `debugMode` setting is on, that opens the same console viewer as the
// combat log's Console button. It is deliberately OUTSIDE the combat input
// pipeline (no holdconfirm, no busy/drag guards, its own pointerup + click
// handlers) so it still works when combat input is stuck, which is the case it
// exists to capture.
import { el } from '../kit/index.js';
import { t } from '../strings.js';
import { openConsoleLog } from '../debuglog.js';

export function mountCombatDebugButton(combatEl, { readSettings = () => ({}) } = {}) {
  let node = null;
  let handle = null;
  let lastOpen = 0;
  const open = (event) => {
    event?.stopPropagation?.();
    // pointerup and the click that follows it are one tap.
    const now = Date.now();
    if (now - lastOpen < 400) return;
    lastOpen = now;
    if (handle && handle.panel?.isConnected) return;
    handle = openConsoleLog({ opener: node, onClose: () => { handle = null; } });
    if (event?.type === 'pointerup') {
      // The viewer now sits under the finger; the click that follows this
      // pointerup would land on its Close button. Swallow that one click.
      const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, true), 600);
    }
  };
  const sync = () => {
    const on = readSettings()?.debugMode === true;
    if (on && !node) {
      node = el('button', { type: 'button', class: 'combat-debug-console', 'data-combat-debug': 'console', text: t('debugChrome.console') });
      node.addEventListener('pointerup', open);
      node.addEventListener('click', open);
      // Keep the combat screen's own handlers (selection clearing) off this tap.
      node.addEventListener('pointerdown', event => event.stopPropagation());
      combatEl.append(node);
    } else if (!on && node) {
      node.remove(); node = null;
    }
    return node;
  };
  sync();
  return { sync, get node() { return node; }, release() { node?.remove(); node = null; } };
}
