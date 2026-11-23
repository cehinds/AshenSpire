// tools/score-studio-save.mjs — local repo read/write helpers for Score Studio (scoring.json + cardArtLayers.json).
//
// Used by tools/serve.mjs on localhost only. All paths are validated to stay inside the repository root.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname, sep, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ValidateScoringConfig } from '../src/model/activeScoring.js';

export const DEFAULT_SCORING_PATH = 'content/source/scoring.json';
export const DEFAULT_ART_LAYERS_PATH = 'content/source/cardArtLayers.json';

function resolveRepoPath(rootDir, relPath, fallback) {
  const chosen = typeof relPath === 'string' && relPath.trim() ? relPath.trim() : fallback;
  const cleaned = chosen.replace(/\\/g, '/').replace(/^\/+/, '');
  const rootResolved = resolve(rootDir);
  const target = resolve(rootResolved, cleaned);
  const rel = relative(rootResolved, target);
  if (isAbsolute(rel) || rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || target === rootResolved) {
    throw new Error(`Path "${chosen}" escapes the repository root.`);
  }
  if (!target.endsWith('.json')) {
    throw new Error(`Path "${chosen}" must be a .json file.`);
  }
  return { target, rel: rel.split(sep).join('/') };
}

export function readStudioConfig(rootDir, { scoringPath, artLayersPath } = {}) {
  const sc = resolveRepoPath(rootDir, scoringPath, DEFAULT_SCORING_PATH);
  const al = resolveRepoPath(rootDir, artLayersPath, DEFAULT_ART_LAYERS_PATH);
  const scoringExists = existsSync(sc.target);
  const artLayersExists = existsSync(al.target);
  return {
    scoringPath: sc.rel,
    defaultScoringPath: DEFAULT_SCORING_PATH,
    scoringExists,
    scoring: scoringExists ? JSON.parse(readFileSync(sc.target, 'utf8')) : null,
    artLayersPath: al.rel,
    defaultArtLayersPath: DEFAULT_ART_LAYERS_PATH,
    artLayersExists,
    artLayers: artLayersExists ? JSON.parse(readFileSync(al.target, 'utf8')) : null,
  };
}

export function saveStudioScoring(rootDir, { path: relPath, scoring, rebuild = true } = {}) {
  const errors = ValidateScoringConfig(scoring);
  if (errors.length) {
    throw new Error(`Invalid scoring configuration: ${errors.join(' ')}`);
  }
  const { target, rel } = resolveRepoPath(rootDir, relPath, DEFAULT_SCORING_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(scoring, null, 2) + '\n', 'utf8');

  const rebuilt = [];
  if (rebuild && rel === DEFAULT_SCORING_PATH) {
    for (const script of ['tools/content-build.mjs', 'tools/combat-power-report.mjs', 'tools/level-lists.mjs']) {
      const r = spawnSync(process.execPath, [resolve(rootDir, script)], { cwd: rootDir, encoding: 'utf8' });
      if (r.status !== 0) {
        throw new Error(`Saved ${rel}, but ${script} failed: ${(r.stderr || r.stdout || '').trim().slice(0, 400)}`);
      }
      rebuilt.push(script);
    }
  }
  return { path: rel, rebuilt };
}

export function saveStudioArtLayers(rootDir, { path: relPath, artLayers } = {}) {
  if (!artLayers || typeof artLayers !== 'object' || !Array.isArray(artLayers.layers)) {
    throw new Error('Art layers config must be an object with a "layers" array.');
  }
  const { target, rel } = resolveRepoPath(rootDir, relPath, DEFAULT_ART_LAYERS_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(artLayers, null, 2) + '\n', 'utf8');
  return { path: rel, layerCount: artLayers.layers.length };
}
