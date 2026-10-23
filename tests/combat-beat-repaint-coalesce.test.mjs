// Perf contract for the combat playback repaint: beats share one repaint per frame, only geometry beats
// refit the battlefield, and every path that ends playback paints the whole board.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const between = (from, to) => { const a = src.indexOf(from); assert.ok(a >= 0, `missing ${from}`); const b = src.indexOf(to, a); assert.ok(b > a, `missing ${to}`); return src.slice(a, b); };
let checks = 0;
const ok = (cond, what) => { checks++; assert.ok(cond, what); };

const beat = between('onBeatApplied: (beat) => {', 'onFlush: () => {');
ok(!/renderCombatantStage\(/.test(beat) && !/renderTopbar\(/.test(beat) && !/renderHand\(/.test(beat),
  'a beat marks pieces dirty; it does not repaint them itself');
ok(/requestAnimationFrame\(flushBeatRender\)/.test(beat), 'non-geometry beats repaint on the next frame');
ok(/if \(beatDirty\.geometry/.test(beat) && /flushBeatRender\(\)/.test(beat), 'geometry beats paint before their effects start');
ok(/bloodRiteReaction/.test(beat), 'the per-beat blood rite reaction stays per beat');

const geometry = between('const GEOMETRY_BEAT_EVENT', ';\n');
for (const type of ['enemySpawned', 'enemyDied', 'playerDied', 'characterMoved', 'combatEnded']) {
  ok(new RegExp(geometry.match(/\/(.*)\/i/)[1], 'i').test(type), `${type} refits the battlefield`);
}
for (const type of ['damageDealt', 'healed', 'blockGained', 'statusApplied', 'cardDrawn']) {
  ok(!new RegExp(geometry.match(/\/(.*)\/i/)[1], 'i').test(type), `${type} does not refit the battlefield`);
}

const flush = between('function flushBeatRender()', '  // Cosmetic animations');
ok(/renderCombatantStage\(\{ fit: geometry \}\)/.test(flush), 'the coalesced repaint passes the geometry hint');
ok(/if \(hand\) renderHand\(\)/.test(flush), 'the hand repaints only for card events');

const flushPath = between('onFlush: () => {', '      finishPlayback');
ok(/discardBeatRender\(\)/.test(flushPath) && /\brender\(\)/.test(flushPath), 'a skipped playback ends with the full render');
const finish = between('const finishPlayback = () => {', 'showPendingDiscard();');
ok(/discardBeatRender\(\)/.test(finish) && /\brender\(\)/.test(finish), 'a finished playback ends with the full render');

ok(!/void pile\.offsetWidth/.test(src), 'the pile feedback restarts its animation without a forced reflow');
console.log(`PASS ${checks}/${checks}; combat beats repaint once per frame and refit only on geometry`);
