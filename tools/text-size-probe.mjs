// tools/text-size-probe.mjs — how big is the text the player reads, and how big are the things they tap, in a real browser.
//
// Boots the seeded combat fight, the reward screen and the rest screen (`?shot=combat&shotSeed=4`, `?shot=reward`,
// `?shot=rest`) at 1280x800 and at 390x844 (touch), and reads the EFFECTIVE rendered size of every visible text element:
// the computed font size times every ancestor `zoom` (body `--ui-zoom` is 1.2 on desktop and 0.9 on the phone), and for
// SVG text the size in user units times the SVG's rendered scale. Only an element's own text nodes count; elements that
// are not painted (display none, hidden, transparent, off screen, zero size) do not.
//
//   MEASURE <viewport> <screen> minText=<px> (<selector>)           the smallest visible text on the screen
//   MEASURE <viewport> <screen> cardEffect= cardName= cardType= cardCost=   a hand card's (reward screen: its offered cards')
//   MEASURE <viewport> combat playerHp=<px> enemyIntent=<px> largestOtherNumber=<px> (<selector>) numberSizes=<count>
//   MEASURE 390x844 <screen> minTapTarget=<px> (<selector>)         the smallest interactive control, in either dimension
//
// It exits 1 when a value is outside its budget (BUDGET below), 2 when the harness could not run. No setting is changed and
// no animation is forced.
//
//   node tools/text-size-probe.mjs [--viewport 1280x800|390x844] [--screen combat|reward|rest] [--dump] [--budgets none]
//   node tools/verdict.mjs -- node tools/text-size-probe.mjs

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const SCREENS = { combat: '?shot=combat&shotSeed=4', reward: '?shot=reward', rest: '?shot=rest' };
const VIEWPORTS = ['1280x800', '390x844'];
// Budgets: `min` values must be at least the number, `max` values at most. Today's values until the targets are set.
const BUDGET = {
  '1280x800 combat minText': { min: 4.63 },
  '1280x800 combat cardEffect': { min: 11.06 },
  '1280x800 combat cardName': { min: 11.76 },
  '1280x800 combat cardType': { min: 8.96 },
  '1280x800 combat cardCost': { min: 13.67 },
  '1280x800 combat playerHp': { min: 15.6 },
  '1280x800 combat largestOtherNumber': { max: 16.27 },
  '1280x800 combat numberSizes': { max: 11 },
  '1280x800 combat enemyIntent': { min: 14.4 },
  '1280x800 reward minText': { min: 5.92 },
  '1280x800 reward cardEffect': { min: 9.77 },
  '1280x800 reward cardName': { min: 10.39 },
  '1280x800 reward cardType': { min: 7.97 },
  '1280x800 reward cardCost': { min: 14.23 },
  '1280x800 rest minText': { min: 12 },
  '390x844 combat minText': { min: 4.8 },
  '390x844 combat cardEffect': { min: 9.3 },
  '390x844 combat cardName': { min: 9.89 },
  '390x844 combat cardType': { min: 7.56 },
  '390x844 combat cardCost': { min: 11.5 },
  '390x844 combat playerHp': { min: 9.36 },
  '390x844 combat minTapTarget': { min: 25.2 },
  '390x844 combat largestOtherNumber': { max: 14.92 },
  '390x844 combat numberSizes': { max: 9 },
  '390x844 combat enemyIntent': { min: 17.6 },
  '390x844 reward minText': { min: 7.11 },
  '390x844 reward cardEffect': { min: 11.78 },
  '390x844 reward cardName': { min: 12.53 },
  '390x844 reward cardType': { min: 9.58 },
  '390x844 reward cardCost': { min: 17.16 },
  '390x844 reward minTapTarget': { min: 25.2 },
  '390x844 rest minText': { min: 12 },
  '390x844 rest minTapTarget': { min: 25.2 },
};
const args = process.argv.slice(2);
const argOf = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`)); else res(msg.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { const timer = setTimeout(() => { pending.delete(id); rej(new Error(`no answer to ${method}`)); }, 90000); pending.set(id, { res: (v) => { clearTimeout(timer); res(v); }, rej: (e) => { clearTimeout(timer); rej(e); } }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}

// Runs in the page: every visible text run with its effective px, and every interactive control with its box.
const PAGE_SCAN = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const pathOf = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 3; n = n.parentElement) {
      const cls = typeof n.className === 'string' ? n.className : n.className?.baseVal || '';
      const c = cls.trim().split(/\\s+/).filter(Boolean).slice(0, 2).join('.');
      parts.unshift(n.tagName.toLowerCase() + (c ? '.' + c : ''));
      if (n.id) { parts[0] = '#' + n.id; break; }
    }
    return parts.join(' > ');
  };
  const chain = (el) => { const out = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) out.push(n); return out; };
  const painted = (el) => {
    let opacity = 1;
    for (const n of chain(el)) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      opacity *= parseFloat(cs.opacity);
    }
    return opacity > 0.05;
  };
  // CSS zoom and any transform scale on the element or an ancestor (a fanned hand card is drawn at one size and scaled to its slot).
  const scaleOf = (n) => {
    const cs = getComputedStyle(n);
    let k = parseFloat(cs.zoom) || 1;
    if (cs.transform && cs.transform !== 'none') { const m = new DOMMatrixReadOnly(cs.transform); k *= Math.hypot(m.a, m.b) || 1; }
    if (cs.scale && cs.scale !== 'none') k *= parseFloat(cs.scale.split(' ')[0]) || 1;
    return k;
  };
  const zoomOf = (el) => chain(el).reduce((z, n) => z * scaleOf(n), 1);
  const items = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.nodeValue.replace(/\\s+/g, ' ').trim();
    if (!text) continue;
    const el = t.parentElement;
    if (!el || el.closest('script,style,template,noscript,[hidden],.sr-only')) continue;
    const range = document.createRange(); range.selectNodeContents(t);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
    if (!painted(el)) continue;
    { const top = document.elementFromPoint(Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), Math.min(vh - 1, Math.max(0, r.top + r.height / 2))); if (top && top.closest('.modal-veil') && !el.closest('.modal-veil')) continue; }
    const fs = parseFloat(getComputedStyle(el).fontSize);
    let px;
    const svg = el.closest('svg');
    if (svg && el !== svg && el.namespaceURI === 'http://www.w3.org/2000/svg') {
      const sr = svg.getBoundingClientRect(), vb = svg.viewBox?.baseVal;
      const scale = vb && vb.width ? Math.min(sr.width / vb.width, sr.height / vb.height || Infinity) : zoomOf(svg);
      px = fs * scale;
    } else px = fs * zoomOf(el);
    if (!(px > 0)) continue;
    items.push({ text: text.slice(0, 40), px: Math.round(px * 100) / 100, sel: pathOf(el), cls: (typeof el.className === 'string' ? el.className : el.className?.baseVal || ''), isNumber: /^[+\\-−×x]?\\d+([.,]\\d+)?(\\s*\\/\\s*\\d+)?%?$/.test(text),
      card: !!el.closest('.card,.illustrated-card-face,[data-card-layout-id]'), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], binding: el.closest('[data-card-binding]')?.dataset.cardBinding || '', hand: !!el.closest('#combat-hand'), playerField: !!el.closest('article.combatant.player'), intent: !!el.closest('.intent-action-value,strong.intent-action-value'), typeName: el.classList.contains('card-type-name'), zoom: zoomOf(el) });
  }
  const taps = [];
  const interactive = 'button,a[href],[role=button],[role=tab],[role=switch],[role=checkbox],[role=menuitem],input,select,summary,label:has(input),#combat-hand .card,.relics .as-pip,.flasks .as-pip';
  for (const el of document.querySelectorAll(interactive)) {
    if (el.matches('input') && el.closest('label')) continue;
    if (el.closest('[inert],[hidden]') || !painted(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    taps.push({ sel: pathOf(el), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, text: (el.textContent || '').trim().slice(0, 24), disabled: !!el.disabled });
  }
  return { items, taps, vw, vh };
})()`;

async function main() {
  const browserPath = argOf('--browser', null) || BROWSERS.find((p) => existsSync(p));
  if (!browserPath) { console.error('text-size-probe: no Chrome/Chromium found; pass --browser PATH or set $CHROME'); process.exit(2); }
  const hosted = await serve({ root: ROOT, port: Number(argOf('--port', 0)), open: false, quiet: true });
  const base = `http://localhost:${hosted.port}/index.html`;
  const { wsUrl, close: dropBrowser } = await launchBrowser({ prefix: 'textsize-', browser: browserPath, timeoutMs: 20000, args: ['--disable-dev-shm-usage'] });
  const cdp = connectCdp(wsUrl);
  await cdp.ready;
  const viewports = argOf('--viewport', '') ? [argOf('--viewport')] : VIEWPORTS;
  const screens = argOf('--screen', '') ? [argOf('--screen')] : Object.keys(SCREENS);
  const scans = [];
  try {
    for (const vp of viewports) for (const screen of screens) {
      const [W, H] = vp.split('x').map(Number), mobile = W < 600;
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      try {
        const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
        await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile }, S);
        if (mobile) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true }, S);
        const ev = async (expression) => {
          const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
          if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
          return r.result.value;
        };
        await cdp.send('Page.navigate', { url: base + SCREENS[screen] }, S);
        const ready = screen === 'combat' ? `!!window.__combat && !!document.querySelector('.end-turn') && document.querySelectorAll('.hand .card').length > 0`
          : screen === 'reward' ? `document.querySelectorAll('.card').length > 0` : `!!document.querySelector('.screen, .rest')`;
        const t0 = Date.now();
        for (;;) { if (await ev(ready).catch(() => false)) break; if (Date.now() - t0 > 90000) throw new Error(`timeout: ${screen} at ${vp}`); await wait(100); }
        await wait(2500);
        scans.push({ vp, screen, ...(await ev(PAGE_SCAN)) });
      } finally { await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); }
    }
  } finally { cdp.close(); await dropBrowser(); hosted.server.close(); }

  if (args.includes('--dump')) {
    for (const s of scans) { console.log(`== ${s.vp} ${s.screen}`); for (const i of [...s.items].sort((a, b) => a.px - b.px)) console.log(`${String(i.px).padStart(6)} ${i.isNumber ? 'N' : ' '} ${i.card ? 'C' : ' '} ${JSON.stringify(i.text)} ${i.sel} [${i.box}] z=${i.zoom}`); if (s.vp !== '1280x800') for (const t of s.taps.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h))) console.log(`tap ${t.w}x${t.h} ${t.sel} ${JSON.stringify(t.text)}`); }
  }

  const fmt = (n) => (Math.round(n * 100) / 100).toString();
  const checks = [];
  const record = (name, value, ok) => checks.push({ name, value, ok });
  for (const s of scans) {
    const tag = `${s.vp} ${s.screen}`;
    const mins = (pick) => { const xs = s.items.filter(pick); return xs.length ? xs.reduce((a, b) => (b.px < a.px ? b : a)) : null; };
    const maxes = (pick) => { const xs = s.items.filter(pick); return xs.length ? xs.reduce((a, b) => (b.px > a.px ? b : a)) : null; };
    const faces = (i) => i.card && (s.screen === 'combat' ? i.hand : true);
    const parts = [];
    const lowest = mins(() => true);
    parts.push(`minText=${fmt(lowest.px)} (${lowest.sel})`);
    const put = (label, item) => parts.push(`${label}=${item ? fmt(item.px) : 'none'}`);
    const eff = mins((i) => faces(i) && i.binding === 'rules'), nm = mins((i) => faces(i) && i.binding === 'name'),
      ty = mins((i) => faces(i) && i.typeName), co = mins((i) => faces(i) && (i.binding === 'stamina' || i.binding === 'mana') && i.isNumber);
    if (s.screen !== 'rest') { put('cardEffect', eff); put('cardName', nm); put('cardType', ty); put('cardCost', co); }
    record(`${tag} minText`, lowest.px, null);
    for (const [k, it] of [['cardEffect', eff], ['cardName', nm], ['cardType', ty], ['cardCost', co]]) if (s.screen !== 'rest') record(`${tag} ${k}`, it ? it.px : 0, null);
    if (s.screen === 'combat') {
      const hp = maxes((i) => i.playerField && i.isNumber), intent = maxes((i) => i.intent && i.isNumber);
      put('playerHp', hp); put('enemyIntent', intent);
      const others = s.items.filter((i) => i.isNumber && i !== hp && i !== intent);
      const big = others.reduce((a, b) => (!a || b.px > a.px ? b : a), null);
      parts.push(`largestOtherNumber=${big ? fmt(big.px) : 'none'} (${big ? big.sel : '-'})`);
      parts.push(`numberSizes=${new Set(s.items.filter((i) => i.isNumber).map((i) => Math.round(i.px * 10) / 10)).size}`);
      record(`${tag} playerHp`, hp ? hp.px : 0, null); record(`${tag} enemyIntent`, intent ? intent.px : 0, null);
      record(`${tag} largestOtherNumber`, big ? big.px : 0, null);
      record(`${tag} numberSizes`, new Set(s.items.filter((i) => i.isNumber).map((i) => Math.round(i.px * 10) / 10)).size, null);
    }
    if (s.vp === '390x844') {
      const t = s.taps.reduce((a, b) => (!a || Math.min(b.w, b.h) < Math.min(a.w, a.h) ? b : a), null);
      parts.push(`minTapTarget=${t ? fmt(Math.min(t.w, t.h)) : 'none'} (${t ? t.sel : '-'})`);
      record(`${tag} minTapTarget`, t ? Math.min(t.w, t.h) : 0, null);
    }
    console.log(`MEASURE ${tag} ${parts.join(' ')}`);
  }
  let red = 0;
  const useBudget = argOf('--budgets', '') !== 'none';
  for (const c of checks) {
    const key = c.name.replace(/^\S+ \S+ /, '');
    const b = BUDGET[c.name] || BUDGET[key];
    if (!useBudget || !b) continue;
    const bad = (b.min !== undefined && c.value < b.min) || (b.max !== undefined && c.value > b.max);
    if (bad) { console.log(`FAIL ${c.name}: ${fmt(c.value)} outside ${b.min !== undefined ? `min ${b.min}` : `max ${b.max}`}`); red += 1; }
  }
  console.log(red ? `text-size-probe: ${red} check(s) RED` : `text-size-probe: OK — ${checks.length} checks passed.`);
  process.exit(red ? 1 : 0);
}
main().catch((error) => { console.error(`text-size-probe: ${error.stack || error.message}`); process.exit(2); });
