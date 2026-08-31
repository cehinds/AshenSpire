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
      const openSelected = async (stones) => {
        errors.set(sessionId, []);
        await cdp.send('Page.navigate', {
          url: `http://127.0.0.1:${served.port}/?shot=rest&shotSmithingStones=${stones}`,
        }, sessionId);
        await until(`!!document.querySelector('#smith-opt') && document.querySelector('#smith-opt').getClientRects().length>0`, 'Shrine Smith option');
        await evaluate('document.fonts && document.fonts.ready');
        await click('#smith-opt');
        await until(`!!document.querySelector('.smith-upgrade-modal')`, 'Smith modal');
        await click('.smith-candidate-card[data-armament-id="straightSword"]');
        await until(`document.querySelector('.smith-preview-card')?.textContent.includes('Straight Sword')`, 'selected Straight Sword preview');
        await until(`[...document.querySelectorAll('.smith-weapon-art img')].every((img)=>img.complete&&img.naturalWidth>0)`, 'armament card art');
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
          return {name:node.dataset.armamentId||node.className,...r,centreHit:!!(hit&&(hit===node||node.contains(hit)))};
        });
        const horizontal=[modal,document.querySelector('.smith-modal-head'),document.querySelector('.smith-modal-body'),document.querySelector('.smith-candidate-region'),document.querySelector('.smith-preview-region'),document.querySelector('.smith-modal-footer')].filter(Boolean).map((node)=>({name:node.className,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth}));
        return {
          text:(preview?.textContent||'').replace(/\\s+/g,' ').trim(),
          count:(document.querySelector('[data-smith-count]')?.textContent||'').replace(/\\s+/g,' ').trim(),
          candidates:[...document.querySelectorAll('.smith-weapon-name')].map((node)=>node.textContent.trim()),
          weaponCards:[...document.querySelectorAll('.smith-weapon-card')].map((node)=>{
            const art=node.querySelector('.smith-weapon-art'), image=art?.querySelector('img');
            const cardRect=rect(node), artRect=art?rect(art):null;
            return {
              name:node.querySelector('.smith-weapon-name')?.textContent.trim()||'',
              count:node.querySelector('.smith-weapon-count')?.textContent.trim()||'',
              countLabel:node.querySelector('.smith-weapon-count')?.getAttribute('aria-label')||'',
              type:node.querySelector('.smith-weapon-type')?.textContent.trim()||'',
              tags:[...node.querySelectorAll('.smith-weapon-tags em')].map((tag)=>tag.textContent.trim()),
              imageLoaded:!!(image?.complete&&image.naturalWidth>0),
              artShare:artRect?artRect.height/cardRect.height:0,
              borrowedCombatType:!!node.querySelector('.ctype,.ctext'),
            };
          }),
          confirm:{text:confirm?.textContent?.trim()||'',disabled:!!confirm?.disabled,aria:confirm?.getAttribute('aria-disabled')},
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
      check(zero.count === '0 Smithing Stones · 2 eligible'
          && zero.candidates.join('|') === 'Straight Sword|Round Shield',
        `SMITH-UI-${upper}-ZERO-PICKER`, `zero-purse modal exposes two distinct owned armament choices (${JSON.stringify({ count: zero.count, candidates: zero.candidates })})`);
      check(zero.weaponCards.length === 2
          && zero.weaponCards.every((card) => card.count === '1' && card.countLabel === '1 in inventory'
            && card.type === 'WEAPON' && card.tags.length >= 2 && card.imageLoaded
            && card.artShare >= 0.45 && !card.borrowedCombatType),
        `SMITH-UI-${upper}-WEAPON-CARD-ANATOMY`, `candidate cards use owned weapon art/count/type/tags with a dominant image box (${JSON.stringify(zero.weaponCards)})`);
      check(zero.text.includes('Cost 1') && zero.text.includes('Purse 0')
          && zero.text.includes('4× Slashing Strike') && zero.text.includes('Damage: 7 → 10')
          && zero.text.includes('1× Weapon Technique') && zero.text.includes('Block: 3 → 5')
          && zero.text.includes('Short 1 Smithing Stone'),
        `SMITH-UI-${upper}-ZERO-DELTAS`, `selected zero-purse preview names cost, purse, shortfall, and both real grouped deltas (${JSON.stringify(zero.text)})`);
      check(zero.confirm.disabled && zero.confirm.aria === 'true' && zero.confirm.text === 'Need 1 more Stone',
        `SMITH-UI-${upper}-ZERO-CONFIRM`, 'zero-purse Confirm is visibly and semantically disabled with the exact shortfall');
      check(zero.documentOverflowX <= 0 && zero.modal?.left >= -0.5 && zero.modal?.top >= -0.5
          && zero.modal?.right <= shape.width + 0.5 && zero.modal?.bottom <= shape.height + 0.5
          && zero.horizontal.every((row) => row.scrollWidth <= row.clientWidth + 1),
        `SMITH-UI-${upper}-ZERO-FIT`, 'modal and regions stay on-glass with no horizontal overflow');
      check(zero.targets.length === 4
          && zero.targets.every((target) => target.width >= 44 && target.height >= 44 && target.centreHit),
        `SMITH-UI-${upper}-ZERO-TARGETS`, 'two armaments, Back, and Confirm each meet 44px and centre hit-testing');
      await capture('zero');
      if (shape.mobile) {
        await evaluate('document.querySelector(".smith-preview-region").scrollTop=document.querySelector(".smith-preview-region").scrollHeight');
        await wait(100);
        await capture('zero-deltas');
      }

      await openSelected(1);
      const one = await reading();
      check(one.count === '1 Smithing Stone · 2 eligible'
          && one.text.includes('Tier 0 → 1') && one.text.includes('Cost 1') && one.text.includes('Purse 1')
          && one.text.includes('4× Slashing Strike') && one.text.includes('Damage: 7 → 10')
          && one.text.includes('1× Weapon Technique') && one.text.includes('Block: 3 → 5'),
        `SMITH-UI-${upper}-ONE-DELTAS`, `one-purse selected review shows tier, cost, purse, and every real grouped delta (${JSON.stringify(one.text)})`);
      check(!one.confirm.disabled && one.confirm.aria === 'false'
          && one.confirm.text === 'Spend 1 · Smith Straight Sword',
        `SMITH-UI-${upper}-ONE-CONFIRM`, 'affordable Confirm names the exact spend and armament');
      check(one.documentOverflowX <= 0 && one.modal?.left >= -0.5 && one.modal?.top >= -0.5
          && one.modal?.right <= shape.width + 0.5 && one.modal?.bottom <= shape.height + 0.5
          && one.horizontal.every((row) => row.scrollWidth <= row.clientWidth + 1),
        `SMITH-UI-${upper}-ONE-FIT`, 'affordable review stays on-glass with no horizontal overflow');
      check(one.targets.length === 4
          && one.targets.every((target) => target.width >= 44 && target.height >= 44 && target.centreHit),
        `SMITH-UI-${upper}-ONE-TARGETS`, 'affordable modal preserves four 44px centre-hit-testable controls');
      await capture('one');
      if (shape.mobile) {
        await evaluate('document.querySelector(".smith-preview-region").scrollTop=document.querySelector(".smith-preview-region").scrollHeight');
        await wait(100);
        await capture('one-deltas');
      }

      await click('.smith-confirm');
      await until(`!document.querySelector('.smith-upgrade-modal') && !!document.querySelector('.mapscreen')`, 'post-confirm map transition');
      check(await evaluate(`!document.querySelector('.smith-upgrade-modal') && !!document.querySelector('.mapscreen')`),
        `SMITH-UI-${upper}-POST-CONFIRM`, 'Confirm leaves the Shrine for the map');

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
        check(coopDoor.text === 'Smith an armament · 1 Stone' && coopDoor.disabled === false,
          'SMITH-UI-COOP-SHOT-DOOR', `co-op Shrine shot exposes the real one-Stone host plan (${JSON.stringify(coopDoor)})`);
        await click('#coop-smith');
        await until(`!!document.querySelector('.smith-upgrade-modal')`, 'co-op Smith modal');
        await click('.smith-candidate-card[data-armament-id="straightSword"]');
        const coopModal = await evaluate(`(() => ({
          count:(document.querySelector('[data-smith-count]')?.textContent||'').replace(/\\s+/g,' ').trim(),
          text:(document.querySelector('.smith-preview-card')?.textContent||'').replace(/\\s+/g,' ').trim(),
        }))()`);
        check(coopModal.count === '1 Smithing Stone · 2 eligible'
            && coopModal.text.includes('Damage: 7 → 10')
            && coopModal.text.includes('Block: 3 → 5'),
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
