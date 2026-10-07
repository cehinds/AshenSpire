// A local authoring bridge for the opening editor. Only the final journey
// scene and the editor's grid preferences can be promoted to shipped defaults.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PROLOGUE_PREFIX, prologueRows, prologueValueIsValid } from '../src/model/prologue.js';

const SOURCE = 'content/config/ui/screens/prologue.json';
const EDITOR_KEYS = new Set(['editorGrid', 'editorSnap', 'editorGridStep']);

export async function saveFirstStepDefaults(root, changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Expected scene settings.');
  const entries = Object.entries(changes);
  if (!entries.length) throw new Error('No first-step changes to save.');
  if (entries.length > 150) throw new Error('Too many scene settings.');
  const rows = new Map(prologueRows().map(row => [row.key, row]));
  const updates = entries.map(([key, value]) => {
    const row = rows.get(key);
    const path = row?.prologuePath;
    const allowed = path?.[0] === 'scenes' && key.startsWith(`${PROLOGUE_PREFIX}scenes.step.`)
      || path?.[0] === 'presentation' && EDITOR_KEYS.has(path[1]);
    if (!allowed || !prologueValueIsValid(row, value)) throw new Error(`Invalid first-step setting: ${key}`);
    return { path, value };
  });
  const sourcePath = join(root, SOURCE);
  const original = await readFile(sourcePath, 'utf8');
  const document = JSON.parse(original);
  const sequence = document.components?.sequence;
  const step = sequence?.scenes?.find(scene => scene.id === 'step');
  if (!step || !sequence.presentation) throw new Error('The project opening config is missing its first step.');
  for (const { path, value } of updates) {
    let target = path[0] === 'scenes' ? step : sequence.presentation;
    const names = path[0] === 'scenes' ? path.slice(2) : path.slice(1);
    for (const name of names.slice(0, -1)) target = target[name] ||= {};
    target[names.at(-1)] = value;
  }
  const next = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(sourcePath, next);
  const build = spawnSync(process.execPath, ['tools/config-build.mjs'], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) {
    await writeFile(sourcePath, original);
    throw new Error(build.stderr?.trim() || 'Could not rebuild project config.');
  }
  return { file: SOURCE, keys: updates.length };
}
