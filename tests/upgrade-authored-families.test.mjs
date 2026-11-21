// A card's authored first upgrade and the rolled alternative beside it are never of one family (review of
// feature/UpgradeOffersPerVisit). The family of each option is read here from what the modal says it changes, not from
// AuthoredFamilies, so the test does not trust the code it checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile, projectGameCard } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { cardUpgradeChanges } from '../src/ui/models/CardUpgradeModel.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const baseRun = createRunState({ seed: 1, classId: 'reaver', registries, runId: 'authored', profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

// Change-line label -> family, as a player reads the modal.
const LABEL_FAMILY = [
  [/^(DAMAGE|HITS|TARGET|ELEMENT|2ND HIT)$/, 'damage'],
  [/^(BLOCK|BARRIER|WARD GAIN|HEAL|COUNTER|REFLECT|POISE BACK)$/, 'defense'],
  [/^(STAMINA|MANA|COST)$/, 'cost'],
  [/^(STATUS|Poise dmg)$/, 'pressure'],
  [/^KEYWORDS$/, 'keyword'],
  [/^(RANGE|STANCE|SCHOOL|RANK|PLAYED)$/, 'form'],
];
// An ALSO or EFFECTS line names its effect in words.
const WORD_FAMILY = [
  [/Draws|Discards|Adds (a|\d)|Shuffles|Exhausts/, 'flow'],
  [/(STR|INT) (this turn|for the fight)/, 'damage'],
  [/(DEX|WIS) (this turn|for the fight)/, 'defense'],
  [/Hits (another|a random)/, 'damage'],
];
function familiesOf(changes) {
  const out = new Set();
  for (const change of changes) {
    const byLabel = LABEL_FAMILY.find(([pattern]) => pattern.test(change.label));
    if (byLabel) { out.add(byLabel[1]); continue; }
    const words = change.adds ? change.after : `${change.after}`.split(', ').filter((w) => !`${change.before}`.includes(w)).join(', ');
    for (const [pattern, family] of WORD_FAMILY) if (pattern.test(words)) out.add(family);
  }
  return out;
}

test('the rolled alternative never shares a family with the authored first upgrade, on every shipped card that has one', () => {
  const clashes = [];
  let checked = 0;
  const authoredCards = registries.cards.all().filter((def) => def.id.startsWith('core.') && def.upgrade && !Array.isArray(def.gradeProfiles));
  assert.ok(authoredCards.length > 20, `${authoredCards.length} cards with an authored upgrade`);
  for (const def of authoredCards) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const run = { ...baseRun, seed };
      const fresh = { instanceId: `a${seed}`, cardId: def.id, upgraded: false };
      const options = nextUpgradeOptions(run, fresh, def, registries, 2);
      if (options.length < 2) continue;
      checked += 1;
      const before = projectGameCard(run, fresh);
      const [authored, rolled] = options.map((step) => familiesOf(cardUpgradeChanges(registries, before, projectGameCard(run, { ...fresh, upgraded: true, upgradeSteps: [step] }))));
      const shared = [...rolled].filter((family) => authored.has(family));
      if (shared.length) clashes.push(`${def.id} seed ${seed}: ${shared} (${JSON.stringify(options[1])})`);
    }
  }
  assert.ok(checked > 500, `checked ${checked} offers`);
  assert.deepEqual(clashes, []);
});

test('every shipped authored upgrade belongs to at least one family', async () => {
  const { AuthoredFamilies } = await import('../src/model/cardUpgradeLimits.js');
  const none = registries.cards.all().filter((def) => def.id.startsWith('core.') && def.upgrade && !AuthoredFamilies(def).length).map((def) => def.id);
  assert.deepEqual(none, []);
});
