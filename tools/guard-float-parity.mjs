// Focused guard-hit parity gate (#207).
//
// The fast door proves the semantic split, the authoritative co-op session
// receipts, and five named source mutations. Browser/source/root evidence is
// added by the same tool's visual lane once shared artifact ownership clears.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession } from './session.mjs';
import { guardHitFloatParts } from '../src/ui/fx.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REG = createRegistries(contentBundle);
const failures = [];
const pass = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

const expected = new Map([
  ['full', { amount: 7, blocked: 7, guard: '7', damage: null }],
  ['partial', { amount: 7, blocked: 4, guard: '4', damage: '-3' }],
  ['unguarded', { amount: 7, blocked: 0, guard: null, damage: '-7' }],
]);

console.log('\nGUARD FLOAT PARITY — focused source door');
for (const [name, row] of expected) {
  const got = guardHitFloatParts(row);
  pass((got.guard ? got.guard.text : null) === row.guard
      && (got.damage ? got.damage.text : null) === row.damage,
    `semantic ${name}`,
    `guard=${got.guard?.text || 'none'} damage=${got.damage?.text || 'none'}`);
  pass(!got.guard || (!got.guard.text.startsWith('+') && got.guard.cls.includes('blk')),
    `${name} absorbed channel is unsigned guard styling`);
}

function coopReceiptMatrix() {
  const game = createSession({ registries: REG, seedString: 'GUARD2' });
  for (const [id, name] of [['p1', 'Full'], ['p2', 'Partial'], ['p3', 'Unguarded']]) {
    game.addMember({ id, name, classId: 'reaver' });
  }
  game.start();
  const nodeId = game.session.mapGraph.startIds[0];
  for (const id of ['p1', 'p2', 'p3']) game.chooseNode(id, nodeId);
  const combat = game.live.combat;
  const opening = game.snapshot().scene;
  if (opening.enemies.length !== 1 || opening.enemies[0].intent?.moveId !== 'slash'
    || opening.enemies[0].intent?.damage !== 7) {
    throw new Error('GUARD2 no longer opens one authoritative 7-damage slash');
  }
  for (const [id, block] of [['p1', 7], ['p2', 4], ['p3', 0]]) {
    const entity = combat.players.get(id).entity;
    entity.hp = 30;
    entity.block = block;
  }
  game.combatEndTurn('p1');
  const before = structuredClone(game.snapshot().scene);
  game.combatEndTurn('p2');
  game.combatEndTurn('p3');
  const after = structuredClone(game.snapshot().scene);
  return { before, after };
}

const coop = coopReceiptMatrix();
const receipts = coop.after.events.filter((event) => event.type === 'damageDealt');
pass(receipts.length === 3, 'co-op transports one damageDealt receipt per real hit', `${receipts.length}/3`);
for (const [index, [id, blocked, hp]] of [['p1', 7, 30], ['p2', 4, 27], ['p3', 0, 23]].entries()) {
  const event = receipts[index];
  const player = coop.after.players.find((entry) => entry.id === id);
  pass(event?.playerId === id && event?.amount === 7 && event?.blocked === blocked,
    `co-op ${id} receipt keeps seat/amount/blocked`, JSON.stringify(event));
  pass(player?.hp === hp && player?.block === 0,
    `co-op ${id} mutation remains HP${hp}/B0`, `HP${player?.hp}/B${player?.block}`);
}

const paths = {
  fx: resolve(ROOT, 'src/ui/fx.js'),
  coop: resolve(ROOT, 'src/ui/screens/coop.js'),
  session: resolve(ROOT, 'tools/session.mjs'),
};
const source = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path, 'utf8')]));

function sourceContract(tree) {
  return [
    /const residual = amount - blocked;/.test(tree.fx),
    /guard: blocked > 0 \? \{ text: String\(blocked\), cls: 'blk small' \}/.test(tree.fx),
    /damage: residual > 0 \? \{ text: `-\$\{residual\}`/.test(tree.fx),
    /type === 'damageDealt' && payload\.targetId === 'player'[\s\S]{0,120}playerId: combat\.playerKey/.test(tree.session),
    /\.filter\(\(e\) => \[[^\]]*'damageDealt'/.test(tree.session),
    /for \(const ev of now !== prev \? \(now\.events \|\| \[\]\) : \[\]\)[\s\S]{0,900}receiptTargets\.add/.test(tree.coop),
    /!receiptTargets\.has\(`player:\$\{p\.id\}`\)/.test(tree.coop),
  ].every(Boolean);
}

pass(sourceContract(source), 'source seams form one receipt-driven contract');
const plants = [
  ['solo-collapses-to-preblock-total', 'fx', 'const residual = amount - blocked;', 'const residual = amount;'],
  ['absorbed-channel-omitted', 'fx', 'guard: blocked > 0 ? { text: String(blocked), cls: \'blk small\' }', 'guard: null'],
  ['absorbed-mislabeled-as-gain', 'fx', 'text: String(blocked)', 'text: `+${blocked}`'],
  ['coop-drops-damage-receipt', 'session', "'enemyMoveStarted', 'damageDealt',", "'enemyMoveStarted',"],
  ['coop-guesses-from-block-delta', 'coop', 'for (const ev of now !== prev ? (now.events || []) : [])', 'for (const ev of [])'],
];
for (const [name, file, find, replacement] of plants) {
  const planted = { ...source, [file]: source[file].replace(find, replacement) };
  pass(planted[file] !== source[file] && !sourceContract(planted), `plant killed: ${name}`);
}

const crlf = Object.fromEntries(Object.entries(source).map(([key, text]) => [key, text.replace(/\n/g, '\r\n')]));
pass(sourceContract(crlf), 'forced-CRLF source contract remains green');

console.log(failures.length ? `\nGUARD FLOAT PARITY FAILED (${failures.length})` : '\nGUARD FLOAT PARITY OK');
process.exit(failures.length ? 1 : 0);
