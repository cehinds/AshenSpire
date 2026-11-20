import test from 'node:test';
import assert from 'node:assert/strict';
import { shopWorkspaceLayout } from '../src/ui/models/ShopWorkspaceModel.js';

import { wireframeUi } from '../src/content/wireframeUi.js';

// The columns were EVEN here until 2026-09-20, when `offersFraction` stopped
// being the answer and became the floor: the offers column is sized for the
// shelf of cards standing in it (tests/card-shelf.test.mjs owns that
// arithmetic). What this test still owns is the frame — rail or no rail,
// columns or stacked — and the one invariant that survived the change: the two
// fractions divide ONE pane.
test('wide frames put the rail beside two columns; compact frames stack', () => {
  const ui = wireframeUi.shop;
  const wide = shopWorkspaceLayout({ width: 1368, bodyHeight: 520, rem: 16 });
  assert.deepEqual([wide.mode, wide.rail, wide.pane], ['wide', 'side', 'columns']);
  assert.equal(wide.railWidth, Math.round(Math.min(Math.max(1368 * ui.railFraction, ui.railMinRem * 16), ui.railMaxRem * 16)));
  assert.equal(wide.offersFr + wide.detailFr, 1);
  assert.ok(wide.offersFr >= ui.offersFraction, 'the authored share is a floor, never a ceiling');
  assert.equal(wide.detailMax, null);
  const phone = shopWorkspaceLayout({ width: 356, bodyHeight: 400, rem: 16 });
  assert.deepEqual([phone.mode, phone.rail, phone.pane, phone.railWidth], ['compact', 'top', 'stacked', 0]);
  assert.equal(phone.detailMax, Math.floor(400 * ui.detailMaxFraction));
  // The switch is the configured frame width, in the measured rem.
  assert.equal(shopWorkspaceLayout({ width: ui.wideMinRem * 16, rem: 16 }).mode, 'wide');
  assert.equal(shopWorkspaceLayout({ width: ui.wideMinRem * 16 - 1, rem: 16 }).mode, 'compact');
  // The rail width is clamped to readable rems at both ends.
  assert.equal(shopWorkspaceLayout({ width: 4000, rem: 16 }).railWidth, ui.railMaxRem * 16);
});
