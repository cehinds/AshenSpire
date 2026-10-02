// Render SVG artwork for visual review; no browser, UI automation or network required.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.ASHENSPIRE_SHARP_MODULE || 'sharp');
const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
async function sheet(kind, cols, cellW, cellH) {
  const assets = manifest.assets.filter(a => a.kind === kind);
  const w = cols * cellW, h = Math.ceil(assets.length / cols) * cellH + 65;
  const layers = [];
  const labels = [];
  labels.push(`<text x="24" y="35" fill="#c9a227" font-family="Georgia" font-size="22">Ashen Spire · ${assets.length} ${kind}</text>`);
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const x = (i % cols) * cellW, y = Math.floor(i / cols) * cellH + 65;
    labels.push(`<rect x="${x + 5}" y="${y + 5}" width="${cellW - 10}" height="${cellH - 10}" fill="#171310" stroke="#4a4034"/>`);
    labels.push(`<text x="${x + 12}" y="${y + cellH - 18}" fill="#e8dcc0" font-family="sans-serif" font-size="12">${escape(a.id)}</text>`);
    const previewW = kind === 'icons' ? 48 : Math.min(cellW - 30, a.width);
    const previewH = kind === 'icons' ? 48 : Math.min(cellH - 50, a.height);
    const png = await sharp(path.join(root, a.file)).resize({ width: previewW, height: previewH, fit: 'inside' }).png().toBuffer();
    const size = await sharp(png).metadata();
    layers.push({ input: png, left: Math.round(x + (cellW - size.width) / 2), top: Math.round(y + (cellH - 35 - size.height) / 2) });
    if (kind === 'icons') {
      const native = await sharp(path.join(root, a.file)).resize(24, 24).png().toBuffer();
      layers.push({ input: native, left: x + 18, top: y + 18 });
    }
  }
  const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#0d0b08"/>${labels.join('')}</svg>`);
  await sharp(base).composite(layers).png().toFile(path.join(root, `${kind}-contact-sheet.png`));
}
Promise.all([sheet('icons', 8, 174, 125), sheet('components', 4, 348, 190)])
  .then(() => console.log('Rendered both asset contact sheets.'))
  .catch(error => { console.error(error); process.exitCode = 1; });
