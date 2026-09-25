// #1230: the Markdown component catalog and the interactive one must list the
// same component ids. The check is C22 of tools/ui-components.mjs; this file
// runs that rung in the suite and proves it goes red on a one-sided entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogDisagreement, findings, receipt } from '../tools/ui-components.mjs';

const md = readFileSync(new URL('../docs/COMPONENT-CATALOG.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = readFileSync(new URL('../docs/component-catalog.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const c22 = (r) => findings(r).filter((line) => line.startsWith('C22 '));

test('the two component catalogs list the same ids', () => {
  const split = catalogDisagreement(md, html);
  assert.equal(split.empty, false, 'a catalog listed no component ids — the parser lost its anchor');
  assert.deepEqual(split.markdownOnly, [], 'ids only in docs/COMPONENT-CATALOG.md');
  assert.deepEqual(split.htmlOnly, [], 'ids only in docs/component-catalog.html');
  assert.deepEqual(c22(receipt()), []);
});

test('an id only in the Markdown catalog fails the check', () => {
  const r = receipt();
  const bad = { ...r, catalogMarkdown: r.catalogMarkdown.replace('| `startup-gate` |', '| `markdown-only-component` | x | x | x | x |\n| `startup-gate` |') };
  assert.match(c22(bad).join('\n'), /only in COMPONENT-CATALOG\.md: markdown-only-component/);
});

test('an id only in the interactive catalog fails the check', () => {
  const r = receipt();
  const bad = { ...r, catalogHtml: r.catalogHtml.replace('const SEMANTIC_COMPONENTS = [', "const SEMANTIC_COMPONENTS = [\n ['html-only-component','x','x','primitive','x','x','panel'],") };
  assert.match(c22(bad).join('\n'), /only in component-catalog\.html: html-only-component/);
});

test('a catalog that lists nothing fails the check rather than agreeing vacuously', () => {
  const r = receipt();
  assert.equal(c22({ ...r, catalogHtml: '' }).length, 1);
});

test('an armoury asset id only in the interactive catalog fails the check', () => {
  const r = receipt();
  const bad = { ...r, catalogHtml: r.catalogHtml.replace('const RENDERED_ARMOURY_COMPONENTS = [', 'const RENDERED_ARMOURY_COMPONENTS = [\n ["armoury.htmlOnlyAsset",".x","x","x","x"],') };
  assert.match(c22(bad).join('\n'), /only in component-catalog\.html: armoury\.htmlOnlyAsset/);
});

test('an armoury asset id only in the Markdown family table fails the check', () => {
  const r = receipt();
  const bad = { ...r, catalogMarkdown: r.catalogMarkdown.replace('`armoury.disclosure` |', '`armoury.disclosure`, `armoury.markdownOnlyAsset` |') };
  assert.match(c22(bad).join('\n'), /only in COMPONENT-CATALOG\.md: armoury\.markdownOnlyAsset/);
});

test('a double-quoted semantic record is still read', () => {
  const r = receipt();
  const quoted = { ...r, catalogHtml: r.catalogHtml.replace("['startup-gate',", '["startup-gate",') };
  assert.notEqual(quoted.catalogHtml, r.catalogHtml);
  assert.deepEqual(c22(quoted), []);
});

// The two families are compared separately: an id that moves between the
// Markdown "| Rendered family |" table and a Component-ID table, or between
// the HTML SEMANTIC_COMPONENTS and RENDERED_ARMOURY_COMPONENTS arrays, is
// still listed once on each side, so one merged set would call it agreement.
test('an armoury asset id moved into a Markdown Component-ID table fails the check', () => {
  const r = receipt();
  const moved = r.catalogMarkdown
    .replace(', `armoury.disclosure` |', ' |')
    .replace('| `startup-gate` |', '| `armoury.disclosure` | x | x | x | x |\n| `startup-gate` |');
  assert.notEqual(moved, r.catalogMarkdown);
  assert.match(c22({ ...r, catalogMarkdown: moved }).join('\n'), /only in COMPONENT-CATALOG\.md: armoury\.disclosure \[semantic\]; only in component-catalog\.html: armoury\.disclosure \[armoury\]/);
});

test('an armoury record moved into the interactive SEMANTIC_COMPONENTS array fails the check', () => {
  const r = receipt();
  const record = ` ["armoury.shell",".armoury[data-composition='character-equipment']","Armoury shell and view routing","responsive shared shell","armouryPanel"],\n`;
  assert.ok(r.catalogHtml.includes(record));
  const moved = r.catalogHtml
    .replace(record, '')
    .replace('const SEMANTIC_COMPONENTS = [\n', `const SEMANTIC_COMPONENTS = [\n${record}`);
  assert.notEqual(moved, r.catalogHtml);
  assert.match(c22({ ...r, catalogHtml: moved }).join('\n'), /only in COMPONENT-CATALOG\.md: armoury\.shell \[armoury\]; only in component-catalog\.html: armoury\.shell \[semantic\]/);
});

// The whole verdict of tools/ui-components.mjs, not only its C22 rung. C5 and
// C12 sat red on dev because nothing in the suite ran the tool; this line is
// that run. Its plants live in `node tools/ui-components.mjs --selftest`.
test('every reusable component contract of tools/ui-components.mjs holds on this checkout', () => {
  assert.deepEqual(findings(receipt()), []);
});
