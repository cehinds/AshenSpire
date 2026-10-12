import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCombatBands, packCombatFooter } from '../src/ui/models/CombatLayout.js';
import { footerArtHeight, footerArtWidth } from '../src/ui/models/FooterLayoutModel.js';

// Phone compact bands are pinned: the desktop band work must not move them.
// Values were captured on the pre-desktop tree for the same inputs that
// combatLayout.js derives from a 360x620 and a 390x844 viewport.
const PHONE = [
  { w: 360, h: 620, zoom: 0.79, bands: { hud: 70.63291139240506, battlefield: 354.43037974683546, hand: 243.2911392405063, footer: 116.45569620253164 },
    footer: { diameter: 81.01265822784809, pileWidth: 63.291139240506325, endWidth: 121.51898734177215 },
    artW: 455.69620253164555, artH: 81.01265822784809 },
  { w: 390, h: 844, zoom: 0.9, bands: { hud: 84.39999999999999, battlefield: 473.3777777777777, hand: 277.77777777777777, footer: 102.22222222222221 },
    footer: { diameter: 71.11111111111111, pileWidth: 55.55555555555556, endWidth: 106.66666666666666 },
    artW: 433.3333333333333, artH: 71.11111111111111 },
];

const near = (a, b) => Math.abs(a - b) < 1e-9;

for (const phone of PHONE) {
  test(`phone compact bands at ${phone.w}x${phone.h} are unchanged`, () => {
    const { w, h, zoom } = phone;
    const width = w / zoom, height = h / zoom, rem = 16 / zoom;
    const footerArtPx = footerArtHeight(width, zoom) * zoom;
    const bands = allocateCombatBands({ width, height, zoom, rem, compact: true, footerArtPx });
    const footer = packCombatFooter({ width, height: bands.footer, zoom, rem });
    for (const key of Object.keys(phone.bands)) assert.ok(near(bands[key], phone.bands[key]), `${key} ${bands[key]}`);
    assert.ok(near(footer.diameter, phone.footer.diameter), `diameter ${footer.diameter}`);
    assert.ok(near(footer.pileWidth, phone.footer.pileWidth), `pileWidth ${footer.pileWidth}`);
    assert.ok(near(footer.endWidth, phone.footer.endWidth), `endWidth ${footer.endWidth}`);
    assert.ok(near(footerArtWidth(width, zoom), phone.artW), `footer art width ${footerArtWidth(width, zoom)}`);
    assert.ok(near(footerArtHeight(width, zoom), phone.artH), `footer art height ${footerArtHeight(width, zoom)}`);
    assert.equal(bands.arrangement, 'stacked');
    assert.equal(bands.supported, true);
  });
}
