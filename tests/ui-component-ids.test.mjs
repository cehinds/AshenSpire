// Every static data-component id written in src/ must be a UI_COMPONENTS value,
// and dataset.component must be assigned from the constant, never a literal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UI_COMPONENTS } from '../src/ui/models/UiComponentId.js';

const KNOWN = new Set(Object.values(UI_COMPONENTS));
const WRITES = [
  { re: /dataset\.component\s*=\s*(['"`])([^'"`$]+)\1/g, literalAssign: true },
  { re: /setAttribute\(\s*['"]data-component['"]\s*,\s*(['"`])([^'"`$]+)\1/g },
  { re: /(?<!\[)data-component=(["'])([^"'$]+)\1/g }, // not a [data-component="x"] selector read
];

export function scanSource(text) {
  const out = [];
  for (const { re, literalAssign } of WRITES) {
    for (const m of text.matchAll(re)) out.push({ id: m[2], literalAssign: !!literalAssign });
  }
  return out;
}

function walk(dir, files = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (p !== join('src', 'content', 'generated')) walk(p, files); }
    else if (e.name.endsWith('.js')) files.push(p);
  }
  return files;
}

test('scanner flags planted bad writes', () => {
  const bad = scanSource(`a.dataset.component = 'nope.x'; b.setAttribute('data-component','nope.y'); \`<i data-component="nope.z" data-component="\${UI.ok}">\``);
  assert.deepEqual(bad.map((b) => b.id).sort(), ['nope.x', 'nope.y', 'nope.z']);
  assert.equal(bad.filter((b) => b.literalAssign).length, 1);
});

test('every static data-component id in src/ is in UI_COMPONENTS', () => {
  const problems = [];
  for (const file of walk('src')) {
    for (const w of scanSource(readFileSync(file, 'utf8'))) {
      if (w.literalAssign) problems.push(`${file}: dataset.component literal '${w.id}' must use UI_COMPONENTS`);
      else if (!KNOWN.has(w.id)) problems.push(`${file}: '${w.id}' not in UI_COMPONENTS`);
    }
  }
  assert.deepEqual(problems, []);
});
