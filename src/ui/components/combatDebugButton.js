// Debug mode's in-combat Console button. A small fixed button, rendered only
// while the `debugMode` setting is on, that opens the same console viewer as the
// combat log's Console button. It is deliberately OUTSIDE the combat input
// pipeline (no holdconfirm, no busy/drag guards, its own click handler;
// opening on pointerup would put the viewer under the finger and the click that
// follows would land on its Close button) so it still works when combat input is stuck, which is the case it
// exists to capture.
import { el } from '../kit/index.js';
import { t } from '../strings.js';
import { openConsoleLog } from '../debuglog.js';

export function mountCombatDebugButton(combatEl, { readSettings = () => ({}) } = {}) {
  let node = null;
  let handle = null;
  const open = (event) => {
    event?.stopPropagation?.();
    if (handle && handle.panel?.isConnected) return;
    handle = openConsoleLog({ opener: node, onClose: () => { handle = null; } });
  };
  const sync = () => {
    const on = readSettings()?.debugMode === true;
    if (on && !node) {
      node = el('button', { type: 'button', class: 'combat-debug-console', 'data-combat-debug': 'console', text: t('debugChrome.console') });
      node.addEventListener('click', open);
      // Keep the combat screen's own handlers (selection clearing) off this tap.
      for (const type of ['pointerdown', 'pointerup']) node.addEventListener(type, event => event.stopPropagation());
      combatEl.append(node);
    } else if (!on && node) {
      node.remove(); node = null;
    }
    return node;
  };
  sync();
  return { sync, get node() { return node; }, release() { node?.remove(); node = null; } };
}
