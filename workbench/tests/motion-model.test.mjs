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
  canvasDocOf, applyCanvasDoc, snap, addClip, removeClip, bindingRows, isGenerated, layoutOf,
  rebaseOnConflicts, viewOf, selectionGate, isDirtyFile, dirtyPathsOf, keepDrafts, saveChangesOf,
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

test('an edited indented pose file keeps its indent, its trailing newline, and changes only the edited line', () => {
  const real = readFixture('pose-studio/stances/projects/herald-default/casting.pose.json');
  const { project: base } = parsePoseFile(real);
  const compact = JSON.stringify(base);
  // The shipped files escape non-ASCII as \uXXXX, so the synthetic variants do too.
  const ascii = (s) => s.replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const variants = [
    ['two spaces', real],
    ['four spaces', ascii(JSON.stringify(base, null, 4)) + '\n'],
    ['a tab', ascii(JSON.stringify(base, null, '\t')) + '\n'],
  ];
  for (const [label, text] of variants) {
    const { project } = parsePoseFile(text);
    const hand = project.anchors.hand;
    const edited = setAnchor(project, 'hand', [hand[0] === 0.5 ? 0.25 : 0.5, hand[1]]);
    const out = serializePoseFile(edited, text);
    const before = text.split('\n');
    const after = out.split('\n');
    assert.equal(after.length, before.length, `${label}: same line count`);
    assert.equal(after.filter((line, i) => line !== before[i]).length, 1, `${label}: one line differs`);
    assert.deepEqual(JSON.parse(out), edited, `${label}: parses back to the edit`);
    assert.equal(out.endsWith('\n'), text.endsWith('\n'), `${label}: trailing newline kept`);
  }
  assert.notEqual(compact, real, 'the fixture is indented, not compact');
});

test('a pose file layout is its indent (none, two spaces, four spaces or a tab) and its trailing whitespace', () => {
  const { project } = parsePoseFile(readFixture('pose-studio/renewal/attack.pose.json'));
  assert.deepEqual(layoutOf(JSON.stringify(project)), { indent: '', tail: '' });
  assert.deepEqual(layoutOf(`${JSON.stringify(project, null, 2)}\n`), { indent: '  ', tail: '\n' });
  assert.deepEqual(layoutOf(JSON.stringify(project, null, 4)), { indent: '    ', tail: '' });
  assert.deepEqual(layoutOf(`${JSON.stringify(project, null, '\t')}\n\n`), { indent: '\t', tail: '\n\n' });
  assert.deepEqual(layoutOf(undefined), { indent: '', tail: '' });
});

/** Every *.pose.json under a repo folder, found without a build step. */
function poseFilesUnder(rel, out = []) {
  for (const entry of fs.readdirSync(new URL(`../../${rel}`, import.meta.url), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) poseFilesUnder(child, out);
    else if (entry.name.endsWith('.pose.json')) out.push(child);
  }
  return out;
}

test('every shipped pose file (renewal, stances and the rest) round-trips byte-identically with no edits', () => {
  const files = poseFilesUnder('pose-studio');
  assert.ok(files.length >= 68, `found ${files.length} pose files`);
  for (const rel of files) {
    const text = readFixture(rel);
    const { project } = parsePoseFile(text);
    assert.ok(project, `${rel} parses`);
    assert.equal(serializePoseFile(project, text), text, `${rel} is byte-exact`);
    assert.equal(isDirty(text, project), false, `${rel} is not dirty`);
  }
});

test('an anchor-only drag leaves the offsets of the effects bound to it, so they follow the anchor', () => {
  const project = {
    anchors: { hand: [0.5, 0.5], torso: [0.3, 0.4] },
    clips: [
      { id: 'bound', effect: 'burst', anchor: 'hand', x: 10, y: -20 },
      { id: 'other', effect: 'spark', anchor: 'torso', x: 0, y: 0 },
    ],
  };
  const doc = canvasDocOf(project);
  const moved = applyCanvasDoc(project, {
    ...doc,
    items: doc.items.map((i) => (i.id === 'anchor:hand' ? { ...i, x: i.x + 30, y: i.y - 15 } : i)),
  });
  assert.ok(Math.abs(moved.anchors.hand[0] - (0.5 + 30 / 1000)) < 1e-9, 'the anchor moved');
  assert.equal(moved.clips[0].x, 10, 'the bound effect keeps its x offset');
  assert.equal(moved.clips[0].y, -20, 'the bound effect keeps its y offset');
  assert.deepEqual(moved.clips[1], project.clips[1], 'an unbound effect is untouched');
});

test('a dragged effect is recomputed against its anchor, and only that effect changes', () => {
  const project = {
    anchors: { hand: [0.5, 0.5] },
    clips: [{ id: 'a', effect: 'burst', anchor: 'hand', x: 10, y: 0 }],
  };
  const doc = canvasDocOf(project);
  const next = applyCanvasDoc(project, {
    ...doc,
    items: doc.items.map((i) => (i.id === 'clip:a' ? { ...i, x: i.x + 7 } : i)),
  });
  assert.equal(next.clips[0].x, 17, 'the offset follows the dragged handle');
  assert.equal(next.clips[0].y, 0);
  assert.deepEqual(next.anchors, project.anchors);
});

test('keep my version rebases each change on the hash a 409 reported, and a deleted file recreates with null', () => {
  const changes = [
    { path: 'pose-studio/renewal/a.pose.json', text: '{}', baseHash: 'old-a' },
    { path: 'pose-studio/renewal/b.pose.json', text: '{}', baseHash: 'old-b' },
    { path: 'pose-studio/renewal/c.pose.json', text: '{}', baseHash: 'old-c' },
  ];
  const conflicts = [
    { path: 'pose-studio/renewal/a.pose.json', hash: null },
    { path: 'pose-studio/renewal/b.pose.json', hash: 'disk-b' },
  ];
  const out = rebaseOnConflicts(changes, conflicts);
  assert.equal(out[0].baseHash, null, 'a pose deleted on disk is saved as a new file');
  assert.equal(out[1].baseHash, 'disk-b', 'a changed file keeps the hash now on disk');
  assert.equal(out[2].baseHash, 'old-c', 'a file that did not conflict keeps its own hash');
  assert.equal(changes[0].baseHash, 'old-a', 'the input is not changed');
  assert.equal(out[0].text, '{}');
});

test('a pose file with clips or bindings null shows as empty lists, the file is not changed, and an added effect is written', () => {
  const text = JSON.stringify({
    schemaVersion: 1, id: 'broken', name: 'Broken', actor: 'warrior', duration: 1000,
    poses: ['a', 'b', 'c', 'd', 'e'], anchors: { hand: [0.5, 0.5], torso: [0.3, 0.4] }, clips: null, bindings: null,
  });
  const { project, problems } = parsePoseFile(text);
  assert.ok(problems.includes('Clips missing'), 'the validation message names the missing clips');
  assert.ok(problems.includes('Bindings missing'));
  const view = viewOf(project);
  assert.deepEqual(view.clips, []);
  assert.deepEqual(view.bindings, []);
  assert.doesNotThrow(() => canvasDocOf(view));
  assert.doesNotThrow(() => bindingRows(view));
  assert.equal(project.clips, null, 'the raw project keeps the null');
  assert.equal(isDirty(text, project), false, 'showing the normalised lists is not a change');
  assert.equal(serializePoseFile(project, text), text);
  const made = addClip(project, 'burst');
  assert.equal(made.project.clips.length, 1, 'an edit writes the list back');
  assert.equal(made.project.bindings, null, 'only the edited field changes');
});

test('viewOf leaves a well-formed project as it is and fills missing poses and anchors for display', () => {
  const { project } = parsePoseFile(readFixture('pose-studio/renewal/attack.pose.json'));
  assert.deepEqual(viewOf(project), project);
  const bare = viewOf({ id: 'x', name: 'x', actor: 'x', duration: 1000, poses: null, anchors: null, clips: undefined });
  assert.deepEqual(bare.poses, []);
  assert.deepEqual(bare.anchors, {});
  assert.deepEqual(bare.clips, []);
  assert.equal(viewOf(null), null);
});

test('a selection gate drops a file read that a newer selection has overtaken', () => {
  const gate = selectionGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(gate.current(first), false, 'the first pick is stale once the second begins');
  assert.equal(gate.current(second), true);
  assert.equal(gate.latest(), second, 'reading the latest does not start a new selection');
  assert.equal(gate.current(second), true);
});

/** A loaded file record as the module holds it: the bytes read, the project drafted from them. */
function recordOf(path, text, edit = null) {
  const { project } = parsePoseFile(text);
  return { path, kind: 'project', hash: `h-${path}`, original: text, project: edit ? edit(project) : project, problems: [] };
}

test('a draft is dirty only when its project differs from the bytes read, and generated files are never dirty', () => {
  const text = readFixture('pose-studio/renewal/attack.pose.json');
  const clean = recordOf('pose-studio/renewal/attack.pose.json', text);
  const edited = recordOf('pose-studio/renewal/attack.pose.json', text, (p) => renamePose(p, 0, 'draft-pose'));
  assert.equal(isDirtyFile(clean), false);
  assert.equal(isDirtyFile(edited), true);
  const generated = recordOf('pose-studio/stances/x.pose.json', text, (p) => renamePose(p, 0, 'draft-pose'));
  assert.equal(isDirtyFile(generated), false, 'a build-written file takes no edits');
  assert.equal(isDirtyFile(null), false);
});

test('dirtyPathsOf lists the drafts with unsaved edits, in the order they were opened', () => {
  const text = readFixture('pose-studio/renewal/attack.pose.json');
  const a = recordOf('pose-studio/renewal/a.pose.json', text, (p) => renamePose(p, 0, 'one'));
  const b = recordOf('pose-studio/renewal/b.pose.json', text);
  const c = recordOf('pose-studio/renewal/c.pose.json', text, (p) => renamePose(p, 1, 'two'));
  const drafts = new Map([[a.path, a], [b.path, b], [c.path, c]]);
  assert.deepEqual(dirtyPathsOf(drafts), ['pose-studio/renewal/a.pose.json', 'pose-studio/renewal/c.pose.json']);
  assert.deepEqual(dirtyPathsOf(new Map()), []);
});

test('switching files keeps every dirty draft, and drops clean ones except the file now open', () => {
  const text = readFixture('pose-studio/renewal/attack.pose.json');
  const dirty = recordOf('pose-studio/renewal/a.pose.json', text, (p) => renamePose(p, 0, 'one'));
  const clean = recordOf('pose-studio/renewal/b.pose.json', text);
  const openNow = recordOf('pose-studio/renewal/c.pose.json', text);
  const kept = keepDrafts(new Map([[dirty.path, dirty], [clean.path, clean]]), openNow.path);
  assert.deepEqual([...kept.keys()], [dirty.path], 'the clean draft goes, the dirty one stays');
  assert.equal(kept.get(dirty.path), dirty, 'the draft is the same record, so the edits come back');
  const withOpen = keepDrafts(new Map([[clean.path, clean]]), clean.path);
  assert.deepEqual([...withOpen.keys()], [clean.path], 'the open file stays even when clean');
});

test('the save changes are the dirty drafts only, each on its own base hash, rebased on any conflict', () => {
  const text = readFixture('pose-studio/renewal/attack.pose.json');
  const a = recordOf('pose-studio/renewal/a.pose.json', text, (p) => renamePose(p, 0, 'one'));
  const b = recordOf('pose-studio/renewal/b.pose.json', text, (p) => renamePose(p, 1, 'two'));
  const clean = recordOf('pose-studio/renewal/c.pose.json', text);
  const changes = saveChangesOf([a, b, clean], []);
  assert.deepEqual(changes.map((c) => c.path), ['pose-studio/renewal/a.pose.json', 'pose-studio/renewal/b.pose.json']);
  assert.equal(changes[0].baseHash, 'h-pose-studio/renewal/a.pose.json');
  assert.equal(changes[0].text, serializePoseFile(a.project, text));
  const rebased = saveChangesOf([a, b], [{ path: b.path, hash: null }]);
  assert.equal(rebased[1].baseHash, null, 'a conflicted draft is saved against the hash the 409 reported');
  assert.equal(rebased[0].baseHash, 'h-pose-studio/renewal/a.pose.json');
});
