#!/usr/bin/env node
// tools/credits-check.mjs — does every asset directory have a CREDITS row, and
// does README §Legal tell the same story as the AI disclosure? (FINISH §10)
//
//   node tools/credits-check.mjs             check the tree; exit 1 on any red
//   node tools/credits-check.mjs --selftest  prove each rule can still go red
//
// WHAT IT READS, AND NOTHING ELSE:
//   · the asset directories — every child directory of assets/ and music/,
//     plus the assets-mobile/ twin tree as one unit (it mirrors assets/ and is
//     produced by tools/mobile-art.mjs, so one row covers it)
//   · CREDITS.md — a directory is covered when its path is written there,
//     followed by a separator (`assets/bg` does not cover `assets/bgx`)
//   · README.md §Legal and src/content/aiDisclosure.js — the set of AI vendors
//     each names must be the same set, §Legal must link CREDITS.md, and §Legal
//     must not deny AI involvement
//   · every AI vendor CREDITS names must also be named by the disclosure
//
// WHAT IT DOES NOT PROVE. A row exists; not that the row is true, complete, or
// names the right licence. Vendors agree; not that the disclosure describes
// the extent of each vendor's work correctly — that wording is the owner's to
// approve (`approved` in src/content/aiDisclosure.js).
//
// The --selftest is in memory: it plants each known-bad into fixture text (and
// into the real tree's text) and requires the matching red. It writes nothing.
//
// Zero dependencies, Node core only.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The closed list of AI vendors this project could name. A vendor matched by
// none of these patterns is invisible to the agreement rule — add it here.
export const VENDORS = Object.freeze([
  { id: 'Anthropic', re: /\bAnthropic\b|\bClaude\b/ },
  { id: 'OpenAI', re: /\bOpenAI\b|\bChatGPT\b|\bCodex\b|\bDALL[·-]?E\b/ },
  { id: 'ElevenLabs', re: /\bElevenLabs\b|\beleven_music/ },
  { id: 'Midjourney', re: /\bMidjourney\b/ },
  { id: 'Stability AI', re: /\bStability AI\b|\bStable Diffusion\b/ },
  { id: 'Google', re: /\bGemini\b|\bImagen\b/ },
  { id: 'Suno', re: /\bSuno\b/ },
  { id: 'Udio', re: /\bUdio\b/ },
]);

// A §Legal sentence that denies AI involvement contradicts the disclosure.
const DENIAL = /\bno AI\b|\bnot AI[- ]generated\b|\bwithout AI\b|\bhand[- ](made|drawn|authored)\b|\bhuman[- ]made\b/i;

export const vendorsIn = (text) => VENDORS.filter((v) => v.re.test(text)).map((v) => v.id);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Is `dir` (e.g. `assets/bg`) written in `credits` as a path, not a prefix? */
export function mentions(credits, dir) {
  return new RegExp(`(^|[^\\w/-])${escapeRe(dir)}(?=$|[^\\w-])`, 'm').test(credits);
}

/** README's `## Legal` section, up to the next `## ` heading; null if absent. */
export function legalSection(readme) {
  const m = /^## Legal[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(readme);
  return m ? m[1] : null;
}

/**
 * The whole verdict as data. `dirs` are repo-relative directory paths; the
 * three texts are file contents. Returns a list of { rule, why } failures.
 */
export function audit({ dirs, credits, readme, disclosure }) {
  const fails = [];
  for (const d of dirs) {
    if (!mentions(credits, d)) fails.push({ rule: 'row', why: `${d}/ has no CREDITS.md row (name the path in CREDITS.md with its source and rights)` });
  }
  const legal = legalSection(readme);
  if (legal == null) {
    fails.push({ rule: 'legal-missing', why: 'README.md has no "## Legal" section' });
    return fails;
  }
  if (!/CREDITS\.md/.test(legal)) fails.push({ rule: 'legal-link', why: 'README §Legal does not link CREDITS.md' });
  const denial = DENIAL.exec(legal);
  if (denial) fails.push({ rule: 'legal-denial', why: `README §Legal says "${denial[0]}", which the AI disclosure contradicts` });
  const said = new Set(vendorsIn(legal));
  const disclosed = new Set(vendorsIn(disclosure));
  for (const v of disclosed) if (!said.has(v)) fails.push({ rule: 'legal-vendor-missing', why: `the AI disclosure names ${v} and README §Legal does not` });
  for (const v of said) if (!disclosed.has(v)) fails.push({ rule: 'legal-vendor-extra', why: `README §Legal names ${v} and the AI disclosure does not` });
  for (const v of vendorsIn(credits)) if (!disclosed.has(v)) fails.push({ rule: 'credits-vendor', why: `CREDITS.md names ${v} and the AI disclosure does not` });
  return fails;
}

/** The real tree's inputs. */
export async function treeInputs(root = ROOT) {
  const dirs = [];
  for (const top of ['assets', 'music']) {
    const abs = resolve(root, top);
    if (!existsSync(abs)) continue;
    for (const e of readdirSync(abs, { withFileTypes: true })) if (e.isDirectory()) dirs.push(`${top}/${e.name}`);
  }
  if (existsSync(resolve(root, 'assets-mobile'))) dirs.push('assets-mobile');
  dirs.sort();
  const { disclosureAsText } = await import('../src/content/aiDisclosure.js');
  return {
    dirs,
    credits: readFileSync(resolve(root, 'CREDITS.md'), 'utf8'),
    readme: readFileSync(resolve(root, 'README.md'), 'utf8'),
    disclosure: disclosureAsText(),
  };
}

async function main() {
  const input = await treeInputs();
  const fails = audit(input);
  const vendors = vendorsIn(input.disclosure).join(', ') || 'none';
  if (fails.length) {
    for (const f of fails) console.log(`FAIL  credits-check [${f.rule}]: ${f.why}`);
    console.log(`credits-check: ${fails.length} failure(s) over ${input.dirs.length} asset directories`);
    return 1;
  }
  console.log(`  ${input.dirs.length}/${input.dirs.length} asset directories have a CREDITS.md row; README §Legal and the AI disclosure name the same vendors (${vendors})`);
  // One check per directory, plus the five §Legal/vendor rules.
  console.log(`credits-check: OK — ${input.dirs.length + 5} checks passed.`);
  return 0;
}

async function selftest() {
  const clean = {
    dirs: ['assets/bg', 'assets/ui', 'music/map', 'assets-mobile'],
    credits: '| `assets/bg/*.webp` | x |\n| assets/ui: flasks | x |\nTracks in `music/map/`. The `assets-mobile/` twin. OpenAI imagegen.\n',
    readme: '# T\n\n## Legal\n\nArt made with OpenAI and code by Claude; see [CREDITS.md](CREDITS.md).\n\n## Next\n',
    disclosure: 'Built by Anthropic’s Claude. Figures by OpenAI’s ChatGPT Codex.',
  };
  const real = await treeInputs();
  const realLegal = legalSection(real.readme) ?? '';
  const plants = [
    { name: 'dir-without-row', rule: 'row', input: { ...clean, dirs: [...clean.dirs, 'assets/map'] } },
    { name: 'prefix-is-not-a-row', rule: 'row', input: { ...clean, dirs: [...clean.dirs, 'assets/b'] } },
    { name: 'longer-name-is-not-a-row', rule: 'row', input: { ...clean, dirs: ['assets/bg'], credits: 'assets/bg-extra/ only' } },
    { name: 'no-legal-section', rule: 'legal-missing', input: { ...clean, readme: '# T\n\n## Licence\n\nMIT\n' } },
    { name: 'legal-without-credits-link', rule: 'legal-link', input: { ...clean, readme: clean.readme.replace('[CREDITS.md](CREDITS.md)', 'the credits') } },
    { name: 'legal-denies-ai', rule: 'legal-denial', input: { ...clean, readme: clean.readme.replace('Art made', 'No AI was used. Art made') } },
    { name: 'legal-omits-disclosed-vendor', rule: 'legal-vendor-missing', input: { ...clean, readme: clean.readme.replace(' and code by Claude', '') } },
    { name: 'legal-names-undisclosed-vendor', rule: 'legal-vendor-extra', input: { ...clean, readme: clean.readme.replace('OpenAI', 'OpenAI and Midjourney') } },
    { name: 'credits-names-undisclosed-vendor', rule: 'credits-vendor', input: { ...clean, credits: `${clean.credits}Music by Suno.\n` } },
    // The same plants against the real tree's text: the rules bite on what ships.
    { name: 'real-credits-loses-a-row', rule: 'row', input: { ...real, dirs: [...real.dirs, 'assets/zz-planted'] } },
    { name: 'real-legal-drops-a-vendor', rule: 'legal-vendor-missing', input: { ...real, readme: real.readme.replace(realLegal, realLegal.replace(/ElevenLabs( Music)?/g, 'a music model')) } },
    { name: 'real-legal-denies-ai', rule: 'legal-denial', input: { ...real, readme: real.readme.replace(realLegal, `${realLegal}\nAll art is hand-made.\n`) } },
  ];
  let bad = 0;
  const cleanFails = audit(clean);
  if (cleanFails.length) {
    bad++;
    console.log(`FAIL  clean fixture is red: ${cleanFails.map((f) => f.rule).join(', ')}`);
  } else console.log('PASS  clean fixture is green');
  for (const p of plants) {
    const rules = audit(p.input).map((f) => f.rule);
    if (rules.includes(p.rule)) console.log(`PASS  ${p.name}: red on [${p.rule}]`);
    else {
      bad++;
      console.log(`FAIL  ${p.name}: expected red on [${p.rule}], got [${rules.join(', ') || 'green'}]`);
    }
  }
  if (bad) {
    console.log(`credits-check-selftest: ${bad} of ${plants.length + 1} checks failed`);
    return 1;
  }
  console.log(`  clean edge + ${plants.length} plants`);
  console.log(`credits-check-selftest: OK — ${plants.length + 1} checks passed.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = process.argv.includes('--selftest') ? await selftest() : await main();
  process.exit(code);
}
