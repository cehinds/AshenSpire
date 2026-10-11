// Co-op ordinary attacks use the same sequential receipt timeline as solo
// without borrowing enemy-turn UI state or dropping their authored visuals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldPaceCoopReceipts } from '../src/ui/screens/coop.js';

const source = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
const session = readFileSync(new URL('../tools/session.mjs', import.meta.url), 'utf8');
const body = (name) => {
  const start = source.indexOf(`\n  function ${name}(`);
  assert.ok(start > 0, `coop.js must define ${name}()`);
  const next = source.indexOf('\n  function ', start + 1);
  return source.slice(start, next > 0 ? next : undefined);
};

test('ordinary attack receipts enter the timeline, while non-attacks retain the direct path', () => {
  assert.equal(shouldPaceCoopReceipts([{ type: 'cardPlayed', cardType: 'attack' }]), true);
  assert.equal(shouldPaceCoopReceipts([{ type: 'cardPlayed', cardType: 'skill' }]), false);
  assert.equal(shouldPaceCoopReceipts([{ type: 'blockGained', amount: 4 }]), false);
  assert.equal(shouldPaceCoopReceipts([{ type: 'enemyMoveStarted' }]), true);
});

test('a player attack timeline does not claim the enemy turn or lock player controls', () => {
  const render = body('renderCombat');
  assert.match(render, /data-turn="\$\{enemyPacing \|\| sc\.phase === 'enemy'/);
  assert.match(render, /hand\.inert = enemyPacing \|\|/);
  assert.doesNotMatch(render, /hand\.inert = pacing \|\|/);
  assert.match(source, /let enemyPacing = false; \/\/ only an enemy-turn replay owns the turn UI and controls/);
});

test('the timeline actor consumes the prepared stance, aura, and sprite-effect plan', () => {
  const pace = body('paceReactionReceipts');
  assert.match(pace, /prepareCombatAnimations\(receiptScene, next\);\s*const timelineAnimations = new Map\(pendingAnimations\);/s);
  assert.match(pace, /timelineAnimations\.get\(ownerId\)/);
  assert.match(pace, /playCombatEffectPlan\(layer, anchorLocalBox\(layer, sprite\), plan\.spriteEffect/);
  assert.match(pace, /stage\?\.play\(pose, duration, actorAura\)/);
  assert.match(source, /heldStances\.accept\(event, \{ \.\.\.definition, cardTags: tags \}\)/);
});

test('a finishing attack carries and paces its final combat frame before the replacement scene', () => {
  const receive = body('receiveSnapshot');
  const pace = body('paceReactionReceipts');
  assert.match(session, /const combatReceipts = last;/, 'the replacement scene carries the authoritative final combat frame');
  assert.match(receive, /const receiptScene = sc\?\.kind === 'combat' \? sc : sc\?\.combatReceipts;/);
  assert.match(receive, /shouldPaceCoopReceipts\(receiptScene\.events\)[\s\S]*paceReactionReceipts\(s, receiptScene\)/);
  assert.match(pace, /function paceReactionReceipts\(next, receiptScene = next\.scene\)/);
  assert.match(pace, /prepareCombatAnimations\(receiptScene, next\)/);
  assert.match(pace, /snap = next;\s*render\(\);/, 'the replacement scene renders only after the receipt timeline');
});
