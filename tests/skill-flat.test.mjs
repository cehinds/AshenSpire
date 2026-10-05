// tests/skill-flat.test.mjs — SPEC §13.4o: every `balance.skill.flatEvery`
// levels of a card-school track adds 1 to the primary number of every card of
// its schools. Derived (stamped as `skillBonus`) from the best track,
// applied in resolveCard beside the rank, and carried into combat.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard, primaryEffectIndex } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { awardSkillXp, xpToNext, stampSkillBonuses, skillBonusFor, skillSchools } from '../src/model/skills.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { stampDeck } from '../src/model/loadout.js';

const registries = createRegistries(contentBundle);
const BLADE = 'item:blade';
const toLevel = (run, level) => awardSkillXp(registries, run, BLADE, Array.from({ length: level }, (_, l) => xpToNext(registries, 'weapon', l)).reduce((a, b) => a + b, 0));

test('the flat is floor(level / flatEvery) for each track whose schools a card carries', () => {
  assert.equal(registries.balance.skill.flatEvery, 5);
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  run.deck.push({ instanceId: 'r', cardId: 'rend', upgraded: false });
  assert.ok(skillSchools(registries, run.loadout, BLADE).length, 'the reaver holds a blade');
  toLevel(run, 4);
  stampSkillBonuses(registries, run);
  assert.equal(run.deck.find((c) => c.instanceId === 'r').skillBonus, undefined, 'level 4 earns nothing');
  awardSkillXp(registries, run, BLADE, xpToNext(registries, 'weapon', 4));
  stampSkillBonuses(registries, run);
  assert.equal(run.deck.find((c) => c.instanceId === 'r').skillBonus, 1, 'level 5 earns +1');
  const defend = run.deck.find((c) => c.cardId === 'defend');
  if (defend) assert.equal(skillBonusFor(registries, run, defend), (registries.cards.get('defend').tags || []).some((t) => skillSchools(registries, run.loadout, BLADE).includes(t)) ? 1 : 0);
  assert.deepEqual(validateRunShape(run).filter((p) => /skillBonus/.test(p)), []);
});

test('the face, the play and the rank all read one number', () => {
  const base = resolveCard(registries, { cardId: 'rend' });
  const i = primaryEffectIndex(base);
  assert.equal(resolveCard(registries, { cardId: 'rend', skillBonus: 2 }).effects[i].amount, base.effects[i].amount + 2);
  assert.equal(resolveCard(registries, { cardId: 'rend', rank: 3, skillBonus: 1 }).effects[i].amount, base.effects[i].amount + 3, 'rank and flat stack');
  assert.equal(resolveCard(registries, { cardId: 'thousandCutsRogue', skillBonus: 1 }).effects[0].amount, 3, 'a multi-hit card splits it, rounded up');
});

test('combat carries the stamped bonus; a full restamp refreshes it', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  toLevel(run, 5);
  run.deck.push({ instanceId: 'r', cardId: 'rend', upgraded: false });
  const combat = createRunCombat({ registries, rng: createRng(3), run, enemyIds: ['wanderingSoldier'] });
  const copy = [...combat.piles.draw, ...combat.piles.hand].find((c) => c.instanceId === 'r');
  assert.equal(copy.skillBonus, 1, 'the fight starts with the bonus stamped');
  run.skills[BLADE].level = 0;
  stampDeck(registries, run);
  assert.equal(run.deck.find((c) => c.instanceId === 'r').skillBonus, undefined, 'a full restamp clears a bonus the levels no longer earn');
});

test('a malformed skillBonus is refused on load', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  for (const bad of [0, -1, 1.5, '1']) {
    run.deck[0].skillBonus = bad;
    assert.ok(validateRunShape(run).some((p) => /deck\[0\]\.skillBonus/.test(p)), `skillBonus ${JSON.stringify(bad)} is refused`);
  }
});

test('a card earns the flat of its best track, not a sum, and never past the cap', async () => {
  const { MAX_SKILL_BONUS } = await import('../src/model/skills.js');
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  const levels = (id, kind, n) => awardSkillXp(registries, run, id, Array.from({ length: n }, (_, l) => xpToNext(registries, kind, l)).reduce((a, b) => a + b, 0));
  levels(BLADE, 'weapon', 5);
  levels('item:shield', 'weapon', 10);
  levels('dualWield', 'dual', 5);
  stampSkillBonuses(registries, run);
  const bash = run.deck.find((c) => c.cardId === 'shieldBash');
  assert.ok(bash, 'the reaver deals Shield Bash');
  assert.equal(bash.skillBonus, 2, 'blade +1, shield +2, dual +1: the best is +2, not +4');
  const flood = { ...run, skills: { [BLADE]: { xp: 0, level: 1000, pendingDrafts: 0 } } };
  const capped = { ...registries, balance: { ...registries.balance, skill: { ...registries.balance.skill, flatEvery: 1 } } };
  assert.equal(skillBonusFor(capped, flood, { cardId: 'rend' }), MAX_SKILL_BONUS, 'no setting stamps what a save refuses');
});

test('co-op seats stamp the bonus before their fight', () => {
  const session = readFileSync(new URL('../tools/session.mjs', import.meta.url), 'utf8');
  assert.match(session, /function memberAsPlayer\(m\) \{[\s\S]{0,400}?stampSkillBonuses\(registries, m\.run\);[\s\S]{0,40}?return \{/);
});

test('the level popup counts the cards a claim actually raised', async () => {
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const { rewardDom } = await import('./helpers/reward-dom.mjs');
  const { bankSkillXp, claimBankedSkillLevel } = await import('../src/model/skills.js');
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    const run = createRunState({ seed: 4, classId: 'reaver', registries });
    toLevel(run, 4);
    run.deck = [{ instanceId: 'r', cardId: 'rend', upgraded: false }, { instanceId: 'd', cardId: 'defend', upgraded: false }];
    bankSkillXp(registries, run, BLADE, xpToNext(registries, 'weapon', 4));
    mountRewards(app, { registries, run, onDone() {}, onPersist: () => stampSkillBonuses(registries, run),
      onClaimSkill: (id) => claimBankedSkillLevel(registries, run, id),
      saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
      rewards: { xpGains: { level: 0, tracks: { [BLADE]: 1 } } } });
    app.querySelector(`.reward-level-up[data-track="${BLADE}"]`).click();
    const summary = app.querySelector('.reward-level-summary').textContent;
    const expected = run.deck.filter((c) => skillBonusFor(registries, run, c) > 0).length;
    assert.ok(expected >= 1);
    assert.match(summary, new RegExp(`${expected} cards? gains? \\+1\\.`));
  } finally { Object.assign(globalThis, saved); }
});
