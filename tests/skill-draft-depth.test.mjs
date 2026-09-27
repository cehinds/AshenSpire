// Skill-draft depth (SPEC §13.4e): a levelled weapon or focus drafts from the
// class reward pool filtered to its schools and to the rarities the level has
// opened. Every hand a class can be created with must offer at least
// MIN_PER_TIER distinct cards at every rarity tier, so a draft is a choice and
// consecutive levels do not repeat the same few cards. Before this floor the
// Reaver's sword and shield drafted commons only and the Starseer's Ash Focus
// (a ritual staff) drafted nothing at all.
import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { characterCreation } from '../src/content/generated/characterCreation.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { rollSkillDraftIds } from '../src/engine/encounters.js';

const MIN_PER_TIER = 4;
const reg = createRegistries(contentBundle);
const schools = new Set(reg.nodes.filter((n) => n.parentId === 'card').map((n) => n.id));
const tiers = Object.keys(reg.balance.skill.rarityUnlock);

test('every creation hand drafts at least four distinct cards per rarity tier', () => {
  const short = [];
  for (const cls of contentBundle.classes) {
    for (const handId of characterCreation.classes[cls.id].handIds) {
      const piece = reg.equipment.armaments.find((a) => a.id === handId);
      const own = (piece.tags || []).filter((t) => schools.has(t));
      for (const rarity of tiers) {
        const ids = new Set(cls.cardPool.filter((id) => {
          const def = reg.cards.get(id);
          return def.rarity === rarity && (def.tags || []).some((t) => own.includes(t));
        }));
        if (ids.size < MIN_PER_TIER) short.push(`${cls.id} ${handId} [${own}] ${rarity}: ${ids.size}`);
      }
    }
  }
  assert.deepEqual(short, []);
});

test("a fresh Starseer's Ash Focus drafts its ash rites at every tier", () => {
  const run = createRunState({ seed: 0x4b4b, classId: 'starseer', registries: reg });
  for (const rarity of tiers) {
    const level = reg.balance.skill.rarityUnlock[rarity];
    const ids = rollSkillDraftIds(reg, createRng(7), { classId: 'starseer', loadout: run.loadout, skillId: 'item:magic-focus', level });
    assert.equal(ids.length, reg.balance.skill.draftSize, `level ${level}`);
    assert.ok(ids.every((id) => reg.cards.get(id).tags.includes('ritual')), `level ${level}: ${ids}`);
  }
});
