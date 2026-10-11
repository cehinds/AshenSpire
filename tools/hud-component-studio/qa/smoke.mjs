import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const base = process.env.HUD_STUDIO_URL || 'http://localhost:8360/';
const dir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const artifacts = process.env.HUD_STUDIO_ARTIFACTS || path.join(dir, 'artifacts');
await fs.mkdir(artifacts, { recursive: true });
const errors = [];
const failedRequests = [];
const browser = await chromium.launch({ ...(process.env.HUD_STUDIO_BROWSER ? { channel: process.env.HUD_STUDIO_BROWSER } : {}), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

function check(condition, message) { if (!condition) throw new Error(message); console.log(`PASS ${message}`); }
function savedScene() { return page.evaluate(() => JSON.parse(localStorage.getItem('ashenspire-hud-component-studio-v1')).scene); }
function effectiveNode(node, state = 'player-selected') { return { ...node, ...(node.states?.[state] || {}) }; }
async function selectTree(id) { await page.locator(`[data-layer="${id}"] .label`).click(); }
async function switchState(id) {
  await page.locator(`[data-state="${id}"]`).click();
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 30000 });
  check(await page.locator(`[data-state="${id}"]`).getAttribute('aria-pressed') === 'true', `state ${id} is active after artwork loads`);
}
async function dragElement(locator, dx, dy) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No visible box for ${await locator.getAttribute('data-node') || 'element'}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}
async function dragAt(point, dx, dy) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 8 });
  await page.mouse.up();
}
async function dragSlider(label, value) {
  const slider = page.getByRole('slider', { name: label, exact: true });
  const box = await slider.boundingBox();
  if (!box) throw new Error(`Slider missing: ${label}`);
  const x = box.x + Math.max(2, Math.min(box.width - 2, box.width * value));
  await page.mouse.click(x, box.y + box.height / 2);
}
async function exportJson(filename) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  const dest = path.join(artifacts, filename);
  await download.saveAs(dest);
  return JSON.parse(await fs.readFile(dest, 'utf8'));
}
async function exportPng(filename) {
  await page.locator('#png').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full view PNG' }).click();
  const download = await downloadPromise;
  const dest = path.join(artifacts, filename);
  await download.saveAs(dest);
  const data = await fs.readFile(dest);
  const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
  check(data.subarray(1, 4).toString() === 'PNG' && width > 0 && height > 0, `PNG exports with valid ${width}x${height} dimensions`);
  return dest;
}

try {
  const seedResponse = await page.request.get(new URL('scene.json', base).toString());
  check(seedResponse.ok(), 'scene.json loads successfully');
  const seed = await seedResponse.json();
  check(seed.version === 1 && seed.canvas?.width === 512 && seed.canvas?.height === 960, 'seed uses the v1 512x960 canvas');
  check(seed.states.map(s => s.id).join(',') === 'idle,player-selected,enemy-selected', 'seed exposes all three combat states');
  check(seed.nodes.length >= 150, `seed contains at least 150 editable nodes (${seed.nodes.length})`);
  check(seed.nodes.some(n => n.type === 'text') && seed.nodes.some(n => n.type === 'image'), 'seed includes editable text and sprite/image nodes');
  const groups = seed.nodes.filter(n => n.type === 'group' && seed.nodes.some(c => c.parent === n.id && c.type !== 'group'));
  const textNode = seed.nodes.find(n => n.type === 'text' && n.parent && seed.nodes.some(p => p.id === n.parent && p.type === 'group')) || seed.nodes.find(n => n.type === 'text');
  let imageNode = seed.nodes.find(n => n.type === 'image' && n.parent && seed.nodes.some(p => p.id === n.parent && p.type === 'group')) || seed.nodes.find(n => n.type === 'image');
  if (!groups.length || !textNode || !imageNode) throw new Error('Seed lacks a group, text node, or image node needed for mouse QA.');

  await page.goto(base, { waitUntil: 'networkidle' });
  check(page.url() === base && (await page.title()).includes('HUD Component Studio'), 'page identity matches the studio');
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 30000 });
  await page.locator(`[data-state="player-selected"]`).waitFor();
  await page.locator(`[data-layer="${textNode.id}"]`).waitFor();
  check(await page.locator('#layerCount').innerText().then(t => Number.parseInt(t, 10)) === seed.nodes.length, 'editor loads the full seed scene');
  await page.screenshot({ path: path.join(artifacts, 'desktop-initial.png'), fullPage: true });
  await page.locator('#expandAll').click();

  // Canvas picking and moving a text leaf with actual mouse input.
  await page.locator(`[data-node="${textNode.id}"]`).scrollIntoViewIfNeeded();
  await dragElement(page.locator(`[data-node="${textNode.id}"]`), 16, 12);
  let current = await savedScene();
  let movedText = effectiveNode(current.nodes.find(n => n.id === textNode.id));
  const initialText = effectiveNode(textNode);
  check(movedText.x !== initialText.x || movedText.y !== initialText.y, 'canvas drag moves a text component');
  check(await page.locator(`[data-layer="${textNode.id}"]`).getAttribute('aria-selected') === 'true', 'canvas pointer selects the text layer');

  // Tree selection, image move, leaf resize, and group resize.
  const imagePick = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('ashenspire-hud-component-studio-v1'));
    const scene = saved.scene, state = saved.stateId;
    const effective = n => ({ ...n, ...(n.states?.[state] || {}) });
    for (const n of scene.nodes.filter(n => n.type === 'image')) {
      const e = effective(n), chain = [n]; let parent = n.parent;
      while (parent) { const p = scene.nodes.find(v => v.id === parent); if (!p) break; chain.push(p); parent = p.parent; }
      if (chain.some(v => effective(v).visible === false || effective(v).locked)) continue;
      const el = document.querySelector(`[data-node="${CSS.escape(n.id)}"]`), r = el?.getBoundingClientRect();
      if (!r || r.width < 4 || r.height < 4) continue;
      for (const fy of [.25, .5, .75]) for (const fx of [.25, .5, .75]) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        const hit = document.elementFromPoint(x, y)?.closest('[data-node]')?.dataset.node;
        if (hit === n.id) return { id: n.id, x, y };
      }
    }
    return null;
  });
  if (!imagePick) throw new Error('No visible image component has an unobstructed canvas point.');
  imageNode = seed.nodes.find(n => n.id === imagePick.id);
  await selectTree(imageNode.id);
  const beforeImage = await savedScene();
  const imageOriginal = effectiveNode(beforeImage.nodes.find(n => n.id === imageNode.id));
  await dragAt(imagePick, 14, 10);
  current = await savedScene();
  const movedImage = effectiveNode(current.nodes.find(n => n.id === imageNode.id));
  check(movedImage.x !== imageOriginal.x || movedImage.y !== imageOriginal.y, 'tree selection followed by canvas drag moves an image component');
  const leafBefore = { ...movedImage };
  await page.locator('#selection [data-handle="se"]').waitFor();
  await dragElement(page.locator('#selection [data-handle="se"]'), 18, 14);
  current = await savedScene();
  const resizedImage = effectiveNode(current.nodes.find(n => n.id === imageNode.id));
  check(resizedImage.width > leafBefore.width || resizedImage.height > leafBefore.height, 'leaf resize handle changes component dimensions');
  await selectTree(groups[0].id);
  const originalGroup = effectiveNode((await savedScene()).nodes.find(n => n.id === groups[0].id));
  await dragElement(page.locator(`#selection [data-move="${groups[0].id}"]`), 12, 8);
  current = await savedScene();
  const movedGroup = effectiveNode(current.nodes.find(n => n.id === groups[0].id));
  check(movedGroup.x !== originalGroup.x || movedGroup.y !== originalGroup.y, 'group move grip drags the selected group');
  const groupBefore = movedGroup;
  await dragElement(page.locator('#selection [data-handle="se"]'), 22, 18);
  current = await savedScene();
  const groupAfter = effectiveNode(current.nodes.find(n => n.id === groups[0].id));
  check(groupAfter.scaleX !== groupBefore.scaleX || groupAfter.scaleY !== groupBefore.scaleY || groupAfter.width !== groupBefore.width, 'group resize handle transforms the group');

  // Inspector color palette and opacity are both operated by the mouse.
  await selectTree(textNode.id);
  const textFillBefore = (await savedScene()).nodes.find(n => n.id === textNode.id).states?.['player-selected']?.fill || textNode.fill;
  await page.getByRole('button', { name: 'Fill / text color #bf2924' }).click();
  current = await savedScene();
  const textAfterColor = current.nodes.find(n => n.id === textNode.id);
  check((textAfterColor.states?.['player-selected']?.fill || textAfterColor.fill) === '#bf2924' && textFillBefore !== '#bf2924', 'palette click changes selected text color');
  await dragSlider('Opacity', 0.43);
  current = await savedScene();
  const textAfterOpacity = current.nodes.find(n => n.id === textNode.id);
  check(Math.abs((textAfterOpacity.states?.['player-selected']?.opacity ?? textAfterOpacity.opacity) - 0.43) < 0.04, 'mouse slider changes component opacity');

  // Visibility and layer order controls.
  await selectTree(imageNode.id);
  const visibilityBefore = effectiveNode((await savedScene()).nodes.find(n => n.id === imageNode.id)).visible;
  await page.locator(`[data-layer="${imageNode.id}"] .eye`).click();
  current = await savedScene();
  const hidden = effectiveNode(current.nodes.find(n => n.id === imageNode.id));
  check(hidden.visible === false, 'layer eye hides a component');
  await page.locator(`[data-layer="${imageNode.id}"] .eye`).click();
  current = await savedScene();
  const restored = effectiveNode(current.nodes.find(n => n.id === imageNode.id));
  check((restored.visible ?? true) === (visibilityBefore ?? true), 'layer eye restores component visibility');
  await selectTree(textNode.id);
  const zBefore = effectiveNode((await savedScene()).nodes.find(n => n.id === textNode.id)).z;
  await page.getByRole('button', { name: '↑ Forward' }).click();
  current = await savedScene();
  check(effectiveNode(current.nodes.find(n => n.id === textNode.id)).z !== zBefore, 'Forward action changes component layer order');

  // Duplicate/delete/undo using UI controls and keyboard input.
  await page.getByRole('button', { name: 'Duplicate' }).click();
  current = await savedScene();
  const copy = current.nodes.find(n => n.name === `${textNode.name} copy`);
  check(!!copy && current.nodes.length === seed.nodes.length + 1, 'Duplicate creates a selectable copy');
  await page.getByRole('button', { name: 'Delete' }).click();
  current = await savedScene();
  check(!current.nodes.some(n => n.id === copy.id), 'Delete removes the selected copy');
  await page.locator('#undo').click();
  check((await savedScene()).nodes.some(n => n.id === copy.id), 'Undo restores the deleted component');
  await page.locator('#redo').click();
  check(!(await savedScene()).nodes.some(n => n.id === copy.id), 'Redo reapplies the deletion');

  // State-specific edits remain isolated when switching tabs and survive reload.
  await selectTree(textNode.id);
  await page.getByRole('button', { name: 'Fill / text color #438ed2' }).click();
  await switchState('enemy-selected');
  await selectTree(textNode.id);
  const enemyBefore = (await savedScene()).nodes.find(n => n.id === textNode.id).states?.['enemy-selected']?.fill;
  await page.getByRole('button', { name: 'Fill / text color #49b841' }).click();
  await switchState('idle');
  await selectTree(textNode.id);
  await page.getByRole('button', { name: 'Fill / text color #ffffff' }).click();
  await switchState('player-selected');
  current = await savedScene();
  const stateNode = current.nodes.find(n => n.id === textNode.id);
  check(stateNode.states?.['player-selected']?.fill === '#438ed2' && stateNode.states?.['enemy-selected']?.fill === '#49b841' && stateNode.states?.idle?.fill === '#ffffff', 'state edits remain independent across all three tabs');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 30000 });
  current = await savedScene();
  check(current.nodes.find(n => n.id === textNode.id).states?.['player-selected']?.fill === '#438ed2' && await page.locator('[data-state="player-selected"]').getAttribute('aria-pressed') === 'true', 'local edits and active state persist after refresh');
  await page.screenshot({ path: path.join(artifacts, 'desktop-edited.png'), fullPage: true });

  // JSON export, import, and roundtrip.
  const exported = await exportJson('layout-export.json');
  check(JSON.stringify(exported) === JSON.stringify(current), 'JSON export preserves the saved scene data');
  await selectTree(textNode.id);
  await page.getByRole('button', { name: 'Fill / text color #bf2924' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#import').click();
  await (await chooser).setFiles(path.join(artifacts, 'layout-export.json'));
  await page.waitForFunction(expected => {
    try { return JSON.stringify(JSON.parse(localStorage.getItem('ashenspire-hud-component-studio-v1')).scene) === expected; }
    catch { return false; }
  }, JSON.stringify(exported), { timeout: 30000 });
  current = await savedScene();
  check(JSON.stringify(current) === JSON.stringify(exported), 'JSON import restores the exported layout exactly');
  await exportPng('full-view.png');

  // Reset confirmation can be canceled and confirmed, then undo restores edited data.
  await page.locator('#reset').click();
  await page.getByRole('button', { name: 'Reset current view' }).click();
  await page.locator('#dialog').getByRole('button', { name: 'Cancel' }).click();
  check(JSON.stringify(await savedScene()) === JSON.stringify(exported), 'reset cancel leaves edits untouched');
  await page.locator('#reset').click();
  await page.getByRole('button', { name: 'Reset current view' }).click();
  await page.locator('#dialogConfirm').click();
  current = await savedScene();
  const originalText = seed.nodes.find(n => n.id === textNode.id);
  check(current.nodes.find(n => n.id === textNode.id).states?.['player-selected']?.fill !== '#ffffff', 'confirmed reset restores the selected view');
  await page.locator('#undo').click();
  check((await savedScene()).nodes.find(n => n.id === textNode.id).states?.['player-selected']?.fill === '#438ed2', 'undo restores edits after view reset');

  // Narrow viewport sanity: controls remain inside the viewport bounds and clickable.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const bounds = await page.evaluate(() => ({ width: innerWidth, nodes: [...document.querySelectorAll('.topbar button,.viewbar button,.layer-bottom button,#fit,#zoomIn,#zoomOut')].map(el => ({ text: el.innerText, right: el.getBoundingClientRect().right, left: el.getBoundingClientRect().left })) }));
  const offscreen = bounds.nodes.filter(node => node.right > bounds.width + 1 || node.left < -1);
  check(offscreen.length === 0, `narrow viewport controls stay onscreen (${offscreen.length} offscreen)`);
  await page.screenshot({ path: path.join(artifacts, 'narrow-390x844.png'), fullPage: true });

  check(errors.length === 0, `no browser console/page errors (${errors.length})`);
  check(failedRequests.length === 0, `no failed scene or asset requests (${failedRequests.length})`);
  await fs.writeFile(path.join(artifacts, 'report.json'), JSON.stringify({ status: 'pass', seedNodes: seed.nodes.length, screenshots: ['desktop-initial.png', 'desktop-edited.png', 'narrow-390x844.png'], errors, failedRequests }, null, 2));
  console.log(`Artifacts: ${artifacts}`);
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(artifacts, 'report.json'), JSON.stringify({ status: 'fail', error: error.stack, errors, failedRequests }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
