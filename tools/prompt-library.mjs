#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TOOL_DIR, '..');
const MANIFEST_FILE = 'manifest.json';
const ENV_LIBRARY_DIR = 'CONSTANTINE_PROMPT_LIBRARY';

const PROMPTS = Object.freeze([
  Object.freeze({
    id: 'ashenspire',
    source: 'PROMPT.md',
    file: 'ashenspire.md',
    title: 'Ashen Spire Rebuild — .NET-First Master Prompt',
    summary: 'A game-specific rebuild contract covering Ashen Spire design, live issue intake, typed .NET architecture, deterministic combat and runs, data DSLs, configurable UI, assets/audio, testing, and gated delivery.',
  }),
  Object.freeze({
    id: 'general-game',
    source: 'docs/GENERAL-GAME-BUILD-PROMPT.md',
    file: 'general-game.md',
    title: 'General Game Builder — .NET-First Master Prompt',
    summary: 'A fill-in, genre- and renderer-independent template for planning and building another game with reusable .NET services, typed configuration, data-driven content, scalable UI, assets, saves, tests, and incremental release gates.',
  }),
]);

function usage() {
  return [
    'Usage: node tools/prompt-library.mjs <command> [id] [--library-dir <path>]',
    'Commands: install | list | path | summary [id] | print <id> | verify',
  ].join('\n');
}

function parseArgs(argv) {
  const args = [...argv];
  let libraryDir;
  const flagIndex = args.indexOf('--library-dir');
  if (flagIndex >= 0) {
    libraryDir = args[flagIndex + 1];
    if (!libraryDir) throw new Error('--library-dir requires a path.');
    args.splice(flagIndex, 2);
  }
  if (args.some((arg) => arg.startsWith('--'))) {
    throw new Error(`Unknown option: ${args.find((arg) => arg.startsWith('--'))}`);
  }
  return { command: args[0], id: args[1], extra: args.slice(2), libraryDir };
}

function resolveLibraryDir(override) {
  const environmentOverride = process.env[ENV_LIBRARY_DIR];
  return resolve(
    override
      ?? (environmentOverride?.trim() ? environmentOverride : undefined)
      ?? join(homedir(), '.constantine', 'prompt-library'),
  );
}

function validateCommandArgs({ command, id, extra }) {
  if (extra.length) throw new Error(`Unexpected argument: ${extra[0]}`);
  switch (command) {
    case 'install':
    case 'list':
    case 'path':
    case 'verify':
      if (id) throw new Error(`Unexpected argument: ${id}`);
      break;
    case 'summary':
      break;
    case 'print':
      if (!id) throw new Error('print requires a prompt id.');
      break;
    default:
      throw new Error(usage());
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function atomicWrite(destination, bytes) {
  const temporary = `${destination}.tmp-${process.pid}`;
  await writeFile(temporary, bytes);
  try {
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.prompts)) {
    throw new Error(`Invalid ${MANIFEST_FILE}: expected schemaVersion 1 and prompts[].`);
  }
  const expectedIds = new Set(PROMPTS.map(({ id }) => id));
  const foundIds = new Set();
  for (const entry of manifest.prompts) {
    if (!expectedIds.has(entry?.id)) throw new Error(`Invalid manifest prompt id: ${entry?.id}`);
    if (foundIds.has(entry.id)) throw new Error(`Duplicate manifest prompt id: ${entry.id}`);
    if (
      typeof entry.file !== 'string'
      || typeof entry.sha256 !== 'string'
      || typeof entry.title !== 'string'
      || typeof entry.summary !== 'string'
    ) {
      throw new Error(`Invalid manifest entry for ${entry.id}.`);
    }
    foundIds.add(entry.id);
  }
  for (const id of expectedIds) {
    if (!foundIds.has(id)) throw new Error(`Manifest is missing prompt id: ${id}`);
  }
  return manifest;
}

async function readManifest(libraryDir) {
  let text;
  try {
    text = await readFile(join(libraryDir, MANIFEST_FILE), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Prompt library is not installed at ${libraryDir}. Run install first.`);
    }
    throw error;
  }
  try {
    return validateManifest(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid ${MANIFEST_FILE}: malformed JSON.`);
    throw error;
  }
}

async function install(libraryDir) {
  await mkdir(libraryDir, { recursive: true });
  const entries = [];
  for (const prompt of PROMPTS) {
    const bytes = await readFile(join(REPO_ROOT, prompt.source));
    await atomicWrite(join(libraryDir, prompt.file), bytes);
    entries.push({ ...prompt, sha256: sha256(bytes) });
  }
  const manifest = {
    schemaVersion: 1,
    installedAt: new Date().toISOString(),
    prompts: entries,
  };
  await atomicWrite(
    join(libraryDir, MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const catalog = [
    '# Constantine’s prompt library',
    '',
    'Use these files directly in text or voice chats. Start by reading the short',
    'summary, then attach or paste the matching full prompt when detailed execution',
    'is required.',
    '',
    ...entries.flatMap((entry) => [
      `## ${entry.id} — ${entry.title}`,
      '',
      entry.summary,
      '',
      `Full prompt: [${entry.file}](${entry.file})`,
      '',
      `Voice cue: “Use the ${entry.id} prompt from my Constantine prompt library. First summarize the relevant requirements, then work one reviewed increment at a time.”`,
      '',
    ]),
  ].join('\n');
  await atomicWrite(join(libraryDir, 'README.md'), `${catalog}\n`);
  process.stdout.write(`PASS — ${entries.length}/${PROMPTS.length} prompts installed at ${libraryDir}\n`);
}

async function verify(libraryDir, quiet = false) {
  const manifest = await readManifest(libraryDir);
  const failures = [];
  for (const entry of manifest.prompts) {
    let bytes;
    try {
      bytes = await readFile(join(libraryDir, entry.file));
    } catch (error) {
      failures.push(`${entry.id}: ${error?.code === 'ENOENT' ? 'file missing' : error.message}`);
      continue;
    }
    const actual = sha256(bytes);
    if (actual !== entry.sha256) failures.push(`${entry.id}: SHA-256 mismatch`);
  }
  if (failures.length) throw new Error(`Prompt library verification failed: ${failures.join('; ')}`);
  if (!quiet) {
    process.stdout.write(`PASS — ${manifest.prompts.length}/${manifest.prompts.length} installed prompts verified.\n`);
  }
  return manifest;
}

async function list(libraryDir) {
  const manifest = await verify(libraryDir, true);
  for (const entry of manifest.prompts) {
    process.stdout.write(`${entry.id}\t${entry.file}\t${entry.title}\t${entry.sha256}\n`);
  }
  process.stdout.write(`PASS — ${manifest.prompts.length}/${manifest.prompts.length} installed prompts listed.\n`);
}

async function summary(libraryDir, id) {
  const manifest = await verify(libraryDir, true);
  const entries = id
    ? manifest.prompts.filter((entry) => entry.id === id)
    : manifest.prompts;
  if (!entries.length) {
    throw new Error(`Unknown prompt id: ${id}. Expected ${PROMPTS.map((p) => p.id).join(', ')}.`);
  }
  for (const entry of entries) {
    process.stdout.write(`${entry.id} — ${entry.title}\n${entry.summary}\n`);
  }
  process.stdout.write(`PASS — ${entries.length}/${entries.length} prompt summaries printed.\n`);
}

async function print(libraryDir, id) {
  if (!id) throw new Error('print requires a prompt id.');
  const manifest = await verify(libraryDir, true);
  const entry = manifest.prompts.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown prompt id: ${id}. Expected ${PROMPTS.map((p) => p.id).join(', ')}.`);
  process.stdout.write(await readFile(join(libraryDir, entry.file), 'utf8'));
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  validateCommandArgs(parsed);
  const libraryDir = resolveLibraryDir(parsed.libraryDir);
  switch (parsed.command) {
    case 'install': await install(libraryDir); break;
    case 'list': await list(libraryDir); break;
    case 'path': process.stdout.write(`${libraryDir}\n`); break;
    case 'summary': await summary(libraryDir, parsed.id); break;
    case 'print': await print(libraryDir, parsed.id); break;
    case 'verify': await verify(libraryDir); break;
  }
}

main().catch((error) => {
  process.stderr.write(`FAIL — ${error.message}\n`);
  process.exitCode = 1;
});
