// Static delivery checks; browser rendering and interactions are verified separately.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const dir = dirname(fileURLToPath(import.meta.url));
const bytes = readFileSync(resolve(dir, 'build.txt'));
const html = bytes.toString('utf8');
const provenance = JSON.parse(readFileSync(resolve(dir, 'provenance.json'), 'utf8'));
const assert = (ok, why) => { if (!ok) throw new Error(why); };
assert(bytes.length === provenance.bytes, 'Bundle byte count differs from provenance');
assert(createHash('sha256').update(bytes).digest('hex') === provenance.standaloneSha256, 'Bundle SHA-256 differs from provenance');
assert(/^<!doctype html>/i.test(html), 'Bundle must be an HTML document');
assert(!/<(?:base|link)\b/i.test(html), 'Bundle must have no base or link dependencies');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
assert(scripts.length === 1, 'Expected one inline runtime script');
for (const [, attrs, code] of scripts) {
  assert(!/\b(?:src|type)\s*=/i.test(attrs), 'Runtime must be inline classic JavaScript');
  assert(!/\b(?:fetch|import)\s*\(/.test(code), 'Runtime must have no fetch or dynamic imports');
  assert(!/(?:^|[;\n])\s*import\s/.test(code), 'Runtime must have no source imports');
}
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
for (const [, , url] of markup.matchAll(/\b(src|href)\s*=\s*["']([^"']*)["']/gi)) assert(!url || url.startsWith('data:') || url.startsWith('#'), 'External markup dependency: ' + url);
for (const [, , url] of html.matchAll(/url\(\s*(["']?)([^\s)'";]+)\1\s*\)/gi)) assert(url.startsWith('data:'), 'External CSS dependency: ' + url);
assert(provenance.featured === 6 && provenance.expanded === 70, 'Expected six featured and 70 expanded cards');
console.log(JSON.stringify({ bytes: bytes.length, sha256: provenance.standaloneSha256, featured: 6, expanded: 70 }));
