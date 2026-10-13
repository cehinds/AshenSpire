// The phone's combat rectangles are unchanged by the desktop and widescreen
// retirement (owner, 2026-10-13: "Mobile layouts must be unchanged"). The
// fixture was captured on origin/dev before the change, for a 390x844 phone at
// UI zoom 0.91: the bands, the footer packing, the footer art and the resting
// hand at 3, 4, 5 and 7 cards, with and without a chooser. Any drift fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allocateCombatBands, packCombatFooter } from '../src/ui/models/CombatLayout.js';
import { handLayout, COMBAT_TOOLS_HEIGHT_PX } from '../src/ui/models/HandLayout.js';
import { footerArtHeight, footerArtWidth } from '../src/ui/models/FooterLayoutModel.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/phone-combat-geometry.json', import.meta.url), 'utf8'));

function phoneGeometry() {
  const zoom = 0.91, rem = 16 / zoom, width = 390 / zoom, height = 844 / zoom;
  const footerArtPx = footerArtHeight(width, zoom, 'mobile') * zoom;
  const out = {};
  out.bands = allocateCombatBands({ width, height, zoom, rem, compact: true, footerArtPx });
  out.bandsTablet = allocateCombatBands({ width, height, zoom, rem, compact: false, footerArtPx });
  out.footerWidth = footerArtWidth(width, zoom, 'mobile');
  out.footerHeight = footerArtHeight(width, zoom, 'mobile');
  out.footerPack = packCombatFooter({ width, height: out.bands.footer, zoom, rem });
  const hand = (count, extra = {}) => handLayout({ width: width - 2 / zoom, height: out.bands.hand - COMBAT_TOOLS_HEIGHT_PX / zoom,
    count, rem, zoom, compact: true, controlsHeight: 0, headroom: COMBAT_TOOLS_HEIGHT_PX / zoom, ...extra });
  out.hand = [3, 4, 5, 7].map(count => hand(count));
  out.handControls = hand(5, { controlsHeight: 40 / zoom, controlled: [0, 1, 2, 3, 4] });
  out.handTabletShape = handLayout({ width: 1000, height: 260, count: 5, rem: 16, zoom: 1, compact: false, headroom: 0 });
  return out;
}

test('the phone combat bands, footer and hand are unchanged from the origin/dev capture', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(phoneGeometry())), fixture);
});

test('the phone band plan never reads the wide sizing: its shares are the phone bands', () => {
  const zoom = 0.91, width = 390 / zoom, height = 844 / zoom;
  const bands = allocateCombatBands({ width, height, zoom, rem: 16 / zoom, compact: true, footerArtPx: 0 });
  assert.equal(bands.supported, true);
  assert.ok(Math.abs(bands.hud + bands.battlefield + bands.hand + bands.footer - height) < 1e-6);
});
