import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { proceduralCardArt } from '../src/ui/proceduralCardArt.js';
import { reviewedCardArtCatalog } from '../src/content/reviewedCardArt.generated.js';
import { renderCard } from '../src/ui/components/card.js';
import { applyCardArtStyle, cardArtStyle } from '../src/ui/cardArtStyle.js';
import { t, tFull } from '../src/ui/strings.js';
import { mountProceduralBuilder } from '../src/ui/tools/cardArtProceduralBuilder.js';
import { withModalDom } from './helpers/modal-dom.mjs';
import { BUILDER_TYPES, BUILDER_ELEMENTS, BUILDER_RANK_MAX, BUILDER_PREVIEW_ID,
  normalizeBuilderInput, builderInputFromControls, createBuilderPreview, builderInputJson } from '../src/ui/tools/cardArtBuilderModel.js';

const profile = resolveGameProfile('default');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const run = createRunState({ registries, classId: 'reaver', seed: 73031 });
const previewText = { name: t('cardArtBuilder.previewName'), text: tFull('cardArtBuilder.previewOnly') };

test('reviewed-card accessibility copy fills its authored name token through the strings API', () => {
  assert.equal(tFull('cardArtBuilder.reviewedCard', { name: 'Example card' }), 'Reviewed Example card');
  assert.throws(() => tFull('cardArtBuilder.reviewedCard'), /wants \{name\}/);
});

test('builder exports only canonical type, tags and one-based bounded rank', () => {
  const input = builderInputFromControls({ type: 'counter', category: 'spell', element: 'earth', delivery: 'projectile',
    statuses: ['burn', 'weak'], extraTags: 'status:burn, future:cue\nfuture:cue', rank: 3 });
  assert.deepEqual(input, { type: 'counter', tags: ['camp:spell', 'delivery:projectile', 'element:earth', 'future:cue',
    'maneuver:counter', 'status:burn', 'status:weak'], rank: 3 });
  const exported = JSON.parse(builderInputJson({ ...input, id: 'discarded', effects: [], assets: [] }));
  assert.deepEqual(exported, input);
  assert.deepEqual(Object.keys(exported), ['type', 'tags', 'rank']);
  for (const rank of [1, 3, 5, BUILDER_RANK_MAX]) assert.equal(normalizeBuilderInput({ ...input, rank }).rank, rank);
  for (const rank of [0, -1, 2.5, NaN, Infinity, '3', BUILDER_RANK_MAX + 1]) {
    assert.throws(() => normalizeBuilderInput({ ...input, rank }), { code: 'rank' });
  }
  assert.throws(() => normalizeBuilderInput({ ...input, type: 'future' }), { code: 'type' });
  assert.throws(() => normalizeBuilderInput({ ...input, tags: ['<script>'] }), { code: 'tags' });
});

test('every builder action, category, element and rank delegates to the production resolver', () => {
  for (const type of BUILDER_TYPES) for (const category of ['physical', 'spell']) {
    for (const element of ['', ...BUILDER_ELEMENTS]) for (const rank of [1, 3, 5]) {
      const input = builderInputFromControls({ type, category, element, rank });
      const preview = createBuilderPreview(registries, input, previewText);
      assert.strictEqual(preview.composition, proceduralCardArt(input, { registries }), `${type}/${category}/${element}/${rank}`);
      assert.ok(preview.composition?.componentArt.sprites.length);
    }
  }
});

test('Evade controls use the art type without inventing a native maneuver tag or changing composition', () => {
  for (const category of ['physical', 'spell']) for (const rank of [1, 3, 5]) {
    const input = builderInputFromControls({ type: 'evade', category, rank });
    assert.ok(!input.tags.some(tag => tag.startsWith('maneuver:')));
    const aliasInput = { ...input, tags: [...input.tags, 'maneuver:evasion'] };
    assert.strictEqual(createBuilderPreview(registries, input, previewText).composition,
      proceduralCardArt(aliasInput, { registries }));
  }
});

test('utility and registry status choices retain all tags while the resolver bounds visible cues', () => {
  for (const [utility, assetId] of [['heal', 'G.object.0'], ['draw', 'F.object.0'], ['cleanse', 'H.object.0']]) {
    const input = builderInputFromControls({ type: 'skill', category: 'physical', utility, rank: 5,
      statuses: ['burn', 'frost', 'weak', 'sleep'], delivery: 'projectile' });
    assert.ok(!input.tags.includes('delivery:projectile'), 'physical controls omit inactive spell delivery');
    const { composition } = createBuilderPreview(registries, input, previewText);
    assert.ok(composition.componentArt.sprites.some(sprite => sprite.assetId === assetId));
    assert.equal(input.tags.filter(tag => tag.startsWith('status:')).length, 4);
    assert.equal(composition.statuses.length, 3);
  }
});

test('conflicting tags report no composition without repairing from an existing card identity', () => {
  const input = builderInputFromControls({ type: 'attack', category: 'spell', rank: 1, extraTags: 'camp:physical' });
  assert.equal(createBuilderPreview(registries, input, previewText).composition, null);
});

test('builder does not register a card, mutate approved placements, or change its caller input', () => {
  const before = JSON.stringify(reviewedCardArtCatalog.records), size = registries.cards.size;
  const input = Object.freeze({ type: 'attack', tags: Object.freeze(['camp:physical', 'status:burn']), rank: 3 });
  const preview = createBuilderPreview(registries, input, previewText);
  assert.notStrictEqual(preview.input.tags, input.tags);
  assert.equal(registries.cards.has(BUILDER_PREVIEW_ID), false);
  assert.equal(registries.cards.size, size);
  assert.equal(JSON.stringify(reviewedCardArtCatalog.records), before);
  assert.deepEqual(input.tags, ['camp:physical', 'status:burn']);
});

test('every builder type and category renders the same native Core recipe with complete costs and local style', () => withModalDom(() => {
  // Preserve the production HTML before the layout-free fixture drops text tokens.
  let markup = '';
  const createElement = document.createElement.bind(document);
  document.createElement = tag => {
    const element = createElement(tag);
    const innerHTML = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'innerHTML');
    Object.defineProperty(element, 'innerHTML', { set(value) {
      if (String(value).includes('data-card-binding="rules"')) markup = String(value);
      innerHTML.set.call(this, value);
    } });
    return element;
  };
  applyCardArtStyle({ cardArtStyle: 'Reviewed' });
  try {
    for (const type of BUILDER_TYPES) for (const category of ['physical', 'spell']) for (const rank of [1, 3, 5]) {
      const input = builderInputFromControls({ type, category, element: category === 'spell' ? 'alteration' : '', rank, utility: type === 'skill' ? 'heal' : '' });
      const preview = createBuilderPreview(registries, input, previewText);
      markup = '';
      const face = renderCard(registries, { cardId: BUILDER_PREVIEW_ID, rank: input.rank },
        { definition: preview.definition, rules: run, inspection: false, level: 'inspect', artStyle: 'Simple' });
      const model = playingCardModel(registries, { cardId: BUILDER_PREVIEW_ID }, { definition: preview.definition, rules: run });
      assert.deepEqual(model.costs, { variable: false, action: 0, mana: 0, stamina: 0 });
      if (type === 'evade') {
        if (category === 'physical') assert.equal(model.stanceType, 'evade');
        assert.equal(preview.definition.evade, false);
        assert.deepEqual(preview.definition.effects, []);
        assert.doesNotMatch(markup, /Prepare one Evade/);
        assert.match(markup, /data-card-binding="rules"[^>]*>[\s\S]*?Art preview only/);
      }
      assert.equal(face.querySelector('[data-art-composition]').dataset.artComposition, preview.composition.componentArt.code);
      assert.equal(face.querySelector('.playing-card-art').dataset.cardArt, 'simple');
      assert.doesNotMatch(face.outerHTML, /undefined|NaN/);
      assert.match(face.getAttribute('aria-label'), /Procedural art preview/);
      assert.equal(cardArtStyle(), 'Reviewed');
    }
  } finally { applyCardArtStyle({}); }
}));

test('mounted controls update the real preview, clear invalid input and export only the current recipe', async () => {
  let exported;
  withModalDom(() => {
    const page = readFileSync(new URL('../docs/card-art-review.html', import.meta.url), 'utf8');
    document.body.innerHTML = page.match(/<main id="procedural-panel"[\s\S]*<\/main>/)[0];
    document.getElementById = id => document.querySelector(`#${id}`);
    const find = id => document.getElementById(`builder-${id}`);
    for (const [id, value] of Object.entries({ type: 'attack', category: 'physical', element: '', utility: '', delivery: 'melee', rank: '1', 'extra-tags': '' })) find(id).value = value;
    Object.defineProperty(find('rank'), 'valueAsNumber', { get() { return Number(this.value); } });
    // This layout-free fixture has no native :checked or select/value reflection.
    const statuses = find('statuses'), query = statuses.querySelectorAll.bind(statuses);
    statuses.querySelectorAll = selector => selector === 'input:checked'
      ? statuses.children.map(label => label.children[0]).filter(input => input.checked) : query(selector);
    const rootURL = new URL('https://example.test/AshenSpire/');
    mountProceduralBuilder({ registries, run, rootURL, imageURL: path => new URL(path, rootURL).href,
      download: (blob, name) => { exported = { blob, name }; } });
    assert.equal(find('type').children.length, 7);
    assert.equal(find('element').children.length, 11);
    assert.equal(find('delivery').disabled, true);
    assert.equal(find('utility').disabled, true);
    assert.equal(find('export').disabled, false);
    assert.equal(find('native').children.length, 1);
    find('ranks').children[2].onclick();
    assert.equal(JSON.parse(find('input').textContent).rank, 5);
    find('category').value = 'spell'; find('element').value = 'fire'; find('delivery').value = 'projectile';
    find('category').dispatchEvent(new Event('input'));
    assert.equal(find('delivery').disabled, false);
    assert.ok(JSON.parse(find('input').textContent).tags.includes('delivery:projectile'));
    find('rank').value = '0'; find('rank').dispatchEvent(new Event('input'));
    assert.equal(find('export').disabled, true);
    assert.equal(find('native').children.length, 0);
    assert.equal(find('message').textContent, tFull('cardArtBuilder.invalidRank', { max: BUILDER_RANK_MAX }));
    find('rank').value = '3'; find('type').value = 'skill'; find('utility').value = 'heal';
    find('type').dispatchEvent(new Event('input'));
    assert.equal(find('utility').disabled, false);
    find('export').onclick();
    assert.equal(find('export').disabled, false);
    assert.equal(registries.cards.has(BUILDER_PREVIEW_ID), false);
  });
  assert.equal(exported.name, 'procedural-card-art.json');
  assert.deepEqual(JSON.parse(await exported.blob.text()), { type: 'skill',
    tags: ['camp:spell', 'delivery:projectile', 'effect:heal', 'element:fire'], rank: 3 });
});
