// node --test workbench/tests/layout-sketch-model.test.mjs — Layout Studio's Sketch
// model against UI Studio's real sketch file (ui-studio/workspace/sketches): the
// round trip is byte-exact, edits change their own lines, and the breakpoint
// overrides resolve as UI Studio resolves them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../modules/layout/sketch-model.mjs';
import * as M from '../modules/layout/studio-model.mjs';
import { SKETCH_SCHEMA } from '../modules/layout/studio-model.mjs';
import { createDocument } from '../ui/kit/canvas-model.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXAMPLE = 'ui-studio/workspace/sketches/example-combat-phone.json';
const realText = readFileSync(join(ROOT, EXAMPLE), 'utf8');
const phone = { width: 390, height: 844 };
const desk = { width: 1280, height: 800 };

test('UI Studio\'s example sketch parses with no problems and saves back byte for byte', () => {
  const { data, problems } = S.parseSketch(realText);
  assert.deepEqual(problems, []);
  assert.equal(data.schema, SKETCH_SCHEMA);
  assert.equal(S.serializeSketch(data, realText), realText);
});

test('the file names UI Studio accepts and the path they live at', () => {
  assert.equal(S.sketchRel('example-combat-phone'), EXAMPLE);
  assert.ok(S.validSketchName('example-combat-phone'));
  assert.ok(!S.validSketchName('Example'));
  assert.ok(!S.validSketchName('../escape'));
});

test('a label edit changes one line of the file and nothing else', () => {
  const { data } = S.parseSketch(realText);
  const next = S.updateBox(data, 'hud', { label: 'Header' });
  const text = S.serializeSketch(next, realText);
  const before = realText.split('\n'), after = text.split('\n');
  assert.equal(after.length, before.length);
  const changed = after.map((l, i) => (l === before[i] ? -1 : i)).filter((i) => i >= 0);
  assert.equal(changed.length, 1);
  assert.match(after[changed[0]], /"label": "Header"/);
  assert.equal(data.boxes[0].label, 'HUD', 'the input is not mutated');
});

test('a box added at a free id, and removed boxes leave the others', () => {
  const { data } = S.parseSketch(realText);
  const added = S.addBox(data, { label: 'Note', x: 5, y: 5, w: 20, h: 10 });
  assert.equal(added.id, 'box-1');
  assert.equal(added.sketch.boxes.at(-1).label, 'Note');
  assert.equal(added.sketch.boxes.at(-1).layer, 2, 'a new box sits on top');
  const removed = S.removeBoxes(added.sketch, ['box-1', 'footer']);
  assert.deepEqual(removed.boxes.map((b) => b.id), ['hud', 'scene', 'hand', 'footer'], 'the locked footer stays');
  assert.deepEqual(S.removeBoxes(added.sketch, ['footer'], { force: true }).boxes.map((b) => b.id), ['hud', 'scene', 'hand', 'box-1']);
});

test('canvas items resolve the phone override, and the desk shows the base', () => {
  const { data } = S.parseSketch(realText);
  const phoneItems = S.canvasItems(data, phone);
  const scenePhone = phoneItems.find((it) => it.id === 'scene');
  assert.equal(scenePhone.h, M.boxToPx({ h: 45 }, 'percent', phone).h, 'the narrow override shortens the scene');
  const deskItems = S.canvasItems(data, desk);
  const sceneDesk = deskItems.find((it) => it.id === 'scene');
  assert.equal(sceneDesk.h, M.boxToPx({ h: 55 }, 'percent', desk).h);
  assert.equal(deskItems.find((it) => it.id === 'footer').locked, true);
});

test('a canvas move at a breakpoint writes that breakpoint\'s override and keeps the base', () => {
  const { data } = S.parseSketch(realText);
  const items = S.canvasItems(data, phone).map((it) => (it.id === 'hand' ? { ...it, y: it.y + 20 } : it));
  const next = S.applyCanvasItems(data, items, phone, { scope: 'breakpoint' });
  const hand = next.boxes.find((b) => b.id === 'hand');
  assert.equal(hand.y, data.boxes.find((b) => b.id === 'hand').y, 'the base y is unchanged');
  assert.ok(hand.overrides.narrow.y > 55, 'the narrow override moved down');
  const base = S.applyCanvasItems(data, S.canvasItems(data, desk).map((it) => (it.id === 'hud' ? { ...it, h: it.h + 40 } : it)), desk);
  assert.ok(base.boxes.find((b) => b.id === 'hud').h > 10, 'a base edit writes the base');
});

test('the PNG drawing lists the visible boxes in layer order at the device size', () => {
  const { data } = S.parseSketch(realText);
  const plan = S.drawingFor(data, phone);
  assert.equal(plan.width, 390);
  assert.equal(plan.height, 844);
  assert.equal(plan.title, 'Example: combat, one layout with a phone override');
  assert.deepEqual(plan.rects.map((r) => r.label), ['HUD', 'Scene', 'Footer', 'Hand'], 'layer 0 first, then layer 1');
  assert.equal(plan.rects.find((r) => r.label === 'Footer').locked, true);
  assert.equal(plan.rects.find((r) => r.label === 'Scene').overridden, true, 'the phone override is drawn');
  const hidden = S.updateBox(data, 'hand', { hidden: true });
  assert.equal(S.drawingFor(hidden, phone).rects.length, 3, 'a hidden box is not drawn');
  assert.deepEqual(S.drawingFor(S.setNotes(data, 'one\n\ntwo'), phone).notes, ['one', 'two']);
});

test('the notes are the sketch\'s own, and the export is the file\'s text', () => {
  const { data } = S.parseSketch(realText);
  const notes = S.setNotes(data, 'Try the hand at 40%');
  assert.equal(notes.notes, 'Try the hand at 40%');
  assert.equal(S.exportJson(data, realText), realText, 'an unchanged sketch exports its file');
  assert.equal(JSON.parse(S.exportJson(notes, realText)).notes, 'Try the hand at 40%');
});

test('the newest sketch pick wins: an earlier pick that finishes later is stale', () => {
  const gate = S.selectionGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(gate.current(first), false, 'the earlier pick installs nothing');
  assert.equal(gate.current(second), true, 'the newest pick installs');
});

test('a sketch deleted on disk leaves the list, and no sketch stays open', () => {
  const gone = S.deletedSketch(['alpha', 'beta'], 'alpha');
  assert.deepEqual(gone.names, ['beta']);
  assert.equal(gone.name, null);
  assert.equal(gone.sketch, null);
  assert.equal(gone.original, null);
  assert.equal(gone.hash, null);
  assert.equal(gone.error, null);
});

test('a hidden box stays in the canvas document as hidden, so Layers still lists it', () => {
  const { data } = S.parseSketch(realText);
  const hidden = S.updateBox(data, 'hand', { hidden: true });
  const items = S.canvasItems(hidden, phone);
  assert.deepEqual(items.map((it) => it.id).sort(), ['footer', 'hand', 'hud', 'scene'], 'the hidden box is kept');
  assert.equal(items.find((it) => it.id === 'hand').hidden, true);
  assert.equal(items.find((it) => it.id === 'hud').hidden, false);
  const doc = createDocument({ width: 390, height: 844, items });
  assert.equal(doc.items.find((it) => it.id === 'hand').hidden, true, 'the canvas kit keeps the flag');
  assert.equal(S.drawingFor(hidden, phone).rects.length, 3, 'a hidden box is still not drawn in the PNG');
});

test('showing a hidden box from Layers writes its hidden flag back, and hiding one writes it too', () => {
  const { data } = S.parseSketch(realText);
  const hidden = S.updateBox(data, 'hand', { hidden: true });
  const shown = S.applyCanvasItems(hidden, S.canvasItems(hidden, phone).map((it) => (it.id === 'hand' ? { ...it, hidden: false } : it)), phone);
  assert.equal(shown.boxes.find((b) => b.id === 'hand').hidden, false, 'the box is shown in the file');
  assert.equal(S.drawingFor(shown, phone).rects.length, 4);
  const again = S.applyCanvasItems(data, S.canvasItems(data, phone).map((it) => (it.id === 'hud' ? { ...it, hidden: true } : it)), phone);
  assert.equal(again.boxes.find((b) => b.id === 'hud').hidden, true, 'the box is hidden in the file');
  assert.equal(S.drawingFor(again, phone).rects.length, 3);
});
