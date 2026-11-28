// tools/score-studio-pack-cards.mjs: the card half of a Studio Save. It merges card changes by
// id into the game's card file and rebuilds what the game reads, rolling back on a failure.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  StudioCardChangeKeys,
  StudioPackCardIdPrefixes,
  IsStudioPackCardId,
  StudioCardExtraFieldTypes,
} from './score-studio/studioSaveFiles.js';
import { SCHEMAS } from '../src/model/schemas.js';

const jsonIndent = 2;
const lineEnd = '\n';
const textEncoding = 'utf8';
const privateKeyMark = '_';
const idKey = 'id';
const nameKey = 'name';
const stepOutputLimit = 1200;
const maxStepOutputBytes = 8 * 1024 * 1024;

// Order matters: game-config embeds the enemy level cards, which read the card file.
export const PackCardsBuildSteps = Object.freeze([
  Object.freeze(['tools/enemy-level-cards.mjs', '--write']),
  Object.freeze(['tools/game-config.mjs', 'build']),
  Object.freeze(['tools/combat-power-report.mjs']),
  Object.freeze(['tools/build-game.mjs']),
]);
// Everything the steps write in the tree, kept so a failed step can put it back.
const buildOutputFiles = Object.freeze([
  'games/ashenspire/game.lock.json',
  'games/ashenspire/build.summary.json',
  'games/ashenspire/packs/core/enemyLevelCards.json',
]);
const buildOutputTrees = Object.freeze(['src/content/generated']);
// The JSON type each card schema kind holds; kinds not listed here are not type-checked.
const schemaKindTypes = Object.freeze({
  str: 'string',
  enum: 'string',
  ref: 'string',
  num: 'number',
  bool: 'boolean',
  arr: 'array',
  effects: 'array',
  obj: 'object',
  map: 'object',
});
const enumKind = 'enum';
const uncheckedType = 'any';
const cardFields = SCHEMAS.card.fields;

function isPlainObject(value)
{
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value)
{
  return typeof value === 'string' && Boolean(value);
}

function isAuthoredKey(key)
{
  return key !== idKey && !key.startsWith(privateKeyMark);
}

function namespaceRule()
{
  return StudioPackCardIdPrefixes.join(' or ');
}

function changeShapeProblem(change)
{
  if (!isPlainObject(change))
  {
    return 'cards must be an array of card change objects.';
  }
  const extraKeys = Object.keys(change).filter((key) => !StudioCardChangeKeys.includes(key));
  if (extraKeys.length)
  {
    return `a card change has keys that are not allowed: ${extraKeys.join(', ')}.`;
  }
  const hasShape = isPlainObject(change.set) && Array.isArray(change.unset);
  return hasShape
    ? null
    : `card change "${change.id}" needs a "set" object and an "unset" array.`;
}

function changeKeysProblem(change)
{
  const setKeys = Object.keys(change.set);
  const badKeys = [
    ...setKeys,
    ...change.unset,
  ].filter((key) => !isNonEmptyString(key) || !isAuthoredKey(key));
  if (badKeys.length)
  {
    return `card change "${change.id}" may not change ${badKeys.join(', ')}.`;
  }
  const bothWays = change.unset.filter((key) => setKeys.includes(key));
  return bothWays.length
    ? `card change "${change.id}" both sets and unsets ${bothWays.join(', ')}.`
    : null;
}

function jsonTypeOf(value)
{
  if (Array.isArray(value))
  {
    return 'array';
  }
  return value === null
    ? 'null'
    : typeof value;
}

function expectedTypeOf(key)
{
  const field = cardFields[key];
  if (!field)
  {
    return StudioCardExtraFieldTypes[key] ?? null;
  }
  return schemaKindTypes[field.k] ?? uncheckedType;
}

function fieldValueProblem(key, value)
{
  const isKnown = key in cardFields || key in StudioCardExtraFieldTypes;
  if (!isKnown)
  {
    return `"${key}" is not a card field.`;
  }
  const expected = expectedTypeOf(key);
  const isUnchecked = expected === uncheckedType;
  const typeMatches = isUnchecked || jsonTypeOf(value) === expected;
  if (!typeMatches || (expected === 'number' && !Number.isFinite(value)))
  {
    return `"${key}" must be a ${expected}.`;
  }
  const field = cardFields[key];
  const isEnumMiss = field?.k === enumKind && !field.values.includes(value);
  return isEnumMiss
    ? `"${key}" must be one of ${field.values.join(', ')}.`
    : null;
}

function requiredUnsetProblem(key)
{
  const field = cardFields[key];
  return field && !field.opt
    ? `"${key}" is required and cannot be removed.`
    : null;
}

// Each set value has its field's JSON type (and enum value); required fields stay.
function changeValuesProblem(change)
{
  const setProblems = Object.entries(change.set)
    .map(([key, value]) => fieldValueProblem(key, value));
  const unsetProblems = change.unset.map(requiredUnsetProblem);
  const problem = [
    ...setProblems,
    ...unsetProblems,
  ].find(Boolean);
  return problem
    ? `card change "${change.id}": ${problem}`
    : null;
}

function cardChangeProblem(change)
{
  const shapeProblem = changeShapeProblem(change);
  if (shapeProblem)
  {
    return shapeProblem;
  }
  if (!IsStudioPackCardId(change.id))
  {
    const where = `the game card file's namespaces (${namespaceRule()})`;
    return `card id "${change.id}" is not in ${where}.`;
  }
  return changeKeysProblem(change) ?? changeValuesProblem(change);
}

function removedIdsProblem(removedCardIds, changedIds)
{
  if (!Array.isArray(removedCardIds) || !removedCardIds.every(isNonEmptyString))
  {
    return 'removedCardIds must be an array of card ids.';
  }
  const outside = removedCardIds.filter((id) => !IsStudioPackCardId(id));
  if (outside.length)
  {
    return `removed ids ${outside.join(', ')} are not in the game card file's namespaces`
      + ` (${namespaceRule()}).`;
  }
  const changedAndRemoved = removedCardIds.filter((id) => changedIds.includes(id));
  return changedAndRemoved.length
    ? `cards ${changedAndRemoved.join(', ')} are both changed and removed.`
    : null;
}

/** The first problem with a Save's card data, or null: shape, keys and id namespaces. */
export function PackCardDataProblem(data)
{
  if (!Array.isArray(data.cards))
  {
    return 'cards must be an array of card change objects.';
  }
  const changeProblem = data.cards.map(cardChangeProblem).find(Boolean);
  if (changeProblem)
  {
    return changeProblem;
  }
  const changedIds = data.cards.map((change) => change.id);
  if (new Set(changedIds).size !== changedIds.length)
  {
    return 'cards holds the same id twice.';
  }
  return removedIdsProblem(data.removedCardIds, changedIds);
}

function applyCardChange(card, change)
{
  const changed = {
    ...card,
    ...change.set,
  };
  for (const key of change.unset)
  {
    delete changed[key];
  }
  return changed;
}

function addedCard(change)
{
  if (change.unset.length || !isNonEmptyString(change.set[nameKey]))
  {
    throw new Error(`new card "${change.id}" needs a name and no unset keys.`);
  }
  return {
    [idKey]: change.id,
    ...change.set,
  };
}

// Each card keeps its place and key order; changed keys are replaced, new keys go last.
export function MergePackCards(packCards, data)
{
  if (!Array.isArray(packCards))
  {
    throw new Error('the game card file is not a JSON array of cards.');
  }
  const removed = new Set(data.removedCardIds);
  const changeById = new Map(data.cards.map((change) => [change.id, change]));
  const packIds = new Set(packCards.map((card) => card.id));
  const kept = packCards
    .filter((card) => !removed.has(card.id))
    .map((card) => changeById.has(card.id)
      ? applyCardChange(card, changeById.get(card.id))
      : card);
  const added = data.cards
    .filter((change) => !packIds.has(change.id))
    .map(addedCard);
  return [
    ...kept,
    ...added,
  ];
}

/** The card file's new text: the same 2-space JSON, so untouched cards keep their bytes. */
export function MergedPackCardsText(packText, data)
{
  const merged = MergePackCards(JSON.parse(packText), data);
  return `${JSON.stringify(merged, null, jsonIndent)}${lineEnd}`;
}

function filesUnder(pathOf, relativeDir)
{
  if (!existsSync(pathOf(relativeDir)))
  {
    return [];
  }
  const entries = readdirSync(pathOf(relativeDir), { withFileTypes: true });
  return entries.flatMap((entry) =>
  {
    const relativePath = `${relativeDir}/${entry.name}`;
    return entry.isDirectory()
      ? filesUnder(pathOf, relativePath)
      : [relativePath];
  });
}

function treeFiles(pathOf)
{
  return buildOutputTrees.flatMap((tree) => filesUnder(pathOf, tree));
}

function snapshotBuildOutputs(pathOf)
{
  const snapshots = new Map();
  for (const relativePath of [...buildOutputFiles, ...treeFiles(pathOf)])
  {
    const target = pathOf(relativePath);
    snapshots.set(relativePath, existsSync(target)
      ? readFileSync(target)
      : null);
  }
  return snapshots;
}

function restoreBuildOutputs(pathOf, snapshots)
{
  for (const relativePath of treeFiles(pathOf))
  {
    if (!snapshots.has(relativePath))
    {
      rmSync(pathOf(relativePath), { force: true });
    }
  }
  for (const [relativePath, bytes] of snapshots)
  {
    const target = pathOf(relativePath);
    if (bytes === null)
    {
      rmSync(target, { force: true });
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}

function stepLabel(step)
{
  return `node ${step.join(' ')}`;
}

/** Runs one build step with node in rootDir; throws with the step's output when it fails. */
export function RunPackCardsBuildStep(rootDir, step, env)
{
  const [script, ...args] = step;
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: rootDir,
    env,
    encoding: textEncoding,
    windowsHide: true,
    maxBuffer: maxStepOutputBytes,
  });
  if (result.status === 0)
  {
    return;
  }
  const output = result.stderr || result.stdout || result.error?.message || '';
  throw new Error(`${stepLabel(step)} failed: ${output.trim().slice(-stepOutputLimit)}`);
}

// Runs every build step; on a failure the build outputs get their old bytes back.
// runStep(step) is the test seam; it returns the commands it ran, as typed.
export function RebuildFromPackCards(pathOf, runStep)
{
  const snapshots = snapshotBuildOutputs(pathOf);
  const rebuilt = [];
  try
  {
    for (const step of PackCardsBuildSteps)
    {
      runStep(step);
      rebuilt.push(stepLabel(step));
    }
  }
  catch (error)
  {
    restoreBuildOutputs(pathOf, snapshots);
    throw error;
  }
  return rebuilt;
}
