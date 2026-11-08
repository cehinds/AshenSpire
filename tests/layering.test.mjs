// tests/layering.test.mjs — two layering checks.
//
// 1. Headless rules layer (owner decision 2026-11-04, Unity-port shape): game rules in
//    src/engine/, src/model/ and engine/ stay headless. DEVELOPER.md, "The four layers".
//    Fails with file:line on (a) an import that resolves into src/ui/ or src/main.js,
//    (b) a browser global used outside comments and string literals.
//    globalThis.crypto is allowed (injectable default, not a DOM dependency).
// 2. Layer rank (docs/ARCHITECTURE-MAP.md, "Layer rank"): a relative import must point
//    to the same or a lower rank, and src/framework imports no ui. Inversions that exist
//    today are listed in KNOWN_INVERSIONS; a new one fails, and so does a listed one that
//    no longer occurs (delete it). The list only shrinks. *.generated.js files are skipped,
//    as in check 1.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RULE_DIRS = ['src/engine', 'src/model', 'engine'];
const BROWSER_GLOBALS = ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'requestAnimationFrame', 'HTMLElement'];

// A future exception is a visible edit here: entries are 'path/to/file.js' (repo-relative, posix).
const ALLOW = [];

// Layer rank, lowest first. Longest matching prefix wins. src/model and src/framework are peers.
const RANKS = [
  ['src/config', 0],
  ['src/content', 1],
  ['engine', 2],
  ['src/model', 3],
  ['src/framework', 3],
  ['src/engine', 4],
  ['src/services', 4],
];
const TOP_RANK = 5; // src/ui, src/main.js, src/dev and any other src/* file
const RANK_DIRS = RANKS.map(([d]) => d);

export function rankOf(rel) {
  let best = null;
  for (const [d, r] of RANKS) {
    if ((rel === d || rel.startsWith(`${d}/`)) && (!best || d.length > best[0].length)) best = [d, r];
  }
  if (best) return best[1];
  return rel.startsWith('src/') ? TOP_RANK : null;
}

// Every rank inversion that exists today, as 'importer -> target' (repo-relative, posix; target as
// resolved). Each group names the review box that removes it. Delete an entry when it is fixed.
const KNOWN_INVERSIONS = [
  // H2: the root kernel imports the model; bindings.mjs back-edge removed by its own box, formulas later
  'engine/runtime/bindings.mjs -> src/model/mechanicsKernel.js',
  'engine/runtime/evaluator.mjs -> src/model/formulas.js',
  // M6: content imports model helpers; the projections (combatExpansionCards, traitProjection, equipment) move into src/model, the rest move down
  'src/content/combatExpansionCards.js -> src/model/combatRanges.js',
  'src/content/combatExpansionCards.js -> src/model/spellDefense.js',
  'src/content/equipment.js -> src/model/combatRanges.js',
  'src/content/generated/gameProfiles.js -> src/model/catalogJson.js',
  'src/content/generated/tagging.js -> src/model/catalogJson.js',
  'src/content/index.js -> src/model/enemyMoveSources.js',
  'src/content/index.js -> src/model/progressionContent.js',
  'src/content/music.js -> src/model/schemas.js',
  'src/content/progression/cards.js -> src/model/combatCardProfile.js',
  'src/content/progression/feats.js -> src/model/classSkillFeatDescription.js',
  'src/content/progression/lessons.js -> src/model/combatCardProfile.js',
  'src/content/traitProjection.js -> src/model/cardClassification.js',
  'src/content/traitProjection.js -> src/model/combatCardProfile.js',
  // H2: framework optionDecision imports ui components; the ui side must import the framework instead
  'src/framework/optionDecision.js -> src/ui/components/holdconfirm.js',
  'src/framework/optionDecision.js -> src/ui/components/optionDecision.js',
  // H2: framework statusSemantics imports src/engine statuses; move the status data below the framework
  'src/framework/statusSemantics.js -> src/engine/combatStatusControl.js',
  'src/framework/statusSemantics.js -> src/engine/statuses.js',
  // H1: d20Chance/rng/stance/cardZones/enemyBurdens/elementRules/combatCardTraitMath move to src/model
  'src/model/actionCosts.js -> src/engine/combatRounds/stance.js',
  'src/model/bookBonusRewards.js -> src/engine/rng.js',
  'src/model/cardFaceProjection.js -> src/engine/d20Chance.js',
  'src/model/cardFaceText.js -> src/engine/d20Chance.js',
  'src/model/cardUpgradeSteps.js -> src/engine/rng.js',
  'src/model/equipmentCard.js -> src/engine/elementRules.js',
  'src/model/gameProfileRewards.js -> src/engine/rng.js',
  'src/model/playingCard.js -> src/engine/d20Chance.js',
  'src/model/proposalStatusRules.js -> src/engine/d20Chance.js',
  'src/model/rollReceipts.js -> src/engine/d20Chance.js',
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(e.name) && !e.name.endsWith('.generated.js')) out.push(p);
  }
  return out;
}

// Returns { noComments, code }: same length and line breaks as src.
// noComments keeps string literals (to read import specifiers); code blanks them too.
function scan(src) {
  let noComments = '', code = '';
  let i = 0;
  const n = src.length;
  const push = (a, b) => { noComments += a; code += b; };
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  function scanTemplate() {
    push(src[i++], ' ');
    while (i < n) {
      const c = src[i];
      if (c === '\\' && i + 1 < n) {
        const escaped = src.slice(i, i + 2);
        push(escaped, blank(escaped));
        i += 2;
      } else if (c === '$' && src[i + 1] === '{') {
        push(src.slice(i, i + 2), '  ');
        i += 2;
        scanCode(true);
      } else {
        push(c, blank(c));
        i++;
        if (c === '`') return;
      }
    }
  }

  function scanCode(templateExpression = false) {
    let braces = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (templateExpression && c === '}' && braces === 0) {
        push(c, ' ');
        i++;
        return;
      }
      if (c === '{') braces++;
      if (c === '}') braces--;
      if (c === '/' && d === '/') {
        let j = i;
        while (j < n && src[j] !== '\n') j++;
        const comment = blank(src.slice(i, j));
        push(comment, comment);
        i = j;
      } else if (c === '/' && d === '*') {
        const end = src.indexOf('*/', i + 2);
        const j = end < 0 ? n : end + 2;
        const comment = blank(src.slice(i, j));
        push(comment, comment);
        i = j;
      } else if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && src[j] !== c && src[j] !== '\n') {
          if (src[j] === '\\') j++;
          j++;
        }
        j = Math.min(j + 1, n);
        push(src.slice(i, j), blank(src.slice(i, j)));
        i = j;
      } else if (c === '`') {
        scanTemplate();
      } else {
        push(c, c);
        i++;
      }
    }
  }

  scanCode();
  return { noComments, code };
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

export function check(file, src) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (ALLOW.includes(rel)) return [];
  const { noComments, code } = scan(src);
  const bad = [];
  const spec = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"`])([^'"`\n]+)\1/g;
  for (let m; (m = spec.exec(noComments));) {
    if (code[m.index] !== noComments[m.index] || !m[2].startsWith('.')) continue;
    const target = relative(ROOT, resolve(dirname(file), m[2])).split(sep).join('/');
    if (target === 'src/main.js' || target === 'src/ui' || target.startsWith('src/ui/')) {
      bad.push(`${rel}:${lineOf(noComments, m.index)} imports ${m[2]} (resolves into ${target})`);
    }
  }
  const names = BROWSER_GLOBALS.join('|');
  const globals = new RegExp(
    `(?<![\\w$.])(?:globalThis\\s*(?:\\?\\.|\\.)\\s*)?(${names})\\b`, 'g',
  );
  for (let m; (m = globals.exec(code));) {
    bad.push(`${rel}:${lineOf(code, m.index)} uses browser global ${m[1]}`);
  }
  const bracketGlobals = new RegExp(
    `(?<![\\w$.])globalThis\\s*(?:\\?\\.\\s*)?\\[\\s*(['"])(${names})\\1\\s*\\]`, 'g',
  );
  for (let m; (m = bracketGlobals.exec(noComments));) {
    if (code[m.index] !== noComments[m.index]) continue;
    bad.push(`${rel}:${lineOf(code, m.index)} uses browser global ${m[2]}`);
  }
  return bad;
}

// Returns [{ importer, target, line }] for relative imports that break the rank rule.
export function rankCheck(file, src) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const from = rankOf(rel);
  if (from === null || from >= TOP_RANK) return [];
  const { noComments, code } = scan(src);
  const out = [];
  const spec = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"`])([^'"`\n]+)\1/g;
  for (let m; (m = spec.exec(noComments));) {
    if (code[m.index] !== noComments[m.index] || !m[2].startsWith('.')) continue;
    const target = relative(ROOT, resolve(dirname(file), m[2])).split(sep).join('/');
    const to = rankOf(target);
    if (to === null) continue;
    const frameworkUi = rel.startsWith('src/framework/') && to === TOP_RANK
      && (target === 'src/ui' || target.startsWith('src/ui/'));
    if (from < to || frameworkUi) out.push({ importer: rel, target, line: lineOf(noComments, m.index) });
  }
  return out;
}

test('layer rank: imports point to the same or a lower rank (ratchet: KNOWN_INVERSIONS only shrinks)', () => {
  const files = RANK_DIRS.flatMap((d) => walk(join(ROOT, d)));
  assert.ok(files.length > 200, `expected to scan the ranked layers, found ${files.length} files`);
  const found = files.flatMap((f) => rankCheck(f, readFileSync(f, 'utf8')));
  const known = new Set(KNOWN_INVERSIONS);
  const seen = new Set(found.map((v) => `${v.importer} -> ${v.target}`));
  const fresh = found.filter((v) => !known.has(`${v.importer} -> ${v.target}`))
    .map((v) => `${v.importer}:${v.line} imports ${v.target} (rank ${rankOf(v.importer)} -> ${rankOf(v.target)})`);
  const stale = KNOWN_INVERSIONS.filter((e) => !seen.has(e))
    .map((e) => `stale entry — delete it from KNOWN_INVERSIONS: ${e}`);
  assert.deepEqual(fresh, [], `new layer-rank inversions:\n${fresh.join('\n')}`);
  assert.deepEqual(stale, [], stale.join('\n'));
  assert.deepEqual([...KNOWN_INVERSIONS].sort(), KNOWN_INVERSIONS, 'keep KNOWN_INVERSIONS sorted');
});

test('rules layer (src/engine, src/model, engine) imports no UI and uses no browser globals', () => {
  const files = RULE_DIRS.flatMap((d) => walk(join(ROOT, d)));
  assert.ok(files.length > 50, `expected to scan the rules layer, found ${files.length} files`);
  const bad = files.flatMap((f) => check(f, readFileSync(f, 'utf8')));
  assert.deepEqual(bad, [], `layering violations:\n${bad.join('\n')}`);
});

test('layering checker catches what it should and ignores comments and strings', () => {
  const f = join(ROOT, 'src/model/x.js');
  assert.equal(check(f, "import '../ui/fx.js';\n").length, 1);
  assert.equal(check(f, "import { a } from '../main.js';").length, 1); // ../main.js from src/model is src/main.js
  assert.equal(check(f, 'const a = document.body;').length, 1);
  assert.equal(check(f, 'const a = globalThis?.document.body;').length, 1);
  assert.equal(check(f, "globalThis['window'].name;").length, 1);
  assert.equal(check(f, 'const a = `${{ a: document.body }.a}`;').length, 1);
  assert.equal(check(f, 'const a = `${`inner ${window.name}`}`;').length, 1);
  assert.equal(check(f, 'const a = "import \'../ui/fx.js\'";').length, 0);
  assert.equal(check(f, "// document\n/* window */ const s = 'localStorage'; const c = globalThis.crypto;").length, 0);
});

test('rank checker flags upward imports and allows peers, downward and comments', () => {
  const at = (p, src) => rankCheck(join(ROOT, p), src).map((v) => `${v.importer} -> ${v.target}`);
  assert.deepEqual(at('src/model/x.js', "import '../engine/rng.js';"), ['src/model/x.js -> src/engine/rng.js']);
  assert.deepEqual(at('src/model/x.js', "export { a } from '../engine/rng.js';"), ['src/model/x.js -> src/engine/rng.js']);
  assert.deepEqual(at('engine/runtime/x.mjs', "import '../../src/model/formulas.js';"), ['engine/runtime/x.mjs -> src/model/formulas.js']);
  assert.deepEqual(at('src/content/x.js', "import '../model/a.js';"), ['src/content/x.js -> src/model/a.js']);
  assert.deepEqual(at('src/framework/x.js', "import '../ui/a.js';"), ['src/framework/x.js -> src/ui/a.js']);
  assert.deepEqual(at('src/model/x.js', "import '../../engine/a.js';"), []); // root engine is below model
  assert.deepEqual(at('src/model/x.js', "import '../content/a.js'; import './b.js';"), []);
  assert.deepEqual(at('src/model/x.js', "import '../framework/a.js';"), []);
  assert.deepEqual(at('src/framework/x.js', "import '../model/a.js';"), []);
  assert.deepEqual(at('src/engine/x.js', "import '../services/a.js'; import '../model/a.js';"), []);
  assert.deepEqual(at('src/ui/x.js', "import '../engine/a.js';"), []);
  assert.deepEqual(at('src/model/x.js', "// import '../engine/rng.js'\nconst s = \"import '../engine/rng.js'\";"), []);
});
