import { tableData } from './tables.mjs';
export { parseCSV, stringifyCSV, tableData } from './tables.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const slash = value => value.replaceAll('\\', '/');
export const editable = name => /^(content\/(source|framework)\/[^/]+\.(csv|json)|src\/(content|engine|model|ui)\/(?!.*\/generated\/)(?!generated\/)[\w./-]+\.js|styles\/[\w./-]+\.css|editor\/workspace\/[\w./-]+\.(json|js|html|css))$/.test(name);
export async function safePath(root, name, create = false) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.')) || /[:\x00-\x1f]/.test(name)) throw Error('Invalid workspace path');
  const absolute = path.resolve(root, name);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) throw Error('Path is outside the workspace');
  let part = root;
  for (const piece of name.split('/')) {
    part = path.join(part, piece);
    try { if ((await fs.lstat(part)).isSymbolicLink()) throw Error('Linked paths are not supported'); }
    catch (e) { if (e.code !== 'ENOENT' || !create) throw e; }
  }
  return absolute;
}
export async function walk(root, prefix, extensions) {
  const result = [];
  async function visit(name) {
    const entries = await fs.readdir(path.join(root, name), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink() || entry.name === 'node_modules') continue;
      const child = `${name}/${entry.name}`;
      if (entry.isDirectory()) await visit(child);
      else if (extensions.includes(path.extname(child).toLowerCase())) result.push(child);
    }
  }
  await visit(prefix);
  return result.sort();
}

export function validateText(name, text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 4 * 1024 * 1024) throw Error('Text files must be under 4 MB');
  if (/\.(csv|json)$/.test(name)) {
    const table = tableData(name, text);
    if (table.rows && table.columns.includes('id')) {
      const seen = new Set();
      for (const row of table.rows) {
        if (typeof row.id !== 'string' || !row.id.trim() || seen.has(row.id)) throw Error(`Missing or duplicate id: ${row.id}`);
        seen.add(row.id);
      }
    }
  }
}

export class Workspace {
  constructor(root, stateDir) { this.root = root; this.stateDir = stateDir; this.tail = Promise.resolve(); }
  serialize(fn) { const next = this.tail.then(fn, fn); this.tail = next.catch(() => {}); return next; }
  async read(name) {
    if (!editable(name)) throw Error('This file is not an editable source');
    const text = await fs.readFile(await safePath(this.root, name), 'utf8');
    return { path: name, text, hash: hash(text) };
  }
  async save(changes) {
    return this.serialize(async () => {
      if (!Array.isArray(changes) || !changes.length || changes.length > 100) throw Error('Choose 1–100 files to save');
      if (new Set(changes.map(c => c.path)).size !== changes.length) throw Error('Duplicate file in save');
      const prepared = [];
      for (const change of changes) {
        if (!editable(change.path)) throw Error('Generated or unsupported files cannot be edited');
        validateText(change.path, change.text);
        const target = await safePath(this.root, change.path, true);
        const old = await fs.readFile(target).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
        if ((old === null ? null : hash(old)) !== change.hash) throw Error(`${change.path} changed on disk. Reload it before saving.`);
        prepared.push({ ...change, target, old });
      }
      const id = `${Date.now()}-${randomUUID()}`;
      const directory = path.join(this.stateDir, 'backups', id);
      await fs.mkdir(directory, { recursive: true });
      const manifest = [];
      for (let i = 0; i < prepared.length; i++) {
        const file = prepared[i];
        if (file.old !== null) await fs.writeFile(path.join(directory, `${i}.bak`), file.old);
        manifest.push({ path: file.path, oldHash: file.old === null ? null : hash(file.old), savedHash: hash(file.text), index: i });
      }
      await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
      const written = [];
      try {
        for (const file of prepared) {
          const current = await fs.readFile(file.target).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
          if ((current === null ? null : hash(current)) !== file.hash) throw Error(`${file.path} changed while saving`);
          await fs.mkdir(path.dirname(file.target), { recursive: true });
          const temp = `${file.target}.${randomUUID()}.tmp`;
          try { await fs.writeFile(temp, file.text, { flag: 'wx' }); await fs.rename(temp, file.target); }
          finally { await fs.rm(temp, { force: true }); }
          written.push(file);
        }
      } catch (error) {
        for (const file of written.reverse()) {
          const current = await fs.readFile(file.target);
          if (hash(current) !== hash(file.text)) continue; // Never undo another writer.
          if (file.old === null) await fs.unlink(file.target); else await fs.writeFile(file.target, file.old);
        }
        throw error;
      }
      return { backup: id, files: prepared.map(f => ({ path: f.path, hash: hash(f.text) })) };
    });
  }
}
