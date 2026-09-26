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
//   · CREDITS.md — a directory is covered only by an ATTRIBUTION ROW: a line of
//     a Markdown table whose header has a Source column and a Rights (or
//     License/Licence) column, whose first cell names the path followed by a
//     separator (`assets/bg` does not cover `assets/bgx`), and whose Source and
//     Rights cells are not empty. A path named in prose, a heading, or another
//     column does not count.
//   · README.md §Legal and src/content/aiDisclosure.js — §Legal must quote the
//     disclosure's canonical summary sentence (AI_SUMMARY below, the one
//     exact-match string) verbatim, and the disclosure itself must still say
//     it; §Legal must link the full disclosure (src/content/aiDisclosure.js)
//     and CREDITS.md with Markdown links, not bare names; and the set of AI
//     vendors each names must be the same set
//   · every AI vendor CREDITS names must also be named by the disclosure
//
// WHAT IT DOES NOT PROVE. A row exists; not that the row is true, complete, or
// names the right licence. Vendors agree; not that the disclosure describes
// the extent of each vendor's work correctly — that wording is the owner's to
// approve (`approved` in src/content/aiDisclosure.js). Prose around the quoted
// sentence in §Legal is not interpreted: agreement is the exact sentence plus
// the vendor sets, never a reading of what else §Legal claims. A filled cell
// that says a fact is NOT recorded (e.g. "Provenance not recorded") passes: the
// row exists and states the gap; closing the gap is the owner's call.
//
// Scope limit. Coverage is checked one level under assets/ and music/ only; a
// row naming any subpath (`assets/animations/reaver/…`) covers the whole
// directory, so a new sibling subdirectory under a covered directory is not
// checked.
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

// The AI disclosure's canonical summary sentence: the first sentence of its
// store lead in src/content/aiDisclosure.js. This is the one home of the string
// the check matches. README §Legal must quote it verbatim and the disclosure
// must still contain it, so an edit on either side goes red here.
export const AI_SUMMARY = 'Ashen Spire was built by AI under human direction.';

// Where §Legal must link for the full disclosure.
export const DISCLOSURE_PATH = 'src/content/aiDisclosure.js';

export const vendorsIn = (text) => VENDORS.filter((v) => v.re.test(text)).map((v) => v.id);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Is `dir` (e.g. `assets/bg`) written in `text` as a path, not a prefix? */
export function mentions(text, dir) {
  return new RegExp(`(^|[^\\w/-])${escapeRe(dir)}(?=$|[^\\w-])`, 'm').test(text);
}

const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isTableLine = (line) => /^\s*\|/.test(line);
const isSeparator = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

/**
 * Every attribution row in `credits`: a body line of a Markdown table whose
 * header has a Source column and a Rights/License/Licence column. Returns
 * { asset, source, rights } per row; `asset` is the row's first cell.
 */
export function attributionRows(credits) {
  const lines = credits.split('\n');
  const rows = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!isTableLine(lines[i]) || !isSeparator(lines[i + 1])) continue;
    const head = cellsOf(lines[i]).map((c) => c.toLowerCase());
    const src = head.indexOf('source');
    const rights = head.findIndex((c) => /^(rights|licen[cs]e)$/.test(c));
    let j = i + 2;
    for (; j < lines.length && isTableLine(lines[j]); j++) {
      if (src < 1 || rights < 1) continue;
      const cells = cellsOf(lines[j]);
      rows.push({ asset: cells[0] ?? '', source: cells[src] ?? '', rights: cells[rights] ?? '' });
    }
    i = j - 1;
  }
  return rows;
}

const filled = (cell) => /[\p{L}\p{N}]/u.test(cell);

/** Does `credits` hold an attribution row for `dir` with Source and Rights filled? */
export function hasRow(credits, dir) {
  return attributionRows(credits).some((r) => mentions(r.asset, dir) && filled(r.source) && filled(r.rights));
}

/** Does `text` hold a Markdown link whose destination is `path` (optional ./ and #anchor)? */
export function linksTo(text, path) {
  return new RegExp(`\\]\\(\\.?\\/?${escapeRe(path)}(?:#[^)]*)?\\)`).test(text);
}

// Markdown renders any run of whitespace as one space, so a hard-wrapped quote
// is still verbatim.
const oneLine = (text) => text.replace(/\s+/g, ' ');

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
    if (!hasRow(credits, d)) fails.push({ rule: 'row', why: `${d}/ has no CREDITS.md attribution row (a table row whose first cell names the path, with Source and Rights filled)` });
  }
  if (!oneLine(disclosure).includes(AI_SUMMARY)) fails.push({ rule: 'disclosure-summary', why: `the AI disclosure no longer says "${AI_SUMMARY}"; change AI_SUMMARY in tools/credits-check.mjs and README §Legal together` });
  const legal = legalSection(readme);
  if (legal == null) {
    fails.push({ rule: 'legal-missing', why: 'README.md has no "## Legal" section' });
    return fails;
  }
  if (!linksTo(legal, 'CREDITS.md')) fails.push({ rule: 'legal-link', why: 'README §Legal does not link CREDITS.md' });
  if (!linksTo(legal, DISCLOSURE_PATH)) fails.push({ rule: 'legal-disclosure-link', why: `README §Legal does not link the full AI disclosure (${DISCLOSURE_PATH})` });
  if (!oneLine(legal).includes(AI_SUMMARY)) fails.push({ rule: 'legal-summary', why: `README §Legal does not quote the AI disclosure's summary sentence verbatim: "${AI_SUMMARY}"` });
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
  console.log(`  ${input.dirs.length}/${input.dirs.length} asset directories have a CREDITS.md attribution row; README §Legal quotes the AI disclosure's summary sentence and names the same vendors (${vendors})`);
  // One check per directory, plus the seven §Legal/disclosure/vendor rules.
  console.log(`credits-check: OK — ${input.dirs.length + 7} checks passed.`);
  return 0;
}

async function selftest() {
  const credits = [
    '| Assets | Source | Rights |',
    '|---|---|---|',
    '| `assets/bg/*.webp` | OpenAI imagegen | CC0 |',
    '| assets/ui: flasks | drawn here | CC0 |',
    '| `music/map/` | synthesized | CC0 |',
    '| `assets-mobile/` | downscaled twin | same as assets/ |',
    '',
  ].join('\n');
  const legal = `${AI_SUMMARY} Code by Claude, art with OpenAI; the full account is the [AI disclosure](${DISCLOSURE_PATH}). See [CREDITS.md](CREDITS.md).`;
  const clean = {
    dirs: ['assets/bg', 'assets/ui', 'music/map', 'assets-mobile'],
    credits,
    readme: `# T\n\n## Legal\n\n${legal}\n\n## Next\n`,
    disclosure: `${AI_SUMMARY} Built by Anthropic’s Claude. Figures by OpenAI’s ChatGPT Codex.`,
  };
  const withLegal = (text) => ({ ...clean, readme: `# T\n\n## Legal\n\n${text}\n\n## Next\n` });
  const real = await treeInputs();
  const realLegal = legalSection(real.readme) ?? '';
  const onRealLegal = (edit) => ({ ...real, readme: real.readme.replace(realLegal, edit(realLegal)) });

  // Known-goods: each must stay green.
  const goods = [
    { name: 'clean fixture', input: clean },
    { name: 'extra prose around the sentence ("not hand-made")', input: withLegal(`The art is not hand-made. ${legal} No AI runs while you play; nothing here is human-made.`) },
    { name: 'sentence hard-wrapped across lines', input: withLegal(legal.replace('built by AI', 'built\nby AI')) },
    { name: 'row in a License-headed table with extra columns', input: { ...clean, credits: `| Asset | Used for | Source | Author | License |\n|---|---|---|---|---|\n| \`assets/bg/x.webp\` | backdrops | Blender | us | CC0 |\n\n${credits}` } },
  ];
  // Known-bads: each must turn its own rule red.
  const plants = [
    { name: 'dir-without-row', rule: 'row', input: { ...clean, dirs: [...clean.dirs, 'assets/map'] } },
    { name: 'prefix-is-not-a-row', rule: 'row', input: { ...clean, dirs: [...clean.dirs, 'assets/b'] } },
    { name: 'longer-name-is-not-a-row', rule: 'row', input: { ...clean, dirs: ['assets/bg'], credits: credits.replace('`assets/bg/*.webp`', '`assets/bg-extra/`') } },
    { name: 'prose-mention-is-not-a-row', rule: 'row', input: { ...clean, dirs: [...clean.dirs, 'assets/classes'], credits: `${credits}This closes the gap \`assets/classes/SUCCESSOR-CONTRACT.md\` carried.\n` } },
    { name: 'path-in-source-cell-is-not-a-row', rule: 'row', input: { ...clean, dirs: [...clean.dirs, 'assets/map'], credits: `${credits.trimEnd()}\n| Parchment plates | made by assets/map/build | CC0 |\n` } },
    { name: 'row-in-table-without-rights-column', rule: 'row', input: { ...clean, dirs: [...clean.dirs, 'assets/map'], credits: `${credits}\n| Assets | Source |\n|---|---|\n| \`assets/map/\` | tools/parchment.mjs |\n` } },
    { name: 'row-with-empty-rights', rule: 'row', input: { ...clean, credits: credits.replace('| drawn here | CC0 |', '| drawn here |  |') } },
    { name: 'row-with-empty-source', rule: 'row', input: { ...clean, credits: credits.replace('| drawn here | CC0 |', '| — | CC0 |') } },
    { name: 'no-legal-section', rule: 'legal-missing', input: { ...clean, readme: '# T\n\n## Licence\n\nMIT\n' } },
    { name: 'legal-without-credits-link', rule: 'legal-link', input: withLegal(legal.replace('[CREDITS.md](CREDITS.md)', 'the credits')) },
    { name: 'legal-names-credits-without-link', rule: 'legal-link', input: withLegal(legal.replace('[CREDITS.md](CREDITS.md)', 'CREDITS.md')) },
    { name: 'legal-without-disclosure-link', rule: 'legal-disclosure-link', input: withLegal(legal.replace(`[AI disclosure](${DISCLOSURE_PATH})`, 'AI disclosure')) },
    { name: 'legal-omits-summary-sentence', rule: 'legal-summary', input: withLegal(legal.replace(AI_SUMMARY, '')) },
    { name: 'legal-edits-summary-sentence', rule: 'legal-summary', input: withLegal(legal.replace(AI_SUMMARY, AI_SUMMARY.replace('built by AI', 'built with AI'))) },
    { name: 'disclosure-drops-summary-sentence', rule: 'disclosure-summary', input: { ...clean, disclosure: clean.disclosure.replace(AI_SUMMARY, 'Ashen Spire was made by hand.') } },
    { name: 'legal-omits-disclosed-vendor', rule: 'legal-vendor-missing', input: withLegal(legal.replace('Code by Claude, ', '')) },
    { name: 'legal-names-undisclosed-vendor', rule: 'legal-vendor-extra', input: withLegal(legal.replace('OpenAI', 'OpenAI and Midjourney')) },
    { name: 'credits-names-undisclosed-vendor', rule: 'credits-vendor', input: { ...clean, credits: `${credits}Music by Suno.\n` } },
    // The same plants against the real tree's text: the rules bite on what ships.
    { name: 'real-credits-loses-a-row', rule: 'row', input: { ...real, dirs: [...real.dirs, 'assets/zz-planted'] } },
    { name: 'real-legal-drops-a-vendor', rule: 'legal-vendor-missing', input: onRealLegal((l) => l.replace(/OpenAI|ChatGPT|Codex/g, 'an image model')) },
    { name: 'real-legal-edits-summary-sentence', rule: 'legal-summary', input: onRealLegal((l) => l.replace(AI_SUMMARY, 'Ashen Spire was built with AI under human direction.')) },
    { name: 'real-legal-loses-disclosure-link', rule: 'legal-disclosure-link', input: onRealLegal((l) => l.replace(new RegExp(`\\]\\(${escapeRe(DISCLOSURE_PATH)}\\)`, 'g'), '](docs/)')) },
  ];
  let bad = 0;
  for (const g of goods) {
    const rules = audit(g.input).map((f) => f.rule);
    if (rules.length) {
      bad++;
      console.log(`FAIL  known-good ${g.name} is red: ${rules.join(', ')}`);
    } else console.log(`PASS  known-good ${g.name} stays green`);
  }
  for (const p of plants) {
    const rules = audit(p.input).map((f) => f.rule);
    if (rules.includes(p.rule)) console.log(`PASS  ${p.name}: red on [${p.rule}]`);
    else {
      bad++;
      console.log(`FAIL  ${p.name}: expected red on [${p.rule}], got [${rules.join(', ') || 'green'}]`);
    }
  }
  const total = goods.length + plants.length;
  if (bad) {
    console.log(`credits-check-selftest: ${bad} of ${total} checks failed`);
    return 1;
  }
  console.log(`  ${goods.length} known-goods + ${plants.length} plants`);
  console.log(`credits-check-selftest: OK — ${total} checks passed.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = process.argv.includes('--selftest') ? await selftest() : await main();
  process.exit(code);
}
