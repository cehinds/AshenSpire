// W1c Character creation as a W1 workspace — the category order, the footer
// each category offers, the rail's entries and the attribute-grid columns
// (docs/architecture-handoff/FRONTEND-WIREFRAMES.md "W1c — Character
// creation"; RESPONSIVE-WIREFRAMES.md W1c). The screen (ui/screens/customize.js)
// draws what these say; the rail/selector rule is CategoryNavModel's.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creationCategories, creationStep, creationFooterPlan, creationRailItems, creationAttributeColumns, creationPortraitRem,
} from '../src/ui/models/CreationWorkspaceModel.js';
import { uiConfig } from '../src/config/generated/ui.js';

const categories = creationCategories();

test('the categories come from config, in order, without repeats', () => {
  assert.deepEqual([...categories], uiConfig.screens.creation.behavior.categories);
  assert.ok(categories.length >= 2);
  assert.throws(() => creationCategories({ behavior: { categories: [] } }), /at least one/);
  assert.throws(() => creationCategories({ behavior: { categories: ['class', 'class'] } }), /repeats/);
});

test('Next and Back step through the categories and stop at the ends', () => {
  assert.equal(creationStep(categories, categories[0], 1), categories[1]);
  assert.equal(creationStep(categories, categories[0], -1), null);
  assert.equal(creationStep(categories, categories.at(-1), 1), null);
  assert.equal(creationStep(categories, categories.at(-1), -1), categories.at(-2));
  assert.throws(() => creationStep(categories, 'nowhere', 1), /not a creation category/);
});

test('the footer always has two actions: Back leaves or steps back, the primary is Next then Begin', () => {
  const first = creationFooterPlan({ categories, current: categories[0] });
  assert.equal(first.back, 'leave');
  assert.equal(first.primary, 'next');
  assert.equal(first.next, categories[1]);
  assert.equal(first.actions, 2);
  const middle = creationFooterPlan({ categories, current: categories[1] });
  assert.equal(middle.back, 'previous');
  assert.equal(middle.previous, categories[0]);
  assert.equal(middle.primary, 'next');
  const last = creationFooterPlan({ categories, current: categories.at(-1) });
  assert.equal(last.primary, 'begin');
  assert.equal(last.next, null);
  assert.equal(last.back, 'previous');
});

test('the rail names every category, carries its value, and selects exactly one', () => {
  const items = creationRailItems({
    categories, current: 'character',
    labels: { class: 'Class', character: 'Character' },
    values: { class: 'Reaver', character: 'Forsaken' },
  });
  assert.equal(items.length, categories.length);
  assert.equal(items.filter((item) => item.selected).length, 1);
  assert.equal(items.find((item) => item.id === 'class').value, 'Reaver');
  assert.equal(items.find((item) => item.id === 'equipment').label, 'equipment', 'an unlabelled category falls back to its id');
  assert.throws(() => creationRailItems({ categories, current: 'nowhere' }), /not a creation category/);
});

test('attributes take two columns on a wide pane and one on a narrow one, from config', () => {
  const { attributeColumnsWide, attributeColumnsNarrow, attributeNarrowBelowRem } = uiConfig.screens.creation.sizing;
  const rem = 16;
  assert.equal(creationAttributeColumns({ hostWidthPx: attributeNarrowBelowRem * rem, rootFontPx: rem }), attributeColumnsWide);
  assert.equal(creationAttributeColumns({ hostWidthPx: (attributeNarrowBelowRem - 1) * rem, rootFontPx: rem }), attributeColumnsNarrow);
  assert.equal(creationAttributeColumns({}), attributeColumnsNarrow, 'an unmeasured pane takes one column');
  assert.throws(() => creationAttributeColumns({ hostWidthPx: 800, rootFontPx: 16 }, { sizing: { attributeColumnsWide: 0, attributeColumnsNarrow: 1, attributeNarrowBelowRem: 40 } }), /whole number/);
});

test('the header portrait size is the config value', () => {
  assert.equal(creationPortraitRem(), uiConfig.screens.creation.sizing.headPortraitRem);
  assert.throws(() => creationPortraitRem({ sizing: { headPortraitRem: 0 } }), /must be > 0/);
});

test('every --creation-* property the CSS reads comes from config, and a bad value is a config error', async () => {
  const { creationCssProperties } = await import('../src/ui/models/CreationWorkspaceModel.js');
  const properties = creationCssProperties();
  for (const [name, value] of Object.entries(properties)) {
    assert.match(name, /^--creation-[a-z-]+$/, name);
    assert.ok(typeof value === 'string' && value.length, `${name} is empty`);
  }
  assert.equal(properties['--creation-portrait'], `${uiConfig.screens.creation.sizing.headPortraitRem}rem`);
  assert.equal(properties['--creation-choice-lines'], String(uiConfig.screens.creation.sizing.choiceDescriptionLines));
  assert.equal(properties['--creation-attribute-columns'], String(uiConfig.screens.creation.sizing.attributeColumnsNarrow), 'unmeasured, the grid rests at the narrow count');
  assert.equal(properties['--creation-attribute-gap'], `${uiConfig.screens.creation.sizing.attributeGapPx}px`);
  const broken = structuredClone(uiConfig.screens.creation);
  broken.sizing.choiceCompactGapRem = 0;
  assert.throws(() => creationCssProperties(broken), /choiceCompactGapRem must be > 0/);
});

test('choice descriptions clip to the config lines and the fit rule is data', async () => {
  const { creationChoiceLines, creationFitsChoices } = await import('../src/ui/models/CreationWorkspaceModel.js');
  assert.equal(creationChoiceLines(), uiConfig.screens.creation.sizing.choiceDescriptionLines);
  assert.throws(() => creationChoiceLines({ sizing: { choiceDescriptionLines: 0 } }), /whole number/);
  assert.equal(creationFitsChoices(), uiConfig.screens.creation.behavior.fitChoicesToPane === true);
  assert.equal(creationFitsChoices({ behavior: {} }), false);
});
