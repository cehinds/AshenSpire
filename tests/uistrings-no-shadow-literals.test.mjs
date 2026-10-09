// tests/uistrings-no-shadow-literals.test.mjs — a migrated sentence has ONE home.
//
// #1489 moved about 200 rows of interface copy into content/source/uiStrings.csv.
// Six Codex findings on it were the same defect: the control's first face read
// t(id), and some other path (a refresh, a repaint, an aria-label, a tooltip
// title, a model's default label) still wrote the old literal, so rewording the
// row moved the text until the first repaint and then put it back. Fixing them
// one thread at a time did not stop the seventh. This sweep does.
//
// For every frozen migration fixture (including #1489, #1535, #1578, #1651 and #1671), plus
// any row the branch adds over origin/dev when git can say so, it takes the
// short, full and tip text and looks for that same text as a string, template
// or markup literal anywhere in src/ui. A hit is a control that can paint the
// old words. It is either routed through t()/tFull()/tTip(), or it is listed in
// ALLOWED below with the reason it is not copy (an id, a stored value, a lookup
// key) or not this row's copy (the same English word naming something else).
// An allowance that no longer matches anything fails too, so the list cannot rot.
//
// The matcher is deliberately literal-bounded: the text must open a literal
// (after ', ", ` or >) and end it, or be followed by a ${…} or a ' + concat. So
// 'Use name' does not count as the row "Use", and comments are stripped first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uiStrings } from '../src/content/generated/uiStrings.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const csvIds = (text) => new Set(text.split('\n').filter((line) => line && !line.startsWith('#')).map((line) => line.split(',')[0]).filter((id) => id && id !== 'id'));

const frozenMigrationIds = (number) => JSON.parse(readFileSync(join(ROOT, `tests/fixtures/uistrings-migrated-${number}.json`), 'utf8')).ids;
const permanentMigratedIds = () => new Set([1489, 1535, 1578, 1651, 1671, 1767].flatMap(frozenMigrationIds));

function migratedIds() {
  // Merged rows must remain protected when origin/dev advances or is absent.
  const ids = permanentMigratedIds();
  // Rows a branch adds after #1489 are swept too while they are under review.
  // A checkout without origin/dev (a tarball, a shallow clone) keeps the frozen list.
  try {
    const dev = csvIds(execFileSync('git', ['show', 'origin/dev:content/source/uiStrings.csv'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    for (const id of csvIds(readFileSync(join(ROOT, 'content/source/uiStrings.csv'), 'utf8'))) if (!dev.has(id)) ids.add(id);
  } catch { /* no origin/dev here */ }
  return ids;
}

// [file, text, reason]. Every entry must still match at least one site.
const ID = 'an id or stored value, not copy';
const ALLOWED = [
  ['src/ui/audio.js', 'disabled', 'stored music status value; not the optional reaction switch face'],
  ['src/ui/components/coopProgressionDoor.js', 'disabled', 'DOM property key; not reaction switch copy'],
  ['src/ui/components/holdconfirm.js', 'disabled', 'stored hold mode; not reaction switch copy'],
  ['src/ui/components/optionDecision.js', 'disabled', 'stored hold mode; not reaction switch copy'],
  ['src/ui/models/CombatToolsModel.js', 'Small', 'stable log size id; its rendered face reads combat.log.size.small'],
  ['src/ui/models/CombatToolsModel.js', 'Medium', 'stable log size id; its rendered face reads combat.log.size.medium'],
  ['src/ui/models/CombatToolsModel.js', 'Large', 'stable log size id; its rendered face reads combat.log.size.large'],
  ['src/ui/models/WireframeChoiceModel.js', 'Medium', 'wireframe preview size, separate from the combat log size'],
  ['src/ui/screens/combat.js', 'Small', 'stored log size id; the shared tools renderer supplies its face'],
  ['src/ui/screens/combat.js', 'disabled', 'HTML disabled attribute; not reaction switch copy'],
  ['src/ui/screens/combat.js', 'Upcast', 'ordinary hand-card upcast control, separate from the reaction option tier sentence'],
  ['src/ui/screens/coop.js', 'Small', 'stored log size id; the shared tools renderer supplies its face'],
  ['src/ui/screens/coop.js', 'disabled', 'HTML disabled attribute; not reaction switch copy'],
  ['src/ui/screens/coop.js', 'Upcast', 'ordinary hand-card upcast control, separate from the reaction option tier sentence'],
  ['src/ui/components/coopUpcastControl.js', 'Upcast', 'ordinary hand-card default label, separate from the reaction option tier sentence'],
  ['src/ui/screens/settings.js', 'enabled', 'stored prologue property key; not reaction switch copy'],
  ['src/ui/screens/worldAtlas.js', 'disabled', 'HTML disabled attributes; not reaction switch copy'],
  ['src/ui/components/friendlyTargets.js', 'Target', 'friendly-target accessibility prefix; not the numbered enemy target label row'],
  ['src/ui/screens/settings.js', 'Progression', `advanced-group id; ${ID}`],
  ['src/ui/models/AdvancedSettingsGroups.js', 'Progression', `advanced-group id; ${ID}`],
  ['src/ui/components/combatantInspector.js', 'Skills', 'combatant active abilities section, separate from the player progression tab'],
  ['src/ui/components/overlay.js', 'Class', 'combat HUD identity field, separate from the progression tab'],
  ['src/ui/screens/customRun.js', 'Class', 'custom run class selector, separate from the progression tab'],
  ['src/ui/screens/customize.js', 'Character', 'character creation fold, separate from the progression tab'],
  ['src/ui/components/illustratedCard.js', 'Georgia', 'CSS font-family fallback, not a displayed font-selection label'],
  ['src/ui/screens/settings.js', 'Stamina', `Recovery topic id; ${ID}`],
  // Settings: category, advanced-group and topic ids. The faces read t('settings.group.*').
  ['src/ui/screens/settings.js', 'Audio', `category id (cat: 'Audio', GENERAL_GROUPS) and General › Audio's own subgroup; ${ID}`],
  ['src/ui/screens/settings.js', 'Stats', `advanced-group id (group.id === 'Stats', MERGED_ADVANCED_GROUPS); ${ID}`],
  ['src/ui/screens/settings.js', 'Recovery', `advancedGroup id; ${ID}`],
  ['src/ui/screens/settings.js', 'Deck', `advancedGroup id and RELEASE_ADVANCED_GROUP_IDS; ${ID}`],
  ['src/ui/screens/settings.js', 'Interface', `advancedGroup id; and General › Display's own "Interface" subgroup, a different heading from Advanced › Interface`],
  ['src/ui/screens/settings.js', 'Battlefield', `advanced-group id; ${ID}`],
  ['src/ui/screens/settings.js', 'Changelog', `advanced-group id and a stored category value; ${ID}`],
  ['src/ui/screens/settings.js', 'About', `advanced-group id and a stored category value; ${ID}`],
  ['src/ui/screens/settings.js', 'Poise', `Stats topic ids and their migration map; ${ID}`],
  ['src/ui/screens/settings.js', 'Move', 'the opening-scene reorder buttons\' aria ("Move <scene> up"), not the formation Move confirm'],
  ['src/ui/screens/settings.js', 'Copied', '"Copied <what>." is the export status sentence, not the Copy button face (that reads common.copied)'],
  ['src/ui/models/AdvancedSettingsGroups.js', 'Stats', `advanced-group id; ${ID}`],
  ['src/ui/models/AdvancedSettingsGroups.js', 'Deck', `advanced-group / topic id; ${ID}`],
  ['src/ui/models/AdvancedSettingsGroups.js', 'Interface', `advanced-group id; ${ID}`],
  ['src/ui/models/AdvancedSettingsGroups.js', 'Battlefield', `advanced-group id; ${ID}`],
  ['src/ui/models/AdvancedSettingsGroups.js', 'Poise', `Stats topic id; ${ID}`],
  ['src/ui/models/AdvancedSettingsGroups.js', 'Stamina', `Stats topic id; ${ID}`],
  ['src/ui/models/StatsPreviewModel.js', 'Poise', `Stats topic id and the rating abbreviation table (RATING_LABELS keys ratings, not this overview row); ${ID}`],
  ['src/ui/models/WireframeChoiceModel.js', 'Modals', `layout family id, persisted (tests/uistrings-stable-ids.test.mjs); ${ID}`],
  ['src/ui/models/WireframeChoiceModel.js', 'Menus', `layout family id, persisted; ${ID}`],
  ['src/ui/models/WireframeChoiceModel.js', 'Scenes', `layout family id, persisted; ${ID}`],
  ['src/ui/models/LoreTypeModel.js', 'IM Fell English', 'dev-era stored loreFace value mapped to its id (legacy read)'],
  ['src/ui/models/LoreTypeModel.js', 'EB Garamond', 'dev-era stored loreFace value mapped to its id (legacy read)'],
  ['src/ui/models/LoreTypeModel.js', 'Cormorant Garamond', 'dev-era stored loreFace value mapped to its id (legacy read)'],
  ['src/ui/models/LoreTypeModel.js', 'Crimson Pro', 'dev-era stored loreFace value mapped to its id (legacy read)'],
  ['src/ui/models/LoreTypeModel.js', 'Libre Baskerville', 'dev-era stored loreFace value mapped to its id (legacy read)'],
  ['src/ui/models/CombatantInspectorSections.js', 'Poise', `meter id list (INSPECTOR_PREVIEW_METERS); ${ID}`],
  ['src/ui/components/tooltipGlossary.js', 'Poise', 'glossary term matched against rules text, which content owns; a lookup key'],
  ['src/ui/previews/tooltipReviewScene.js', 'Cards', 'dev review scene category id, compared with ==='],
  ['src/ui/previews/tooltipReviewScene.js', 'Exhaust', 'dev review scene\'s sample keyword tooltip (a card keyword, not the combat pile)'],
  // The same English word naming a different thing. Rewording the row must NOT move these.
  ['src/ui/components/combatantOverhead.js', 'Inspect', 'combatant overhead inspection names a combatant, not the Reading Desk card inspection action'],
  ['src/ui/components/creationCards.js', 'List', 'character creation layout selector, separate from the deck display selector'],
  ['src/ui/components/offlinePlay.js', 'All', 'the save-import replacement warning begins with All slots; it is not the collection filter'],
  ['src/ui/input.js', 'Inspect', 'global input binding label, separate from the Reading Desk card action'],
  ['src/ui/screens/settings.js', 'Undo', 'settings change undo, separate from the deck transaction undo'],
  ['src/ui/screens/worldAtlas.js', 'Inspect', 'local map point inspection aria-label, separate from card inspection'],
  ['src/ui/models/LocalServiceModel.js', 'Cards', 'a service receipt\'s item category, not the Armoury tab'],
  ['src/ui/screens/equipment.js', 'Hand', 'the Armoury Resources table\'s hand-size line, not the Stats preview "Hand" topic title'],
  ['src/ui/components/formationMovement.js', 'Move to', 'formation cell movement confirmation and action cost, not the Armoury action that moves an item to an equipment slot'],
  ['src/ui/screens/equipment.js', 'Poise', '"Poise <n>" is an item\'s poise threshold, not the Stats preview line'],
  ['src/ui/screens/customRun.js', 'Deck', 'Custom Climb\'s Deck section, not the Settings Deck topic'],
  ['src/ui/input.js', 'Deck', 'control-bar short for Open Armoury (Deck); no migrated row names this action (the Armoury tab is "Cards")'],
  ['src/ui/models/SmithSelectionModel.js', 'Discard', 'a card upgrade\'s discard value ("Discard +1"), not the combat Discard pile'],
  ['src/ui/screens/worldAtlas.js', 'Map zoom', 'the local map\'s live zoom readout, not the Settings row that sets the world map\'s default zoom'],
  ['src/ui/screens/combat.js', 'Poise', 'the stat meter and resistance sentence name the Poise stat; statsPreview.overview.poise labels one preview line'],
  ['src/ui/screens/coop.js', 'Poise', 'the stat meter names the Poise stat, not the Stats preview line'],
  ['src/ui/screens/customize.js', 'Poise', 'character creation\'s Poise stat card, not the Stats preview line'],
  ['src/ui/components/creationCards.js', 'Poise', 'character creation\'s Poise chip, not the Stats preview line'],
];

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (line, lead) => lead + ' '.repeat(line.length - lead.length));
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.js') ? [join(dir, entry.name)] : []));
const reEscape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** text → the row ids and forms that author it. A {token} row contributes the text before its first token. */
function migratedTexts(ids = migratedIds()) {
  const texts = new Map();
  for (const row of uiStrings) {
    if (!ids.has(row.id)) continue;
    for (const form of ['short', 'full', 'tip']) {
      const text = row[form];
      if (typeof text !== 'string' || !text.trim()) continue;
      const lead = text.split(/\{\w+\}/)[0].trim();
      if (lead.length < 3) continue;
      if (!texts.has(lead)) texts.set(lead, []);
      texts.get(lead).push(`${row.id}.${form}`);
    }
  }
  return texts;
}

// Compiled once, swept once: both assertions below read the same hits.
let swept;
function sweep() {
  if (swept) return swept;
  const patterns = [...migratedTexts()].map(([text, rows]) => ({
    text, rows, re: new RegExp(`(?<=['"\`>])${reEscape(text)}(?=['"\`<]| ?\\$\\{| ['"\`])`),
  }));
  const hits = [];
  for (const path of walk(join(ROOT, 'src/ui'))) {
    const file = relative(ROOT, path).split('\\').join('/');
    const lines = stripComments(readFileSync(path, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      for (const { text, rows, re } of patterns) {
        if (line.includes(text) && re.test(line)) hits.push({ file, line: index + 1, text, rows, source: line.trim().slice(0, 120) });
      }
    });
  }
  return (swept = hits);
}

test('the sweep has rows to sweep', () => {
  assert.ok(migratedTexts().size > 100, 'the migrated-row list came back nearly empty');
});

test('all 25 compact Armament rows remain covered independently of origin/dev', () => {
  const frozen = frozenMigrationIds(1578);
  assert.equal(new Set(frozen).size, 25, 'retain every authored Armament row after promotion');
  for (const id of frozen) assert.ok(uiStrings.some(row => row.id === id), `missing authored row ${id}`);
  const permanent = migratedTexts(permanentMigratedIds());
  assert.ok(permanent.get('Move to')?.includes('armoury.action.moveTo.short'),
    'the semantic formation allowance must still be checked after the branch delta becomes empty');
});

test('all 35 Progression hub rows remain protected after origin/dev contains the migration', () => {
  const frozen = frozenMigrationIds(1671);
  assert.equal(new Set(frozen).size, 35, 'retain every row authored for the Progression hub');
  for (const id of frozen) assert.ok(uiStrings.some(row => row.id === id), `missing authored row ${id}`);
  // The permanent list alone simulates an empty branch delta or missing origin/dev.
  const permanent = migratedTexts(permanentMigratedIds());
  assert.ok(permanent.get('Progression')?.includes('progression.title.short'),
    'protect the title and its distinct settings-group ID allowance after promotion');
  assert.ok(permanent.get('Associated cards')?.includes('progression.cards.short'),
    'protect the hub inspection copy independently of git branch state');
});

test('all three enemy target rows remain protected independently of origin/dev', () => {
  const frozen = frozenMigrationIds(1651);
  assert.deepEqual([...frozen].sort(), [
    'combat.enemyTarget.choose', 'combat.enemyTarget.health', 'combat.enemyTarget.label',
  ], 'retain every authored target picker row, without duplicate IDs');
  const permanentIds = permanentMigratedIds();
  for (const id of frozen) {
    assert.ok(permanentIds.has(id), `missing permanent coverage for ${id}`);
    assert.ok(uiStrings.some(row => row.id === id), `missing authored row ${id}`);
  }
  // The permanent list alone simulates an empty branch delta or missing origin/dev.
  const permanent = migratedTexts(permanentIds);
  assert.ok(permanent.get('Choose an enemy target')?.includes('combat.enemyTarget.choose.full'));
  assert.ok(permanent.get('Target')?.includes('combat.enemyTarget.label.full'),
    'the distinct friendly-target accessibility allowance must remain checked after promotion');
  // Health starts with a value token, so it has no literal prefix to sweep.
  // Its live renderer must still read that authored row rather than rebuild it.
  const picker = stripComments(readFileSync(join(ROOT, 'src/ui/components/enemyTargetPicker.js'), 'utf8'));
  for (const id of frozen) assert.ok(picker.includes(`tFull('${id}'`), `target picker must consume ${id}`);
  const health = uiStrings.find(row => row.id === 'combat.enemyTarget.health');
  assert.match(health.full, /\{hp\}.*\{maxHp\}/, 'the authored health row retains both live values');
});

test('no src/ui literal repaints a row #1489 moved into uiStrings.csv', () => {
  const allowed = new Set(ALLOWED.map(([file, text]) => `${file}\u0000${text}`));
  const shadows = sweep().filter((hit) => !allowed.has(`${hit.file}\u0000${hit.text}`));
  assert.deepEqual(shadows.map((hit) => `${hit.file}:${hit.line} "${hit.text}" (${hit.rows[0]}) — ${hit.source}`), [],
    'each of these paints the old words of a migrated row: route it through t(), or allowlist it with a reason');
});

test('every allowance still matches something, and gives a reason', () => {
  const hits = sweep();
  for (const [file, text, reason] of ALLOWED) {
    assert.ok(reason && reason.length > 10, `${file} "${text}" has no reason`);
    assert.ok(hits.some((hit) => hit.file === file && hit.text === text), `${file} "${text}" is allowlisted but no longer appears — drop it`);
  }
});
