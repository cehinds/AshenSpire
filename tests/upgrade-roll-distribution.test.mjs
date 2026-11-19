// Card-upgrade redesign (owner, 2026-11-19), step 1: measure what the roll offers per card type.
// Rolls ~2000 seeded upgrades per card type and upgrade number and prints the share of each group (ease,
// effectiveness/cost, new effect, identity). The numbers are printed, and only sanity is asserted, so a later change
// to the roll shows up as a moved table in the commit message, not as a brittle failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollUpgradeOptions, upgradeStepRng, rarityOfStep } from '../src/model/cardUpgradeSteps.js';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const byId = (id) => cards.find((c) => c.id === id);
const ROLLS = 2000;

// A step's group, from the section 6 table of docs/balance/buff-drawbacks-proposal-2026-11-19.md.
const EASE_FX = new Set(['unexhaust', 'unethereal', 'steady']);
const IDENTITY_TAGS = ['range:', 'targeting:', 'maneuver:', 'school:'];
function groupOf(step) {
  if (step.k === 'combo') return groupOf(step.steps[0]);
  if (step.k === 'fx') return EASE_FX.has(step.fx) ? 'ease' : 'new';
  if (step.k === 'tag') {
    if (step.damageSchool) return 'eff';
    if (step.tag === 'rank.cantrip') return 'eff';
    if (step.damage && !step.tag) return 'identity';
    return IDENTITY_TAGS.some((p) => step.tag?.startsWith(p)) ? 'identity' : 'new';
  }
  if (step.k === 'stk' && step.n < 0) return 'ease';
  if (['dmg', 'blk', 'stk', 'cost', 'hits', 'poise'].includes(step.k)) return 'eff';
  return 'new';
}

const withKeyword = (card, ...words) => ({ ...card, keywords: [...(card.keywords || []), ...words] });
export const SAMPLES = [
  ['attack (Strike)', byId('core.strike')],
  ['attack + Exhaust', withKeyword(byId('core.strike'), 'exhaust')],
  ['smash', byId('core.smash')],
  ['sweep', byId('core.sweep')],
  ['counter', byId('core.counter')],
  ['defend', byId('core.defend')],
  ['evade', byId('core.evade')],
  ['skill + Ethereal/Exhaust', byId('core.retreat')],
  ['spell (attack)', byId('core.cinderDart')],
  ['spell (skill)', byId('core.glimpse')],
  ['power', byId('core.heraldSpecial')],
];
const STAGES = [0, 4, 7, 9];

export function distribution(card, stepIndex, rolls = ROLLS) {
  const groups = { ease: 0, eff: 0, new: 0, identity: 0 };
  const rarities = { common: 0, uncommon: 0, rare: 0 };
  const kinds = {};
  let got = 0;
  for (let i = 0; i < rolls; i += 1) {
    const step = rollUpgradeOptions(card, [], stepIndex, upgradeStepRng(1000 + i, `dist-${card.id}`, stepIndex), {}, 1)[0];
    if (!step) continue;
    got += 1;
    groups[groupOf(step)] += 1;
    rarities[rarityOfStep(step)] += 1;
    const key = step.k === 'fx' ? `fx:${step.fx}` : step.k;
    kinds[key] = (kinds[key] || 0) + 1;
  }
  return { groups, rarities, kinds, got };
}

test('upgrade roll distribution per card type (printed)', () => {
  const pct = (n, total) => `${((100 * n) / total).toFixed(1)}%`.padStart(6);
  const lines = ['group shares per card type: ease / effectiveness-cost / new effect / identity | common / uncommon / rare'];
  for (const [label, card] of SAMPLES) {
    assert.ok(card, label);
    for (const stepIndex of STAGES) {
      const { groups, rarities, got } = distribution(card, stepIndex);
      if (!got) { lines.push(`${label.padEnd(26)} #${String(stepIndex + 1).padEnd(2)} no options`); continue; }
      lines.push(`${label.padEnd(26)} #${String(stepIndex + 1).padEnd(2)} ${pct(groups.ease, got)} ${pct(groups.eff, got)} ${pct(groups.new, got)} ${pct(groups.identity, got)} | ${pct(rarities.common, got)} ${pct(rarities.uncommon, got)} ${pct(rarities.rare, got)}`);
      assert.equal(groups.ease + groups.eff + groups.new + groups.identity, got);
    }
  }
  console.log(lines.join('\n'));
});
