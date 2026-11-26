import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CANONICAL_MECHANIC_DELEGATES, createMechanicReader } from '../tools/lib/mechanics-readers.mjs';
import { gameDigest } from '../engine/kernel/gameConfig.js';

const source = (file, text) => ({ file, lines: text.split('\n') });
const bridge = { file: 'src/engine/wrapper.js', implementation: 'src/model/shared.js', namespace: 'Shared', symbols: { Read: 'publicRead' } };
const wrapper = "import * as Shared from '../model/shared.js';\nexport function publicRead() { return Shared.Read(); }\nexport function laterRead() { return 'behavior:probe'; }";
const leaf = "export function Read() { return 'behavior:probe'; }\nexport function Unbridged() { return 'behavior:other'; }";
const makeReader = (owner = wrapper, implementation = leaf, delegates = [bridge]) => createMechanicReader([
  source(bridge.file, owner),
  source('src/model/earlier.js', "export function competitor() { return 'behavior:probe'; }"),
  source(bridge.implementation, implementation),
], delegates);

test('a delegated implementation keeps its wrapper position before later engine and earlier model readers', () => {
  assert.deepEqual(makeReader()([/'behavior:probe'/]), { file: bridge.file, symbol: 'publicRead' });
  assert.deepEqual(makeReader()([/'behavior:other'/]), { file: bridge.implementation, symbol: 'Unbridged' });
  assert.deepEqual(makeReader(wrapper, leaf, [])([/'behavior:probe'/]), { file: bridge.file, symbol: 'laterRead' });
});

test('each delegated function keeps the declaration position of its own public owner', () => {
  const owner = "import * as Shared from '../model/shared.js';\nexport function first() { return 'behavior:first'; }\nexport const publicRead = () => Shared.Read();";
  const implementation = "export const Read = () => 'behavior:first';";
  assert.deepEqual(makeReader(owner, implementation)([/'behavior:first'/]), { file: bridge.file, symbol: 'first' });
});

test('missing export, wrong import, and fabricated wrapper owners fail closed', () => {
  assert.throws(() => makeReader(wrapper, leaf.replace('export function Read', 'function Read')), /must export Read/);
  assert.throws(() => makeReader(wrapper.replace('../model/shared.js', '../model/other.js')), /must import/);
  assert.throws(() => makeReader(wrapper.replace('publicRead', 'renamed')), /missing declaration publicRead/);
  assert.throws(() => makeReader('/*\n' + wrapper.split('\n')[0] + '\n*/\n' + wrapper.split('\n').slice(1).join('\n')), /must import/);
});

test('comments, string/template/regex decoys and a neighboring function cannot validate delegation', () => {
  for (const body of [
    '// Shared.Read();\nreturn 0;',
    '/* Shared.Read(); */ return 0;',
    'return "Shared.Read()";',
    "return 'Shared.Read()';",
    'return `Shared.Read()`;',
    'return /Shared.Read\\(/;',
    'if (true) /;return Shared.Read()/.test(""); return 0;',
    'if (Boolean(true)) /;return Shared.Read()/.test(""); return 0;',
    'while (false) /;return Shared.Read()/.test(""); return 0;',
    'for (; false;) /;return Shared.Read()/.test(""); return 0;',
    'if (false) {} else /;return Shared.Read()/.test(""); return 0;',
    'do /;return Shared.Read()/.test(""); while (false); return 0;',
    'null instanceof /;return Shared.Read()/; return 0;',
    'return 0; }\nfunction another() { return Shared.Read();',
  ]) {
    const owner = "import * as Shared from '../model/shared.js';\nexport function publicRead() { " + body + ' }';
    assert.throws(() => makeReader(owner), /must call Shared.Read/, body);
  }
});

test('await followed by a regex literal cannot prove an async owner delegates', () => {
  const owner = "import * as Shared from '../model/shared.js';\nexport async function publicRead() { await /;return Shared.Read()/.test(''); return 0; }";
  assert.throws(() => makeReader(owner), /must call/);
});

test('braces in default arguments and literals do not end the owner body early', () => {
  const owner = "import * as Shared from '../model/shared.js';\nexport function publicRead({ value = '}' } = {}) { const close = /}/; if (value) { void value; } return Shared.Read(); }";
  assert.deepEqual(makeReader(owner)([/'behavior:probe'/]), { file: bridge.file, symbol: 'publicRead' });
});

test('nested functions, lazy arrows, callbacks and conditional delegates cannot prove direct ownership', () => {
  for (const body of [
    'function unused() { return Shared.Read(); } return 1;',
    'const unused = () => Shared.Read(); return 1;',
    'const unused = () => { return Shared.Read(); }; return 1;',
    '[1].map(() => Shared.Read()); return 1;',
    'if (false)\nreturn Shared.Read(); return 1;',
  ]) assert.throws(() => makeReader("import * as Shared from '../model/shared.js';\nexport function publicRead() { " + body + ' }'), /must call/);
});

test('namespace shadowing and a nested column-zero wrapper fail closed', () => {
  for (const owner of [
    "function publicRead(Shared) { return Shared.Read(); }",
    "function publicRead() { const Shared = { Read() { return 1; } }; return Shared.Read(); }",
    "function publicRead() { const { foo = 1, Shared } = { Shared: { Read() { return 1; } } }; return Shared.Read(); }",
    "function publicRead() { const foo = 1, Shared = { Read() { return 1; } }; return Shared.Read(); }",
    "function shell() {\nfunction publicRead() { return Shared.Read(); }\n}",
  ]) assert.throws(() => makeReader("import * as Shared from '../model/shared.js';\n" + owner), /must call|must be top-level/);
});

test('unicode and nested templates cannot turn literal text into a delegation call', () => {
  for (const decoy of ['`outer ${`inner Shared.Read()`}`', '`outer ${ { text: `Shared.Read()` } }`', '"😀 Shared.Read()"']) {
    const owner = "// 😀 retains UTF-16 offsets\nimport * as Shared from '../model/shared.js';\nfunction publicRead() { const ignored = " + decoy + '; return 1; }';
    assert.throws(() => makeReader(owner), /must call/);
  }
  const owner = "// 😀\nimport * as Shared from '../model/shared.js';\nfunction publicRead() { const ignored = `outer ${`inner text`}`; return Shared.Read(); }";
  assert.deepEqual(makeReader(owner)([/'behavior:probe'/]), { file: bridge.file, symbol: 'publicRead' });
});

function treeSources(dir) {
  return readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).flatMap(entry => {
    const file = `${dir}/${entry.name}`;
    return entry.isDirectory() ? treeSources(file) : entry.name.endsWith('.js') ? [source(file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'))] : [];
  });
}

test('the eight extracted mechanic owners retain their saved compatibility metadata', () => {
  const nonReaders = new Set(['combatPower.js', 'cardGenerator.js', 'subclassCardGenerator.js', 'cardPoolPlan.js', 'itemGenerator.js']);
  const sources = ['src/engine', 'src/model'].flatMap(treeSources).filter(row => !nonReaders.has(row.file.split('/').pop()));
  const findReader = createMechanicReader(sources, CANONICAL_MECHANIC_DELEGATES);
  const expected = {
    'damage.arcane': ['src/engine/gameProfileCombat.js', 'profileDamageReceiptCore'],
    damage_arcane: ['src/engine/gameProfileCombat.js', 'profileDamageReceiptCore'],
    damage_sacred: ['src/engine/gameProfileCombat.js', 'profileDamageReceiptCore'],
    school_divine: ['src/engine/gameProfileCombat.js', 'profileDamageReceiptCore'],
    maneuver_smash: ['src/engine/gearReceipt.js', 'GearMeleeHit'],
    'status.brittle': ['src/engine/elementIdentity.js', 'ElementReceiptStages'],
    'status.chill': ['src/engine/elementIdentity.js', 'ElementReceiptStages'],
    'status.shock': ['src/engine/elementIdentity.js', 'ElementReceiptStages'],
  };
  // Full canonical manifest hashes from 10911b810d5, before the extraction.
  // Legitimate authored manifest changes must deliberately update these pins.
  const pinned = {
    'damage.arcane': 'sha256:6d49359fb2a007eca475e9b4eedcbc8db49665f29739bd80ebd90aab279f183f',
    damage_arcane: 'sha256:98b570444b6edd4efd97ad4b5dc38dd27e2642c9d209619bd60f294fa0ac82e7',
    damage_sacred: 'sha256:4fb33616f707ddcee7ee5e73928092803c076ecbc175323529ed013847c84e63',
    school_divine: 'sha256:3b29b48360efea97a1575d94f14155f078acba384c1de501e23237ba3634ec2c',
    maneuver_smash: 'sha256:a95e88b069c8ac53cec256b20f693e8590177775b333cbe0429785755f3dd1b4',
    'status.brittle': 'sha256:2b956dd7f6e7b0f1c5cd07c60dc68e57c2dd9350fb10e3115b72c85f4ebb9355',
    'status.chill': 'sha256:e2b3e37a45811239cceccbab5e5c9b9c00784bd854daaa166d45596f8f020834',
    'status.shock': 'sha256:b9b84553587b6634fbec4589121b753824a9b79002bcabb2cb8bf3c3817fd188',
  };
  for (const [id, [file, symbol]] of Object.entries(expected)) {
    const manifest = JSON.parse(readFileSync(new URL(`../engine/mechanics/${id}/mechanic.json`, import.meta.url), 'utf8'));
    const name = id.startsWith('status.') ? id.slice(7) : manifest.tag;
    const reader = findReader([new RegExp(`['"\x60]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\x60]`)]);
    assert.deepEqual(reader, { file, symbol }, id);
    // legacy is part of the manifest's runtime fingerprint, so the projected
    // manifest must have exactly the pre-extraction ownership, without extras.
    assert.equal(gameDigest({ ...manifest, legacy: reader }), pinned[id], id);
  }
});
