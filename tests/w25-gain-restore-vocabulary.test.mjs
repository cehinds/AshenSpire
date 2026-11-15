// Owner, 2026-11-15: "there should be a distinction between gain and restore. gain can exceed maximum, restore can go up to maximum."
// Every shipped Core card and relic text that says "Gain N <pool>" is backed by an op that can exceed the pool's maximum, and every
// "Restore N <pool>" by an op that stops at it. HP keeps its established word, Heal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const rules = { combatExpansionVersion: 2, gameProfile: profile };
// What each op does to its pool (src/engine/actions.js): gainEnergy adds to Stamina with no cap; restoreStamina, restoreMana, restorePoise
// and gainWard (the Ward pool refill) stop at the maximum; gainBarrier and gainPoise (a guard) are uncapped bonus Poise.
const EXCEED = { Mana: [], Stamina: ['gainEnergy'], Ward: ['applyStatus:ward'], Poise: ['gainBarrier', 'applyStatus:barrier', 'gainPoise', 'block', 'applyStatus'] }; // a spell Defend's `block` and a status-driven shield become Barrier stacks at play (content/combatExpansionCards.js)
const CAPPED = { Mana: ['restoreMana'], Stamina: ['restoreStamina'], Ward: ['gainWard'], Poise: ['restorePoise'] };
const opsOf = card => new Set([...(card.effects || []), ...(card.upgrade?.effects || [])].flatMap(e => [e.op, e.op === 'applyStatus' ? `applyStatus:${e.status}` : null]).filter(Boolean));
const strip = html => String(html).replace(/<[^>]*>/g, '');
const shipped = id => !id.startsWith('base.');
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const VERB = /\b(Gain|Restore)s? (?:\{[^}]+\}|\d+) (Mana|Stamina|Ward|Poise)\b(?!\/| guard)/gi;

function problems(label, text, ops) {
  const bad = [];
  for (const [, verb, pool] of String(text).matchAll(VERB)) {
    const kind = verb.toLowerCase() === 'gain' ? EXCEED : CAPPED;
    if (!kind[pool].some(op => ops.has(op))) bad.push(`${label}: "${verb} N ${pool}" but ops are ${[...ops].join(',')}`);
  }
  return bad;
}

test('card texts and faces: Gain only for ops that can exceed the maximum, Restore only for capped ops', () => {
  const bad = [];
  for (const card of reg.cards.all().filter(c => shipped(c.id))) {
    const ops = opsOf(card);
    const strip1 = text => typeof text === 'string' ? text.replace(/(\{(?:gainEnergy|gainBarrier|restoreMana|restoreStamina|restorePoise|gainWard|ward|barrier)(?:\.\d+)?\})/g, '$1') : text;
    for (const [where, text] of [['textTemplate', card.textTemplate], ['upgrade', card.upgrade?.textTemplate],
      ['plain', safe(() => cardPlainText(reg, { cardId: card.id, abilityRank: 1 }, { rules }), '')],
      ...(safe(() => cardFaceLines(card, null, reg, rules), []) || []).map((line, i) => [`face.${i}`, strip(line.html ?? '')])]) {
      // A template names its op in the token: {restoreMana} Mana is a capped refill, {gainEnergy} Stamina an uncapped gain.
      const tokenOps = new Set([...ops, ...[...String(strip1(text) || '').matchAll(/\{([A-Za-z]+)(?:\.\d+)?\}/g)].map(m => m[1] === 'ward' || m[1] === 'barrier' ? `applyStatus:${m[1]}` : m[1])]);
      bad.push(...problems(`${card.id} ${where}`, text, where === 'textTemplate' || where === 'upgrade' ? new Set([...ops].filter(op => tokenOps.has(op))) : ops));
    }
  }
  assert.deepEqual(bad, []);
});

test('relic texts: Gain and Restore follow the op their token names', () => {
  const bad = [];
  for (const relic of reg.relics.all()) {
    const text = String(relic.textTemplate || '');
    for (const m of text.matchAll(/\b(gain|restores?) \{([A-Za-z]+)\} (Mana|Stamina)/gi)) {
      const gains = m[1].toLowerCase() === 'gain';
      const exceeds = m[2] === 'gainEnergy', capped = ['restoreMana', 'restoreStamina'].includes(m[2]);
      if (gains ? !exceeds : !capped) bad.push(`${relic.id}: ${m[0]}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the ops behave as their words say: gainEnergy exceeds the maximum, restoreStamina and restoreMana stop at it', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const A = await import('../src/engine/actions.js');
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const p = combat.player;
  const exec = (op, amount) => A.executeAction(combat, { effect: { op, target: 'self', amount }, source: p, owner: p, target: p, card: null, meta: {} });
  p.energy = p.maxStamina; exec('gainEnergy', 2);
  assert.equal(p.energy, p.maxStamina + 2, 'Gain Stamina may exceed the maximum');
  p.stamina = p.maxStamina; exec('restoreStamina', 3);
  assert.equal(p.stamina, p.maxStamina, 'Restore Stamina stops at the maximum');
  p.mana = p.maxMana; exec('restoreMana', 3);
  assert.equal(p.mana, p.maxMana, 'Restore Mana stops at the maximum');
});
