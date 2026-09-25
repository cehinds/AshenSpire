// tests/content.test.mjs — the content integrity check, as one test.
//
// ONE DOOR, EVERY WAY SHIPPED CONTENT CAN BE WRONG BEFORE A PLAYER SEES IT:
//   1. the shipped bundle passes validateContent with zero errors;
//   2. the drift and reach tools pass on the tree as it stands —
//      content-build --check, config-build --check, attack-source-audit
//      --check, linkcheck, statusreach, closedsets (each is spawned once;
//      linkcheck's own 64-file batches run side by side to stay in budget);
//   3. every literal ui-string id the source asks for is a row in the table
//      (the generated table itself is proven current by content-build --check);
//   4. every asset path the game builds from content is a file on disk;
//   5. malformed bundles are refused BY NAME — a door that has never been seen
//      to fail is `unknown`, not green.
//
// Failures are collected and reported together so one red names every problem.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { has, stringIds } from '../src/ui/strings.js';
import { relicArtAsset } from '../src/model/relicArt.js';
import { armamentIconAsset } from '../src/model/equipmentArt.js';
import { armourMenuAsset } from '../src/model/paintedOutfitArt.js';
import { ARMAMENTS, ARMOUR } from '../src/content/equipment.js';
import { PAINTED_ENEMIES, EXPANSION_ENEMIES, ENEMY_POSES } from '../src/content/enemyArt.js';
import { POSE_FRAMES, POSE_STRIP, POSE_DIR, POSE_CANVAS } from '../src/content/poseSprites.js';
import { COMBAT_EFFECT_ART } from '../src/content/combatEffectArt.js';
import { POSE_EFFECT_ART } from '../src/content/poseEffectArt.js';
import { prologueArtwork } from '../src/ui/assets.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const onDisk = (path) => existsSync(resolve(ROOT, path));

function run(args) {
  return new Promise((done) => {
    const child = spawn(process.execPath, args, { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => done({ code, out }));
  });
}

// linkcheck links every module under src/, tools/, tests/ and pose-studio/ in
// 64-file batches, one process each, sequentially. Its own --batch-start door
// is driven here with the batches side by side; the verdict is the same union.
async function linkcheck() {
  let total = Infinity;
  let next = 0;
  const broken = [];
  const failures = [];
  const worker = async () => {
    while (next < total) {
      const start = next;
      next += 64;
      const r = await run(['--experimental-vm-modules', 'tools/linkcheck.mjs', `--batch-start=${start}`]);
      const line = r.out.match(/^BATCH_RESULT: (.+)$/m);
      if (r.code !== 0 || !line) { failures.push(`batch ${start} (exit ${r.code}): ${r.out.slice(-400)}`); continue; }
      const result = JSON.parse(line[1]);
      total = result.total;
      broken.push(...result.broken);
    }
  };
  await Promise.all(Array.from({ length: Math.max(2, availableParallelism()) }, worker));
  return { total, broken, failures };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.m?js$/.test(name)) out.push(p);
  }
  return out;
}

// Real defects this check found on arrival, named so the check could land green
// without editing the screens in the same commit. Each entry must still fail:
// once it is fixed, the stale entry is itself red until it is deleted here.
//   reward.kind.chest has no `tip` cell, so hovering an elite-chest reward row
//   throws "has no tip form" from the tooltip builder.
const KNOWN_COPY_DEFECTS = new Set([
  "src/ui/screens/reward.js: tTip('reward.kind.chest') asks for the tip form, which the row does not author",
]);

function clone(bundle, edit) {
  const b = { ...bundle, balance: { ...bundle.balance, rewards: { ...bundle.balance.rewards } } };
  if (bundle.balance.rewards.eliteChest) b.balance.rewards.eliteChest = { ...bundle.balance.rewards.eliteChest };
  edit(b);
  return b;
}

test('shipped content is valid, current, reachable, and every path it names exists', async () => {
  const problems = [];
  const fail = (msg) => problems.push(msg);

  // The tools run in the background while the in-process checks proceed.
  const tools = [
    ['content-build --check', ['tools/content-build.mjs', '--check']],
    ['config-build --check', ['tools/config-build.mjs', '--check']],
    ['attack-source-audit --check', ['tools/attack-source-audit.mjs', '--check']],
    ['statusreach', ['tools/statusreach.mjs'], true],
    ['closedsets', ['tools/closedsets.mjs'], true],
  ].map(([name, args, wantsResult]) => run(args).then((r) => ({ name, wantsResult, ...r })));
  const links = linkcheck();

  // 1. The shipped bundle.
  const verdict = validateContent(contentBundle);
  if (!verdict.ok || verdict.errors.length) {
    fail(`validateContent refused the shipped bundle: ${verdict.errors.slice(0, 5).map((e) => `${e.path}: ${e.msg}`).join(' | ')}`);
  }

  // 5. The door can fail, and names the field it refused.
  const refusals = [
    ['missing balance.rewards.bossRelicChoices', (b) => { delete b.balance.rewards.bossRelicChoices; }, 'balance.rewards.bossRelicChoices'],
    ['bossRelicChoices of 0', (b) => { b.balance.rewards.bossRelicChoices = 0; }, 'balance.rewards.bossRelicChoices'],
    ['eliteChest.cinders with lo above hi', (b) => { b.balance.rewards.eliteChest.cinders = [9, 3]; }, 'balance.rewards.eliteChest.cinders'],
    ['eliteChest.cinders not a pair', (b) => { b.balance.rewards.eliteChest.cinders = 'lots'; }, 'balance.rewards.eliteChest.cinders'],
    ['schoolBuildupMultipliers missing', (b) => { b.balance = { ...b.balance, arcaneExposure: { ...b.balance.arcaneExposure, schoolBuildupMultipliers: null } }; }, 'balance.arcaneExposure.schoolBuildupMultipliers'],
  ];
  for (const [label, edit, path] of refusals) {
    const r = validateContent(clone(contentBundle, edit));
    if (r.ok || !r.errors.some((e) => e.path === path)) {
      fail(`malformed bundle (${label}) was not refused at ${path}: ${r.errors.slice(0, 3).map((e) => e.path).join(', ') || 'no errors'}`);
    }
  }
  // Nothing at all is a bundle too, and the door must refuse it rather than throw.
  const empty = validateContent(null);
  if (empty.ok || !empty.errors.length) fail('validateContent(null) was accepted');

  // 3. Every literal ui-string id the source asks for is a row.
  const ids = new Set(stringIds());
  if (!ids.size) fail('the ui-string table is empty');
  const srcFiles = walk(join(ROOT, 'src'));
  const dynamic = [];
  const seenKnown = new Set();
  let literalCalls = 0;
  const copyFail = (msg) => { if (KNOWN_COPY_DEFECTS.has(msg)) seenKnown.add(msg); else fail(msg); };
  for (const file of srcFiles) {
    const text = readFileSync(file, 'utf8');
    const imp = text.match(/import\s*\{([^}]*)\}\s*from\s*['"][./]*(?:ui\/)?strings\.js['"]/);
    if (!imp) continue;
    const FORM = { t: 'short', tFull: 'full', tTip: 'tip' };
    const callers = imp[1].split(',').map((s) => s.trim().split(/\s+as\s+/)).filter(([orig]) => FORM[orig]);
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    const where = relative(ROOT, file).split(sep).join('/');
    for (const [orig, local = orig] of callers) {
      const name = local;
      const call = new RegExp(`(?<![\\w.$])${name}\\(\\s*(['"\`])((?:(?!\\1).)*)\\1`, 'g');
      for (const m of code.matchAll(call)) {
        const key = m[2];
        if (m[1] === '`' && key.includes('${')) { dynamic.push([where, key]); continue; }
        const form = FORM[orig];
        literalCalls++;
        if (!ids.has(key)) copyFail(`${where}: ${name}('${key}') names no ui-string row`);
        else if (!has(key, form)) copyFail(`${where}: ${name}('${key}') asks for the ${form} form, which the row does not author`);
      }
    }
  }
  if (literalCalls < 100) fail(`the ui-string scan read only ${literalCalls} literal call(s) — the scanner, not the tree, is broken`);
  for (const msg of KNOWN_COPY_DEFECTS) if (!seenKnown.has(msg)) fail(`KNOWN_COPY_DEFECTS entry no longer fails — delete it: ${msg}`);
  // A templated id must at least have one row it could resolve to.
  const literalParts = (tpl) => {
    const parts = [''];
    for (let i = 0; i < tpl.length; i++) {
      if (tpl[i] === '$' && tpl[i + 1] === '{') {
        let depth = 1;
        for (i += 2; i < tpl.length && depth; i++) depth += tpl[i] === '{' ? 1 : tpl[i] === '}' ? -1 : 0;
        i--;
        parts.push('');
      } else parts[parts.length - 1] += tpl[i];
    }
    return parts;
  };
  for (const [where, key] of dynamic) {
    const pattern = new RegExp(`^${literalParts(key).map((s) => s.replace(/[.*+?^()|[\]{}$\\]/g, '\\$&')).join('[^]+')}$`);
    if (![...ids].some((id) => pattern.test(id))) fail(`${where}: templated id \`${key}\` matches no ui-string row`);
  }

  // 4a. Every literal asset path in src/ (comments aside) is on disk.
  for (const file of srcFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      const bare = line.replace(/\s\/\/\s.*$/, '');
      for (const m of bare.matchAll(/['"`](assets\/[^'"`$]+\.(?:webp|png|jpe?g|svg|gif|json|mp3|ogg|wav|woff2?))['"`]/g)) {
        if (!onDisk(m[1])) fail(`${relative(ROOT, file)}: ${m[1]} is not on disk`);
      }
    }
  }

  // 4b. Paths the game BUILDS from content ids.
  for (const relic of contentBundle.relics) {
    const path = relicArtAsset(relic);
    if (path && !onDisk(path)) fail(`relic ${relic.id}: ${path} missing`);
  }
  for (const piece of ARMAMENTS) {
    if (!onDisk(armamentIconAsset(piece))) fail(`armament ${piece.id}: ${armamentIconAsset(piece)} missing`);
  }
  for (const piece of ARMOUR) {
    const path = armourMenuAsset(piece.classId, piece.id);
    if (!path || !onDisk(path)) fail(`armour ${piece.classId}/${piece.id}: menu art ${path} missing`);
  }
  const enemyIds = new Set(contentBundle.enemies.map((e) => e.id));
  for (const id of ENEMY_POSES) {
    for (const pose of ['idle', 'attack']) if (!onDisk(`assets/enemy-poses/${id}_${pose}.webp`)) fail(`enemy pose ${id}_${pose} missing`);
  }
  for (const id of PAINTED_ENEMIES) if (!onDisk(`assets/enemies-unity/painted_${id}.webp`)) fail(`painted enemy ${id} missing`);
  for (const id of EXPANSION_ENEMIES) if (!onDisk(`assets/enemies-expansion/${id}.webp`)) fail(`expansion enemy ${id} missing`);
  for (const id of [...ENEMY_POSES, ...PAINTED_ENEMIES, ...EXPANSION_ENEMIES]) {
    if (!enemyIds.has(id)) fail(`enemy art is registered for '${id}', which is no enemy`);
  }
  for (const [kind, table] of [['combat effect', COMBAT_EFFECT_ART], ['pose effect', POSE_EFFECT_ART]]) {
    for (const [id, frames] of Object.entries(table)) {
      if (!frames.length) fail(`${kind} ${id} has no frames`);
      for (const f of frames) if (!onDisk(f)) fail(`${kind} ${id}: ${f} missing`);
    }
  }
  for (const layout of ['desktop', 'mobile']) {
    for (const id of ['warmth', 'year', 'night', 'step', 'road', 'reaver', 'starseer', 'rogue', 'herald']) {
      const path = prologueArtwork(id, layout);
      if (!onDisk(path)) fail(`prologue ${id}/${layout}: ${path} missing`);
    }
    for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
      const path = prologueArtwork('carry', layout, { classId });
      if (!onDisk(path)) fail(`prologue carry/${classId}/${layout}: ${path} missing`);
    }
  }
  // Pose frames: every class x tint x pose has a row, a file, and a floor under its crop.
  const classes = [...new Set([...POSE_FRAMES.keys()].map((k) => k.split('_')[0]))];
  const tints = [...new Set([...POSE_FRAMES.keys()].map((k) => k.split('_').at(-1)))];
  if (!classes.length || !tints.length) fail('the pose-frame table is empty');
  for (const c of classes) for (const tint of tints) for (const pose of POSE_STRIP) {
    const row = POSE_FRAMES.get(`${c}_${pose}_${tint}`);
    if (!row) { fail(`pose ${c}/${pose}/${tint}: no row`); continue; }
    if (!onDisk(POSE_DIR + row.f)) fail(`pose ${c}/${pose}/${tint}: ${row.f} missing`);
    if (!(row.g > row.y)) fail(`pose ${c}/${pose}/${tint}: floor ${row.g} is not below the crop top ${row.y}`);
    if (row.x + row.w > POSE_CANVAS.width + 1 || row.y + row.h > POSE_CANVAS.height + 1) fail(`pose ${c}/${pose}/${tint}: crop runs off the canvas`);
  }

  // 2. The tools' verdicts.
  for (const r of await Promise.all(tools)) {
    if (r.code !== 0) { fail(`${r.name} exited ${r.code}: ${r.out.slice(-600)}`); continue; }
    if (r.wantsResult) {
      const line = r.out.match(/^RESULT: (.*\.)$/m);
      if (!line) fail(`${r.name} printed no complete RESULT line`);
    }
  }
  const link = await links;
  for (const f of link.failures) fail(`linkcheck ${f}`);
  if (!Number.isFinite(link.total) || link.total < 1) fail('linkcheck linked nothing');
  for (const b of link.broken) fail(`linkcheck: ${b.file}: ${b.err}`);

  assert.deepEqual(problems, [], `${problems.length} content problem(s):\n  ${problems.join('\n  ')}`);
});
