// Owner, 2026-11-15 (W25-W): "instead of saying add 1 barrier it could just be gain x poise". The word Barrier leaves every player-facing text of the
// shipped Core: card names and faces, relics, status names and tooltips, interface strings, and the upgrade option labels. Internals (the `barrier`
// status id, the `gainBarrier` op) stay for saves. A card that adds N Barrier stacks reads "Gain N x poisePerStack Poise".
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { cardPlainText, relicText } from '../src/ui/components/card.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { cardEffectLine } from '../src/ui/models/CardOptionSummaryModel.js';
import { fixCoreStatusDefinition } from '../src/model/fixCoreMechanics.js';
import { uiStrings } from '../src/content/generated/uiStrings.js';
import { combatLogEntries } from '../src/model/combatLog.js';
import { POISE_ON_MODULES } from './helpers/poise-on.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { ...POISE_ON_MODULES } });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const BARRIER = /\bbarrier\b/i;
// `base.*` is the hash-locked Persistent proposal fixture pack (tests/base-card-pack.test.mjs); no Core pool deals it.
const shipped = id => !id.startsWith('base.');
const strip = html => String(html).replace(/<[^>]*>/g, '');
const rules = { combatExpansionVersion: 2, gameProfile: profile };

test('no shipped Core card name, face, text or upgrade label shows the word Barrier', () => {
  const bad = [];
  for (const card of reg.cards.all().filter(c => shipped(c.id))) {
    const texts = [['name', card.name], ['textTemplate', card.textTemplate], ['upgrade.textTemplate', card.upgrade?.textTemplate],
      ...(card.faceTemplate || []).map((line, i) => [`faceTemplate.${i}`, line]),
      ['plain', safe(() => cardPlainText(reg, { cardId: card.id, abilityRank: 1 }, { rules }))],
      ...(safe(() => cardFaceLines(card, null, reg, rules), []) || []).map((line, i) => [`face.${i}`, strip(line.html ?? line.faceHtml ?? '')])];
    for (const [where, text] of texts) if (typeof text === 'string' && BARRIER.test(text.replace(/\{[^}]*\}/g, ''))) bad.push(`${card.id} ${where}: ${text.slice(0, 80)}`);
    // The upgrade picker's tile line for a card that adds Barrier stacks.
    for (const row of safe(() => cardEffectLine(card, null, reg), [])) if (BARRIER.test(`${row.label}${row.before}${row.after}`)) bad.push(`${card.id} option line ${row.label}`);
  }
  assert.deepEqual(bad, []);
});
function safe(fn, fallback = '') { try { return fn(); } catch { return fallback; } }

test('no shipped relic text or status name or tooltip shows the word Barrier', () => {
  const bad = [];
  for (const relic of reg.relics.all()) if (BARRIER.test(`${relic.name} ${safe(() => relicText(relic, reg))}`)) bad.push(`relic ${relic.id}`);
  const ctx = { registries: reg, combatExpansionVersion: 2, gameProfile: profile, fixCoreRules: profile.fixCoreRules };
  for (const status of reg.statuses.all().filter(s => shipped(s.id))) {
    const row = safe(() => fixCoreStatusDefinition(ctx, status.id, status), status);
    for (const text of [status.name, status.tooltip, row.name, row.tooltip, row.description]) if (typeof text === 'string' && BARRIER.test(text)) bad.push(`status ${status.id}: ${text.slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

test('no interface string or combat log line shows the word Barrier', () => {
  const bad = uiStrings.filter(row => BARRIER.test(`${row.short} ${row.full} ${row.tip}`)).map(row => row.id);
  assert.deepEqual(bad, []);
  const enemies = [{ id: 'e1', enemyId: 'graveWisp' }];
  const lines = combatLogEntries([{ type: 'statusApplied', targetId: 'player', sourceId: 'e1', status: 'barrier', stacks: 2 }, { type: 'barrierGained', targetId: 'player', amount: 6 },
    { type: 'barrierBroken', targetId: 'player' }, { type: 'statusExpired', targetId: 'player', status: 'barrier' }], { registries: reg, enemies }).map(row => row.text);
  assert.deepEqual(lines.filter(text => BARRIER.test(text)), []);
  assert.ok(lines[0].includes('gained 10 Poise'), lines[0]);
});

test('a card that adds Barrier stacks reads the Poise they give (stacks x poisePerStack)', () => {
  const text = cardPlainText(reg, { cardId: 'sanctuaryCleanse', abilityRank: 1 }, { rules });
  assert.match(text, /Gain 15 Poise/);
});
