// Every static data-component id written in src/ must be a UI_COMPONENTS value,
// and dataset.component must be assigned from the constant, never a literal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_COMPONENTS } from '../src/ui/models/UiComponentId.js';

const KNOWN = new Set(Object.values(UI_COMPONENTS));
const WRITES = [
  { re: /dataset(?:\.component|\[\s*['"]component['"]\s*\])\s*=\s*(['"`])([^'"`$]+)\1/g, literalAssign: true },
  { re: /['"]data-component['"]\s*:\s*(['"`])([^'"`$]+)\1/g, literalAssign: true },
  { re: /setAttribute\(\s*['"]data-component['"]\s*,\s*(['"`])([^'"`$]+)\1/g },
  { re: /(?<!\[)data-component=(["'])([^"'$]+)\1/g }, // not a [data-component="x"] selector read
];

// `dataset: { ..., component: 'lit' }`: from each `dataset: {` walk forward
// counting braces, so the balanced `{}` of a `${...}` in an earlier value cannot
// end the object early, and test for `component:` only at depth 1 (this object's
// own keys, not a nested one).
const DATASET_KEY = /component\s*:\s*(['"`])([^'"`$]+)\1/y;
function datasetLiterals(text, out) {
  for (const m of text.matchAll(/dataset\s*:\s*\{/g)) {
    let depth = 1;
    for (let i = m.index + m[0].length; i < text.length && depth > 0; i++) {
      const c = text[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (depth === 1 && c === 'c' && /\W/.test(text[i - 1])) {
        DATASET_KEY.lastIndex = i;
        const k = DATASET_KEY.exec(text);
        if (k) out.push({ id: k[2], literalAssign: true });
      }
    }
  }
}

export function scanSource(text) {
  const out = [];
  datasetLiterals(text, out);
  for (const { re, literalAssign } of WRITES) {
    for (const m of text.matchAll(re)) out.push({ id: m[2], literalAssign: !!literalAssign });
  }
  return out;
}

function walk(dir, files = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!p.endsWith(join('content', 'generated'))) walk(p, files); }
    else if (e.name.endsWith('.js')) files.push(p);
  }
  return files;
}

test('scanner flags planted bad writes', () => {
  const bad = scanSource(`a.dataset.component = 'nope.x'; b.setAttribute('data-component','nope.y'); el('i',{'data-component':'nope.a'}); el('i',{dataset:{slot:\`\${s.id}\`, component:'nope.b'}}); x.dataset['component']='nope.c'; \`<i data-component="nope.z" data-component="\${UI.ok}">\``);
  assert.deepEqual(bad.map((b) => b.id).sort(), ['nope.a', 'nope.b', 'nope.c', 'nope.x', 'nope.y', 'nope.z']);
  assert.equal(bad.filter((b) => b.literalAssign).length, 4);
});

test('every static data-component id in src/ is in UI_COMPONENTS', () => {
  const problems = [];
  for (const file of walk(fileURLToPath(new URL('../src/', import.meta.url)))) {
    for (const w of scanSource(readFileSync(file, 'utf8'))) {
      if (w.literalAssign) problems.push(`${file}: dataset component literal '${w.id}' must use UI_COMPONENTS`);
      else if (!KNOWN.has(w.id)) problems.push(`${file}: '${w.id}' not in UI_COMPONENTS`);
    }
  }
  assert.deepEqual(problems, []);
});
