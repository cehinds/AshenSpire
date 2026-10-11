// workbench/core/settings.mjs — Workbench settings kept on the server.
//
// Stored in workbench/.state/settings.json (gitignored), so every window and
// browser sees the same values. Paths to the external checkouts default from
// ASHEN_ART_CHECKOUT and ASHEN_EDITOR_CHECKOUT; a value saved here wins.
import fs from 'node:fs';
import path from 'node:path';

export const EDITOR_URL_DEFAULT = 'http://127.0.0.1:5173';
// The Workbench page may frame loopback origins only (its CSP frame-src).
const LOOPBACK_URL = /^http:\/\/(127\.0\.0\.1|localhost):\d{1,5}(\/[\w\-./?=&%#]*)?$/;

export function defaults(env = process.env) {
  return { artCheckout: env.ASHEN_ART_CHECKOUT || '', editorCheckout: env.ASHEN_EDITOR_CHECKOUT || '', editorUrl: EDITOR_URL_DEFAULT };
}

/** Problems with a proposed settings object; [] when it may be saved. */
export function settingsProblems(s) {
  const problems = [];
  if (!s || typeof s !== 'object') return ['Settings must be an object'];
  for (const key of ['artCheckout', 'editorCheckout']) {
    const v = s[key];
    if (v === '' || v === undefined) continue;
    if (typeof v !== 'string' || !path.isAbsolute(v)) { problems.push(`${key}: use an absolute folder path`); continue; }
    try { if (!fs.statSync(v).isDirectory()) problems.push(`${key}: not a folder`); } catch { problems.push(`${key}: folder not found (${v})`); }
  }
  if (s.editorUrl !== undefined && s.editorUrl !== '' && !(typeof s.editorUrl === 'string' && LOOPBACK_URL.test(s.editorUrl))) problems.push('editorUrl: use a local address such as http://127.0.0.1:5173');
  return problems;
}

export class Settings {
  constructor(file, env = process.env) { this.file = file; this.env = env; }
  read() {
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* none yet */ }
    const base = defaults(this.env);
    const out = { ...base };
    for (const k of Object.keys(base)) if (typeof saved[k] === 'string' && saved[k] !== '') out[k] = saved[k];
    return out;
  }
  save(next) {
    const merged = { ...this.read(), ...Object.fromEntries(Object.entries(next || {}).filter(([k]) => k in defaults(this.env))) };
    const problems = settingsProblems(merged);
    if (problems.length) throw Object.assign(Error(problems.join('; ')), { status: 400 });
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(merged, null, 2)}\n`);
    return merged;
  }
}

/** Where an external entry lives on disk, or null: `<checkout>/<path>`, then without the optional prefix. */
export function resolveExternal(entry, checkout) {
  if (!checkout) return null;
  const tries = [entry.path];
  if (entry.pathPrefixOptional && entry.path.startsWith(entry.pathPrefixOptional)) tries.push(entry.path.slice(entry.pathPrefixOptional.length));
  const base = path.resolve(checkout); // no trailing separator, so the boundary check below holds
  for (const rel of tries) {
    const abs = path.resolve(base, rel);
    if ((abs === base || abs.startsWith(base + path.sep)) && fs.existsSync(abs)) return rel;
  }
  return null;
}
