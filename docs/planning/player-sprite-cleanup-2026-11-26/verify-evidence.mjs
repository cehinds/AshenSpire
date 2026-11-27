// Planning-artifact verification only; does not run or alter the game.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const baseline = '49eca254d795d06266aa23941cb2b31fe77b27bf';
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item =>
  item.isDirectory() ? files(join(dir, item.name)) : [join(dir, item.name)]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const errors = [];
let links = 0, imageHashes = 0, loadedImageReceipts = 0, jsonFiles = 0;
const checkFile = (path, expected, bytes) => {
  if (!existsSync(path)) { errors.push(`Missing image: ${path}`); return; }
  const data = readFileSync(path);
  if (!expected || sha(data) !== expected) errors.push(`Image hash mismatch: ${path}`);
  if (bytes !== undefined && data.length !== bytes) errors.push(`Image byte count mismatch: ${path}`);
  imageHashes++;
};

for (const file of files(root)) {
  if (file.endsWith('.json')) {
    jsonFiles++;
    if (statSync(file).size > 256 * 1024) errors.push(`JSON exceeds 256 KiB: ${file}`);
    try { JSON.parse(readFileSync(file, 'utf8')); } catch { errors.push(`Invalid JSON: ${file}`); }
  }
  if (!file.endsWith('.md')) continue;
  const content = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].trim().replace(/^<|>$/g, '');
    if (/^(https?:|mailto:|#)/i.test(href)) continue;
    const [target, anchor] = href.split('#');
    const dest = resolve(dirname(file), decodeURIComponent(target));
    if (!existsSync(dest)) { errors.push(`Broken local link in ${file}: ${href}`); continue; }
    if (/^L\d+/.test(anchor || '')) {
      const line = Number(anchor.match(/^L(\d+)/)[1]);
      if (line > readFileSync(dest, 'utf8').split('\n').length) errors.push(`Invalid source line: ${href}`);
    }
    links++;
  }
}

const visual = json('visuals/image-manifest.json');
if (visual.sourceCommit !== baseline || visual.artTag !== 'ashenspire-hd-assets-v30') errors.push('Visual identity mismatch');
for (const [name, record] of Object.entries(visual.outputImages)) checkFile(join(root, 'visuals', name), record.sha256, record.bytes);

const runtime = json('verification/runtime-capture-record.json');
if (runtime.sourceBaseline !== baseline || runtime.artTag !== 'ashenspire-hd-assets-v30') errors.push('Runtime capture identity mismatch');
for (const capture of runtime.captures) {
  checkFile(join(root, 'verification', capture.file), capture.sha256, capture.bytes);
  for (const receipt of capture.receipts || []) {
    if (!receipt.loadedBytesMatchCache || receipt.loadedByteSha256 !== receipt.cacheByteSha256) errors.push(`Loaded image mismatch: ${receipt.assetId}`);
    loadedImageReceipts++;
  }
}

const measured = json('measurements/summary.json');
if (measured.baseline !== baseline || measured.counts.missingRasterFiles || measured.counts.catalogHashMismatches) errors.push('Measured baseline checks failed');
const result = { baseline, kind: 'Planning evidence integrity, not implementation acceptance',
  checkedAt: new Date().toISOString(), localLinksChecked: links, imageHashesChecked: imageHashes,
  loadedImageReceiptsChecked: loadedImageReceipts, compactJsonFilesChecked: jsonFiles,
  measuredCounts: measured.counts, errors, pass: errors.length === 0 };
writeFileSync(join(root, 'VALIDATION.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
