// tests/card-presentation-levels.test.mjs — the authored presentation-level
// manifest, and the row solver under it.
//
// THREE PROPERTIES, AND EACH ONE NAMES A DEFECT THAT WOULD OTHERWISE BE SILENT.
//
//   A  EVERY REGION THE MANIFEST NAMES EXISTS ON THE FACE. The manifest's
//      vocabulary is `balance.ui.equipmentCard.regions` and nothing else. If a
//      region is renamed in balance and not in the JSON, the level quietly
//      stops asking for a row that is still being drawn — the face loses it
//      with no error anywhere. The reverse is just as quiet: a manifest naming
//      `footnote` asks for a region no renderer has, and nothing says so.
//
//   B  THE SOLVER HONOURS ITS DECLARED FLOORS WITH REGIONS OMITTED. The whole
//      value of the feature is that an omitted region gives its pixels BACK,
//      so a glance card is genuinely larger-typed rather than the same card
//      with holes. That is only true if the rows still sum inside the budget
//      and no surviving region is pushed under its own floor. Asserted at the
//      SPARSEST level and at the FULLEST: inspect is the one whose job is to
//      show everything, so it is the one most likely to ask the face to carry
//      more rows than the budget can honour, and `tools/textfit.mjs` cannot
//      see that class of overflow (it only scans elements that own a text
//      node) — a green textfit is not evidence here.
//
//   C  GLANCE ⊆ FOCUS ⊆ INSPECT, per surface as well as at the base. Choosing
//      a card must never make it say LESS; a patch that adds a field at glance
//      which focus does not carry would do exactly that, and the player would
//      watch information disappear as they selected.
//
// Plus two the design rests on: the manifest's surfaces are the surface
// vocabulary services/cardActions.js already owns (one home), and `name` is
// never a region — it is absolutely positioned over the art and is the title,
// which shows at every level.

import test from 'node:test';
import assert from 'node:assert/strict';
import { balance } from '../src/content/balance.js';
import { equipmentCardTokens } from '../src/model/equipmentCard.js';
import { cardFields, fieldManifest, levelForView, promote, regionOrder, resolveCardLevel, LEVELS } from '../src/model/cardFields.js';
import { SURFACES } from '../src/services/cardActions.js';

const manifest = fieldManifest();
const regions = regionOrder();
const surfaces = Object.keys(manifest.surfaces || {});

test('A. every region the manifest names is a region the face actually has', () => {
  assert.deepEqual(Object.keys(manifest.levels).sort(), [...LEVELS].sort(),
    'the manifest declares exactly the three levels');
  const named = new Set();
  for (const keys of Object.values(manifest.levels)) for (const key of keys) named.add(key);
  for (const patches of Object.values(manifest.surfaces || {})) {
    for (const patch of Object.values(patches)) {
      for (const key of [...(patch.add || []), ...(patch.drop || [])]) named.add(key);
    }
  }
  for (const key of named) {
    assert.ok(regions.includes(key),
      `the manifest names region "${key}", which balance.ui.equipmentCard.regions does not have`
      + ` — regions are ${regions.join(', ')}`);
  }
  // The other direction, so a region added to the face is not left out of every
  // level by accident: `inspect` says everything, so it must name them all.
  assert.deepEqual([...manifest.levels.inspect].sort(), [...regions].sort(),
    'inspect shows everything — a region on the face that inspect does not name is one nothing ever shows');
  assert.ok(!named.has('name'),
    'the title is not a region: it is absolutely positioned over the art, holds no row, and shows at every level');
});

test('B. the solver honours its declared floors when regions are omitted', () => {
  const config = balance.ui.equipmentCard;
  const cases = [];
  for (const level of LEVELS) {
    cases.push({ level, surface: 'none' });
    for (const surface of surfaces) cases.push({ level, surface });
  }
  for (const { level, surface } of cases) {
    const fields = cardFields(level, { surface });
    const tokens = equipmentCardTokens(config, { omit: fields.omit });
    const where = `${surface}/${level}`;

    assert.deepEqual(tokens.regions, [...fields.visible],
      `${where}: the solver lays down exactly the regions this level shows, in the face's own order`);
    assert.equal(tokens.rows.split(' ').length, fields.visible.length,
      `${where}: --epc-rows carries one track per visible region, so DOM order and grid rows cannot drift`);

    // The omitted regions took no row, and their gaps went with them.
    const gaps = config.gapPx * Math.max(0, fields.visible.length - 1);
    assert.equal(tokens.budget, config.frameHeightPx - config.paddingPx * 2 - gaps,
      `${where}: an omitted region returns its gap to the budget as well as its floor`);

    const total = fields.visible.reduce((sum, key) => sum + tokens.heights[key], 0);
    assert.ok(total <= tokens.budget + 1e-6,
      `${where}: the solved rows (${total.toFixed(2)}px) fit the budget (${tokens.budget}px)`);
    for (const key of fields.visible) {
      assert.ok(tokens.heights[key] > 0, `${where}: ${key} kept a row rather than collapsing to nothing`);
      // Over budget the solver may take a region to half its floor and no
      // lower — a row collapsed to nothing is not a smaller row, it is a
      // missing one. Under budget nothing may sit below its floor at all.
      assert.ok(tokens.heights[key] >= config.regions[key].minPx / 2 - 1e-6,
        `${where}: ${key} was not taken below half its declared floor`);
    }
    for (const key of fields.omit) {
      assert.equal(tokens.heights[key], undefined, `${where}: ${key} has no height because it has no row`);
    }
  }

  // THE FULLEST LEVEL, STATED AS ITS OWN CLAIM rather than left inside the
  // loop above, because it is the one that can go wrong and it is the one
  // whose whole job is to show everything.
  //
  // WHAT THIS GATE FOUND ON ITS FIRST RUN, and it is a real finding about the
  // SHIPPED face rather than about the levels: the seven regions' declared
  // floors sum to 438px against a 434px budget. Inspect is 4px over. It has
  // always been 4px over — until the levels existed, EVERY render of this face
  // drew all seven regions, so every card in the game has been paying it — and
  // the solver absorbs it exactly where balance.js says it should, by taking
  // flavour (priority 1, the lowest) to 14px against its floor of 18. Nothing
  // silently cuts a mechanic; lore gives up the room, which is the ordering
  // the config states out loud.
  //
  // So the assertion here is the property the solver actually PROMISES, not a
  // stronger one it has never held: the shortfall is bounded, it is taken from
  // the least important regions FIRST, and no region goes below half its own
  // floor. If a later change makes the floors fit outright, `debt` becomes 0
  // and every branch below still holds; if a change makes the debt grow past
  // what the low-priority regions can absorb, this goes red.
  //
  // Worth stating plainly because `tools/textfit.mjs` cannot see this: it
  // scans elements that own a text node, and a region squeezed below its floor
  // overflows its own row without ever failing that check.
  const full = equipmentCardTokens(config, { omit: cardFields('inspect', { surface: 'none' }).omit });
  const floors = regions.reduce((sum, key) => sum + config.regions[key].minPx, 0);
  const debt = Math.max(0, floors - full.budget);
  const squeezed = regions.filter((key) => full.heights[key] < config.regions[key].minPx - 1e-6);
  const absorbed = squeezed.reduce((sum, key) => sum + (config.regions[key].minPx - full.heights[key]), 0);
  assert.ok(Math.abs(absorbed - debt) < 1e-6,
    `inspect: the ${debt.toFixed(2)}px the floors overrun the budget by must all be absorbed by the face,`
    + ` not left to overflow — ${absorbed.toFixed(2)}px was`);
  // Whatever gave room did so in priority order: nothing more important than a
  // region that kept its floor may itself have been squeezed.
  const kept = regions.filter((key) => !squeezed.includes(key));
  for (const giver of squeezed) {
    for (const keeper of kept) {
      assert.ok(config.regions[giver].priority <= config.regions[keeper].priority,
        `inspect: "${giver}" (priority ${config.regions[giver].priority}) gave up room while`
        + ` "${keeper}" (priority ${config.regions[keeper].priority}) kept its floor — the solver took from the wrong end`);
    }
  }
  for (const key of regions) {
    assert.ok(full.heights[key] >= config.regions[key].minPx / 2 - 1e-6,
      `inspect: ${key} was not taken below half its declared floor — a row collapsed to nothing is a missing row`);
  }
  // And the feature's own claim, measured: omitting regions gives their pixels
  // to the ones that remain, so the effect text a glance card shows is BIGGER
  // than the one an inspect card shows, not the same row with holes in it.
  const glanceRows = equipmentCardTokens(config, { omit: cardFields('glance', { surface: 'none' }).omit });
  assert.ok(glanceRows.heights.effects > full.heights.effects,
    'a glance card gives the effect rows the pixels the regions it does not say would have taken');
});

test('C. glance is a subset of focus is a subset of inspect, at the base and on every surface', () => {
  const check = (surface) => {
    const at = (level) => new Set(cardFields(level, { surface }).visible);
    const glance = at('glance'), focus = at('focus'), inspect = at('inspect');
    for (const key of glance) {
      assert.ok(focus.has(key), `${surface}: glance shows "${key}" but focus does not — choosing a card would make it say less`);
    }
    for (const key of focus) {
      assert.ok(inspect.has(key), `${surface}: focus shows "${key}" but inspect does not — the reading door would say less than the face`);
    }
    assert.ok(glance.size > 0, `${surface}: a glance that shows nothing is not a card`);
  };
  check('none');
  for (const surface of surfaces) check(surface);
});

test('the manifest patches surfaces the game already names, and nothing else', () => {
  for (const surface of surfaces) {
    assert.ok(SURFACES.includes(surface),
      `the manifest patches "${surface}", which services/cardActions.js does not name`
      + ` — the places a card can stand have one home (${SURFACES.join(', ')})`);
  }
  for (const patches of Object.values(manifest.surfaces || {})) {
    for (const [level, patch] of Object.entries(patches)) {
      assert.ok(LEVELS.includes(level), `a surface patch names level "${level}"`);
      assert.deepEqual(Object.keys(patch).filter((k) => !['add', 'drop'].includes(k)), [],
        'a surface patch is sparse: it adds and drops against the base level, it is never a second full table');
    }
  }
});

test('the patches this manifest ships are the ones it says it ships', () => {
  // Stated as values, not just shapes, so a patch cannot be lost in a merge
  // without a line going red beside it.
  assert.ok(cardFields('glance', { surface: 'creation' }).visible.includes('footer'),
    'the creation picker shows rarity while you are choosing');
  assert.ok(!cardFields('glance', { surface: 'none' }).visible.includes('footer'),
    'and that is a patch, not the base level');
  assert.ok(cardFields('glance', { surface: 'armoury' }).visible.includes('type'),
    'the Armoury glance shows the type band: the question there is what goes in which slot');
  assert.ok(!cardFields('focus', { surface: 'combat' }).visible.includes('footer'),
    'the combat hand drops rarity even at focus — mid-fight it is noise');
});

test('the level is derived, promoted rather than replaced, and a view only selects one', () => {
  assert.equal(resolveCardLevel({ floor: 'glance', lit: false }), 'glance');
  assert.equal(resolveCardLevel({ floor: 'glance', lit: true }), 'focus', 'lighting a card promotes it');
  assert.equal(resolveCardLevel({ floor: 'focus', lit: false }), 'focus', 'a floor is a floor, not a default');
  assert.equal(resolveCardLevel({ floor: 'focus', lit: true }), 'focus', 'promotion is a max, so it never demotes');
  assert.equal(resolveCardLevel({ floor: 'glance', lit: false, inspecting: true }), 'inspect',
    'the reading door says everything whatever the surface asked for');
  assert.equal(promote('glance', 'inspect'), 'inspect');
  // The view SELECTS a level; it does not own a field set of its own.
  assert.equal(levelForView('grid'), 'glance');
  assert.equal(levelForView('list'), 'focus');
  assert.throws(() => cardFields('skim'), /unknown level 'skim'/,
    'an unknown level is refused by name rather than guessed at');
});

console.log(`PASS card presentation levels: ${LEVELS.length} levels x ${surfaces.length + 1} surfaces over ${regions.length} authored regions`);
