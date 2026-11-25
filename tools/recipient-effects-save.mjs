import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ReadRecipientEffectTiming, ValidateRecipientEffectTiming } from '../src/model/recipientEffectTiming.js';
import { CONFIG_DIR, GENERATED, compileEntries, generate, readConfigTree } from './config-build.mjs';
import { acquire } from './lib/build-lock.mjs';

const relativeFile = 'ui/presentation/recipientEffects.json';
const sourceFile = CONFIG_DIR + '/' + relativeFile;
const revisionOf = text => createHash('sha256').update(text).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });

function readState(root) {
  const text = readFileSync(join(root, sourceFile), 'utf8');
  return { text, document: JSON.parse(text), revision: revisionOf(text) };
}

export function readRecipientEffects(root) {
  const { document, revision } = readState(root);
  return { revision, timing: ReadRecipientEffectTiming(document), file: sourceFile };
}

function updateTiming(text, document, timing) {
  const motion = {
    resultQueueScope: timing.scope,
    resultMaxConcurrent: timing.maxConcurrent,
    resultGapMs: timing.gapMs,
    resultOverlapMs: timing.overlapMs,
  };
  const expected = structuredClone(document);
  Object.assign(expected.motion, motion);
  expected.layering.opacity.global = timing.opacity;

  let updated = text;
  for (const [field, value] of Object.entries({ ...motion, global: timing.opacity })) {
    const fieldValue = new RegExp('("' + field + '"\\s*:\\s*)("(?:\\\\.|[^"\\\\])*"|-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)', 'g');
    updated = updated.replace(fieldValue, (_, prefix, original) =>
      prefix + (JSON.parse(original) === value ? original : JSON.stringify(value)));
  }
  if (JSON.stringify(JSON.parse(updated)) !== JSON.stringify(expected)) {
    throw fail(409, 'Timing fields changed format. Reload the editor after restoring the authored timing fields.');
  }
  return updated;
}

export async function saveRecipientEffects(root, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).sort().join(',') !== 'revision,timing'
      || typeof input.revision !== 'string' || !/^[0-9a-f]{64}$/.test(input.revision)) {
    throw fail(400, 'Expected a saved revision and timing values.');
  }
  if (!input.timing || typeof input.timing !== 'object' || Array.isArray(input.timing)
      || Object.keys(input.timing).sort().join(',') !== 'gapMs,maxConcurrent,opacity,overlapMs,scope') {
    throw fail(400, 'Expected exactly scope, maxConcurrent, gapMs, overlapMs and opacity.');
  }
  let timing;
  try {
    timing = ValidateRecipientEffectTiming(input.timing);
  } catch (error) {
    throw fail(400, error.message);
  }

  const release = await acquire(root, 'recipient effects editor', { timeoutMs: 3000 });
  try {
    const { text, document, revision } = readState(root);
    if (revision !== input.revision) throw fail(409, 'The game JSON changed. Restore Saved before saving again.');
    const updated = updateTiming(text, document, timing);
    const entries = readConfigTree(join(root, 'content')).map(entry => entry.rel === relativeFile ? { ...entry, text: updated } : entry);
    const compiled = compileEntries(entries, { requireInteractionConfigs: true });
    if (compiled.errors.length) throw fail(422, 'Configuration did not compile. ' + compiled.errors.join(' '));

    const source = join(root, sourceFile);
    const generated = join(root, GENERATED);
    const generatedText = generate(compiled);
    const sourceChanged = updated !== text;
    const generatedChanged = !existsSync(generated) || readFileSync(generated, 'utf8').replaceAll('\r\n', '\n') !== generatedText;
    if (!sourceChanged && !generatedChanged) return { revision, timing, file: sourceFile };
    const suffix = '.editor-' + randomUUID();
    const sourceTemp = source + suffix;
    const generatedTemp = generated + suffix;
    const backup = sourceTemp + '.original';
    let restoreFailed = false;
    try {
      if (sourceChanged) {
        writeFileSync(sourceTemp, updated, { flag: 'wx' });
        writeFileSync(backup, text, { flag: 'wx' });
      }
      if (generatedChanged) {
        mkdirSync(dirname(generated), { recursive: true });
        writeFileSync(generatedTemp, generatedText, { flag: 'wx' });
      }
      if (readFileSync(source, 'utf8') !== text) throw fail(409, 'The game JSON changed during save. Restore Saved and try again.');
      if (sourceChanged) renameSync(sourceTemp, source);
      if (generatedChanged) {
        try {
          renameSync(generatedTemp, generated);
        } catch (error) {
          if (sourceChanged) {
            try {
              renameSync(backup, source);
            } catch (restoreError) {
              restoreFailed = true;
              throw new Error('Could not restore the source JSON. Original bytes are available at ' + backup, { cause: restoreError });
            }
          }
          throw error;
        }
      }
    } finally {
      for (const file of [sourceTemp, generatedTemp]) rmSync(file, { force: true });
      if (!restoreFailed) rmSync(backup, { force: true });
    }
    return { revision: revisionOf(updated), timing, file: sourceFile };
  } finally {
    release();
  }
}
