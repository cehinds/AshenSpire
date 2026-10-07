// THE SUBSTEP'S WAY ON MUST OUTRANK THE STAGE'S SKIP.
//
// Character creation's equipment stage carries two Continues at once, and they
// mean opposite things:
//
//   .cc-equipment-continue   `Continue to Off Hand` — close the armament you
//                            came to choose and open the next one
//   .cz-stage .modal-btnrow.end
//                            `Continue to seed` — LEAVE equipment entirely
//
// #1003 pinned the second one to the scrollport floor so the way on never
// scrolls out of reach. Below 700px the first is pinned too, at `z-index:3`.
// Above 700px it stayed a static grid item — and a static element loses the
// paint order to a later, positioned sibling in the same band.
//
// MEASURED before the fix, scrolled so the section's Continue reached the
// floor: 1024x768, 1366x768, 1440x900, 760x900 and 900x700 all overlapped
// (28.8-43.8px vertically, 121.8-233px horizontally), and `elementFromPoint`
// at the section Continue's own centre returned `BUTTON.as-btn cz-next` at
// every one. A player pressing `Continue to Off Hand` reached `Continue to
// seed` and SKIPPED the armament.
//
// A grid item's containing block is its own one-row grid area, so this button
// cannot be made sticky above 700px (the reason the sticky rule is mobile
// only). It does not need travel — only rank.
//
// THE RULE THIS FILE HOLDS: wherever the stage row is pinned, the section's
// own Continue paints above it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');

let checks = 0;
const ok = (cond, what) => { checks++; assert.ok(cond, what); };

const declarations = (selector) => {
  const at = css.indexOf(`\n${selector}`);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  return open < 0 ? null : css.slice(open + 1, css.indexOf('}', open));
};

// ---- the stage row is the thing being outranked ------------------------------
const stage = declarations('.cz-stage .modal-btnrow.end,');
ok(!!stage, 'the stage-level Continue row is still pinned by a rule that can be read');
ok(/position:\s*sticky/.test(stage), 'the stage-level Continue row is sticky');
const stageZ = Number(stage.match(/z-index:\s*(\d+)/)?.[1]);
ok(Number.isFinite(stageZ), 'the stage-level Continue row names a z-index');

// ---- the section's own Continue outranks it, at every width ------------------
const section = declarations('.cc-equipment-continue {');
ok(!!section, "the equipment section's Continue still has a base rule");
// `position` is what lets the z-index apply at all: on a static element the
// z-index is ignored, which is exactly how the defect arrived.
ok(/position:\s*(relative|sticky|absolute|fixed)/.test(section),
  "the section's Continue is positioned, so its z-index applies");
const sectionZ = Number(section.match(/z-index:\s*(\d+)/)?.[1]);
ok(Number.isFinite(sectionZ), "the section's Continue names a z-index");
ok(sectionZ > stageZ,
  `the section's Continue (${sectionZ}) paints above the stage row (${stageZ})`);

// ---- and the narrow path still pins it, which is where it also needs travel --
const narrow = css.slice(css.indexOf('@media(max-width:700px)'));
// The narrow block styles this button twice — the grid reset, then the pin —
// so take the rule that actually carries the pin rather than the first match.
const mobile = [...narrow.matchAll(/\.cc-equipment-continue \{([^}]*)\}/g)]
  .map((match) => match[1]).find((body) => /position:\s*sticky/.test(body));
ok(!!mobile, "below 700px the section's Continue is still sticky");
const mobileZ = Number(mobile.match(/z-index:\s*(\d+)/)?.[1]);
ok(Number.isFinite(mobileZ) && mobileZ > stageZ,
  `below 700px it also paints above the stage row (${mobileZ} > ${stageZ})`);
// The flex switch is what gives sticky somewhere to travel; a grid item's
// containing block is its own one-row area and sticky there does nothing.
ok(/\.cc-equip-group\[data-equipment-section\] \{ display:flex; flex-direction:column;/.test(narrow),
  'below 700px the group is a column flex container, so sticky has travel');

console.log(`PASS ${checks}/${checks}; the equipment section's Continue outranks the stage's skip at every width`);
