import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardDefinition, playingCardModel } from '../src/model/playingCard.js';
import { cardPlainText, cardDetailHtml } from '../src/ui/components/card.js';
import { createCombat, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';

const rules = { combatExpansionVersion: 2, reactionRulesVersion: 2, breakMeterVersion: 2 };
const plain = html => String(html).replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export function wardToBlockCardText() {
  const registries = createRegistries(contentBundle);
  const refs = contentBundle.cards.flatMap(card => [
    { cardId: card.id },
    ...(card.upgrade ? [{ cardId: card.id, upgraded: true }] : []),
    ...(card.gradeProfiles || []).map((_, abilityRank) => ({ cardId: card.id, abilityRank })),
  ]);
  for (const profile of registries.equipment.basicCardProfiles || [])
    refs.push({ cardId: profile.role === 'defend' ? 'defend' : 'strike', profileId: profile.id });
  const cards = [];
  const seen = new Set();
  for (const ref of refs) {
    const key = JSON.stringify(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    const def = playingCardDefinition(registries, ref, { rules });
    const model = playingCardModel(registries, ref, { definition: def });
    if (!def.defenseRange && !['defense', 'counter', 'evade', 'sweep'].includes(model.stanceType)) continue;
    const inspectionHtml = cardDetailHtml(registries, ref, { rules });
    cards.push({ ref, name: def.name, cardCategory: model.cardCategory, stanceType: model.stanceType,
      stanceGroups: model.stanceGroups, abilityRank: model.abilityRank, rank: model.rank,
      compact: cardPlainText(registries, ref, { rules }), inspection: plain(inspectionHtml), inspectionHtml });
  }
  const liveExamples = [];
  for (const cardId of ['fireCounter', 'frostCounter', 'forceCounter', 'crystalBarrier']) {
    const ctx = createCombat({ registries, rng: createRng(5), ...rules,
      ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
      player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 30, mana: 30,
        maxStamina: 30, stamina: 30, energyMax: 30, drawPerTurn: 1,
        deck: [{ cardId, instanceId: 'text-example', abilityRank: 1 }] } });
    ctx.player.ratings = { ar: 0, dr: 3, pr: 3, ward: 30, poise: 30 };
    ctx.player.statuses = {};
    const ref = ctx.piles.hand.find(card => card.instanceId === 'text-example');
    const preview = previewCard(ctx, ref.instanceId, ctx.enemies[0].id);
    const inspectionHtml = cardDetailHtml(registries, ref, { rules, preview });
    liveExamples.push({ ref, DR: 3, PR: 3, compact: cardPlainText(registries, ref, { rules, preview }),
      inspection: plain(inspectionHtml), inspectionHtml, values: preview.values });
  }
  return { assumptions: 'Version 2 authored default/upgrade/rank text; live examples use actual preview with DR 3 and PR 3, no status bonuses.', cards, liveExamples };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = resolve(process.argv[2] || 'artifacts/ward-to-block/card-text.json');
  mkdirSync(resolve(output, '..'), { recursive: true });
  const data = wardToBlockCardText();
  writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
  console.log(JSON.stringify({ output, cards: data.cards.length, liveExamples: data.liveExamples.length }));
}
