// node --test workbench/tests/motion-model.test.mjs — Motion Studio's pure model: timeline
// maths, frame selection, the deep link, the library filter, the pose-file round trip
// (byte-exact for unchanged files), the edit operations and the canvas mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FRAME_MS, poseIndexAt, poseStart, stepFrame, stepPose, advance, onionNeighbours, poseTicks,
  clipStart, clipBar, parseMotionLink, motionLinkOf, libraryEntries, filterLibrary,
  parsePoseFile, checkProject, serializePoseFile, isDirty, setAnchor, setClipFields, moveClip, renamePose,
  canvasDocOf, applyCanvasDoc, snap, addClip, removeClip, bindingRows, isGenerated,
} from '../modules/motion/model.mjs';

const readFixture = (rel) => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const CUES = { anticipation: 0, release: 0.3, contact: 0.5, recovery: 0.78 };

test('pose index and pose start agree with the game sample() rule (floor, clamped)', () => {
  assert.equal(poseIndexAt(5, 1000, 0), 0);
  assert.equal(poseIndexAt(5, 1000, 199), 0);
  assert.equal(poseIndexAt(5, 1000, 200), 1);
  assert.equal(poseIndexAt(5, 1000, 1000), 4, 'the end clamps to the last pose');
  assert.equal(poseIndexAt(5, 1000, -50), 0);
  assert.equal(poseStart(5, 1000, 2), 400);
  assert.equal(poseStart(5, 1000, 9), 800, 'out-of-range indexes clamp');
});

test('frame steps move 1/30 s and stop at both ends', () => {
  assert.equal(stepFrame(0, -1, 1000), 0);
  assert.ok(Math.abs(stepFrame(0, 1, 1000) - FRAME_MS) < 1e-9);
  assert.equal(stepFrame(999.9, 1, 1000), 1000);
});

test('pose steps jump to the neighbouring pose start and stay at the ends', () => {
  assert.equal(stepPose(5, 1000, 250, 1), 400);
  assert.equal(stepPose(5, 1000, 250, -1), 0);
  assert.equal(stepPose(5, 1000, 0, -1), 0);
  assert.equal(stepPose(5, 1000, 999, 1), 800);
});

test('advance loops with a modulo at the chosen speed, or stops at the end without loop', () => {
  assert.deepEqual(advance(900, 200, { duration: 1000, speed: 1, loop: true }), { time: 100, ended: false });
  assert.deepEqual(advance(0, 100, { duration: 1000, speed: 2, loop: true }), { time: 200, ended: false });
  assert.deepEqual(advance(0, 100, { duration: 1000, speed: 0.25, loop: true }), { time: 25, ended: false });
  assert.deepEqual(advance(900, 200, { duration: 1000, speed: 1, loop: false }), { time: 1000, ended: true });
});

test('onion skin neighbours are the previous and next pose, null at either end', () => {
  assert.deepEqual(onionNeighbours(5, 1000, 0), { index: 0, prev: null, next: 1 });
  assert.deepEqual(onionNeighbours(5, 1000, 450), { index: 2, prev: 1, next: 3 });
  assert.deepEqual(onionNeighbours(5, 1000, 1000), { index: 4, prev: 3, next: null });
});

test('timeline ticks are evenly spaced fractions and empty for an empty project', () => {
  assert.deepEqual(poseTicks(4, 1000).map((t) => t.at), [0, 0.25, 0.5, 0.75]);
  assert.deepEqual(poseTicks(0, 1000), []);
});

test('a clip starts at its cue fraction plus its offset, and its bar is clipped to the project', () => {
  const clip = { cue: 'contact', offset: -15, duration: 130 };
  assert.equal(clipStart(clip, 260, CUES), 0.5 * 260 - 15);
  const bar = clipBar(clip, 260, CUES);
  assert.ok(Math.abs(bar.left - 115 / 260) < 1e-9);
  assert.ok(Math.abs(bar.width - 130 / 260) < 1e-9);
  const late = clipBar({ cue: 'recovery', offset: 0, duration: 5000 }, 1000, CUES);
  assert.equal(late.left + late.width, 1, 'the bar stops at the project end');
  assert.deepEqual(clipBar(clip, 0, CUES), { left: 0, width: 0 });
});

test('the deep link reads class, outfit, anim and frame, and writes them back in a stable order', () => {
  const p = parseMotionLink(new URLSearchParams('mod=motion&class=reaver&outfit=rogue-duelist&anim=pose-studio%2Frenewal%2Fattack.pose.json&frame=2'));
  assert.deepEqual(p, { class: 'reaver', outfit: 'rogue-duelist', anim: 'pose-studio/renewal/attack.pose.json', frame: 2 });
  assert.equal(motionLinkOf(p), 'class=reaver&outfit=rogue-duelist&anim=pose-studio%2Frenewal%2Fattack.pose.json&frame=2');
  assert.equal(motionLinkOf({ class: 'rogue', frame: 0 }), 'class=rogue&frame=0');
  assert.equal(motionLinkOf({}), '');
});

test('the deep link rejects a non-numeric or oversized frame and empty values', () => {
  assert.equal(parseMotionLink({ frame: 'two' }).frame, null);
  assert.equal(parseMotionLink({ frame: '1234' }).frame, null);
  assert.equal(parseMotionLink({ class: '   ' }).class, null);
  assert.equal(parseMotionLink({ class: 'x'.repeat(500) }).class.length, 200);
});

test('the library holds classes, outfits, stances and animation sets, filterable by kind, class and search', () => {
  const entries = libraryEntries({
    classes: [{ id: 'reaver', label: 'Reaver' }, { id: 'rogue', label: 'Rogue' }],
    outfits: [{ id: 'rogue-duelist', classId: 'rogue' }],
    sets: [
      { path: 'pose-studio/renewal/attack.pose.json', name: 'Reaver sword attack', actor: 'reaver', poses: 5 },
      { path: 'pose-studio/stances/projects/herald-default/casting.pose.json', name: 'Herald casting', actor: 'herald', poses: 6, stance: true },
    ],
  });
  assert.equal(entries.length, 5);
  assert.equal(filterLibrary(entries, { kind: 'stance' }).length, 1);
  assert.deepEqual(filterLibrary(entries, { classId: 'rogue' }).map((e) => e.kind), ['class', 'outfit']);
  assert.equal(filterLibrary(entries, { q: 'casting' })[0].kind, 'stance');
  assert.equal(filterLibrary(entries, { q: '  ' }).length, 5, 'a blank search keeps everything');
});

test('an unchanged pose file round-trips to its exact bytes, including escaped names and a trailing newline', () => {
  for (const rel of ['pose-studio/renewal/attack.pose.json', 'pose-studio/renewal/spell.pose.json', 'pose-studio/renewal/base-attack.pose.json']) {
    const text = readFixture(rel);
    const { project, problems } = parsePoseFile(text);
    assert.deepEqual(problems, [], `${rel} checks clean`);
    assert.equal(serializePoseFile(project, text), text, `${rel} is byte-exact`);
    assert.equal(isDirty(text, project), false);
  }
});

test('a changed pose file serializes to JSON that parses back to the edited project', () => {
  const text = readFixture('pose-studio/renewal/base-attack.pose.json');
  const { project } = parsePoseFile(text);
  const edited = setAnchor(project, 'hand', [0.41, 0.5]);
  const out = serializePoseFile(edited, text);
  assert.notEqual(out, text);
  assert.deepEqual(JSON.parse(out), edited, 'round trip keeps every field');
  assert.ok(out.endsWith(text.slice(text.trimEnd().length)), 'the original trailing whitespace is kept');
  assert.equal(isDirty(text, edited), true);
});

test('non-ASCII text is written as \\u escapes, the style of the shipped pose files', () => {
  const text = readFixture('pose-studio/renewal/attack.pose.json');
  const { project } = parsePoseFile(text);
  const renamed = { ...project, name: 'Alternative Reaver · Sword attack v2' };
  const out = serializePoseFile(renamed, text);
  assert.match(out, /Reaver \\u00b7 Sword/);
  assert.equal(JSON.parse(out).name, 'Alternative Reaver · Sword attack v2');
});

test('checkProject flags what would stop the game reading a project', () => {
  assert.deepEqual(checkProject(null), ['Not a project object']);
  const { project } = parsePoseFile(readFixture('pose-studio/renewal/attack.pose.json'));
  assert.deepEqual(checkProject(project), []);
  assert.ok(checkProject({ ...project, schemaVersion: 2 }).includes('Unsupported schemaVersion'));
  assert.ok(checkProject({ ...project, poses: ['a'] }).includes('Poses need 5 to 7 names'));
  assert.ok(checkProject({ ...project, anchors: { hand: [1.5, 0] } }).some((p) => p.startsWith('Anchor hand')));
  const bad = parsePoseFile('{not json');
  assert.equal(bad.project, null);
  assert.match(bad.problems[0], /^Not JSON/);
});

test('edits clamp to the limits and return a new project without touching the input', () => {
  const { project } = parsePoseFile(readFixture('pose-studio/renewal/attack.pose.json'));
  const before = JSON.stringify(project);
  const moved = setAnchor(project, 'hand', [2, -1]);
  assert.deepEqual(moved.anchors.hand, [1, 0]);
  assert.equal(JSON.stringify(project), before, 'the input is untouched');
  const clipped = setClipFields(project, 'effect-slash', { x: 5000, opacity: 3, layer: 'behind', travel: true, size: 1.7 });
  const clip = clipped.clips[0];
  assert.equal(clip.x, 1000);
  assert.equal(clip.opacity, 1);
  assert.equal(clip.layer, 'behind');
  assert.equal(clip.travel, true);
  assert.equal(clip.size, 20, 'size clamps to its minimum');
  assert.equal(setClipFields(project, 'effect-slash', { layer: 'sideways' }).clips[0].layer, 'front', 'unknown layers are ignored');
  assert.throws(() => setAnchor(project, 'nope', [0, 0]), /No anchor/);
  assert.throws(() => moveClip(project, 'missing', 0, 0), /No effect/);
  assert.equal(moveClip(project, 'effect-slash', 12.4, -3).clips[0].y, -3);
});

test('renaming a pose keeps the frame count and rejects unsafe names', () => {
  const { project } = parsePoseFile(readFixture('pose-studio/renewal/attack.pose.json'));
  const renamed = renamePose(project, 0, 'windup2');
  assert.equal(renamed.poses.length, project.poses.length);
  assert.equal(renamed.poses[0], 'windup2');
  assert.throws(() => renamePose(project, 0, '../x'), /letters/);
  assert.throws(() => renamePose(project, 9, 'x'), /No such pose/);
});

test('the canvas kit view maps anchors and clip offsets to items, and back without drift', () => {
  const { project } = parsePoseFile(readFixture('pose-studio/renewal/attack.pose.json'));
  const doc = canvasDocOf(project);
  assert.equal(doc.width, 1000);
  assert.equal(doc.height, 600);
  const hand = doc.items.find((i) => i.id === 'anchor:hand');
  assert.equal(hand.x + hand.w / 2, project.anchors.hand[0] * 1000);
  const same = applyCanvasDoc(project, doc);
  assert.deepEqual(same.anchors, project.anchors, 'unmoved items keep their anchors');
  assert.equal(same.clips[0].x, project.clips[0].x);
  const moved = applyCanvasDoc(project, { ...doc, items: doc.items.map((i) => (i.id === 'anchor:weapon' ? { ...i, x: i.x + 20 } : i)) });
  assert.ok(Math.abs(moved.anchors.weapon[0] - (project.anchors.weapon[0] + 0.02)) < 1e-9);
});

test('adding and removing effects keeps IDs unique and refuses unknown or unsafe input', () => {
  const { project } = parsePoseFile(readFixture('pose-studio/renewal/attack.pose.json'));
  const a = addClip(project, 'slash');
  assert.equal(a.project.clips.length, project.clips.length + 1);
  const added = a.project.clips.at(-1);
  assert.equal(added.id, a.id);
  assert.equal(added.cue, 'contact');
  assert.equal(checkProject(a.project).length, 0);
  const b = addClip(a.project, 'slash');
  assert.notEqual(b.id, a.id, 'a second slash gets its own ID');
  assert.throws(() => addClip(project, '../evil'), /letters/);
  assert.throws(() => addClip(project, 'slash', { cue: 'later' }), /Unknown cue/);
  assert.throws(() => addClip(project, 'slash', { anchor: 'nope' }), /No anchor/);
  const removed = removeClip(a.project, added.id);
  assert.equal(removed.clips.length, project.clips.length);
  assert.throws(() => removeClip(removed, 'missing'), /No effect/);
});

test('bindings read as rows with their tags, enabled state and priority', () => {
  const { project } = parsePoseFile(readFixture('pose-studio/renewal/attack.pose.json'));
  assert.deepEqual(bindingRows(project), [], 'the attack set has no bindings');
  const rows = bindingRows({ bindings: [{ id: 'b1', name: 'Card hit', provider: 'ashenspire', kind: 'card', objectId: 'strike', event: 'actionResolved', all: ['fx:fire'], any: ['weapon'], none: ['blocked'], enabled: false, priority: 5 }] });
  assert.deepEqual(rows[0].tags, ['fx:fire', 'any weapon', 'not blocked']);
  assert.equal(rows[0].enabled, false);
  assert.equal(rows[0].priority, 5);
});

test('snap rounds to the grid step and leaves the value alone without one', () => {
  assert.equal(snap(13, 5), 15);
  assert.equal(snap(13, 0), 13);
});

test('generated files are the stance projects the build writes; renewal and other sets are editable', () => {
  assert.equal(isGenerated('pose-studio/stances/projects/reaver-default/offensive.pose.json'), true);
  assert.equal(isGenerated('pose-studio/stances/projects/herald-default/casting.pose.json'), true);
  assert.equal(isGenerated('pose-studio/stances/registry.json'), true);
  assert.equal(isGenerated('pose-studio/renewal/attack.pose.json'), false);
  assert.equal(isGenerated('pose-studio/renewal/base-attack.pose.json'), false);
  assert.equal(isGenerated('pose-studio/stancesX/file.pose.json'), false, 'a prefix match needs the folder separator');
  assert.equal(isGenerated(undefined), false);
});
