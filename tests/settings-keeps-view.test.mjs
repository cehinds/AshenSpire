import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { captureView, restoreView } from '../src/ui/screens/settings.js';

// A rebuild of the Settings pane drops the scroll offset and the focused
// control. captureView/restoreView carry both across a rebuild by shape and by
// the control's own key, so the menu stays where the player left it.

const PANE_INNER = '<div class="set-row"><input type="range" data-key="ui.zoom" aria-label="Zoom"></div>'
  + '<select data-key="ui.theme" class="set-choice-select"><option>a</option></select>';

function build(doc) {
  const root = doc.createElement('div');
  root.setAttribute('class', 'modal-body');
  const panel = doc.createElement('div');
  panel.setAttribute('class', 'as-pane set-panel');
  panel.setAttribute('id', 'set-panel');
  panel.innerHTML = PANE_INNER;
  root.appendChild(panel);
  doc.body.appendChild(root);
  return { root, panel };
}

test('scrollTop of a scroll container is restored after a rebuild', () => {
  withKitDom((dom) => {
    const { root, panel } = build(dom.document);
    panel.scrollTop = 420;
    const view = captureView(root);
    // Rebuild: the pane's contents are replaced and its scroll is reset.
    panel.innerHTML = PANE_INNER;
    panel.scrollTop = 0;
    restoreView(root, view);
    assert.equal(panel.scrollTop, 420);
  });
});

test('focus moves back to the control with the same key after a rebuild', () => {
  withKitDom((dom) => {
    const doc = dom.document;
    const { root, panel } = build(doc);
    const oldSelect = panel.querySelector('select[data-key="ui.theme"]');
    oldSelect.focus();
    const view = captureView(root);
    // The rebuild replaces every node, so the focused select is detached and
    // the page falls back to body.
    panel.innerHTML = PANE_INNER;
    doc.activeElement = doc.body;
    restoreView(root, view);
    const focused = doc.activeElement;
    assert.equal(focused.tagName, 'SELECT');
    assert.equal(focused.getAttribute('data-key'), 'ui.theme');
    assert.notEqual(focused, oldSelect, 'focus lands on the rebuilt control, not the detached one');
  });
});

test('restore with no matching control is a no-op', () => {
  withKitDom((dom) => {
    const doc = dom.document;
    const { root, panel } = build(doc);
    panel.querySelector('select[data-key="ui.theme"]').focus();
    const view = captureView(root);
    // The rebuilt pane has no such control and no scrolled node.
    panel.innerHTML = '<div class="set-row"><input type="range" data-key="ui.other"></div>';
    doc.activeElement = doc.body;
    assert.doesNotThrow(() => restoreView(root, view));
    assert.equal(doc.activeElement, doc.body, 'nothing matched, so focus is not moved');
    assert.doesNotThrow(() => restoreView(root, null));
    assert.doesNotThrow(() => restoreView(null, view));
  });
});
