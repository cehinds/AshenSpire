// Equipment's substep action and the page's stage action own separate rows.
// This replaced the overlapping sticky rows: raising one button cannot reserve
// space for the other, whereas the equipment grid and sibling page footer do.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/ui/screens/customize.js', import.meta.url), 'utf8');
const reserved = css.slice(css.indexOf('/* Equipment uses the available page height;'));

test('creation stage controls live outside the scrolling equipment body', () => {
  assert.match(source, /const body = el\('div', \{ class: 'modal-body cz-scroll' \}/);
  assert.match(source, /\}, \[head, body, foot\]\)/);
  assert.match(source, /className: 'cz-actions'/);
});

test('equipment reserves an action row on wide and narrow game viewports', () => {
  assert.match(reserved, /\.customize \.cc-equip-group\[data-equipment-section\] \{[^}]*display:grid;[^}]*grid-template-rows:minmax\(0,1fr\) auto;/);
  assert.match(reserved, /\.customize \.cc-equipment-continue \{[^}]*grid-column:2; grid-row:2;/);
  const narrow = reserved.slice(reserved.indexOf('@container game-viewport (max-width:700px)'));
  assert.match(narrow, /grid-template-rows:auto minmax\(0,1fr\) auto;/);
  assert.match(narrow, /\.customize \.cc-equipment-continue \{[^}]*grid-column:1; grid-row:3;/);
  assert.match(reserved, /\.customize \.cc-equip-group > \.cc-equipment-details \{[^}]*overflow:auto;/);
});
