// node --test workbench/tests/layout-card-layers-model.test.mjs — Card layers model: the real
// src/content/card-layout.json loads and writes back byte for byte, a tab-indented file keeps its
// tabs and key order, invalid layouts are listed, and changesFor() reports only real changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as CL from '../modules/layout/card-layers-model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = fs.readFileSync(path.join(ROOT, CL.LAYOUT_FILE), 'utf8');

test('the layout file path is the one the game compiler reads', () => {
  assert.equal(CL.LAYOUT_FILE, 'src/content/card-layout.json');
  assert.ok(fs.existsSync(path.join(ROOT, CL.LAYOUT_FILE)));
});

test('the real layout loads with no problems and writes back byte for byte', () => {
  const { data, format, problems } = CL.parseLayout(real);
  assert.deepEqual(problems, []);
  assert.equal(format.indent, '  ');
  assert.equal(format.bom, false);
  assert.ok(data.layers.length >= 9);
  assert.equal(CL.serialize(data, format), real);
  assert.deepEqual(CL.changesFor({ original: real, data }), []);
});

test('invalid JSON is refused with the parser message', () => {
  assert.throws(() => CL.parseLayout('{"layers": [}'), /Invalid JSON/);
});

test('a tab-indented file keeps its tabs, key order, byte-order mark and CRLF newlines', () => {
  const text = '﻿{\r\n\t"schemaVersion": 1,\r\n\t"width": 360,\r\n\t"height": 540,\r\n\t"layers": [\r\n\t\t{"id": "title", "type": "text", "x": 1, "y": 2, "w": 3, "h": 4, "rotation": 0, "opacity": 1}\r\n\t]\r\n}\r\n';
  const { data, format, problems } = CL.parseLayout(text);
  assert.deepEqual(problems, []);
  assert.equal(format.indent, '\t');
  assert.equal(format.bom, true);
  assert.equal(format.newline, '\r\n');
  assert.deepEqual(Object.keys(data), ['schemaVersion', 'width', 'height', 'layers']);
  const moved = { ...data, layers: [{ ...data.layers[0], x: 5 }] };
  const out = CL.serialize(moved, format);
  assert.ok(out.startsWith('﻿{\r\n\t"schemaVersion": 1,'));
  assert.ok(out.endsWith('}\r\n'));
  assert.ok(!/[^\r]\n/.test(out.slice(1)), 'every newline is CRLF');
  assert.match(out, /"x": 5/);
});

test('changesFor returns one file change only when the draft differs from the text read', () => {
  const { data } = CL.parseLayout(real);
  const next = structuredClone(data);
  next.layers[1].x = next.layers[1].x + 1;
  const changes = CL.changesFor({ original: real, data: next });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].path, CL.LAYOUT_FILE);
  assert.notEqual(changes[0].text, real);
  assert.equal(JSON.parse(changes[0].text).layers[1].x, next.layers[1].x);
  assert.deepEqual(CL.changesFor({ original: real, data: structuredClone(data) }), []);
});

test('layoutProblems lists what the game compiler would refuse', () => {
  const base = () => ({ schemaVersion: 1, width: 360, height: 540, layers: [{ id: 'a', type: 'text', x: 0, y: 0, w: 10, h: 10, rotation: 0, opacity: 1 }] });
  assert.deepEqual(CL.layoutProblems(base()), []);
  assert.deepEqual(CL.layoutProblems([]), ['The layout must be a JSON object']);
  assert.match(CL.layoutProblems({ ...base(), schemaVersion: 2 }).join('\n'), /schemaVersion/);
  assert.match(CL.layoutProblems({ ...base(), width: 0 }).join('\n'), /width/);
  assert.deepEqual(CL.layoutProblems({ ...base(), layers: [] }), ['layers must be a non-empty list']);
  const dup = base(); dup.layers.push({ ...dup.layers[0] });
  assert.match(CL.layoutProblems(dup).join('\n'), /duplicate layer id a/);
  const wrong = base(); wrong.layers[0].type = 'shape'; wrong.layers[0].w = 0; wrong.layers[0].opacity = 2; wrong.layers[0].locked = 'yes';
  const msgs = CL.layoutProblems(wrong).join('\n');
  assert.match(msgs, /type must be image or text/);
  assert.match(msgs, /w must be above 0/);
  assert.match(msgs, /opacity must be from 0 to 1/);
  assert.match(msgs, /locked must be true or false/);
  const href = base(); href.layers[0].type = 'image'; href.layers[0].href = '../etc/x.png';
  assert.match(CL.layoutProblems(href).join('\n'), /href must be a png, webp or svg/);
  const missing = base(); delete missing.layers[0].rotation;
  assert.match(CL.layoutProblems(missing).join('\n'), /rotation must be a number/);
});
