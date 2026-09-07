#!/usr/bin/env node
// #045/#046 current-build acceptance: real rendered title/combat geometry and
// pointer/touch/keyboard timing against the single shipped tooltip surface.
//
// 2026-09-05 — Constantine reversed part of that acceptance: "no tool tip for
// Status effects and player combatants". The one-surface rule stood on the
// grounds that a second tooltip repeats what the frame's glance already says,
// and that is still true of the intent and the HP/Poise bars — they stay
// silent. It was never true of a status pip: the glance NAMES the effect
// ("Effects Crimson Blight") and never explains it, so the pip now answers for
// itself. The other half of his sentence was not a suppression at all but a
// hole: the glance had only ever been wired to enemies, so the player's frame
// answered nothing. Both sides now open the same surface, which is why its
// variant is `combatant-context` and no longer `enemy-context`.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const STANDALONE = process.argv.includes('--build');
const OUT = resolve(ROOT, 'outputs', STANDALONE ? 't0-ui-authoritative-build' : 't0-ui-authoritative');
const BROWSER = resolveBrowser([
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]);
const wait = (ms) => new Promise((pass) => setTimeout(pass, ms));
const shapes = [
  { name: 'desktop', width: 1200, height: 730, mobile: false, input: 'mouse' },
  { name: 'mobile', width: 390, height: 844, mobile: true, input: 'touch' },
];

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const packet = JSON.parse(event.data);
    const waiter = pending.get(packet.id);
    if (!waiter) return;
    pending.delete(packet.id);
    packet.error ? waiter.no(new Error(packet.error.message)) : waiter.ok(packet.result);
  });
  return {
    ready: new Promise((ok, no) => { socket.addEventListener('open', ok); socket.addEventListener('error', no); }),
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((ok, no) => {
        pending.set(id, { ok, no });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { socket.close(); },
  };
}

let checks = 0;
let failures = 0;
const failedAssertions = [];
const receipts = [];
function check(held, code, detail = '') {
  checks += 1;
  if (!held) { failures += 1; failedAssertions.push({ code, detail }); }
  console.log(`${held ? 'PASS' : 'RED '} ${code}${detail ? ` — ${detail}` : ''}`);
}

function boxReader() {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const overlap = (a, b) => !!a && !!b && a.left < b.right - .25 && a.right > b.left + .25 && a.top < b.bottom - .25 && a.bottom > b.top + .25;
  const tip = document.querySelector('#tooltip');
  const enemy = document.querySelector('.combatant.enemy:not(.dead)');
  const intent = enemy?.querySelector('.intent');
  const hud = document.querySelector('.topbar.combat-hud');
  const card = enemy?.querySelector('.combatant-card');
  const subject = card ? (() => {
    const boxes = [...card.children].map(rect).filter((box) => box && box.width > 0 && box.height > 0);
    if (!boxes.length) return rect(card);
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  })() : null;
  const title = document.querySelector('.title-menu');
  const wordmark = document.querySelector('[data-component="title-wordmark"]');
  const lines = [...(tip?.querySelectorAll('.tt-title, .tt-combatant-line') || [])].map((el) => el.textContent.replace(/\s+/g, ' ').trim());
  const tipBox = tip && getComputedStyle(tip).display !== 'none' ? rect(tip) : null;
  const hudStyle = hud ? getComputedStyle(hud) : null;
  const hudTop = hud?.querySelector('.hud-top');
  const titleBox = rect(title);
  const wordmarkRange = wordmark ? (() => { const range=new Range(); range.selectNodeContents(wordmark); return rect(range); })() : null;
  const centerDelta = tipBox && subject
    ? ((tipBox.left + tipBox.right) - (subject.left + subject.right)) / 2
    : null;
  const edgeGaps = tipBox && subject
    ? [subject.left - tipBox.right, tipBox.left - subject.right, subject.top - tipBox.bottom, tipBox.top - subject.bottom]
      .filter((gap) => gap >= -.5)
    : [];
  return {
    viewport: { width: innerWidth, height: innerHeight },
    title: titleBox && { ...titleBox, centerDelta: ((titleBox.left + titleBox.right) / 2) - (innerWidth / 2),
      wordmark: wordmarkRange && { ...wordmarkRange, centerDelta: ((wordmarkRange.left + wordmarkRange.right) / 2) - (innerWidth / 2) } },
    tooltip: {
      count: document.querySelectorAll('#tooltip').length,
      visible: !!tipBox,
      role: tip?.getAttribute('role') || null,
      ariaHidden: tip?.getAttribute('aria-hidden') || null,
      placement: tip?.dataset.tooltipPlacement || null,
      variant: tip?.dataset.tooltipVariant || null,
      lines,
      box: tipBox,
    },
    enemy: { selected: enemy?.getAttribute('aria-pressed') || null, box: rect(enemy), card: rect(card), subject, intent: rect(intent) },
    hud: hud ? {
      box: rect(hud), mode: hud.dataset.hudMode || 'regular',
      paddingTop: Number.parseFloat(hudStyle.paddingTop), paddingBottom: Number.parseFloat(hudStyle.paddingBottom),
      topGap: Number.parseFloat(getComputedStyle(hudTop).gap),
      children: Object.fromEntries(['.hud-top','.hud-info-row','.hud-center','.hud-run-meta','.hud-identity','.hud-resource-row','.hud-bottom','.hud-control-grid','.hud-vitals-panel','.hud-potions']
        .map((selector) => [selector, rect(hud.querySelector(selector))])),
    } : null,
    geometry: {
      tipIntentOverlap: overlap(tipBox, rect(intent)),
      tipHudOverlap: overlap(tipBox, rect(hud)),
      onGlass: !tipBox || (tipBox.left >= -.5 && tipBox.top >= -.5 && tipBox.right <= innerWidth + .5 && tipBox.bottom <= innerHeight + .5),
      subjectCenterDelta: centerDelta,
      subjectEdgeGaps: edgeGaps,
      nearSubject: !tipBox || edgeGaps.some((gap) => gap <= 14),
    },
    redundantEnemyTooltips: enemy ? enemy.querySelectorAll('[data-tooltip], [aria-describedby="tooltip"]:not(.combatant.enemy)').length : -1,
  };
}

async function main() {
  if (!BROWSER) throw new Error('Chrome/Edge unavailable');
  mkdirSync(OUT, { recursive: true });
  const served = await serve({ root: ROOT, port: 8587, open: false });
  const appUrl = STANDALONE ? `${served.url}build/AshenSpire.html` : served.url;
  const browser = await launchBrowser({
    prefix: 'current-build-ui-repair-', browser: BROWSER, headless: '--headless=new',
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'], timeoutMs: 20000,
  });
  const cdp = connect(browser.wsUrl);
  await cdp.ready;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
      return result.result.value;
    };
    const until = async (expression, name, timeout = 15000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await evaluate(expression).catch(() => false)) return;
        await wait(60);
      }
      throw new Error(`timeout waiting for ${name}`);
    };
    const point = () => evaluate(`(() => { const e=document.querySelector('.combatant.enemy:not(.dead)'); const r=e?.getBoundingClientRect(); return r&&{x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    const move = (x, y) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' }, sessionId);
    const click = async (x, y) => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
    };
    const touch = async (x, y) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }, sessionId);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
    };
    const key = async (keyName, code, vk) => {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: vk }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk }, sessionId);
    };
    const read = () => evaluate(`(${boxReader.toString()})()`);
    const shot = async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId);
      const path = resolve(OUT, `${name}.png`);
      writeFileSync(path, Buffer.from(data, 'base64'));
      return path;
    };

    for (const shape of shapes) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: shape.mobile,
      }, sessionId);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: shape.mobile, maxTouchPoints: 1 }, sessionId);

      await cdp.send('Page.navigate', { url: `${appUrl}?shot=title` }, sessionId);
      await until(`!!document.querySelector('.title-menu')`, `${shape.name} title`);
      await wait(160);
      const titleState = await read();
      check(Math.abs(titleState.title?.centerDelta ?? 99) <= 1 && Math.abs(titleState.title?.wordmark?.centerDelta ?? 99) <= 1,
        `TITLE-CENTER-${shape.name.toUpperCase()}`, `stack ${(titleState.title?.centerDelta ?? 99).toFixed(2)}px; text ${(titleState.title?.wordmark?.centerDelta ?? 99).toFixed(2)}px`);
      receipts.push({ shape: shape.name, state: 'title', reading: titleState, screenshot: await shot(`${shape.name}-title-centered`) });

      const settings = encodeURIComponent(JSON.stringify({ reducedMotion: false }));
      await cdp.send('Page.navigate', { url: `${appUrl}?shot=combat&shotEnemyContext=status&shotSettings=${settings}` }, sessionId);
      await until(`document.querySelectorAll('.combatant.enemy:not(.dead)').length > 0 && document.querySelector('#tooltip')`, `${shape.name} combat`);
      await wait(180);
      const baseline = await read();
      check(!baseline.tooltip.visible && baseline.tooltip.role === 'tooltip' && baseline.tooltip.ariaHidden === 'true' && baseline.tooltip.count === 1,
        `TOOLTIP-SEMANTICS-${shape.name.toUpperCase()}`, JSON.stringify(baseline.tooltip));
      check(baseline.hud?.paddingTop <= 1.2 && baseline.hud?.paddingBottom <= 1.2 && baseline.hud?.topGap <= 1.2,
        `HUD-DENSITY-${shape.name.toUpperCase()}`, `${baseline.hud?.mode} p${baseline.hud?.paddingTop}/${baseline.hud?.paddingBottom} gap${baseline.hud?.topGap}`);
      // Per surface now, not blanket: `answers` is whether that surface is
      // allowed its own attached tooltip. `data-tip-attached` is the real
      // marker attachTooltip leaves — the older aria/data-tooltip pair alone
      // could not see an attached pip, so a reversal here would have read as a
      // pass.
      const surfaceOwnership = await evaluate(`(() => {
        const rows=[['.combatant.enemy .intent',false],['.combatant.enemy .meters .bar',false],['.combatant.player .meters .bar',false],['.combatant.enemy .status-icon',true]];
        return rows.map(([selector,answers]) => {
          const el=document.querySelector(selector);
          return {selector,answers,found:!!el,ownsTooltip:!!el?.matches('[data-tooltip],[aria-describedby="tooltip"],[data-tip-attached]')};
        });
      })()`);
      check(surfaceOwnership.every((entry) => entry.found && entry.ownsTooltip === entry.answers)
          && baseline.redundantEnemyTooltips === 0,
        `SECONDARY-TOOLTIP-SUPPRESSION-${shape.name.toUpperCase()}`, JSON.stringify(surfaceOwnership));
      if (!shape.mobile) {
        const suppressionBehavior = [];
        for (const [selector, expectedVariant] of [
          ['.combatant.enemy .intent', 'combatant-context'],
          ['.combatant.enemy .meters .bar', 'combatant-context'],
          // The player's frame answers the same glance the enemies do — it is
          // the one surface, not a second one, so his bars own no tooltip.
          ['.combatant.player .meters .bar', 'combatant-context'],
          // The pip's own reading: no variant, and its title is the effect.
          ['.combatant.enemy .status-icon', 'status'],
        ]) {
          const target = await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); const r=e?.getBoundingClientRect(); return r&&{x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
          await move(target.x, target.y); await wait(560);
          const hoverState = await read();
          suppressionBehavior.push({ selector, input: 'hover', count: hoverState.tooltip.count, visible: hoverState.tooltip.visible, variant: hoverState.tooltip.variant, title: hoverState.tooltip.lines[0] || null });
          await move(2, shape.height - 2); await wait(80);
          await evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('gpfocus',{bubbles:true}))`);
          await wait(560);
          const focusState = await read();
          suppressionBehavior.push({ selector, input: 'focus', count: focusState.tooltip.count, visible: focusState.tooltip.visible, variant: focusState.tooltip.variant, title: focusState.tooltip.lines[0] || null });
          await evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('gpblur',{bubbles:true}))`);
          await wait(80);
          const expected = (state) => state.count === 1 && state.visible && (expectedVariant === 'status'
            ? state.variant === null && /Blight/.test(state.lines[0] || '')
            : state.variant === expectedVariant);
          if (!expected(hoverState.tooltip) || !expected(focusState.tooltip)) break;
        }
        const trayEmpty = await evaluate(`!document.querySelector('.combatant-inspector-host')?.children.length`);
        check(suppressionBehavior.length === 8 && suppressionBehavior.every((state) => state.count === 1 && state.visible
            && (state.selector.includes('status-icon')
              ? state.variant === null && /Blight/.test(state.title || '')
              : state.variant === 'combatant-context'))
            && trayEmpty,
          'SECONDARY-TOOLTIP-BEHAVIOR-DESKTOP', JSON.stringify(suppressionBehavior));
        await cdp.send('Page.navigate', { url: `${appUrl}?shot=combat&shotEnemyContext=status&shotSettings=${settings}` }, sessionId);
        await until(`document.querySelectorAll('.combatant.enemy:not(.dead)').length > 0 && document.querySelector('#tooltip')`, 'desktop combat after suppression probes');
        await wait(120);
      }
      const expandedDelta = await evaluate(`(() => {
        const hud=document.querySelector('.combat > .topbar.combat-hud.shared-hud');
        const candidate=hud.getBoundingClientRect().height;
        const style=document.createElement('style');
        style.textContent='.combat > .topbar.combat-hud.shared-hud{padding-block:calc(4px / var(--ui-zoom,1)) !important}.combat > .topbar.combat-hud.shared-hud .hud-top{gap:calc(3px / var(--ui-zoom,1)) !important}:root[data-layout="narrow"] .combat > .topbar.combat-hud.shared-hud{padding-block:calc(4px / var(--ui-zoom,1)) !important}:root[data-layout="narrow"] .combat > .topbar.combat-hud.shared-hud .hud-top{gap:calc(3px / var(--ui-zoom,1)) !important}:root[data-layout="narrow"] .topbar.combat-hud.shared-hud .hud-info-row{line-height:normal !important}';
        document.head.appendChild(style); const prior=hud.getBoundingClientRect().height; style.remove();
        return {candidate,prior,reduction:prior-candidate,vh:(prior-candidate)/innerHeight*100};
      })()`);
      check(expandedDelta.vh >= 1 && expandedDelta.vh <= 5, `HUD-REDUCTION-${shape.name.toUpperCase()}`,
        `${expandedDelta.reduction.toFixed(2)}px / ${expandedDelta.vh.toFixed(2)}vh`);
      receipts.push({ shape: shape.name, state: 'combat', reading: baseline, screenshot: await shot(`${shape.name}-combat-hud`) });

      const p = await point();
      if (shape.input === 'mouse') await move(p.x, p.y); else await touch(p.x, p.y);
      await wait(220);
      const before = await read();
      check(!before.tooltip.visible, `DELAY-BEFORE-500-${shape.name.toUpperCase()}`, 'hidden at 220ms');
      receipts.push({ shape: shape.name, state: 'before-delay', reading: before, screenshot: await shot(`${shape.name}-tooltip-before-delay`) });
      await wait(360);
      const visible = await read();
      const expected = visible.tooltip.lines;
      check(visible.tooltip.visible && visible.tooltip.ariaHidden === 'false' && visible.tooltip.variant === 'combatant-context',
        `DELAY-AFTER-500-${shape.name.toUpperCase()}`, JSON.stringify(expected));
      check(expected.length === 4 && /^HP \d+\/\d+$/.test(expected[1] || '') && /^Poise \d+\/\d+$/.test(expected[2] || '')
          && expected[3] === 'Effects Crimson Blight' && !/Intent|Move set|Block|Damage/i.test(expected.join(' ')),
        `EXACT-CONTENT-${shape.name.toUpperCase()}`, expected.join(' | '));
      check(!visible.geometry.tipIntentOverlap && !visible.geometry.tipHudOverlap && visible.geometry.onGlass
          && visible.geometry.nearSubject && visible.tooltip.placement === 'above',
        `TOOLTIP-GEOMETRY-${shape.name.toUpperCase()}`, JSON.stringify(visible.geometry));
      receipts.push({ shape: shape.name, state: 'visible', reading: visible, screenshot: await shot(`${shape.name}-tooltip-visible`) });

      const edge = shape.mobile ? 'right' : 'left';
      await move(2, shape.height - 2);
      await wait(80);
      await evaluate(`(() => {
        const enemy=document.querySelector('.combatant.enemy:not(.dead)');
        enemy.style.transformOrigin='center';
        enemy.style.transform='scale(.78)';
        const card=enemy.querySelector('.combatant-card');
        const boxes=[...card.children].map((el)=>el.getBoundingClientRect()).filter((r)=>r.width>0&&r.height>0);
        const left=Math.min(...boxes.map((r)=>r.left)), right=Math.max(...boxes.map((r)=>r.right));
        const delta=${JSON.stringify(edge)}==='left' ? 6-left : innerWidth-6-right;
        enemy.style.transform='translateX('+delta+'px) scale(.78)';
        enemy.dispatchEvent(new Event('gpfocus',{bubbles:true}));
      })()`);
      await wait(560);
      const transformed = await read();
      check(transformed.tooltip.visible && transformed.geometry.onGlass && transformed.geometry.nearSubject
          && !transformed.geometry.tipIntentOverlap && !transformed.geometry.tipHudOverlap,
        `TOOLTIP-TRANSFORMED-${edge.toUpperCase()}-EDGE-${shape.name.toUpperCase()}`, JSON.stringify(transformed.geometry));
      receipts.push({ shape: shape.name, state: `transformed-${edge}-edge`, reading: transformed,
        screenshot: await shot(`${shape.name}-tooltip-transformed-${edge}-edge`) });
      await evaluate(`(() => {
        const enemy=document.querySelector('.combatant.enemy:not(.dead)');
        enemy.dispatchEvent(new Event('gpblur',{bubbles:true}));
        enemy.dispatchEvent(new Event('gpfocus',{bubbles:true}));
      })()`);
      await wait(560);
      const transformedRepeat = await read();
      const samePlacement = transformed.tooltip.box && transformedRepeat.tooltip.box
        && Math.abs(transformed.tooltip.box.left - transformedRepeat.tooltip.box.left) <= .5
        && Math.abs(transformed.tooltip.box.top - transformedRepeat.tooltip.box.top) <= .5;
      check(samePlacement && transformedRepeat.geometry.nearSubject,
        `TOOLTIP-TRANSFORMED-DETERMINISTIC-${shape.name.toUpperCase()}`, JSON.stringify(transformedRepeat.geometry));

      // Start from a clean state; explicit click/tap selection owns aria-pressed
      // immediately but shares the same 500ms cancellable reveal delay.
      await cdp.send('Page.navigate', { url: `${appUrl}?shot=combat&shotEnemyContext=status&shotSettings=${settings}` }, sessionId);
      await until(`document.querySelectorAll('.combatant.enemy:not(.dead)').length > 0 && document.querySelector('#tooltip')`, `${shape.name} selection combat`);
      await wait(120);
      const p2 = await point();
      if (shape.input === 'mouse') await click(p2.x, p2.y); else await touch(p2.x, p2.y);
      await wait(220);
      const selectedBefore = await read();
      check(selectedBefore.enemy.selected === 'true' && !selectedBefore.tooltip.visible,
        `SELECTION-BEFORE-500-${shape.name.toUpperCase()}`, `aria-pressed=${selectedBefore.enemy.selected}`);
      await wait(360);
      const selected = await read();
      check(selected.enemy.selected === 'true' && selected.tooltip.visible,
        `SELECTION-AFTER-500-${shape.name.toUpperCase()}`, `aria-pressed=${selected.enemy.selected}`);
      receipts.push({ shape: shape.name, state: 'selected', reading: selected, screenshot: await shot(`${shape.name}-tooltip-selected`) });

      await evaluate(`window.__renderCombatForShot()`);
      await wait(220);
      const rerenderBefore = await read();
      check(rerenderBefore.enemy.selected === 'true' && !rerenderBefore.tooltip.visible,
        `SELECTION-RERENDER-BEFORE-500-${shape.name.toUpperCase()}`, 'fresh node retains selection while delay restarts');
      await wait(360);
      const rerenderAfter = await read();
      check(rerenderAfter.enemy.selected === 'true' && rerenderAfter.tooltip.visible,
        `SELECTION-RERENDER-AFTER-500-${shape.name.toUpperCase()}`, 'fresh selected node restores contextual tooltip');

      await move(2, shape.height - 2);
      await wait(120);
      const selectedAfterLeave = await read();
      check(selectedAfterLeave.enemy.selected === 'true' && selectedAfterLeave.tooltip.visible,
        `SELECTION-OWNS-LEAVE-${shape.name.toUpperCase()}`, 'selection remains the contextual owner');

      await wait(5100);
      const faded = await read();
      check(!faded.tooltip.visible && faded.tooltip.ariaHidden === 'true', `AUTO-FADE-5000-${shape.name.toUpperCase()}`, 'hidden after configured lifetime');
      receipts.push({ shape: shape.name, state: 'faded', reading: faded, screenshot: await shot(`${shape.name}-tooltip-faded`) });

      // Exercise the production unified cursor rather than assigning DOM focus
      // from the harness. Escape clears the earlier pointer selection; the
      // first Arrow enters the cursor ring and subsequent directional moves
      // converge on the enemy. Space must then reach that role=button and use
      // the same configured selection delay as pointer/touch/Enter.
      await key('Escape', 'Escape', 27);
      let arrowSteps = 0;
      while (arrowSteps < 24 && !(await evaluate(`document.querySelector('.combatant.enemy:not(.dead)')?.classList.contains('gp-focus')`))) {
        const direction = await evaluate(`(() => {
          const target=document.querySelector('.combatant.enemy:not(.dead)');
          const current=document.querySelector('.gp-focus');
          if (!target || !current) return 'ArrowUp';
          const t=target.getBoundingClientRect(), c=current.getBoundingClientRect();
          const dx=(t.left+t.width/2)-(c.left+c.width/2);
          const dy=(t.top+t.height/2)-(c.top+c.height/2);
          return Math.abs(dy)>=Math.abs(dx) ? (dy<0?'ArrowUp':'ArrowDown') : (dx<0?'ArrowLeft':'ArrowRight');
        })()`);
        await key(direction, direction, { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 }[direction]);
        arrowSteps += 1;
      }
      check(await evaluate(`document.querySelector('.combatant.enemy:not(.dead)')?.classList.contains('gp-focus') === true`),
        `KEYBOARD-ARROW-REACH-${shape.name.toUpperCase()}`, `${arrowSteps} directional step(s)`);
      await key(' ', 'Space', 32);
      await wait(220);
      const keyboardBefore = await read();
      check(!keyboardBefore.tooltip.visible && keyboardBefore.enemy.selected === 'true', `KEYBOARD-SPACE-BEFORE-500-${shape.name.toUpperCase()}`);
      await wait(360);
      const keyboardAfter = await read();
      check(keyboardAfter.tooltip.visible, `KEYBOARD-SPACE-AFTER-500-${shape.name.toUpperCase()}`);

      const compactSettings = encodeURIComponent(JSON.stringify({ reducedMotion: false, runHudMode: 'compact' }));
      await cdp.send('Page.navigate', { url: `${appUrl}?shot=combat&shotEnemyContext=status&shotSettings=${compactSettings}` }, sessionId);
      await until(`document.querySelector('.topbar.combat-hud[data-hud-mode="compact"]')`, `${shape.name} compact HUD`);
      await wait(100);
      const compact = await read();
      const compactDelta = await evaluate(`(() => {
        const hud=document.querySelector('.combat > .topbar.combat-hud.shared-hud');
        const candidate=hud.getBoundingClientRect().height;
        const style=document.createElement('style');
        style.textContent='.combat > .topbar.combat-hud.shared-hud[data-hud-mode="compact"]{padding-block:calc(5px / var(--ui-zoom,1)) !important}.combat > .topbar.combat-hud.shared-hud[data-hud-mode="compact"] .hud-top{--compact-gap:calc(2px / var(--ui-zoom,1)) !important;column-gap:calc(6px / var(--ui-zoom,1)) !important;row-gap:calc(2px / var(--ui-zoom,1)) !important}:root[data-layout="narrow"] .combat > .topbar.combat-hud.shared-hud[data-hud-mode="compact"]{padding-block:calc(5px / var(--ui-zoom,1)) !important}:root[data-layout="narrow"] .combat > .topbar.combat-hud.shared-hud[data-hud-mode="compact"] .hud-top{--compact-gap:calc(2px / var(--ui-zoom,1)) !important;column-gap:calc(6px / var(--ui-zoom,1)) !important;row-gap:calc(2px / var(--ui-zoom,1)) !important}:root[data-layout="narrow"] .combat > .topbar.combat-hud.shared-hud[data-hud-mode="compact"] .hud-info-row{gap:calc(3px / var(--ui-zoom,1)) !important;line-height:normal !important}:root[data-layout="narrow"] .combat > .topbar.combat-hud.shared-hud[data-hud-mode="compact"] :is(.hud-run-meta,.hud-identity){line-height:normal !important}:root[data-layout="narrow"] .combat > .topbar.combat-hud.shared-hud[data-hud-mode="compact"] .hud-control-grid{padding:var(--compact-gap) !important}';
        document.head.appendChild(style); const prior=hud.getBoundingClientRect().height; style.remove();
        return {candidate,prior,reduction:prior-candidate,vh:(prior-candidate)/innerHeight*100};
      })()`);
      check(compact.hud?.mode === 'compact' && compact.hud.paddingTop <= 1.2 && compact.hud.paddingBottom <= 1.2,
        `HUD-COMPACT-DENSITY-${shape.name.toUpperCase()}`, JSON.stringify(compact.hud));
      check(compactDelta.vh >= 1 && compactDelta.vh <= 5, `HUD-COMPACT-REDUCTION-${shape.name.toUpperCase()}`,
        `${compactDelta.reduction.toFixed(2)}px / ${compactDelta.vh.toFixed(2)}vh`);
      receipts.push({ shape: shape.name, state: 'compact-hud', reading: compact, delta: compactDelta, screenshot: await shot(`${shape.name}-combat-hud-compact`) });
    }

    // A non-default UI zoom must cap long contextual copy in local coordinates,
    // never in pre-zoom viewport units.
    const zoomSettings = encodeURIComponent(JSON.stringify({ reducedMotion: false, uiScale: 'XL' }));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 }, sessionId);
    await cdp.send('Page.navigate', { url: `${appUrl}?shot=combat&shotEnemyContext=status&shotSettings=${zoomSettings}` }, sessionId);
    await until(`document.querySelector('.combatant.enemy:not(.dead)') && document.querySelector('#tooltip')`, 'zoomed tooltip');
    const zp = await point();
    await move(zp.x, zp.y); await wait(560);
    const zoomCap = await evaluate(`(() => {
      const tip=document.querySelector('#tooltip');
      tip.querySelector('.tt-title').textContent='Wandering Soldier with an intentionally very long contextual display name that must wrap safely';
      const r=tip.getBoundingClientRect();
      return {zoom:getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom').trim(),left:r.left,right:r.right,width:r.width,viewport:innerWidth,scrollWidth:tip.scrollWidth,clientWidth:tip.clientWidth};
    })()`);
    check(Number(zoomCap.zoom) > 1 && zoomCap.left >= -.5 && zoomCap.right <= zoomCap.viewport + .5
        && zoomCap.scrollWidth <= zoomCap.clientWidth + 1,
      'TOOLTIP-ZOOMED-LONG-CONTENT', JSON.stringify(zoomCap));

    // The real settings door activates reduced motion. Lifetime remains 5000ms,
    // but expiry has no 160ms visual fade tail.
    const reduced = encodeURIComponent(JSON.stringify({ reducedMotion: true }));
    await cdp.send('Page.navigate', { url: `${appUrl}?shot=combat&shotEnemyContext=status&shotSettings=${reduced}` }, sessionId);
    await until(`document.body.classList.contains('reduced-motion') && document.querySelector('.combatant.enemy:not(.dead)')`, 'reduced-motion combat');
    const rp = await point();
    await move(rp.x, rp.y);
    await wait(560);
    check((await read()).tooltip.visible, 'REDUCED-MOTION-SHOW', 'configured delay remains active');
    await wait(5005);
    const reducedExpired = await read();
    check(!reducedExpired.tooltip.visible && reducedExpired.tooltip.ariaHidden === 'true', 'REDUCED-MOTION-EXPIRY', 'hidden without fade tail');

    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
    const systemReduced = encodeURIComponent(JSON.stringify({ reducedMotion: false }));
    await cdp.send('Page.navigate', { url: `${appUrl}?shot=combat&shotEnemyContext=status&shotSettings=${systemReduced}` }, sessionId);
    await until(`!document.body.classList.contains('reduced-motion') && matchMedia('(prefers-reduced-motion: reduce)').matches && document.querySelector('.combatant.enemy:not(.dead)')`, 'system reduced-motion combat');
    const sp = await point(); await move(sp.x, sp.y); await wait(560); await wait(5005);
    const systemReducedExpired = await read();
    check(!systemReducedExpired.tooltip.visible && systemReducedExpired.tooltip.ariaHidden === 'true',
      'SYSTEM-REDUCED-MOTION-EXPIRY', 'matchMedia path hides without fade tail');
    await cdp.send('Emulation.setEmulatedMedia', { features: [] }, sessionId);

    await cdp.send('Target.closeTarget', { targetId });
  } finally {
    cdp.close();
    await browser.close();
    served.server.close();
  }
  writeFileSync(resolve(OUT, 'current-build-ui-repair.json'), JSON.stringify({ target: STANDALONE ? 'standalone-build' : 'source', checks, failures, failedAssertions, receipts }, null, 2));
  console.log(`current-build-ui-repair: ${checks - failures}/${checks} passed; screenshots ${receipts.length}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => { console.error(`current-build-ui-repair: ${error.stack || error.message}`); process.exit(2); });
