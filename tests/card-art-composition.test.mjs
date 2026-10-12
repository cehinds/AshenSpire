import test from 'node:test';
import assert from 'node:assert/strict';
import { simpleCardArt, cardArtElement, cardArtPreviewFixtures, cardArtStatuses } from '../src/ui/cardArtComposition.js';
import { cardArtLayersHtml } from '../src/ui/cardArtLayers.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';

const face = (tags, extra = {}) => ({ id: 'custom', cardTags: tags, ...extra });
test('nine elements across six actions and all five base variants are composable', () => {
  const fixtures = cardArtPreviewFixtures();
  assert.equal(fixtures.length, 54);
  assert.equal(new Set(fixtures.map(row => row.id)).size, 54);
  for (const { composition } of fixtures) {
    assert.match(composition.path, /^assets\/cards\/library\/magical-(attack|smash|counter|evade|sweep|defend)-0[1-5]-512.webp$/);
    assert.match(cardArtLayersHtml(composition), /data-card-art-layers/);
  }
  const all = cardArtPreviewFixtures({ allVariants: true });
  assert.equal(all.length, 270);
  assert.equal(new Set(all.map(row => `${row.composition.path}:${row.composition.element}`)).size, 270);
});
test('aliases and unrecognized tags cannot invent mechanics or unsafe paths', () => {
  for (const [source, target] of [['alternation', 'alteration'], ['illusion', 'psychic'], ['decay', 'necrotic'], ['holy', 'divine']]) assert.equal(cardArtElement(source), target);
  assert.equal(cardArtElement('__proto__'), null);
  assert.equal(simpleCardArt(face(['camp:spell', 'maneuver:../attack'])), null);
  assert.equal(simpleCardArt(face(['camp:spell', 'maneuver:attack', 'school:unknown'])).element, 'force');
  assert.equal(simpleCardArt(face(['camp:physical', 'maneuver:smash']), { large: true, variant: 5 }).path, 'assets/cards/library/physical-smash-05-1024.webp');
});
test('resolved equipment identity and explicit empty tags take precedence', () => {
  const def = face(['camp:spell', 'maneuver:counter', 'school:fire'], { id: 'strike', tags: ['camp:physical', 'maneuver:attack'] });
  assert.equal(simpleCardArt(def, { ref: { cardId: 'strike', profileId: 'bladeAttack' } }).category, 'magical');
  assert.equal(simpleCardArt({ ...def, cardTags: [] }), null);
  assert.equal(simpleCardArt({ ...def, cardTags: undefined, tags: [] }), null);
  assert.equal(simpleCardArt(undefined), null);
  assert.equal(simpleCardArt(face(['camp:physical', 'maneuver:defend'], { evade: { charges: 1 } })).maneuver, 'evade');
});
test('active registry junction is used only when resolved tags are absent', () => {
  const registries = { tags: [], tagging: [{ family: 'card', objectId: 'strike', tagId: 'camp:spell' }, { family: 'card', objectId: 'strike', tagId: 'maneuver:sweep' }, { family: 'card', objectId: 'strike', tagId: 'school:illusion' }] };
  assert.equal(simpleCardArt({ id: 'strike' }, { registries }).element, 'psychic');
  assert.equal(simpleCardArt({ id: 'strike', cardTags: [] }, { registries }), null);
  assert.equal(simpleCardArt({ id: 'strike' }, { registries: { tags: [], tagging: [] } }), null);
});
test('all current status rows have a restrained layer, including future custom statuses', () => {
  const reg = createRegistries(contentBundle);
  for (const status of reg.statuses.all()) {
    const def = face(['camp:physical', 'maneuver:attack'], { effects: [{ op: 'applyStatus', status: status.id }] });
    const art = simpleCardArt(def, { registries: reg });
    assert.equal(art.statuses[0]?.id, status.id);
    assert.match(cardArtLayersHtml(art), /data-art-status=/);
  }
  const registry = { statuses: new Map([['custom', { name: '<img onerror=x>', tint: 'red;position:fixed' }]]) };
  assert.equal(cardArtStatuses({ effects: [{ op: 'buildup', status: 'custom' }] }, [], registry)[0].color, '#d9c8ec');
});
test('nested statuses are deterministic, deduplicated, capped and active-registry scoped', () => {
  const effects = [{ op: 'conditional', then: [{ op: 'buildup', status: 'frozen' }, { op: 'applyStatus', status: 'bleeding' }, { op: 'applyStatus', status: 'weak' }, { op: 'applyStatus', status: 'sleep' }] }];
  const def = { effects };
  assert.deepEqual(cardArtStatuses(def, ['status:frozen']).map(row => row.id), ['bleeding', 'frozen', 'sleep']);
  assert.deepEqual(cardArtStatuses(def, [], { statuses: new Map() }), []);
  effects.push(effects);
  assert.equal(cardArtStatuses(def).length, 3);
});
test('layer markup escapes authored ids and never uses shared SVG ids or external resources', () => {
  const composition = { kind: 'simple', layers: [{ kind: 'status', id: '\"><img src=x onerror=alert(1)>', motif: 'stars', color: 'red;opacity:1' }] };
  const html = cardArtLayersHtml(composition);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('red;opacity'));
  assert.ok(!/\bid=|<defs|<script|\bhref=/.test(html));
  assert.equal(html, cardArtLayersHtml(composition));
});
test('shipped resolved cards retain their authored family', () => {
  const registries = createRegistries(contentBundle);
  for (const cardId of ['strike', 'defend', 'gorefireSlash']) {
    const def = resolveCard(registries, { cardId });
    const composition = simpleCardArt(def, { registries });
    assert.ok(composition, cardId);
  }
});
test('physical palette selection is stable by card/profile, independent of instance and order', () => {
  const def = face(['camp:physical', 'maneuver:attack']);
  const variants = new Set(Array.from({ length: 40 }, (_, i) => simpleCardArt({ ...def, id: `card-${i}` }).variant));
  assert.equal(variants.size, 5);
  assert.equal(simpleCardArt(def, { ref: { profileId: 'blade', instanceId: 'one' } }).variant,
    simpleCardArt(def, { ref: { profileId: 'blade', instanceId: 'two' } }).variant);
  assert.equal(simpleCardArt({ ...def, art: { variant: 4 } }).variant, 4);
  assert.equal(simpleCardArt(def, { variant: 3 }).variant, 3);
});
test('element precedence respects explicit element, school and single authored damage identity', () => {
  const art = (tags, extra) => simpleCardArt(face(['camp:physical', 'maneuver:attack', ...tags], extra));
  assert.equal(art(['damage:fire']).element, 'fire');
  assert.equal(art(['school:frost', 'damage:fire']).element, 'frost');
  assert.equal(art(['element:earth', 'school:frost', 'damage:fire']).element, 'earth');
  assert.equal(art(['damage:fire', 'damage:slashing']).element, null);
  assert.equal(art(['damage:fire'], { attack: { damageType: 'frost' } }).element, 'frost');
  assert.equal(art([], { attack: { components: [{ type: 'fire' }, { type: 'slashing' }] } }).element, null);
  assert.equal(art([], { attack: { components: [{ type: 'fire' }, { type: 'fire' }] } }).element, 'fire');
});
test('explicit auxiliary payloads contribute statuses while unrelated authored data does not', () => {
  const def = { counterPayload: { effects: [{ op: 'applyStatus', status: 'frozen' }] }, upcast: [{ op: 'buildup', status: 'bleeding' }], schoolEffect: { op: 'applyStatus', status: 'weak' }, flavor: { op: 'applyStatus', status: 'dazed' } };
  assert.deepEqual(cardArtStatuses(def).map(row => row.id), ['bleeding', 'frozen', 'weak']);
  const registry = { statuses: new Map([['custom', { tint: '#12345' }]]) };
  assert.equal(cardArtStatuses({ effects: [{ op: 'applyStatus', status: 'custom' }] }, [], registry)[0].color, '#d9c8ec');
});
