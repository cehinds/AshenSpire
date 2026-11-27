import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_TEMPLATES_KIND,
  CARD_TEMPLATES_PATH,
  TEMPLATE_CARD_FIELDS,
  TemplateCardFields,
  TemplateNameProblem,
  TemplateIdFor,
  SaveCardAsTemplate,
  RenameTemplate,
  DeleteTemplate,
  CardFromTemplate,
  FreshCardId,
  MissingArtLayerIds,
  GroupTemplatesByType,
  TemplateFile,
  ParseTemplateFile,
  MergeImportedTemplates,
  createMemoryTemplateStore,
} from '../tools/score-studio/cardTemplates.js';

function sourceCard() {
  return {
    id: 'reaver.cleave', name: 'Cleave', class: 'reaver', rarity: 'uncommon', type: 'attack', icon: 'attack',
    cost: 2, staminaCost: 2, manaCost: 1, costRule: 'fixed', damageSchool: 'physical', magicShare: 0.25,
    effects: [{ op: 'damage', amount: 8, target: 'allEnemies' }, { op: 'applyStatus', status: 'weak', amount: 1, target: 'allEnemies' }],
    tags: ['camp:physical', 'classification.attack', 'targeting:area', 'targeting.allEnemies'], keywords: ['exhaust'],
    kindIds: ['classification.attack'], textTemplate: 'Deal {damage} to all enemies.', upgradeMenu: { a: 1 },
    scoringOverride: { rank: 3 }, _edited: true, _autoName: false, _custom: false, _newDraft: true,
  };
}

test('the template file lives in the Studio save folder', () => {
  assert.equal(CARD_TEMPLATES_PATH, 'content/source/studio/templates.json');
});

test('a template keeps mechanics only and drops the id, the name, `_` flags and scoringOverride', () => {
  const card = sourceCard();
  const fields = TemplateCardFields(card);
  assert.deepEqual(Object.keys(fields).sort(), [...TEMPLATE_CARD_FIELDS].sort());
  for (const dropped of ['id', 'name', 'class', 'icon', 'kindIds', 'textTemplate', 'upgradeMenu', 'scoringOverride']) assert.equal(dropped in fields, false, dropped);
  assert.equal(Object.keys(fields).some(key => key.startsWith('_')), false);
  assert.deepEqual(fields.effects, card.effects);
  assert.deepEqual(fields.tags, card.tags);
  assert.equal(fields.magicShare, 0.25);
  // A deep copy: no array is shared with the card.
  assert.notEqual(fields.effects, card.effects); assert.notEqual(fields.effects[0], card.effects[0]); assert.notEqual(fields.tags, card.tags);
});

test('Save as template stores a named template under its type and leaves the card untouched', () => {
  const card = sourceCard(), before = structuredClone(card);
  const saved = SaveCardAsTemplate([], card, { name: '  Area cleave ', artLayerIds: ['layer-1', 'layer-1'], now: '2026-11-26T00:00:00.000Z' });
  assert.deepEqual(card, before, 'the source card is byte-identical');
  assert.equal(saved.replaced, false);
  assert.deepEqual(saved.template, {
    id: 'template.area-cleave', name: 'Area cleave', cardType: 'attack', createdAt: '2026-11-26T00:00:00.000Z',
    card: TemplateCardFields(before), artLayerIds: ['layer-1'],
  });
  assert.equal(saved.templates.length, 1);
});

test('an empty or overlong name stores nothing and names the problem', () => {
  const list = [];
  assert.equal(SaveCardAsTemplate(list, sourceCard(), { name: '   ' }).problem, 'Give the template a name.');
  assert.match(SaveCardAsTemplate(list, sourceCard(), { name: 'x'.repeat(61) }).problem, /60 characters/);
  assert.equal(TemplateNameProblem('Fine'), '');
  assert.deepEqual(list, []);
});

test('a taken name asks first; Cancel stores nothing and Replace keeps the id with the new content', () => {
  const first = SaveCardAsTemplate([], sourceCard(), { name: 'Cleave kit', now: 'then' }).templates;
  const frozen = structuredClone(first);
  const other = { ...sourceCard(), type: 'skill', effects: [{ op: 'block', amount: 5, target: 'self' }] };
  const asked = SaveCardAsTemplate(first, other, { name: 'cleave KIT' });
  assert.equal(asked.taken.id, 'template.cleave-kit', 'a taken name (any case) returns the existing template');
  assert.equal(asked.templates, undefined, 'nothing is stored until Replace');
  assert.deepEqual(first, frozen);
  const replaced = SaveCardAsTemplate(first, other, { name: 'cleave KIT', replace: true, now: 'now' });
  assert.equal(replaced.replaced, true);
  assert.equal(replaced.templates.length, 1);
  assert.equal(replaced.template.id, 'template.cleave-kit', 'Replace keeps the id');
  assert.equal(replaced.template.cardType, 'skill');
  assert.deepEqual(replaced.template.card.effects, other.effects);
  assert.deepEqual(first, frozen, 'the old list is not changed');
});

test('template ids are template.<slug> and stay unique', () => {
  assert.equal(TemplateIdFor('Heavy Blow!!'), 'template.heavy-blow');
  assert.equal(TemplateIdFor('Heavy blow', [{ id: 'template.heavy-blow' }, { id: 'template.heavy-blow-2' }]), 'template.heavy-blow-3');
  assert.equal(TemplateIdFor('***'), 'template.template');
  const one = SaveCardAsTemplate([], sourceCard(), { name: 'Heavy blow' }).templates;
  const two = SaveCardAsTemplate(one, sourceCard(), { name: 'Heavy-blow' }).templates;
  assert.deepEqual(two.map(t => t.id), ['template.heavy-blow', 'template.heavy-blow-2']);
});

test('a card from a template gets a fresh id, Auto-name on, New card defaults and equal mechanics', () => {
  const template = SaveCardAsTemplate([], sourceCard(), { name: 'Area cleave' }).template;
  const cards = [{ id: 'custom.card_1' }, { id: 'custom.card_1_new' }];
  const id = FreshCardId(cards, 1);
  assert.equal(id, 'custom.card_1_new_new', "New's id loop checks every card");
  let normalized = 0;
  const card = CardFromTemplate(template, { id, normalize: def => { normalized++; return def; }, textFor: def => `text for ${def.type}` });
  assert.equal(normalized, 1);
  assert.equal(card.id, id);
  assert.equal(card._autoName, true, 'the name is generated');
  assert.equal(card._custom, true); assert.equal(card._edited, true);
  assert.equal(card.class, 'colorless', 'dropped fields take New card defaults');
  assert.equal(card.textTemplate, 'text for attack');
  assert.notEqual(card.name, 'Area cleave', "the template's name is not copied");
  assert.deepEqual(TemplateCardFields(card), template.card, 'mechanics equal the template');
  assert.equal('scoringOverride' in card, false);
});

test('copy, not linked: editing or replacing a template never changes a card made from it', () => {
  const list = SaveCardAsTemplate([], sourceCard(), { name: 'Kit' }).templates;
  const card = CardFromTemplate(list[0], { id: 'custom.card_a' });
  const cardBefore = JSON.stringify(card);
  list[0].card.effects[0].amount = 99; list[0].card.tags.push('extra');
  assert.equal(JSON.stringify(card), cardBefore);
  const renamed = RenameTemplate(list, list[0].id, 'Kit renamed').templates;
  const replaced = SaveCardAsTemplate(renamed, { type: 'power', effects: [] }, { name: 'Kit renamed', replace: true }).templates;
  DeleteTemplate(replaced, replaced[0].id);
  assert.equal(JSON.stringify(card), cardBefore);
  // And the other way: editing the card does not change the template.
  const fresh = SaveCardAsTemplate([], sourceCard(), { name: 'Kit' }).templates;
  const made = CardFromTemplate(fresh[0], { id: 'custom.card_b' });
  made.effects[0].amount = 1; made.tags.length = 0;
  assert.equal(fresh[0].card.effects[0].amount, 8); assert.ok(fresh[0].card.tags.length > 0);
});

test('rename keeps the id and content and refuses an empty or taken name; delete removes one', () => {
  let list = SaveCardAsTemplate([], sourceCard(), { name: 'One' }).templates;
  list = SaveCardAsTemplate(list, sourceCard(), { name: 'Two' }).templates;
  const renamed = RenameTemplate(list, 'template.one', 'Uno');
  assert.equal(renamed.templates[0].id, 'template.one');
  assert.equal(renamed.templates[0].name, 'Uno');
  assert.deepEqual(renamed.templates[0].card, list[0].card);
  assert.equal(RenameTemplate(list, 'template.one', ' ').problem, 'Give the template a name.');
  assert.match(RenameTemplate(list, 'template.one', 'two').problem, /already named "Two"/);
  assert.ok(RenameTemplate(list, 'template.one', 'ONE').templates, 'a case change of its own name is allowed');
  assert.deepEqual(DeleteTemplate(list, 'template.one').map(t => t.id), ['template.two']);
  assert.equal(list.length, 2, 'the input list is not changed');
});

test('templates group by card type, attacks first, names sorted', () => {
  let list = [];
  for (const [name, type] of [['Zed', 'skill'], ['Alpha', 'power'], ['Bash', 'attack'], ['Axe', 'attack']]) list = SaveCardAsTemplate(list, { type, effects: [] }, { name }).templates;
  assert.deepEqual(GroupTemplatesByType(list).map(group => [group.type, group.templates.map(t => t.name)]), [['attack', ['Axe', 'Bash']], ['skill', ['Zed']], ['power', ['Alpha']]]);
});

test('missing art layers are reported, layers are never copied', () => {
  const template = SaveCardAsTemplate([], sourceCard(), { name: 'Kit', artLayerIds: ['layer-1', 'layer-gone'] }).template;
  assert.deepEqual(MissingArtLayerIds(template, [{ id: 'layer-1' }]), ['layer-gone']);
  assert.equal('artLayers' in CardFromTemplate(template, { id: 'custom.card_x' }), false);
});

test('export then import round-trips the templates', () => {
  let list = SaveCardAsTemplate([], sourceCard(), { name: 'One', artLayerIds: ['layer-1'], now: 't1' }).templates;
  list = SaveCardAsTemplate(list, { type: 'skill', effects: [{ op: 'block', amount: 4 }] }, { name: 'Two', now: 't2' }).templates;
  const file = TemplateFile(list);
  assert.equal(file.kind, CARD_TEMPLATES_KIND); assert.equal(file.formatVersion, 1);
  const parsed = ParseTemplateFile(JSON.stringify(file, null, 2));
  assert.deepEqual(parsed.templates, list);
  const merged = MergeImportedTemplates([], parsed.templates);
  assert.deepEqual(merged.templates.map(t => [t.name, t.id]), [['One', 'template.one'], ['Two', 'template.two']]);
  assert.deepEqual(merged.templates.map(t => t.card), list.map(t => t.card));
});

test('importing clashing names numbers them and every imported template gets a fresh id', () => {
  const existing = SaveCardAsTemplate([], sourceCard(), { name: 'Kit' }).templates;
  const incoming = [{ ...existing[0] }, { ...existing[0], id: 'template.other', name: 'kit' }];
  const merged = MergeImportedTemplates(existing, incoming);
  assert.deepEqual(merged.templates.map(t => t.name), ['Kit', 'Kit 2', 'kit 3']);
  const ids = merged.templates.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'ids stay unique');
  assert.equal(merged.added.length, 2);
  assert.equal(existing.length, 1, 'the existing list is not changed');
});

test('a broken file changes nothing and names its first problem', () => {
  const good = TemplateFile(SaveCardAsTemplate([], sourceCard(), { name: 'Kit' }).templates);
  const cases = [
    ['{ nope', /^Not valid JSON/],
    ['[]', /one JSON object/],
    [JSON.stringify({ ...good, kind: 'other' }), /Not a card templates file/],
    [JSON.stringify({ ...good, formatVersion: 2 }), /Format version 2 is not supported/],
    [JSON.stringify({ ...good, templates: {} }), /"templates" must be a list/],
    [JSON.stringify({ ...good, templates: [{ ...good.templates[0], name: '' }] }), /Template 1: Give the template a name/],
    [JSON.stringify({ ...good, templates: [{ ...good.templates[0], id: 'bad id' }] }), /Template 1 \("Kit"\): "id"/],
    [JSON.stringify({ ...good, templates: [{ ...good.templates[0], card: [] }] }), /"card" must be an object/],
    [JSON.stringify({ ...good, templates: [{ ...good.templates[0], card: { effects: [] } }] }), /needs a "type"/],
    [JSON.stringify({ ...good, templates: [{ ...good.templates[0], artLayerIds: [1] }] }), /"artLayerIds" must be a list of text/],
    [JSON.stringify({ ...good, templates: [good.templates[0], good.templates[0]] }), /Template 2: the id "template.kit" is used twice/],
    [JSON.stringify({ ...good, templates: [good.templates[0], { ...good.templates[0], id: 'template.kit-2', name: 'KIT' }] }), /Template 2: the name "KIT" is used twice/],
  ];
  for (const [text, pattern] of cases) {
    const result = ParseTemplateFile(text);
    assert.equal(result.templates, undefined, text);
    assert.match(result.problem, pattern, text);
  }
  const refused = ParseTemplateFile(good, { checkCard: card => (card.effects.length > 1 ? 'Effect 2 must be an object with an "op" name.' : '') });
  assert.equal(refused.problem, 'Template 1 ("Kit"): Effect 2 must be an object with an "op" name.', "the Studio's card checks are reused");
});

test('import keeps only template card fields', () => {
  const file = { kind: CARD_TEMPLATES_KIND, formatVersion: 1, templates: [{ id: 'template.kit', name: 'Kit', card: { type: 'attack', id: 'leak', name: 'Leak', _autoName: false, scoringOverride: {}, effects: [] } }] };
  const { templates } = ParseTemplateFile(file);
  assert.deepEqual(templates[0].card, { type: 'attack', effects: [] });
  assert.deepEqual(templates[0].artLayerIds, []);
});

test('the in-memory store keeps a copy of the saved file', () => {
  const store = createMemoryTemplateStore();
  assert.equal(store.load(), null);
  const file = TemplateFile(SaveCardAsTemplate([], sourceCard(), { name: 'Kit' }).templates);
  store.save(file);
  file.templates.length = 0;
  assert.equal(store.load().templates.length, 1);
  const loaded = store.load(); loaded.templates.length = 0;
  assert.equal(store.load().templates.length, 1);
});
