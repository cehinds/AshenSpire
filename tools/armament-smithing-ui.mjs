#!/usr/bin/env node
// Issue #211 — real-Chromium Shrine Smith UI proof at the two acceptance
// viewports. This serves source and writes only armament-smithing-*.png proof
// captures under docs/preview.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'docs', 'preview');
const SHAPES = Object.freeze([
  Object.freeze({ width: 1200, height: 730, mobile: false, label: 'desktop' }),
  Object.freeze({ width: 390, height: 844, mobile: true, label: 'mobile' }),
]);
const browserPath = [
  process.env.CHROME,
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((candidate) => candidate && existsSync(candidate));

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let checks = 0;
let failures = 0;

function check(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`  PASS ${code} - ${detail}`);
  else {
    failures += 1;
    console.error(`  RED  ${code} - ${detail}`);
  }
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const handlers = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id != null && pending.has(message.id)) {
      const { yes, no } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) no(new Error(message.error.message)); else yes(message.result);
    } else if (message.method && handlers.has(message.method)) {
      handlers.get(message.method)(message.params, message.sessionId);
    }
  };
  return {
    ready: new Promise((yes, no) => { socket.onopen = yes; socket.onerror = no; }),
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((yes, no) => pending.set(id, { yes, no }));
    },
    on(method, handler) { handlers.set(method, handler); },
    close() { socket.close(); },
  };
}

function decodePng(buffer) {
  if (buffer.length < 33 || buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('capture is not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let interlace = 0;
  const dataChunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') dataChunks.push(data);
    else if (type === 'IEND') break;
    offset += length + 12;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG depth/interlace ${depth}/${interlace}`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
  if (!channels) throw new Error(`unsupported PNG colour type ${colour}`);
  const packed = inflateSync(Buffer.concat(dataChunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[source++];
    const line = packed.subarray(source, source + stride);
    source += stride;
    const current = pixels.subarray(y * stride, (y + 1) * stride);
    const previous = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? current[x - channels] : 0;
      const above = previous ? previous[x] : 0;
      const diagonal = previous && x >= channels ? previous[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += above;
      else if (filter === 3) value += (left + above) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(above - diagonal);
        const pb = Math.abs(left - diagonal);
        const pc = Math.abs(left + above - 2 * diagonal);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? above : diagonal;
      } else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
      current[x] = value & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

function imageReceipt(buffer) {
  const decoded = decodePng(buffer);
  const colours = new Set();
  const stride = Math.max(decoded.channels, Math.floor(decoded.pixels.length / 5000 / decoded.channels) * decoded.channels);
  for (let i = 0; i < decoded.pixels.length && colours.size < 64; i += stride) {
    const r = decoded.pixels[i];
    const g = decoded.channels >= 3 ? decoded.pixels[i + 1] : r;
    const b = decoded.channels >= 3 ? decoded.pixels[i + 2] : r;
    colours.add(`${r},${g},${b}`);
  }
  return {
    width: decoded.width,
    height: decoded.height,
    sampledColours: colours.size,
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex').toUpperCase(),
  };
}

async function main() {
  if (!browserPath) throw new Error('no Chrome/Edge/Chromium found; set CHROME');
  mkdirSync(OUT, { recursive: true });
  const served = await serve({ root: ROOT, port: 8296, open: false });
  let launched;
  let cdp;
  const errors = new Map();
  const receipts = [];
  try {
    launched = await launchBrowser({ prefix: 'smith-ui-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
    cdp = connectCdp(launched.wsUrl);
    await cdp.ready;
    cdp.on('Runtime.exceptionThrown', (params, sessionId) => {
      const detail = params?.exceptionDetails;
      if (!errors.has(sessionId)) errors.set(sessionId, []);
      errors.get(sessionId).push(detail?.exception?.description || detail?.text || 'runtime exception');
    });

    for (const shape of SHAPES) {
      const upper = `${shape.width}X${shape.height}`;
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      errors.set(sessionId, []);
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width,
        height: shape.height,
        deviceScaleFactor: 1,
        mobile: shape.mobile,
      }, sessionId);

      const evaluate = async (expression) => {
        const result = await cdp.send('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
        }, sessionId);
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'page evaluation failed');
        return result.result.value;
      };
      const until = async (expression, label, timeout = 15000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (await evaluate(expression).catch(() => false)) return;
          await wait(70);
        }
        throw new Error(`${shape.label}: timed out waiting for ${label}`);
      };
      const click = async (selector) => {
        const point = await evaluate(`(() => {
          const node=document.querySelector(${JSON.stringify(selector)});
          if(!node)return null;
          node.scrollIntoView({block:'center',inline:'center'});
          const r=node.getBoundingClientRect(), x=(r.left+r.right)/2, y=(r.top+r.bottom)/2;
          const hit=document.elementFromPoint(x,y);
          return {x,y,clear:!!(hit&&(hit===node||node.contains(hit)))};
        })()`);
        if (!point) throw new Error(`${shape.label}: missing ${selector}`);
        if (!point.clear) throw new Error(`${shape.label}: ${selector} is not centre-hit-testable`);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
        await wait(160);
      };
      const openSelected = async (stones, itemRef = 'armament/straightSword', itemName = 'Straight Sword') => {
        errors.set(sessionId, []);
        await cdp.send('Page.navigate', {
          url: `http://127.0.0.1:${served.port}/?shot=rest&shotSmithingStones=${stones}`,
        }, sessionId);
        await until(`!!document.querySelector('#smith-opt') && document.querySelector('#smith-opt').getClientRects().length>0`, 'Shrine Smith option');
        await evaluate('document.fonts && document.fonts.ready');
        await click('#smith-opt');
        await until(`!!document.querySelector('.smith-upgrade-modal')`, 'Smith modal');
        await until(`document.querySelector('.smith-upgrade-modal h2')?.textContent.trim()==='Upgrade an Item'`, 'generic Smith modal title');
        await click(`.smith-candidate-card[data-item-ref="${itemRef}"]`);
        await until(`document.querySelector('.smith-preview-card')?.textContent.includes(${JSON.stringify(itemName)})`, `selected ${itemName} preview`);
        await until(`[...document.querySelectorAll('.smith-weapon-art img')].every((img)=>img.complete&&img.naturalWidth>0)`, 'item card art');
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4 }, sessionId);
        await evaluate('document.activeElement?.blur(); document.querySelector(".smith-preview-region").scrollTop=0');
        await wait(180);
      };
      const reading = () => evaluate(`(() => {
        const visible=(node)=>{if(!node)return false;const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
        const rect=(node)=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const modal=document.querySelector('.smith-upgrade-modal');
        const preview=document.querySelector('.smith-preview-card');
        const confirm=document.querySelector('.smith-confirm');
        const targets=[...document.querySelectorAll('.smith-candidate-card,.smith-back,.smith-confirm')].filter(visible).map((node)=>{
          const r=rect(node), x=(r.left+r.right)/2, y=(r.top+r.bottom)/2, hit=document.elementFromPoint(x,y);
          return {name:node.dataset.itemRef||node.className,...r,centreHit:!!(hit&&(hit===node||node.contains(hit)))};
        });
        const horizontal=[modal,document.querySelector('.smith-modal-head'),document.querySelector('.smith-modal-body'),document.querySelector('.smith-candidate-region'),document.querySelector('.smith-preview-region'),document.querySelector('.smith-modal-footer')].filter(Boolean).map((node)=>({name:node.className,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth}));
        return {
          text:(preview?.textContent||'').replace(/\\s+/g,' ').trim(),
          count:(document.querySelector('[data-smith-count]')?.textContent||'').replace(/\\s+/g,' ').trim(),
          title:document.querySelector('.smith-upgrade-modal h2')?.textContent.trim()||'',
          candidates:[...document.querySelectorAll('.smith-candidate-card')].map((node)=>({ref:node.dataset.itemRef||'',name:node.querySelector('.smith-weapon-name')?.textContent.trim()||''})),
          weaponCards:[...document.querySelectorAll('.smith-weapon-card')].map((node)=>{
            const art=node.querySelector('.smith-weapon-art'), image=art?.querySelector('img');
            const cardRect=rect(node), artRect=art?rect(art):null;
            return {
              itemRef:node.dataset.itemRef||'',
              name:node.querySelector('.smith-weapon-name')?.textContent.trim()||'',
              count:node.querySelector('.smith-weapon-count')?.textContent.trim()||'',
              countLabel:node.querySelector('.smith-weapon-count')?.getAttribute('aria-label')||'',
              types:[...node.querySelectorAll('.smith-item-type-row [data-item-type]')].map((type)=>({tag:type.dataset.itemType,label:type.textContent.trim()})),
              tags:[...node.querySelectorAll('.smith-weapon-tags em')].map((tag)=>tag.textContent.trim()),
              imageLoaded:!!(image?.complete&&image.naturalWidth>0),
              artShare:artRect?artRect.height/cardRect.height:0,
              borrowedCombatType:!!node.querySelector('.ctype,.ctext'),
            };
          }),
          confirm:{text:confirm?.textContent?.trim()||'',disabled:!!confirm?.disabled,aria:confirm?.getAttribute('aria-disabled'),state:confirm?.dataset.smithActionState||'',hold:confirm?.dataset.optionHold||''},
          summaryHeights:[...document.querySelectorAll('.smith-summary-cell')].map((node)=>rect(node).height),
          summaryBorders:[...document.querySelectorAll('.smith-summary-cell')].map((node)=>getComputedStyle(node).borderTopWidth),
          summaryGrid:document.querySelector('.smith-summary-grid')?{
            columns:getComputedStyle(document.querySelector('.smith-summary-grid')).gridTemplateColumns,
            requirementWidth:rect(document.querySelector('.smith-requirements')).width,
            gridWidth:rect(document.querySelector('.smith-summary-grid')).width,
            selectedToStatsGap:document.querySelector('.smith-intrinsic-stats')
              ? rect(document.querySelector('.smith-intrinsic-stats')).top-rect(document.querySelector('.smith-summary-grid')).bottom
              : null,
          }:null,
          economy:document.querySelector('.smith-preview-economy')?{
            reference:[...document.querySelectorAll('.smith-preview-economy .smith-cost-pair em')].map((node)=>node.textContent.trim()).join('/'),
            icon:document.querySelector('.smith-stone-icon')?.textContent.trim()||'',
            label:document.querySelector('.smith-economy-values b')?.textContent.trim()||'',
            required:document.querySelector('.smith-cost-required')?.textContent.trim()||'',
            available:document.querySelector('.smith-cost-available')?.textContent.trim()||'',
            availableColor:getComputedStyle(document.querySelector('.smith-cost-available')).color,
            requiredColor:getComputedStyle(document.querySelector('.smith-cost-required')).color,
            costColor:getComputedStyle(document.querySelector('.smith-economy-values b')).color,
            slashXs:[...document.querySelectorAll('.smith-preview-economy .smith-cost-pair > i')].map((node)=>{const r=rect(node);return (r.left+r.right)/2;}),
            headerBottom:Math.max(...[...document.querySelectorAll('.smith-preview-economy .smith-cost-pair em')].map((node)=>rect(node).bottom)),
            numberTop:Math.min(...[...document.querySelectorAll('.smith-preview-economy .smith-cost-pair strong')].map((node)=>rect(node).top)),
            labelHeight:rect(document.querySelector('.smith-economy-values b')).height,
            labelLineHeight:Number.parseFloat(getComputedStyle(document.querySelector('.smith-economy-values b')).lineHeight),
            valuesScrollWidth:document.querySelector('.smith-economy-values').scrollWidth,
            valuesClientWidth:document.querySelector('.smith-economy-values').clientWidth,
          }:null,
          selectedType:document.querySelector('.smith-candidate-card.selected .smith-item-type-row')?.textContent.trim()||'',
          selectedNameStyle:document.querySelector('.smith-selected-head > b')?{
            color:getComputedStyle(document.querySelector('.smith-selected-head > b')).color,
            fontSize:getComputedStyle(document.querySelector('.smith-selected-head > b')).fontSize,
            foldColor:getComputedStyle(document.querySelector('.smith-upgrade-row > summary > span:first-child > b')).color,
            foldFontSize:getComputedStyle(document.querySelector('.smith-upgrade-row > summary > span:first-child > b')).fontSize,
          }:null,
          intrinsic:document.querySelector('.smith-intrinsic-stats')?{
            title:document.querySelector('.smith-intrinsic-stats .smith-data-heading b')?.textContent.trim()||'',
            text:(document.querySelector('.smith-intrinsic-stats')?.textContent||'').replace(/\\s+/g,' ').trim(),
            overflow:document.querySelector('.smith-intrinsic-stats').scrollWidth-document.querySelector('.smith-intrinsic-stats').clientWidth,
            borderLeft:getComputedStyle(document.querySelector('.smith-intrinsic-stats')).borderLeftWidth,
            borderRight:getComputedStyle(document.querySelector('.smith-intrinsic-stats')).borderRightWidth,
            radius:getComputedStyle(document.querySelector('.smith-intrinsic-stats')).borderRadius,
          }:null,
          affected:[...document.querySelectorAll('.smith-upgrade-folds .smith-upgrade-row')].map((node)=>({
            title:node.querySelector('summary b')?.textContent.trim()||'',
            role:node.querySelector('summary small')?.textContent.trim()||'',
            unused:node.classList.contains('is-unused'),
            opacity:Number.parseFloat(getComputedStyle(node).opacity),
            text:(node.textContent||'').replace(/\\s+/g,' ').trim(),
            values:[...node.querySelectorAll('.smith-fold-values span')].map((value)=>({
              label:value.querySelector('em')?.textContent.trim()||'',
              before:value.querySelector('b')?.textContent.trim()||'',
              after:value.querySelector('strong')?.textContent.trim()||'',
            })),
          })),
          summaryFonts:[
            {label:getComputedStyle(document.querySelector('.smith-preview-label')).fontSize,value:getComputedStyle(document.querySelector('.smith-selected-head > b')).fontSize},
            {label:getComputedStyle(document.querySelector('.smith-cost-pair em')).fontSize,value:getComputedStyle(document.querySelector('.smith-economy-values')).fontSize},
          ],
          requirementRow:document.querySelector('.smith-requirements')?{
            border:getComputedStyle(document.querySelector('.smith-requirements')).borderTopWidth,
            borderLeft:getComputedStyle(document.querySelector('.smith-requirements')).borderLeftWidth,
            borderRight:getComputedStyle(document.querySelector('.smith-requirements')).borderRightWidth,
            radius:getComputedStyle(document.querySelector('.smith-requirements')).borderRadius,
            height:rect(document.querySelector('.smith-requirements')).height,
            minHeight:getComputedStyle(document.querySelector('.smith-requirements')).minHeight,
            resultHeights:[...document.querySelectorAll('.smith-upgrade-folds .smith-upgrade-row')].map((node)=>rect(node).height),
            nestedBorder:getComputedStyle(document.querySelector('.smith-requirement')).borderTopWidth,
            metric:document.querySelector('.smith-requirement-values em')?.textContent.trim()||'',
            before:document.querySelector('.smith-requirement-values b')?.textContent.trim()||'',
            after:document.querySelector('.smith-requirement-values strong')?.textContent.trim()||'',
            detail:document.querySelector('.smith-requirement small')?.textContent.trim()||'',
            detailRight:document.querySelector('.smith-requirement small')
              ? Math.abs(rect(document.querySelector('.smith-requirement small')).right-rect(document.querySelector('.smith-requirement')).right)<=8
              : true,
          }:null,
          modal:modal?rect(modal):null,
          documentOverflowX:document.documentElement.scrollWidth-innerWidth,
          horizontal,
          targets,
        };
      })()`);
      const capture = async (state) => {
        const name = `armament-smithing-${state}-${shape.width}x${shape.height}.png`;
        const path = resolve(OUT, name);
        const { data } = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
          captureBeyondViewport: false,
        }, sessionId);
        const buffer = Buffer.from(data, 'base64');
        writeFileSync(path, buffer);
        const receipt = { state, path, ...imageReceipt(buffer) };
        receipts.push(receipt);
        check(receipt.width === shape.width && receipt.height === shape.height,
          `SMITH-UI-${upper}-${state.toUpperCase()}-DIMENSIONS`, `${name} is exactly ${receipt.width}x${receipt.height}`);
        check(receipt.sampledColours >= 16 && receipt.bytes > 1000,
          `SMITH-UI-${upper}-${state.toUpperCase()}-NONBLANK`, `${name} is nonblank (${receipt.sampledColours} sampled colours, ${receipt.bytes} bytes)`);
      };

      await openSelected(0);
      const zero = await reading();
      check(zero.title === 'Upgrade an Item' && zero.count === '0 Smithing Stones · 3 eligible'
          && zero.candidates.map((row)=>row.ref).join('|') === 'armament/straightSword|armament/roundShield|armor/reaver/default'
          && !zero.candidates.some((row)=>row.ref === 'relic/forsakenMedallion'),
        `SMITH-UI-${upper}-ZERO-PICKER`, `generic picker exposes the two default armaments and equipped armor by namespaced ref without inferring an unauthored owned relic (${JSON.stringify({ title: zero.title, count: zero.count, candidates: zero.candidates })})`);
      check(zero.weaponCards.length === 3
          && zero.weaponCards[0]?.types.length === 1 && zero.weaponCards[0].types[0]?.tag === 'item:blade' && zero.weaponCards[0].types[0]?.label === 'Blade'
          && zero.weaponCards[1]?.types.length === 1 && zero.weaponCards[1].types[0]?.tag === 'item:shield' && zero.weaponCards[1].types[0]?.label === 'Shield'
          && zero.weaponCards[2]?.itemRef === 'armor/reaver/default'
          && zero.weaponCards.every((card) => card.count === '1' && card.countLabel === '1 in inventory'
            && card.tags.length >= (card.itemRef.startsWith('armament/') ? 2 : 1) && card.imageLoaded
            && card.artShare >= 0.45 && !card.borrowedCombatType),
        `SMITH-UI-${upper}-EQUIPMENT-CARD-ANATOMY`, `namespaced armament/armor candidate cards use owned equipment art/count/semantic type/tags with a dominant image box (${JSON.stringify(zero.weaponCards)})`);
      check(zero.intrinsic?.title === 'Equipment Stats' && zero.intrinsic.text.includes('AR 5') && zero.intrinsic.text.includes('DEF 2')
          && zero.intrinsic.text.includes('WEIGHT 5') && zero.intrinsic.text.includes('Weapon Art Mana 0')
          && zero.intrinsic.text.includes('Unique Skill Stamina 0') && zero.intrinsic.overflow <= 0
          && zero.intrinsic.borderLeft === '0px' && zero.intrinsic.borderRight === '0px' && zero.intrinsic.radius === '0px',
        `SMITH-UI-${upper}-INTRINSIC-STATS`, `armament intrinsic row exposes AR/DEF/Weight/Weapon Art Mana/Unique Skill Stamina without a nested card or horizontal overflow (${JSON.stringify(zero.intrinsic)})`);
      check(zero.selectedNameStyle?.color === zero.selectedNameStyle?.foldColor
          && zero.selectedNameStyle?.fontSize === zero.selectedNameStyle?.foldFontSize,
        `SMITH-UI-${upper}-SELECTED-NAME-TYPE`, `selected item name uses the same white display treatment and size as fold titles (${JSON.stringify(zero.selectedNameStyle)})`);
      check(zero.text.includes('REQ/AVAIL') && zero.text.includes('Smithing Stone Cost REQ/AVAIL 1/0') && zero.text.includes('STR10→9')
          && zero.text.includes('Slashing Strike') && zero.text.includes('AR 7 → 10')
          && zero.text.includes('Weapon Guard') && zero.text.includes('not in active deck')
          && zero.text.includes('Scales with STR') && zero.text.includes('Weapon Technique') && zero.text.includes('GUARD 3 → 5')
          && zero.text.includes('Short 1 Smithing Stone'),
        `SMITH-UI-${upper}-ZERO-DELTAS`, `selected zero-purse preview names cost, requirement reduction, active Strike/Technique, grey unused Defense, scaling, and shortfall (${JSON.stringify(zero.text)})`);
      check(zero.summaryHeights.length === 2 && Math.max(...zero.summaryHeights) - Math.min(...zero.summaryHeights) <= 1
          && zero.summaryBorders.every((width) => width === '0px')
          && zero.economy?.reference === 'REQ/AVAIL' && zero.economy?.icon === '🪨'
          && zero.economy?.label === 'Smithing Stone Cost' && zero.economy?.required === '1' && zero.economy?.available === '0'
          && zero.economy.headerBottom <= zero.economy.numberTop + 1
          && zero.economy.slashXs.length === 2 && Math.abs(zero.economy.slashXs[0] - zero.economy.slashXs[1]) <= 0.5
          && zero.economy.labelHeight <= zero.economy.labelLineHeight + 1
          && zero.economy.valuesScrollWidth <= zero.economy.valuesClientWidth + 1
          && zero.economy.availableColor !== zero.economy.requiredColor && zero.economy.requiredColor === zero.economy.costColor,
        `SMITH-UI-${upper}-SUMMARY-GRID`, `Selected Item and Cost use borderless equal-height 3:1 cells; the two slash glyphs share one x anchor (${JSON.stringify({ heights: zero.summaryHeights, borders: zero.summaryBorders, economy: zero.economy })})`);
      check(zero.summaryFonts.length === 2
          && new Set(zero.summaryFonts.map((row) => row.label)).size === 1
          && new Set(zero.summaryFonts.map((row) => row.value)).size === 1,
        `SMITH-UI-${upper}-SUMMARY-TYPE`, `the two summary components share one header size and one primary-value size (${JSON.stringify(zero.summaryFonts)})`);
      const summaryColumns = zero.summaryGrid?.columns.trim().split(/\s+/).map((value) => Number.parseFloat(value)) || [];
      check(zero.summaryGrid && summaryColumns.length === 2 && Math.abs(summaryColumns[0] / summaryColumns[1] - 3) <= 0.05
          && Math.abs(zero.summaryGrid.requirementWidth - zero.summaryGrid.gridWidth) <= 1
          && Math.abs(zero.summaryGrid.selectedToStatsGap) <= 1,
        `SMITH-UI-${upper}-SUMMARY-ORDER`, `Selected Item and Cost share the first row; Equipment Stats begins immediately below and Requirements spans the full row (${JSON.stringify(zero.summaryGrid)})`);
      check(zero.requirementRow?.border !== '0px' && zero.requirementRow?.borderLeft === '0px'
          && zero.requirementRow?.borderRight === '0px' && zero.requirementRow?.radius === '0px'
          && zero.requirementRow?.nestedBorder === '0px'
          && zero.requirementRow.metric === 'STR' && zero.requirementRow.before === '10' && zero.requirementRow.after === '9'
          && zero.requirementRow.detail === 'You have 13' && zero.requirementRow.detailRight
          && zero.requirementRow.resultHeights.every((height) => height >= 44),
        `SMITH-UI-${upper}-REQUIREMENT-ROW`, `Requirements is a flat selected-item row without a nested card and right-anchors the player value (${JSON.stringify(zero.requirementRow)})`);
      check(zero.affected.length === 3
          && zero.affected.some((row) => row.role.includes('attack · 4 active') && !row.unused)
          && zero.affected.some((row) => row.role.includes('guard · not in active deck') && row.unused && row.opacity < 0.6)
          && zero.affected.some((row) => row.role.includes('technique · 1 active') && !row.unused),
        `SMITH-UI-${upper}-ROLE-USAGE`, `basic Strike, Defense, and Technique rows publish active ownership while the displaced Defense is visibly muted (${JSON.stringify(zero.affected)})`);
      check(!zero.confirm.disabled && zero.confirm.aria === 'true' && zero.confirm.state === 'blocked'
          && zero.confirm.hold === 'blocked' && zero.confirm.text === 'Upgrade (1)',
        `SMITH-UI-${upper}-ZERO-CONFIRM`, 'zero-purse Upgrade (1) remains clickable, is ARIA-blocked, and cannot arm a hold commit');
      check(zero.documentOverflowX <= 0 && Math.abs(zero.modal?.left || 0) <= 0.5 && Math.abs(zero.modal?.top || 0) <= 0.5
          && Math.abs((zero.modal?.width || 0) - shape.width) <= 1 && Math.abs((zero.modal?.height || 0) - shape.height) <= 1
          && zero.horizontal.every((row) => row.scrollWidth <= row.clientWidth + 1),
        `SMITH-UI-${upper}-ZERO-FIT`, 'Shrine action pane fills the viewport and regions have no horizontal overflow');
      check(zero.targets.length === 5
          && zero.targets.every((target) => target.width >= 44 && target.height >= 44 && target.centreHit),
        `SMITH-UI-${upper}-ZERO-TARGETS`, 'two armaments, equipped armor, Back, and Confirm each meet 44px and centre hit-testing');
      await click('.smith-candidate-card[data-item-ref="armor/reaver/default"]');
      const armor = await reading();
      check(armor.text.includes('Wayfarer Plate') && armor.selectedType === 'Armor' && !armor.intrinsic
          && armor.affected.length === 1 && armor.affected[0].role.startsWith('armor')
          && armor.affected[0].title === 'Poise threshold'
          && armor.affected[0].values.some((value)=>value.label === 'Poise threshold' && value.after === '9')
          && /\b8\b/.test(armor.affected[0].text),
        `SMITH-UI-${upper}-TYPED-ARMOR`, `equipped armor selects by namespaced ref and renders its typed authored row without armament-only intrinsic stats (${JSON.stringify({ selectedType: armor.selectedType, intrinsic: armor.intrinsic, affected: armor.affected })})`);
      await click('.smith-candidate-card[data-item-ref="armament/straightSword"]');
      await capture('zero');
      if (shape.mobile) {
        await evaluate('document.querySelector(".smith-preview-region").scrollTop=document.querySelector(".smith-preview-region").scrollHeight');
        await wait(100);
        await capture('zero-deltas');
      }
      const blockedPoint = await evaluate(`(() => { const r=document.querySelector('.smith-confirm').getBoundingClientRect(); return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}; })()`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: blockedPoint.x, y: blockedPoint.y, button: 'left', clickCount: 1 }, sessionId);
      await wait(700);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: blockedPoint.x, y: blockedPoint.y, button: 'left', clickCount: 1 }, sessionId);
      await until(`!!document.querySelector('.confirmation-modal')`, 'blocked upgrade explanation');
      const blockedReview = await evaluate(`(() => ({
        title:document.querySelector('.confirmation-modal h2')?.textContent?.trim()||'',
        text:(document.querySelector('.confirmation-modal')?.textContent||'').replace(/\\s+/g,' ').trim(),
        confirmVisible:!!document.querySelector('.confirmation-confirm')?.getClientRects().length,
        smithStillOpen:!!document.querySelector('.smith-upgrade-modal'),
      }))()`);
      check(blockedReview.title === 'Cannot upgrade Straight Sword' && blockedReview.text.includes('Need 1 more Smithing Stone.')
          && !blockedReview.confirmVisible && blockedReview.smithStillOpen,
        `SMITH-UI-${upper}-BLOCKED-REVIEW`, `blocked click/hold explains the exact shortfall and cannot commit (${JSON.stringify(blockedReview)})`);
      await click('.confirmation-cancel');
      await until(`!document.querySelector('.confirmation-modal') && !!document.querySelector('.smith-upgrade-modal')`, 'closed blocked upgrade explanation');

      await openSelected(1);
      const one = await reading();
      check(one.count === '1 Smithing Stone · 3 eligible'
          && one.text.includes('Tier 0 → 1') && one.text.includes('REQ/AVAIL') && one.text.includes('Smithing Stone Cost REQ/AVAIL 1/1') && one.text.includes('STR10→9')
          && one.text.includes('Slashing Strike') && one.text.includes('AR 7 → 10')
          && one.text.includes('Weapon Technique') && one.text.includes('GUARD 3 → 5'),
        `SMITH-UI-${upper}-ONE-DELTAS`, `one-purse selected review shows tier, cost, requirement, scaling, and every real grouped delta (${JSON.stringify(one.text)})`);
      check(!one.confirm.disabled && one.confirm.aria === 'false'
          && one.confirm.text.includes('Upgrade (1)') && one.confirm.state === 'actionable' && one.confirm.hold === 'commit',
        `SMITH-UI-${upper}-ONE-CONFIRM`, 'affordable Upgrade (1) is actionable and advertises the hold shortcut');
      check(one.documentOverflowX <= 0 && Math.abs(one.modal?.left || 0) <= 0.5 && Math.abs(one.modal?.top || 0) <= 0.5
          && Math.abs((one.modal?.width || 0) - shape.width) <= 1 && Math.abs((one.modal?.height || 0) - shape.height) <= 1
          && one.horizontal.every((row) => row.scrollWidth <= row.clientWidth + 1),
        `SMITH-UI-${upper}-ONE-FIT`, 'affordable review fills the Shrine action pane with no horizontal overflow');
      check(one.targets.length === 5
          && one.targets.every((target) => target.width >= 44 && target.height >= 44 && target.centreHit),
        `SMITH-UI-${upper}-ONE-TARGETS`, 'affordable modal preserves five 44px centre-hit-testable controls');
      await capture('one');
      if (shape.mobile) {
        await evaluate('document.querySelector(".smith-preview-region").scrollTop=document.querySelector(".smith-preview-region").scrollHeight');
        await wait(100);
        await capture('one-deltas');
      }

      await click('.smith-confirm');
      await until(`!!document.querySelector('.confirmation-modal')`, 'upgrade confirmation modal');
      const review = await evaluate(`(() => ({
        title:document.querySelector('.confirmation-modal h2')?.textContent?.trim()||'',
        text:(document.querySelector('.confirmation-modal')?.textContent||'').replace(/\\s+/g,' ').trim(),
        smithStillOpen:!!document.querySelector('.smith-upgrade-modal'),
      }))()`);
      check(review.title === 'Upgrade Straight Sword?' && review.text.includes('REQ/AVAIL') && review.text.includes('Smithing Stone Cost REQ/AVAIL 1/1')
          && review.text.includes('STR10→9') && review.text.includes('AR 7 → 10') && review.smithStillOpen,
        `SMITH-UI-${upper}-CLICK-REVIEW`, `click opens the shared consequence/cost modal without committing (${JSON.stringify(review)})`);
      await click('.confirmation-cancel');
      await until(`!document.querySelector('.confirmation-modal') && !!document.querySelector('.smith-upgrade-modal')`, 'cancelled upgrade review');
      const holdPoint = await evaluate(`(() => { const r=document.querySelector('.smith-confirm').getBoundingClientRect(); return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}; })()`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: holdPoint.x, y: holdPoint.y, button: 'left', clickCount: 1 }, sessionId);
      await wait(700);
      await until(`!document.querySelector('.smith-upgrade-modal') && !!document.querySelector('.mapscreen')`, 'post-hold map transition');
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: holdPoint.x, y: holdPoint.y, button: 'left', clickCount: 1 }, sessionId);
      check(await evaluate(`!document.querySelector('.confirmation-modal') && !document.querySelector('.smith-upgrade-modal') && !!document.querySelector('.mapscreen')`),
        `SMITH-UI-${upper}-HOLD-DIRECT`, 'completed hold commits once and leaves the Shrine without opening the modal');

      await wait(700);
      await click('#open-armoury');
      await until(`!!document.querySelector('.armoury-overlay') && !!document.querySelector('.armoury-smithing-receipt')`, 'Armoury Smithing receipt');
      const armoury = await evaluate(`(() => {
        const receipt=document.querySelector('.armoury-smithing-receipt');
        const owner=receipt?.closest('details');
        if(owner)owner.open=true;
        const rows=[...document.querySelectorAll('details.armoury-card-row')];
        for(const row of rows) {
          const name=row.querySelector('.armoury-card-row-name')?.textContent?.trim();
          if(name==='Slashing Strike+'||name==='Weapon Technique+')row.open=true;
        }
        const receiptDetailPane=receipt?.closest('.armoury-armament-details');
        const tier=[...(receiptDetailPane?.querySelectorAll('dl div') || [])]
          .find((row)=>row.querySelector('dt')?.textContent?.trim()==='Smithing tier')?.querySelector('dd')?.textContent?.trim()||'';
        const cards=rows.map((row)=>({
          name:row.querySelector('.armoury-card-row-name')?.textContent?.trim()||'',
          combat:(row.querySelector('.armoury-card-combat')?.textContent||'').replace(/\\s+/g,' ').trim(),
        }));
        return {
          receipt:(receipt?.textContent||'').replace(/\\s+/g,' ').trim(),
          receiptTitle:receipt?.querySelector('b')?.textContent?.trim()||'',
          receiptDetail:receipt?.querySelector('span')?.textContent?.trim()||'',
          receiptVisible:!!receipt&&receipt.getClientRects().length>0,
          tier,
          cards,
          documentOverflowX:document.documentElement.scrollWidth-innerWidth,
        };
      })()`);
      const strikeArmoury = armoury.cards.find((row) => row.name === 'Slashing Strike+');
      const techniqueArmoury = armoury.cards.find((row) => row.name === 'Weapon Technique+');
      check(armoury.receiptVisible && armoury.tier === '1'
          && armoury.receipt === 'Last SmithingTier 0 → 1 · 1 Stone · 5 basic cards improved',
        `SMITH-UI-${upper}-ARMOURY-RECEIPT`, `Armoury exposes tier 1 and the exact durable Smithing receipt (${JSON.stringify({ visible: armoury.receiptVisible, tier: armoury.tier, title: armoury.receiptTitle, detail: armoury.receiptDetail, receipt: armoury.receipt })})`);
      check(strikeArmoury?.combat === 'Deal 10 damage.' && techniqueArmoury?.combat === 'Gain 5 Block.',
        `SMITH-UI-${upper}-ARMOURY-CARDS`, `Armoury resolves improved equipment cards (${JSON.stringify({ strike: strikeArmoury, technique: techniqueArmoury })})`);
      check(armoury.documentOverflowX <= 0,
        `SMITH-UI-${upper}-ARMOURY-FIT`, 'post-Smith Armoury has no document-level horizontal overflow');

      await evaluate(`(() => {
        const receipt=document.querySelector('.armoury-smithing-receipt');
        receipt?.scrollIntoView({block:'center',inline:'nearest'});
      })()`);
      await wait(140);
      await capture('receipt');
      if (await evaluate(`document.querySelector('[data-region="cards"]')?.dataset.collapsed==='1'`)) {
        await click('[data-fold="cards"]');
        await until(`document.querySelector('[data-region="cards"]')?.dataset.collapsed==='0'`, 'expanded Armoury Cards tray');
      }
      await evaluate(`(() => {
        const rows=[...document.querySelectorAll('details.armoury-card-row')];
        const strike=rows.find((row)=>row.querySelector('.armoury-card-row-name')?.textContent?.trim()==='Slashing Strike+');
        const technique=rows.find((row)=>row.querySelector('.armoury-card-row-name')?.textContent?.trim()==='Weapon Technique+');
        if(strike)strike.open=true;
        if(technique)technique.open=true;
        strike?.scrollIntoView({block:'center',inline:'nearest'});
      })()`);
      await wait(140);
      await capture('cards-strike');
      await evaluate(`(() => {
        const rows=[...document.querySelectorAll('details.armoury-card-row')];
        const technique=rows.find((row)=>row.querySelector('.armoury-card-row-name')?.textContent?.trim()==='Weapon Technique+');
        technique?.scrollIntoView({block:'center',inline:'nearest'});
      })()`);
      await wait(140);
      await capture('cards');
      check((errors.get(sessionId) || []).length === 0,
        `SMITH-UI-${upper}-RUNTIME`, 'both affordability states and Confirm completed without an uncaught runtime exception');

      // The same source shot block owns two additional issue-211 reach doors.
      // Exercise them once at desktop size: the co-op fixture must be a real
      // host plan with one Stone, and the non-empty reward fixture must show
      // the real, already-claimed elite faucet receipt. The empty reward pose
      // remains empty rather than being silently granted a Stone.
      if (!shape.mobile) {
        errors.set(sessionId, []);
        await cdp.send('Page.navigate', {
          url: `http://127.0.0.1:${served.port}/?shot=coopshrine`,
        }, sessionId);
        await until(`!!document.querySelector('#coop-smith')`, 'co-op Shrine Smith option');
        const coopDoor = await evaluate(`(() => {
          const button=document.querySelector('#coop-smith');
          return {text:button?.textContent?.trim()||'',disabled:!!button?.disabled};
        })()`);
        check(coopDoor.text === 'Upgrade an item · 1 Stone' && coopDoor.disabled === false,
          'SMITH-UI-COOP-SHOT-DOOR', `co-op Shrine shot exposes the real one-Stone host plan (${JSON.stringify(coopDoor)})`);
        await click('#coop-smith');
        await until(`!!document.querySelector('.smith-upgrade-modal')`, 'co-op Smith modal');
        await click('.smith-candidate-card[data-item-ref="armament/straightSword"]');
        const coopModal = await evaluate(`(() => ({
          count:(document.querySelector('[data-smith-count]')?.textContent||'').replace(/\\s+/g,' ').trim(),
          text:(document.querySelector('.smith-preview-card')?.textContent||'').replace(/\\s+/g,' ').trim(),
        }))()`);
        check(coopModal.count === '1 Smithing Stone · 3 eligible'
            && coopModal.text.includes('AR 7 → 10')
            && coopModal.text.includes('GUARD 3 → 5'),
          'SMITH-UI-COOP-SHOT-MODAL', `co-op Shrine shot opens the shared real-delta review (${JSON.stringify(coopModal)})`);

        await cdp.send('Page.navigate', {
          url: `http://127.0.0.1:${served.port}/?shot=reward`,
        }, sessionId);
        await until(`!!document.querySelector('.reward-kind[data-kind="smithingStone"]')`, 'Smithing Stone reward row');
        const reward = await evaluate(`(() => {
          const row=document.querySelector('.reward-kind[data-kind="smithingStone"]');
          return {state:row?.dataset.state||'',text:(row?.textContent||'').replace(/\\s+/g,' ').trim()};
        })()`);
        check(reward.state === 'taken' && reward.text.includes('1 Smithing Stone')
            && reward.text.includes('1 total') && reward.text.includes('Taken'),
          'SMITH-UI-REWARD-SHOT-FAUCET', `non-empty reward shot displays the real claimed elite faucet (${JSON.stringify(reward)})`);

        await cdp.send('Page.navigate', {
          url: `http://127.0.0.1:${served.port}/?shot=reward&shotReward=pending`,
        }, sessionId);
        await until(`!!document.querySelector('.reward-kind[data-kind="smithingStone"]')`, 'restored pending Smithing Stone reward row');
        const pending = await evaluate(`(() => {
          const row=document.querySelector('.reward-kind[data-kind="smithingStone"]');
          const state=window.__spoils();
          return {
            rowState:row?.dataset.state||'',
            liveStones:state.smithingStones,
            savedStones:state.savedSmithingStones,
            livePending:state.pendingReward,
            savedPending:state.savedPendingReward,
          };
        })()`);
        check(pending.rowState === 'taken' && pending.liveStones === 1 && pending.savedStones === 1
            && pending.livePending?.states?.smithingStone === 'taken'
            && pending.savedPending?.states?.smithingStone === 'taken',
          'SMITH-UI-REWARD-PENDING-RESTORE', `interruption/load resumes the saved offer with its Stone and claim (${JSON.stringify(pending)})`);
        await click('.reward-kind[data-kind="cinders"]');
        const partial = await evaluate(`(() => {
          const state=window.__spoils();
          return {
            rowState:document.querySelector('.reward-kind[data-kind="cinders"]')?.dataset.state||'',
            live:state.pendingReward?.states?.cinders||'',
            saved:state.savedPendingReward?.states?.cinders||'',
          };
        })()`);
        check(partial.rowState === 'taken' && partial.live === 'taken' && partial.saved === 'taken',
          'SMITH-UI-REWARD-PARTIAL-CHECKPOINT', `a partially collected row persists its Taken state with the run mutation (${JSON.stringify(partial)})`);

        await cdp.send('Page.navigate', {
          url: `http://127.0.0.1:${served.port}/?shot=reward&shotReward=empty`,
        }, sessionId);
        await until(`!!document.querySelector('#reward-continue')`, 'empty reward pose');
        check(await evaluate(`!document.querySelector('.reward-kind[data-kind="smithingStone"]') && document.querySelectorAll('.reward-kind').length===0`),
          'SMITH-UI-REWARD-SHOT-EMPTY', 'empty reward shot remains empty and does not cross the elite faucet');
        check((errors.get(sessionId) || []).length === 0,
          'SMITH-UI-SHOT-DOORS-RUNTIME', 'co-op Shrine and full/empty reward shot doors completed without an uncaught runtime exception');
      }
      await cdp.send('Target.closeTarget', { targetId });
    }

    console.log('\n  Evidence:');
    for (const receipt of receipts) {
      console.log(`    ${receipt.path} | ${receipt.width}x${receipt.height} | ${receipt.bytes} bytes | SHA256 ${receipt.sha256}`);
    }
    console.log('  Boundary: source Shrine and post-Smith Armoury DOM at 1200x730 and 390x844, plus desktop co-op Shrine and reward shot reach doors; no built bundle, persistent browser storage, networked co-op host, or human aesthetic approval was checked.');
    if (failures) console.log(`armament-smithing-ui: ${checks - failures} passed, ${failures} failed`);
    else console.log(`armament-smithing-ui: OK — ${checks} checks passed`);
    return failures ? 1 : 0;
  } finally {
    try { cdp?.close(); } catch { /* best effort */ }
    try { await launched?.close(); } catch (error) { console.error(`browser cleanup warning: ${error.message}`); }
    await new Promise((done) => served.server.close(done));
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`armament-smithing-ui: HARNESS COULD NOT RUN - ${error?.stack || error}`);
  process.exitCode = 2;
}
