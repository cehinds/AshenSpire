#!/usr/bin/env node
// Browser gate for the reward-card status stack: NEW sits above the card and
// the selected Information control sits above NEW without changing card flow.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const output = resolve(process.env.REWARD_BADGE_QA_OUT || resolve(process.env.TEMP || '.', 'reward-new-badge-qa'));
mkdirSync(output, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await launchBrowser({ prefix: 'reward-badge-', browser: process.env.CHROME });
const endpoint = new URL(browser.wsUrl);
const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json();
const pageTarget = targets.find(target => target.type === 'page');
if (!pageTarget) throw new Error('reward badge QA: Chrome opened no page target');
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => { ws.onopen = resolveOpen; ws.onerror = rejectOpen; });
let sequence = 0;
const pending = new Map();
const runtimeErrors = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolveCall, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve: resolveCall, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const waitFor = async (expression, label) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise(resolveWait => setTimeout(resolveWait, 50));
  }
  throw new Error(`reward badge QA: timed out waiting for ${label}`);
};
const check = (truthy, label, detail = '') => {
  if (!truthy) throw new Error(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`PASS ${label}`);
};
const screenshot = async name => {
  const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(output, `${name}.png`), Buffer.from(png.data, 'base64'));
};

await send('Page.enable');
await send('Runtime.enable');
try {
  for (const shape of [
    { name: 'desktop', width: 1200, height: 850, scale: 1 },
    { name: 'phone', width: 390, height: 844, scale: 2 },
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: shape.width, height: shape.height, deviceScaleFactor: shape.scale, mobile: shape.name === 'phone',
    });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.server.address().port}/index.html?shot=reward` });
    await waitFor(`!!document.querySelector('.reward-kind[data-kind="card"]')`, `${shape.name} reward menu`);
    check(await evaluate(`document.body.textContent.trim().length > 0`), `${shape.name} route is nonblank`);
    await evaluate(`document.querySelector('.reward-kind[data-kind="card"]').click()`);
    await waitFor(`document.querySelectorAll('.reward-row .card[data-new="1"]').length > 0`, `${shape.name} unseen cards`);
    const before = await evaluate(`(() => [...document.querySelectorAll('.reward-row .card[data-new="1"]')].map(card => {
      const c=card.getBoundingClientRect(), b=card.querySelector('.card-badge-new')?.getBoundingClientRect();
      return {card:card.dataset.cardId, above:!!b&&b.bottom<c.top, centered:!!b&&b.left>=c.left&&b.right<=c.right, gap:b?c.top-b.bottom:null};
    }))()`);
    check(before.every(item => item.above && item.centered && item.gap >= 4), `${shape.name} NEW markers sit above their cards`, JSON.stringify(before));
    await screenshot(`${shape.name}-new-above-card`);
    await evaluate(`document.querySelector('.reward-row .card[data-new="1"]').click()`);
    await waitFor(`getComputedStyle(document.querySelector('.reward-selected .card-info-button')).visibility === 'visible'`, `${shape.name} Information reveal`);
    const selected = await evaluate(`(() => { const card=document.querySelector('.reward-selected'), badge=card.querySelector('.card-badge-new'), info=card.querySelector('.card-info-button');
      const c=card.getBoundingClientRect(), b=badge.getBoundingClientRect(), i=info.getBoundingClientRect();
      return {order:i.bottom<b.top&&b.bottom<c.top, gaps:[b.top-i.bottom,c.top-b.bottom], visible:getComputedStyle(info).visibility}; })()`);
    check(selected.order && selected.gaps.every(gap => gap >= 4), `${shape.name} selected stack is Information, NEW, card`, JSON.stringify(selected));
    await screenshot(`${shape.name}-selected-information-new-card`);
  }
  check(runtimeErrors.length === 0, 'reward route has no runtime exceptions', runtimeErrors.join('; '));
  console.log(`reward-new-badge-qa: OK — screenshots in ${output}`);
} finally {
  ws.close();
  server.server.close();
  await browser.close();
}
