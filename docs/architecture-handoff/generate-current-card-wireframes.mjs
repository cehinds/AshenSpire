// Current WC1 documentation is derived from the same authored card manifest as the game.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = new URL('.', import.meta.url);
const config = JSON.parse(readFileSync(new URL('../../content/config/ui/components/card.json', here), 'utf8'));
const { sizing, behavior } = config;
const fields = behavior.fields;
const levels = ['glance', 'focus', 'inspect'];
const title = { glance: 'At rest', focus: 'Selected', inspect: 'Reading door' };
const labels = { art: 'GLYPH / ART', facts: '◆ 1   ϟ 2   ♦ 3', type: 'TYPE BAND', tags: 'TAG CHIPS', effects: 'RULES / EFFECTS', footer: 'RARITY                  OWNED', flavor: 'FLAVOR IN READING PANE' };
const ratio = `${sizing.ratio.numerator}:${sizing.ratio.denominator}`;
const heightFor = width => Number((width * sizing.ratio.denominator / sizing.ratio.numerator).toFixed(1));
const sum = values => values.reduce((a, b) => a + b, 0);

function visible(level, surface = 'none') {
  const result = new Set(fields.levels[level]);
  const patch = fields.surfaces[surface]?.[level] || {};
  for (const key of patch.add || []) result.add(key);
  for (const key of patch.drop || []) result.delete(key);
  return result;
}

function bands(level, surface = 'none') {
  const show = visible(level, surface);
  return sizing.bands.filter((_, index) => [true, show.has('art'), show.has('type') || show.has('effects'), show.has('footer')][index]);
}

function ascii(level) {
  const show = visible(level);
  const rows = ['┌──────────────────────────────┐', '│          CARD NAME           │', '├──────────────────────────────┤'];
  if (show.has('art')) {
    rows.push('│ ◆ 1   [ GLYPH / ART ]       │');
    rows.push('│ ϟ 2   (extra costs if used)  │');
    if (show.has('tags')) rows.push('│ [tags at art well bottom]    │');
    rows.push('├──────────────────────────────┤');
  }
  if (show.has('type')) rows.push('│         TYPE BAND            │');
  if (show.has('effects')) rows.push('│       RULES / EFFECTS        │');
  if (show.has('type') || show.has('effects')) rows.push('├──────────────────────────────┤');
  if (show.has('footer')) rows.push('│ Rarity             Owned: n  │', '└──────────────────────────────┘');
  else rows[rows.length - 1] = '└──────────────────────────────┘';
  return rows.join('\n');
}

export function currentCardWireframesMarkdown() {
  const variants = Object.entries(sizing.levels.glance.variants || {}).map(([name, width]) => `${name} ${width}×${heightFor(width)}px`).join(', ');
  let out = `## Current playing card (WC1) — implemented\n\n`;
  out += `These are the cards the game draws now, based on [the authored card manifest](../../content/config/ui/components/card.json), [the renderer](../../src/ui/components/card.js), and [the WC1 styles](../../styles/kit.css). The face is **${ratio}**. The authored track weights are **${sizing.bands.join(':')}** for name, art, body, and metadata; a withheld region removes its track and the remaining weights renormalize. The name never disappears.\n\n`;
  out += `The left-edge cost rail starts below the name and stays readable in a fanned hand. It always shows action cost, including zero, and adds stamina or mana only when nonzero. The art well currently uses the card's glyph; tags, when shown, sit at its bottom. The body contains the type band when allowed and rule text. The footer holds metadata, not the Play command. Flavor is read in the inspection pane outside the face. The information control belongs to selection/inspection, outside the face.\n\n`;
  for (const level of levels) {
    const show = visible(level);
    const width = sizing.levels[level].widthPx;
    const tracks = bands(level);
    out += `### ${level[0].toUpperCase() + level.slice(1)} — ${title[level]}\n\n`;
    out += `Nominal box **${width}×${heightFor(width)}px**${level === 'glance' ? ` (${variants})` : ''}; all sizes preserve ${ratio}. Visible regions: ${[...show].map(key => `\`${key}\``).join(', ')}. In-flow tracks: **${tracks.join(':')}**.\n\n`;
    out += `\`\`\`text\n${ascii(level)}\n\`\`\`\n\n`;
  }
  out += `### Surface adjustments\n\n| Surface | Level | Change to the face | In-flow tracks |\n|---|---|---|---|\n`;
  for (const [surface, patches] of Object.entries(fields.surfaces)) {
    for (const [level, patch] of Object.entries(patches)) {
      const change = [...(patch.add || []).map(key => `add ${key}`), ...(patch.drop || []).map(key => `drop ${key}`)].join('; ');
      out += `| ${surface} | ${level} | ${change} | ${bands(level, surface).join(':')} |\n`;
    }
  }
  out += `\n[Visual anatomy of all three current levels](../mockups/card-anatomy.svg). Art proposals should keep this shell and change only the content of the art well.\n\n`;
  return out;
}

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function svgText(x, y, value, size = 13, color = '#e9dcc4', anchor = 'start') {
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${escape(value)}</text>`;
}
function cardSvg(level, x) {
  const show = visible(level);
  const faceY = 130, faceW = 230, faceH = 322;
  const active = bands(level);
  const total = sum(active);
  const heights = active.map(weight => faceH * weight / total);
  let y = faceY;
  let out = `<g transform="translate(${x} 0)">`;
  out += svgText(faceW / 2, 69, level.toUpperCase(), 19, '#d6ad62', 'middle');
  out += svgText(faceW / 2, 91, `${sizing.levels[level].widthPx}px nominal · ${ratio}`, 12, '#aa9a7f', 'middle');
  out += `<rect x="0" y="${faceY}" width="${faceW}" height="${faceH}" rx="10" fill="#271e17" stroke="#b99959" stroke-width="2"/>`;
  const band = (height, fill, content) => {
    out += `<rect x="1" y="${y.toFixed(2)}" width="${faceW - 2}" height="${height.toFixed(2)}" fill="${fill}" stroke="#5c4933" stroke-width=".6"/>`;
    out += content(y, height);
    y += height;
  };
  band(heights[0], '#30251b', (top, h) => svgText(faceW / 2, top + h / 2 + 5, 'CARD NAME', 15, '#f1e5cd', 'middle'));
  let index = 1;
  if (show.has('art')) {
    band(heights[index++], '#130f0d', (top, h) => {
      let bits = svgText(faceW / 2 + 9, top + h / 2 + 5, labels.art, 14, '#c7b18c', 'middle');
      bits += svgText(10, top + 22, '◆ 1', 16, '#d9b564');
      bits += svgText(10, top + 43, 'ϟ / ♦', 11, '#9bb6a8');
      if (show.has('tags')) bits += `<rect x="13" y="${top + h - 29}" width="90" height="20" rx="4" fill="#3a3425" stroke="#8f7850"/>` + svgText(58, top + h - 15, 'TAG CHIPS', 10, '#d6bd88', 'middle');
      return bits;
    });
  }
  if (show.has('type') || show.has('effects')) {
    band(heights[index++], '#2b211a', (top, h) => {
      let bits = '';
      if (show.has('type')) {
        bits += `<rect x="12" y="${top + 12}" width="206" height="28" rx="4" fill="#423223"/>`;
        bits += svgText(faceW / 2, top + 31, labels.type, 12, '#d4ad6a', 'middle');
      }
      bits += svgText(faceW / 2, top + (show.has('type') ? 68 : 33), labels.effects, 13, '#e9dcc4', 'middle');
      bits += svgText(faceW / 2, top + (show.has('type') ? 89 : 54), 'Live rules, fitted to space', 11, '#a99983', 'middle');
      return bits;
    });
  }
  if (show.has('footer')) band(heights[index], '#30251b', (top, h) => svgText(faceW / 2, top + h / 2 + 4, labels.footer, 10, '#baa582', 'middle'));
  out += svgText(faceW / 2, 486, `${active.join(':')} active tracks`, 12, '#aa9a7f', 'middle');
  out += '</g>';
  return out;
}

export function currentCardWireframesSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 580" role="img" aria-labelledby="title desc" font-family="Arial,sans-serif">\n<title id="title">Current AshenSpire playing card wireframes</title>\n<desc id="desc">The current 5 to 7 playing card at glance, focus, and inspect levels. The name and left-edge cost rail are always visible. Type and footer appear at focus; tags appear at inspect. Absent bands return their space to the card.</desc>\n<rect width="840" height="580" fill="#17120f"/>\n${svgText(420, 34, 'CURRENT PLAYING CARD · THREE DETAIL LEVELS', 19, '#ead4a6', 'middle')}\n${levels.map((level, i) => cardSvg(level, 25 + i * 280)).join('\n')}\n${svgText(420, 528, 'Cost rail: action always, stamina/mana when used. Flavor and full reading live outside the face.', 13, '#c8b99c', 'middle')}\n${svgText(420, 550, 'Art well currently holds a glyph. This is the shell for the proposed visual artwork.', 12, '#a99983', 'middle')}\n</svg>\n`;
}

export function writeCurrentCardWireframes() {
  writeFileSync(new URL('./current-card-wireframes.md', here), `# Current playing-card wireframes\n\n${currentCardWireframesMarkdown().trimEnd()}\n`);
  writeFileSync(new URL('../mockups/card-anatomy.svg', here), currentCardWireframesSvg());
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) writeCurrentCardWireframes();
