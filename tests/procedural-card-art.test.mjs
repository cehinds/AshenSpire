import test from 'node:test';
import assert from 'node:assert/strict';
import { proceduralCardArt, PROCEDURAL_BACKGROUND_COLORS } from '../src/ui/proceduralCardArt.js';
import { cardArtLayersHtml } from '../src/ui/cardArtLayers.js';
import { layeredCardArtCatalog as base } from '../src/content/layeredCardArt.generated.js';
import { reviewedCardArtCatalog as reviewed } from '../src/content/reviewedCardArt.generated.js';
import { proceduralDefinitionArt } from '../src/ui/cardArtComposition.js';
import { playingCardArt, playingCardArtwork } from '../src/ui/cardArtwork.js';
import { illustratedArtwork } from '../src/ui/components/illustratedCard.js';
import { renderCard, refreshCard } from '../src/ui/components/card.js';
import { applyCardArtStyle, resolveCardArtStyle } from '../src/ui/cardArtStyle.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { withModalDom } from './helpers/modal-dom.mjs';
import { readFileSync } from 'node:fs';
import { CARD_COMPONENTS } from '../src/content/cardComponents.generated.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { playingCardDefinition } from '../src/model/playingCard.js';
import { optionRowList } from '../src/ui/components/optionRowList.js';

const recipe = (type = 'attack', tags = ['camp:physical'], rank = 1) => proceduralCardArt({ type, tags, rank });
test('element background takes precedence over magic and physical defaults, never status', () => {
  for (const camp of ['physical', 'spell']) {
    const plain = recipe('defend', [`camp:${camp}`]);
    const burn = recipe('defend', [`camp:${camp}`, 'status:burn']);
    const earth = recipe('defend', [`camp:${camp}`, 'element:earth']);
    const both = recipe('defend', [`camp:${camp}`, 'status:burn', 'element:earth']);
    assert.deepEqual(plain.componentArt.backgroundColor, camp === 'spell'
      ? { id: 'camp:spell', color: PROCEDURAL_BACKGROUND_COLORS.magic }
      : { id: 'camp:physical', color: PROCEDURAL_BACKGROUND_COLORS.physical });
    assert.deepEqual(burn.componentArt.backgroundColor, plain.componentArt.backgroundColor);
    assert.ok(burn.componentArt.sprites.some(sprite => sprite.assetId.startsWith('cue.burn.')), 'Burn retains its status effect');
    assert.deepEqual(earth.componentArt.backgroundColor, { id: 'element:earth', color: PROCEDURAL_BACKGROUND_COLORS.element.earth });
    assert.deepEqual(both.componentArt.backgroundColor, earth.componentArt.backgroundColor);
    assert.strictEqual(both, recipe('defend', ['element:earth', 'status:burn', `camp:${camp}`]));
    assert.deepEqual(recipe('defend', [`camp:${camp}`, 'status:burning']).componentArt.backgroundColor, burn.componentArt.backgroundColor);
    for (const art of [burn, earth, both]) {
      assert.equal(art.path, plain.path, 'the original background texture remains the base image');
      assert.deepEqual(art.componentArt.sprites.filter(s => s.id === 'object'), plain.componentArt.sprites.filter(s => s.id === 'object'));
      const html = cardArtLayersHtml(art);
      assert.ok(html.indexOf('data-art-background-color=') < html.indexOf('data-card-art-component='), 'recoloring is behind object and effect PNGs');
      assert.match(html, /mix-blend-mode:color/);
      assert.doesNotMatch(html, /data-art-background-tint|brightness\(|sepia\(/);
      assert.ok(html.indexOf('data-art-background-color=') < html.indexOf('data-art-composition='), 'color treatment precedes the isolated component stage');
    }
    const html = cardArtLayersHtml(both);
    assert.equal((html.match(/data-art-background-color=/g) || []).length, 1, 'combined tags use one element color treatment');
    for (const element of ['force', 'fire', 'lightning', 'earth', 'frost', 'psychic', 'alteration', 'divine', 'necrotic', 'wind']) {
      const art = recipe('attack', [`camp:${camp}`, `element:${element}`, 'status:burn']);
      assert.deepEqual(art.componentArt.backgroundColor, { id: `element:${element}`, color: PROCEDURAL_BACKGROUND_COLORS.element[element] });
      assert.match(art.componentArt.backgroundColor.color, /^#[0-9a-f]{6}$/);
    }
  }
});

test('physical and magical procedural counters paint the hammer in front of the shield at every rank', () => {
  const originalBase = JSON.stringify(base), originalReviewed = JSON.stringify(reviewed);
  for (const camp of ['physical', 'spell']) for (const rank of [1, 3, 5]) {
    const art = recipe('counter', [`camp:${camp}`, 'element:earth', 'status:burn'], rank);
    const hammer = art.componentArt.sprites.find(s => s.id === 'secondaryObject');
    const shield = art.componentArt.sprites.find(s => s.id === 'object');
    assert.equal(hammer.assetId, 'O.object.1');
    assert.equal(hammer.path, base.assets['O.object.1'].path);
    assert.ok(!art.componentArt.sprites.some(sprite => sprite.assetId === 'O.object.0'), 'counter no longer contains a sword');
    assert.equal(shield.assetId, 'O.object.4');
    assert.ok(hammer.zIndex > shield.zIndex);
    assert.ok(Number(hammer.css.zIndex) > Number(shield.css.zIndex));
    const html = cardArtLayersHtml(art);
    assert.match(html, new RegExp(`data-art-layer="secondaryObject"[^>]+z-index:${hammer.zIndex}`));
    assert.equal(hammer.transform.rotationDeg, 180, 'hammer head points upper-right with grip lower-left');
    assert.deepEqual(hammer.affine, [-1, 0, 0, -1]);
    const { x, y, width, height } = hammer.transform;
    assert.ok(x - width / 2 >= 32 && x + width / 2 <= 480, 'entire rotated hammer stays inside the horizontal inset');
    assert.ok(y - height / 2 >= 32 && y + height / 2 <= 608, 'entire rotated hammer stays inside the vertical inset');
  }
  assert.equal(JSON.stringify(base), originalBase, 'approved/Legacy recipe catalog is unchanged');
  assert.equal(JSON.stringify(reviewed), originalReviewed, 'Reviewed snapshots are unchanged');
  const reviewedArt = playingCardArt({ cardId: 'mindSpike' }, { definition: { type: 'attack', cardTags: ['camp:spell', 'status:burn', 'element:earth'] }, style: 'Reviewed' });
  assert.doesNotMatch(cardArtLayersHtml(reviewedArt), /data-art-background-color/);
});

test('row-list artwork shares isolated background recoloring without filtering foreground PNGs', () => withModalDom(() => {
  const art = recipe('counter', ['camp:physical', 'status:burn']);
  const rows = optionRowList([{ id: 'preview', name: 'Preview', artAsset: art.path, artComposition: art }]);
  const well = rows.querySelector('.option-row-art');
  assert.equal(well.style.isolation, 'isolate');
  assert.ok(well.querySelector('img'));
  assert.match(well.querySelector('[data-art-background-color="camp:physical"]').getAttribute('style'), /mix-blend-mode:color/);
  assert.ok(well.querySelector('[data-card-art-component="O.object.1"]'));
  assert.ok([...well.querySelectorAll('[data-card-art-component]')].every(image => !image.style.filter));
}));

test('pure art depends only on canonical tags, type and rank, never identity or optional mechanics', () => {
  const tags = Object.freeze(['status:burn', 'camp:spell', 'element:fire', 'delivery:projectile']);
  const input = Object.freeze({ type: 'attack', tags, rank: 3, id: 'known', effects: [{ op: 'heal' }] });
  const first = proceduralCardArt(input);
  const second = proceduralCardArt({ ...input, tags: [...tags].reverse().map(id => ({ id })), id: '', name: 'different', profileId: 'axe', variant: 5, effects: [] });
  assert.strictEqual(first, second, 'canonical semantic cache also ignores unrelated fields');
  assert.ok(Object.isFrozen(first.componentArt.sprites[1].css));
  assert.throws(() => { first.componentArt.sprites[1].css.opacity = '0'; });
});
test('all actions, utilities, aliases and explicit maneuver overrides use shipped PNGs', () => {
  const assets = { ...base.assets, ...reviewed.assets };
  for (const camp of ['physical', 'spell']) for (const type of ['attack', 'smash', 'counter', 'evade', 'sweep', 'defend', 'defense', 'evasion', 'skill', 'power']) {
    const art = recipe(type, [`camp:${camp}`]);
    assert.ok(art?.componentArt, `${camp}/${type}`);
    for (const sprite of art.componentArt.sprites) assert.equal(sprite.path, assets[sprite.assetId].path);
    assert.ok(art.visualCues.length <= 4);
  }
  assert.equal(recipe('attack', ['camp:physical', 'maneuver:sweep']).maneuver, 'sweep');
  for (const [effect, asset] of [['heal', 'G.object.0'], ['draw', 'F.object.0'], ['cleanse', 'H.object.0']]) {
    assert.ok(recipe('skill', ['camp:physical', `effect:${effect}`]).componentArt.sprites.some(sprite => sprite.assetId === asset));
  }
  const counter = recipe('counter', ['camp:spell']).componentArt.sprites;
  assert.ok(counter.some(sprite => sprite.id === 'secondaryObject'), 'counter retains separate shield and hammer');
  assert.ok(recipe('evade').componentArt.sprites.some(sprite => sprite.assetId === 'symbol.feather'));
});
test('rank changes rendered decorative intensity without changing weapon geometry or silhouette', () => {
  for (const type of ['attack', 'sweep', 'counter', 'evade', 'skill']) {
    const rows = [1, 3, 5].map(rank => recipe(type, ['camp:spell', 'status:burn'], rank));
    assert.equal(new Set(rows.map(cardArtLayersHtml)).size, 3);
    const objects = art => art.componentArt.sprites.filter(sprite => /^(object|secondaryObject)(-|$)/.test(sprite.id));
    assert.deepEqual(objects(rows[0]), objects(rows[2]));
    assert.deepEqual(recipe(type, ['camp:spell', 'status:burn'], 9).componentArt.sprites, rows[2].componentArt.sprites);
  }
  for (const rank of [undefined, null, 0, -1, 2.5, NaN, Infinity, '3']) assert.equal(recipe('attack', ['camp:physical'], rank).rank, 1);
});
test('elements, spell delivery, bounded status PNGs and unknown registry statuses are semantic', () => {
  for (const element of ['force', 'fire', 'lightning', 'earth', 'frost', 'psychic', 'alteration', 'divine', 'necrotic', 'wind']) {
    const art = recipe('attack', ['camp:spell', `element:${element}`, 'delivery:projectile']);
    assert.ok(art.componentArt.sprites.some(sprite => sprite.assetId === `Z.effect.${base.selection.projectiles[element]}`));
  }
  const melee = recipe('attack', ['camp:spell', 'maneuver:casting', 'delivery:melee']);
  assert.ok(melee.componentArt.sprites.some(sprite => sprite.assetId.startsWith('Y.effect.')));
  const tags = ['status:burn', 'status:frost', 'status:sleep', 'status:weak', 'status:burn'];
  assert.equal(recipe('attack', ['camp:spell', ...tags]).statuses.length, 2);
  assert.equal(recipe('attack', ['camp:physical', ...tags]).statuses.length, 3);
  const registry = { statuses: new Map([['futureStatus', { id: 'futureStatus', tint: 'url(evil)' }]]) };
  const generic = proceduralCardArt({ type: 'skill', tags: ['camp:spell', 'status:futureStatus'] }, { registries: registry });
  assert.deepEqual(generic.statuses, [{ id: 'futureStatus' }]);
  assert.ok(generic.componentArt.sprites.some(sprite => sprite.assetId.startsWith('cue.prepared.')));
  assert.doesNotMatch(cardArtLayersHtml(generic), /evil/);
});
test('all ten elements visibly change every action through approved PNG source/CSS, not just metadata', () => {
  const manifest = JSON.parse(readFileSync(new URL('../art-manifest.json', import.meta.url)));
  for (const action of ['attack', 'smash', 'counter', 'evade', 'sweep', 'defend', 'skill']) {
    const renders = new Set();
    for (const [element, digit] of Object.entries(base.selection.projectiles)) {
      const art = recipe(action, ['camp:spell', `element:${element}`]);
      assert.equal(art.componentArt.sprites.filter(sprite => sprite.assetId === `Z.effect.${digit}`).length, 1, `${action}/${element} has one real elemental PNG`);
      renders.add(JSON.stringify(art.componentArt.sprites.map(sprite => [sprite.path, sprite.css])));
      for (const sprite of art.componentArt.sprites) assert.ok(manifest.assets[sprite.path]?.common, sprite.path);
    }
    assert.equal(renders.size, 10, `${action} has ten distinct rendered recipes`);
  }
});
test('Reviewed working placement edits cannot mutate the procedural template pool on a cache miss', () => {
  const source = Object.values(reviewed.records).flatMap(record => record.sprites).find(sprite => sprite.assetId === 'symbol.feather');
  const before = recipe('evade', ['camp:physical'], 101).componentArt.sprites.find(sprite => sprite.assetId === 'symbol.feather');
  const saved = source.css.left;
  try {
    source.css.left = '1%';
    const after = recipe('evade', ['camp:physical'], 102).componentArt.sprites.find(sprite => sprite.assetId === 'symbol.feather');
    assert.deepEqual(after, before, 'approved template is detached from mutable review working catalog');
  } finally { source.css.left = saved; }
});
test('mixed elements deduplicate aliases, preserve precedence and bound cues across actions and consumers', () => withModalDom(() => {
  for (const camp of ['physical', 'spell']) for (const action of ['attack', 'smash', 'counter', 'evade', 'sweep', 'defend', 'skill']) {
    const tags = [`camp:${camp}`, 'element:fire', 'element:cold', 'status:burn', 'status:bleed', 'status:frost'];
    const mixed = recipe(action, tags, 3);
    assert.deepEqual(mixed.elements, ['fire', 'frost']);
    assert.equal(mixed.componentArt.backgroundColor.color, '#9455c7');
    assert.strictEqual(mixed, recipe(action, [...tags, 'element:frost'].reverse(), 3));
    assert.ok(mixed.visualCues.length <= 4);
    assert.ok(mixed.componentArt.sprites.filter(row => row.id.startsWith('element-cue')).length <= 2);
    const objects = art => art.componentArt.sprites.filter(row => /^(object|secondaryObject)/.test(row.id));
    assert.deepEqual(objects(mixed), objects(recipe(action, tags, 5)), 'rank preserves weapon geometry');
  }
  const tags = ['camp:spell', 'element:lightning', 'element:alternation'];
  const lime = recipe('attack', tags);
  assert.equal(lime.componentArt.backgroundColor.color, '#9aca35');
  assert.strictEqual(lime, recipe('attack', ['element:alteration', ...tags].reverse()));
  const generic = recipe('attack', ['camp:physical', 'element:earth', 'element:wind', 'element:fire']);
  assert.strictEqual(generic, recipe('attack', ['element:wind', 'element:fire', 'camp:physical', 'element:earth']));
  assert.match(generic.componentArt.backgroundColor.color, /^#[0-9a-f]{6}$/);
  assert.equal(recipe('attack', ['camp:spell', 'damage:fire', 'damage:frost']).componentArt.backgroundColor.color, '#9455c7');
  const definition = { type: 'attack', cardTags: tags };
  assert.strictEqual(proceduralDefinitionArt(definition), lime);
  assert.strictEqual(playingCardArt({ cardId: 'mindSpike' }, { definition, style: 'Simple' }), lime);
  const reg = createRegistries(contentBundle);
  const card = renderCard(reg, { cardId: 'mindSpike' }, { definition: { ...reg.cards.get('mindSpike'), cardTags: tags }, artStyle: 'Simple' });
  assert.match(card.querySelector('[data-art-background-color="element:alteration+lightning"]').getAttribute('style'), /#9aca35/);
  assert.equal(PROCEDURAL_BACKGROUND_COLORS.element.fire, '#88552f');
  assert.equal(PROCEDURAL_BACKGROUND_COLORS.element.earth, '#705440');
  for (const prefix of ['element:', 'school:', 'damage:']) {
    const blood = recipe('attack', ['camp:spell', prefix + 'blood']);
    assert.equal(blood.componentArt.backgroundColor.color, '#b3271b');
    assert.ok(blood.componentArt.sprites.every(row => row.path));
  }
  const magic = recipe('attack', ['camp:spell']);
  const force = recipe('attack', ['camp:spell', 'element:force']);
  assert.notStrictEqual(magic, force);
  assert.equal(magic.componentArt.backgroundColor.color, '#427ec7');
  assert.equal(force.componentArt.backgroundColor.color, '#b3271b');
}));

test('missing, empty, conflicting and unsupported camp or action identities fail safely', () => {
  for (const tags of [[], ['camp:physical', 'camp:spell'], ['camp:unknown'], ['camp:spell', 'maneuver:invented'], ['camp:spell', 'maneuver:attack', 'maneuver:sweep']]) {
    assert.equal(recipe('attack', tags), null);
  }
  assert.equal(recipe('unknown'), null);
  assert.equal(recipe('attack', ['camp:physical', 'element:__proto__']), null);
  assert.equal(recipe('attack', ['camp:spell', 'element:cold', 'element:frost']).element, 'frost');
  assert.equal(recipe('attack', ['camp:spell', 'school:illusion', 'school:psychic']).element, 'psychic');
  assert.equal(recipe('attack', ['camp:physical', 'damage:cold', 'damage:frost']).element, 'frost');
  for (const tags of [
    ['element:fire', 'element:frost', 'school:divine'],
    ['school:fire', 'school:frost', 'damage:divine'],
  ]) assert.equal(recipe('attack', ['camp:spell', ...tags]).componentArt.backgroundColor.color, '#9455c7');
  for (const tags of [['element:fire', 'element:unknown'], ['school:unknown', 'damage:fire']]) {
    assert.equal(recipe('attack', ['camp:spell', ...tags]), null);
  }
  assert.equal(recipe('attack', ['camp:physical', 'damage:fire', 'damage:slashing']).element, 'fire');
  assert.equal(recipe('attack', ['camp:physical', 'damage:blood', 'damage:blunt']).componentArt.backgroundColor.color, '#b3271b');
});

test('Simple is procedural before dedicated and curated ID routes, while Reviewed and Legacy retain them', () => {
  const def = { type: 'attack', cardTags: ['camp:spell', 'maneuver:casting', 'element:fire'], rank: 3 };
  const samples = ['', 'future-card', 'mindSpike', 'gorefireSlash'].map(id => playingCardArt({ cardId: id, profileId: id }, {
    definition: { ...def, id, name: id, effects: [{ op: 'heal', amount: 999 }] }, style: 'Simple',
  }));
  for (const sample of samples) assert.strictEqual(sample, samples[0]);
  const reviewedArt = playingCardArt({ cardId: 'mindSpike' }, { definition: { ...def, id: 'mindSpike' }, style: 'Reviewed' });
  assert.strictEqual(reviewedArt.componentArt, reviewed.records.mindSpike);
  assert.equal(playingCardArt({ cardId: 'gorefireSlash' }, { definition: def, style: 'Legacy' }).path, playingCardArtwork({ cardId: 'gorefireSlash' }));
  assert.equal(resolveCardArtStyle({ cardArtStyle: 'Reviewed' }), 'Reviewed');
  assert.equal(resolveCardArtStyle({ cardArtStyle: 'Simple' }), 'Simple');
  for (const id of ['', 'mindSpike', 'gorefireSlash']) for (const cardTags of [[], null, undefined, ['camp:physical', 'camp:spell'], ['camp:spell', 'element:fire', 'element:unknown']]) {
    assert.equal(playingCardArt({ cardId: id, profileId: 'bladeAttack' }, { definition: { id, type: 'attack', cardTags }, style: 'Simple' }), null,
      'explicit invalid or empty tags never repair through card/profile identity');
  }
});
test('legacy adapter infers declared utility/status facts only when explicit cardTags are absent', () => {
  const def = { type: 'skill', tags: ['camp:physical'], effects: [{ op: 'heal', amount: 5 }, { op: 'applyStatus', status: 'burn' }] };
  const inferred = proceduralDefinitionArt(def);
  assert.ok(inferred.componentArt.sprites.some(sprite => sprite.assetId === 'G.object.0'));
  assert.deepEqual(inferred.statuses, [{ id: 'burn' }]);
  const explicit = { ...def, cardTags: ['camp:physical', 'effect:draw'] };
  const first = proceduralDefinitionArt(explicit);
  const changed = proceduralDefinitionArt({ ...explicit, effects: [{ op: 'removeStatus', target: 'self' }], evade: true, attack: { damageType: 'fire' } });
  assert.strictEqual(first, changed);
  assert.ok(first.componentArt.sprites.some(sprite => sprite.assetId === 'F.object.0'));
  assert.deepEqual(first.statuses, []);
  assert.equal(proceduralDefinitionArt({ ...def, cardTags: [] }), null);
  const healing = proceduralDefinitionArt({ type: 'skill', tags: ['camp:spell'], effects: [{ op: 'heal', amount: 8 }, { op: 'retain' }] });
  assert.ok(healing.componentArt.sprites.some(sprite => sprite.assetId === 'G.object.0'), 'healing plus Retain keeps the healing leaf; retaining a card is not drawing');
  assert.ok(!healing.componentArt.sprites.some(sprite => sprite.assetId === 'F.object.0'));
});
test('explicit utility identities outrank generic aliases in every tag order', () => {
  for (const tags of [
    ['camp:spell', 'effect:heal', 'retain'],
    ['retain', 'effect:heal', 'camp:spell'],
    ['reshuffle', 'camp:physical', 'effect:heal'],
    ['effect:heal', 'camp:physical', 'reshuffle'],
    ['fx:heal', 'camp:spell', 'retain'],
    ['retain', 'camp:spell', 'fx:heal'],
  ]) {
    const art = recipe('skill', tags);
    assert.ok(art.componentArt.sprites.some(sprite => sprite.assetId === 'G.object.0'));
    assert.ok(!art.componentArt.sprites.some(sprite => sprite.assetId === 'F.object.0'));
  }
  for (const tags of [['effect:heal', 'effect:draw'], ['effect:draw', 'effect:heal']]) {
    assert.ok(recipe('skill', ['camp:spell', ...tags]).componentArt.sprites.some(sprite => sprite.assetId === 'F.object.0'), 'multiple explicit effects use the existing catalog order');
  }
});
test('actual Core-bound projected tags remain authoritative when they omit a healing art cue', () => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries: reg, classId: 'herald', seed: 5,
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const ref = run.deck.find(card => card.cardId === 'urgentHeal') || { cardId: 'urgentHeal' };
  const definition = playingCardDefinition(reg, ref, { rules: run });
  assert.ok(definition.keywords.includes('retain'), 'exercise the actual Core-bound Retain card');
  assert.ok(definition.effects.some(effect => effect.op === 'heal'));
  const art = playingCardArt(ref, { definition, registries: reg, style: 'Simple' });
  const expected = proceduralCardArt({ type: definition.type, tags: definition.cardTags, rank: definition.rank }, { registries: reg });
  assert.strictEqual(art, expected, 'no hidden DSL effect repairs the explicit projected tags');
  assert.ok(art.componentArt.sprites.some(sprite => sprite.assetId === 'I.object.0'));
  assert.ok(!art.componentArt.sprites.some(sprite => sprite.assetId === 'G.object.0'));
});
test('live definition rank wins canonical visual refs, ability rank zero is an explicit first visual rank', () => {
  const def = { id: 'future', type: 'attack', cardTags: ['camp:physical'], rank: 5 };
  assert.equal(illustratedArtwork({ cardId: 'strike', rank: 1 }, 'strike', { definition: def }).rank, 5);
  assert.equal(proceduralDefinitionArt({ ...def, rank: undefined, abilityRank: 0 }, { ref: { rank: 5 } }).rank, 1);
  assert.equal(proceduralDefinitionArt({ ...def, rank: undefined }, { ref: { rank: 3 } }).rank, 3);
  assert.equal(proceduralDefinitionArt({ ...def, rank: 3 }, { ref: { rank: 5 } }).rank, 3);
});
test('in-place refresh recomputes procedural art from the newly resolved live rank', () => withModalDom(() => {
  applyCardArtStyle({});
  const reg = createRegistries(contentBundle), ref = { cardId: 'strike', rank: 1 };
  const card = renderCard(reg, ref, { inspection: false }); document.body.append(card);
  const before = card.querySelector('[data-card-art-layers]').outerHTML;
  ref.rank = 3;
  assert.equal(refreshCard(card, { inspection: false }), true);
  const after = card.querySelector('[data-card-art-layers]').outerHTML;
  assert.notEqual(after, before, 'same element receives new rendered art intensity');
  assert.ok(card.querySelector('[data-card-art-component="O.object.0"]'));
}));
test('review previews override artwork style locally without changing the saved global style', () => withModalDom(() => {
  applyCardArtStyle({});
  const reg = createRegistries(contentBundle);
  const reviewedCard = renderCard(reg, { cardId: 'mindSpike' }, { inspection: false, artStyle: 'Reviewed' });
  const simpleCard = renderCard(reg, { cardId: 'mindSpike' }, { inspection: false, artStyle: 'Simple' });
  assert.ok(reviewedCard.querySelector('[data-art-composition="C001"]'));
  assert.ok(simpleCard.querySelector('[data-art-composition^="procedural-"]'));
}));
test('invalid explicit Simple tags stay unresolved through the facade and mounted per-ID artwork layer', () => withModalDom(() => {
  applyCardArtStyle({});
  const reg = createRegistries(contentBundle);
  for (const cardId of ['defend', 'gorefireSlash', 'strike']) {
    const definition = { ...reg.cards.get(cardId), cardTags: ['camp:physical', 'camp:spell'] };
    const options = { definition, registries: reg, style: 'Simple' };
    assert.equal(illustratedArtwork({ cardId }, cardId, options), null);
    const card = renderCard(reg, { cardId }, { definition: { ...definition, cardTags: [] }, inspection: false, artStyle: 'Simple' });
    assert.equal(card.querySelector('.playing-card-art'), null, `${cardId}: no legacy painting repairs an invalid descriptor`);
    assert.ok(card.querySelector('[data-component="art"] .ic-glyph'), 'safe generic placeholder remains');
    assert.ok(illustratedArtwork({ cardId }, cardId, { ...options, style: 'Legacy' })?.path);
    assert.ok(illustratedArtwork({ cardId }, cardId, { ...options, style: 'Reviewed' })?.path);
  }
}));
test('an explicit custom artwork component still overrides the invalid Simple placeholder afterward', () => withModalDom(() => {
  applyCardArtStyle({});
  const reg = createRegistries(contentBundle), doc = CARD_COMPONENTS.cards.defend;
  const saved = doc.components.art;
  try {
    doc.components.art = { href: 'assets/cards/shield-defend-512.webp', fit: 'contain' };
    const definition = { ...reg.cards.get('defend'), cardTags: [] };
    const card = renderCard(reg, { cardId: 'defend' }, { definition, inspection: false, artStyle: 'Simple' });
    const custom = card.querySelector('[data-component="art"][data-custom-image="true"] img');
    assert.ok(custom, 'the separately authored custom appearance is still applied');
    assert.match(custom.src, /shield-defend-512\.webp$/);
  } finally { if (saved === undefined) delete doc.components.art; else doc.components.art = saved; }
}));
