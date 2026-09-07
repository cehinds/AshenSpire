import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const {outfits} = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
const library = JSON.parse(readFileSync(join(here, 'library.json'), 'utf8'));
const classes = ['reaver', 'rogue', 'starseer', 'herald'];
const title = s => s[0].toUpperCase() + s.slice(1);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const image = (file, label) => `<a href="${esc(file)}" target="_blank" rel="noopener"><img src="${esc(file)}" alt="${esc(label)}" loading="lazy"></a>`;
const figure = (file, label) => `<figure>${image(file, label)}<figcaption>${esc(label)}</figcaption></figure>`;
const labels = {idle:'Combat idle', guard:'Guard', attack1:'Anticipation', attack2:'Extension', attack3:'Contact', attack4:'Recovery', hit:'Hit reaction'};

for (const cls of classes) {
  const rows = outfits.filter(o => o.id.split('-')[0] === cls);
  const sources = library.filter(s => s.classId === cls);
  const poseLabels = cls === 'reaver' ? {...labels, idle:'Idle · Sword rest', attack1:'Attack 1 · Low advance', attack2:'Attack 2 · Overhead windup', attack3:'Attack 3 · Downward cleave'} : labels;
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title(cls)} · Complete painted collection · AshenSpire</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#12110f;color:#e4dac6}*{box-sizing:border-box}body{max-width:1440px;margin:auto;padding:28px}a{color:#dfc27c}a:focus-visible{outline:2px solid #efd178;outline-offset:4px}h1{font:2.5rem Georgia,serif;color:#e9d5a1;margin:24px 0 10px}h2{font:1.8rem Georgia,serif;margin:0 0 20px}h3{font-size:1rem;color:#cdb574;margin:24px 0 12px}p{color:#b8ae9c;line-height:1.6}.class-nav,.outfit-nav{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.class-nav a,.outfit-nav a{padding:10px 16px;border:1px solid #66583e;border-radius:6px;text-decoration:none}.class-nav [aria-current=page]{background:#554527;color:#fff0c6}.outfit{margin:28px 0;padding:24px;background:#1c1914;border:1px solid #494131;border-radius:10px;scroll-margin-top:20px}figure{margin:0;background:#15130f;border:1px solid #383022;border-radius:6px;overflow:hidden}figure a{display:block}figure img{display:block;width:100%;object-fit:contain}figcaption{padding:10px;text-align:center;color:#cdb574;font-size:.9rem}.presentation{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.presentation img{height:360px}.combat{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.combat img{aspect-ratio:1}.sources{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.sources img{height:auto}.source-section{border-top:1px solid #66583e;padding-top:28px;margin-top:40px}footer{padding:28px 0;color:#b8ae9c}.hint{font-size:.9rem}@media(max-width:700px){body{padding:14px}h1{font-size:2rem}.outfit{padding:14px}.presentation{grid-template-columns:repeat(2,minmax(0,1fr))}.presentation figure:first-child{grid-column:1/-1}.presentation img{height:260px}.combat{grid-template-columns:repeat(2,minmax(0,1fr))}.sources{grid-template-columns:1fr}}@media print{body{background:white;color:black}.class-nav,footer{display:none}.outfit{break-inside:avoid}a{color:inherit}}
</style></head>
<body>
<nav class="class-nav" aria-label="Character classes">${classes.map(c => `<a href="${c}.html"${c === cls ? ' aria-current="page"' : ''}>${title(c)}</a>`).join('')}</nav>
<header><h1>${title(cls)} — complete collection</h1><p>All four outfits on one page. Each includes menu and detail poses, a close-up portrait, and the compact combat set. Earlier pose sheets are preserved below.</p><p class="hint">Art preview · not installed in the game. Select any image to inspect it at full size.</p></header>
<nav class="outfit-nav" aria-label="Outfits on this page">${rows.map(o => `<a href="#${esc(o.id)}">${esc(o.name)}</a>`).join('')}<a href="#sources">Earlier pose sheets</a></nav>
<main>${rows.map(o => `<section class="outfit" id="${esc(o.id)}"><h2>${esc(o.name)}</h2><h3>Character menu &amp; details</h3><div class="presentation">${figure(o.menu.portrait, 'Close-up portrait')}${figure(o.menu.stand, 'Menu pose')}${figure(o.menu.detail, 'Detail pose')}</div><h3>${cls === 'reaver' ? 'Combat poses · right-facing attacks' : 'Right-facing combat poses'}</h3><div class="combat">${o.frames.map(f => figure(f.file, poseLabels[f.pose] || f.pose)).join('')}</div></section>`).join('\n')}
<section class="source-section" id="sources"><h2>Earlier poses &amp; source sheets</h2><p>All ${sources.length} ${title(cls)} source sheets are collected here, including the approved poses outside the small combat set.</p><div class="sources">${sources.map(s => figure(s.file, s.title)).join('')}</div></section></main>
<footer><a href="index.html">Animation player and comparison tools</a></footer>
</body></html>\n`;
  writeFileSync(join(here, cls + '.html'), html);
  console.log(`${cls}.html: ${rows.length} outfits, ${sources.length} source sheets`);
}
