import { assertSourceDisplayArt, readLoadedSourceBody } from './source-display-art.mjs';
// Real mouse input and browser-clock responsiveness for the ordered Core2 action.
// Raw click-to-contact and click-to-first-number latencies are always printed.
// Acceptance retains the 400/750 ms overhead budgets after excluding only the
// independently checked four 500 ms waits, the active authored half-rate clip,
// and hit-stop derived from this action's committed receipts. Every sample must
// retain intent → action → sprite → contact → reaction → damage → HUD → resolution.
// Missing or shortened waits, missing readouts and missing samples fail.
//
// The Core entry matchup can put a melee card outside the enemy's spell range.
// One real hostile action is still required and its committed miss is reported
// without inventing a number. Numeric samples also include immediate protection
// cards; later hostile candidates must have a positive public preview chance.
// Optional enemy-turn reactions are declined through their visible Back button.
// No engine action, settings change, injected state or synthetic click is used.
//
// Each input, contact and numeric readout is associated with this player's
// measured action using the production opt-in stage trace. At sprite start we
// read the active stage's authored actionTiming(), rather than treating observed
// scheduling lag as an allowance. Three contacts AND three rendered numbers are
// required. A failing round is measured once more on a fresh page by default;
// --rounds 1 retains the single-shot verdict. See click-impact-rounds.mjs.
//
//   CHROME=/path/to/chrome node tools/click-impact-probe.mjs [--rounds 1] [--plays 5]

import { CORE_ENTRY_SEED } from './core-entry-fixture.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { pointerTargetExpression } from './pointer-target.mjs';
import { judgeRounds } from './click-impact-rounds.mjs';
import { orderedImpactSample } from './click-impact-stages.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// Responsiveness overhead limits, independently fixed rather than game settings.
const BUDGET_MS = 400;
// The first numeric readout retains the original separate overhead budget.
const NUMBER_BUDGET_MS = 750;
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const PLAYS = Number(argOf('--plays') || 5);
const ROUNDS = Math.max(1, Math.floor(Number(argOf('--rounds') || 2)) || 1);
const SEED = Number(argOf('--seed') || CORE_ENTRY_SEED);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl, pageErrors = []) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`));
      else res(msg.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function main() {
  if (!browserPath) { console.error('click-impact-probe: no Chrome/Chromium found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const externalUrl = argOf('--url');
  if (!externalUrl) {
    try {
      const art = assertSourceDisplayArt(ROOT);
      console.log(`source art preflight: ${art.checked} declared display files match their hashes`);
    } catch (error) {
      console.error(`click-impact-probe: cannot measure source artwork: ${error.message}`);
      process.exitCode = 2;
      return;
    }
  }
  const hosted = externalUrl ? null : await serve({ root: ROOT, port: 8251, open: false });
  const server = hosted?.server;
  const base = externalUrl || `http://localhost:${hosted.port}/`;
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'clickimpact-', browser: browserPath,
    args: ['--window-size=1440,860', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
    timeoutMs: 12000,
  });
  const pageErrors = [];
  let lastPicked = null;
  const cdp = connectCdp(wsUrl, pageErrors);
  await cdp.ready;
  // Each round drives a fresh page (a new tab on the same browser and server), so a
  // re-measurement shares nothing with the round before it but the seed and the plays.
  let S = null;
  let targetId = null;
  const openPage = async () => {
    ({ targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }));
    ({ sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
    await cdp.send('Page.enable', {}, S);
    await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S);
  };

  const evalIn = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (expr, label, timeoutMs = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await evalIn(expr)) return true;
      await wait(100);
    }
    throw new Error(`timeout: ${label}`);
  };
  const clickAt = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, S);
    }
  };
  const click = async (sel, label, settle = true) => {
    const pt = await evalIn(`(() => {
      const e = document.querySelector(${JSON.stringify(sel)});
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const { x, y } = e.matches('.combatant, .hand .card') ? ${pointerTargetExpression(sel)}
        : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      return { x, y, hit: document.elementFromPoint(x, y)?.outerHTML.slice(0, 180) };
    })()`);
    if (!pt) throw new Error(`no element for ${label} (${sel})`);
    if (args.includes('--debug')) console.log('    input', label, sel, JSON.stringify(pt));
    await clickAt(pt.x, pt.y);
    if (settle) await wait(300);
  };


  const measure = async () => {
    await openPage();
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`document.readyState === 'complete'`, 'the page');
    await evalIn(`(() => { localStorage.clear(); return true; })()`);
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`!!(document.querySelector('.startup-gate') || document.querySelector('.title-menu .slot-new'))`, 'the startup gate or the title');
    if (await evalIn(`!!document.querySelector('.startup-gate')`)) {
      for (const type of ['keyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, S);
    }
    await until(`!!document.querySelector('.title-menu .slot-new:not([disabled])')`, 'New Game');
    await click('.title-menu .slot-new', 'New Game');
    await until(`!!document.querySelector('[data-title-action="modal-continue"]:not([disabled])')`, 'the slot picker');
    await click('[data-title-action="modal-continue"]', 'Create character');
    await until(`!!document.querySelector('[data-title-action="review-new"]:not([disabled])')`, 'the slot review');
    await click('[data-title-action="review-new"]', 'Start');
    await until(`!!document.querySelector('#cz-classes .cz-class')`, 'Core class creation');
    await click('#cz-classes .cz-class', 'Reaver');
    await click('#cz-next', 'Review');
    await until(`document.querySelector('.cz-railed')?.dataset.creationStage === 'review'`, 'Core review');
    await click('#seed-input', 'seed field');
    for (const type of ['keyDown','keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 }, S);
    await cdp.send('Input.insertText', { text: String(SEED) }, S);
    await click('#cz-start', 'Begin Core');
    // Walk the live entry rest, authored dungeon dialogue and map doors.
    // These are real controls, never engine calls or injected run state.
    for (let step = 0; step < 24; step += 1) {
      if (await evalIn(`!!window.__combat && !!document.querySelector('.hand .card')`)) break;
      const next = await evalIn(`(() => {
        const visible = n => { if (!n || n.hidden || n.disabled || n.getAttribute('aria-disabled') === 'true') return false; const r=n.getBoundingClientRect(); return r.width>0 && r.height>0 && n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)); };
        const pick = selector => [...document.querySelectorAll(selector)].find(visible);
        const direct = pick('#shrine-leave, #leave-shop, .prologue-screen [data-prologue-action="continue"], .confirmation-modal .confirmation-confirm, .map-tray [data-map-action="enter"], .map-enter');
        const node = direct || pick('.map-node.monster.reachable:not(.current)') || [...document.querySelectorAll('.map-node.reachable:not(.current):not(.visited)')].filter(visible).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left)[0];
        const dialogue = node || [...document.querySelectorAll('.dialogue-screen button, .event-screen button, .class-mastery-node')].find(visible);
        if (!dialogue) return null;
        document.querySelectorAll('[data-input-probe-next]').forEach(n => delete n.dataset.inputProbeNext);
        dialogue.dataset.inputProbeNext = 'true';
        return (dialogue.textContent || dialogue.getAttribute('aria-label') || dialogue.getAttribute('class') || dialogue.tagName).trim().slice(0,100);
      })()`);
      if (next) await click('[data-input-probe-next="true"]', next);
      else {

        await wait(500);
      }
    }
    await until(`!!window.__combat && !!document.querySelector('.hand .card')`, 'the first Core fight');
    await wait(1500);
    if (await evalIn(`(() => { const n=document.querySelector('.combat .tut-skip'); return n && !n.hidden && n.getBoundingClientRect().width>0; })()`)) await click('.combat .tut-skip', 'Skip the first-combat tutorial');

    if (!externalUrl) {
      try {
        // The combat screen already imports this exact module URL. stageFor is
        // a lookup of registered stages, not an initializer or painting API.
        const body = await evalIn(`(async () => {
          const { stageFor } = await import('/src/ui/services/PoseAnimator.js');
          return (${readLoadedSourceBody.toString()})(stageFor(document.querySelector('.combatant.player')));
        })()`);
        if (!body?.ready) throw new Error(JSON.stringify(body));
        console.log('source body precondition: loaded authored image ' + JSON.stringify(body));
      } catch (error) {
        console.error(`click-impact-probe: cannot measure an unloaded source body: ${error.message}`);
        process.exitCode = 2;
        return;
      }
    }

    // The page's own clock: pointer releases and visible damage/protection.
    // Dedicated Poise/Ward payloads can update a bar without a damage float.
    await evalIn(`(async () => {
      const { stageFor } = await import('/src/ui/services/PoseAnimator.js');
      const { actionPacing } = await import('/src/ui/animationPace.js');
      const { fixCoreEnabled } = await import('/src/model/fixCoreMechanics.js');
      const { ACTION_PACING } = await import('/src/model/autoCombatPolicy.js');
      window.__impactTiming = { ...actionPacing(), playbackRate: ACTION_PACING.spritePlaybackRate, fixCore: fixCoreEnabled(window.__combat) };
      const meters = () => JSON.stringify([...document.querySelectorAll('.combatant [data-res=poise], .combatant [data-res=ward]')].map(e => [e.closest('[data-eid]')?.dataset.eid, e.dataset.res, e.dataset.cur, e.dataset.max]));
      window.__impact = { ups: [], floats: [], contacts: [], floatOwners: [], contactOwners: [], clips: [], meterState: meters(), measureMeters: false };
      const trace = [];
      trace.push = (...rows) => {
        const length = Array.prototype.push.apply(trace, rows);
        for (const [at, stage, actorId] of rows) if (stage === 'sprite' && actorId === 'player') queueMicrotask(() => {
          const actor = document.querySelector('.combatant.player .sprite');
          const figure = stageFor(actor), playing = figure?.presentation;
          const clip = figure?.actionTiming?.(playing?.action || playing?.pose || figure?.pose, window.__impactTiming.spriteSpeed);
          window.__impact.clips.push({ at, ...clip, activeMs: playing?.duration, action: playing?.action });
        });
        return length;
      };
      window.__fx.trace = trace;
      addEventListener('pointerup', () => window.__impact.ups.push(performance.now()), { capture: true });
      new MutationObserver((list) => {
        const t = performance.now();
        const owner = name => { const row = window.__fx.trace.findLast(row => row[1] === name); return row && { at: t, stageAt: row[0], actor: row[2] }; };
        const float = () => { window.__impact.floats.push(t); window.__impact.floatOwners.push(owner('damage')); };
        for (const m of list) if (m.type === 'attributes' && m.attributeName === 'data-contact') {
          window.__impact.contacts.push(t); window.__impact.contactOwners.push(owner('contact'));
        }
        for (const m of list) for (const n of m.addedNodes || []) {
          if (n.nodeType === 1 && n.classList.contains('float-num') && /\\b(dmg|blk|poise|ward|barrier)\\b/.test(n.className)) float();
        }
        const nextMeters = meters();
        if (window.__impact.measureMeters && nextMeters !== window.__impact.meterState) float();
        window.__impact.meterState = nextMeters;
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-cur', 'data-max', 'data-contact'] });
      return true;
    })()`);

    const played = () => evalIn(`window.__combat?.player?.counters?.cardsPlayedThisCombat || 0`);
    const idle = `!!window.__combat && window.__combat.result == null && window.__combat.phase === 'player' && !!document.querySelector('.hand .card') && !document.querySelector('.combat .end-turn')?.disabled`;
    // A spent hand (every card played, no sample yet missing a number) has no `.hand .card` to wait for; it still ends the
    // turn through the no-pick branch below. The hand is read from combat state, so a hand still being drawn does not count.
    const spent = `!!window.__combat && window.__combat.result == null && window.__combat.phase === 'player' && window.__combat.piles.hand.length === 0 && !document.querySelector('.combat .end-turn')?.disabled`;
    const samples = [];
    const numbers = [];
    let hostileProofs = 0;
    for (let guard = 0; (samples.length < PLAYS || numbers.length < PLAYS || !hostileProofs) && guard < PLAYS * 6; guard += 1) {
      if (await evalIn(`!window.__combat || window.__combat.result != null`)) break;
      await until(`(${idle}) || (${spent})`, 'an idle hand', 15000);
      await wait(400);
      const picked = await evalIn(`(async () => {
        const { resolveCombatCard } = await import('/src/engine/combatExpansion.js');
        const { previewCardHit } = await import('/src/engine/combat.js');
        const { hasImmediateCombatImpact } = await import('/tools/click-impact-card.mjs');
        const { immediateCardEffects } = await import('/src/model/cardTargets.js');
        const combat = window.__combat;
        const hand = [...document.querySelectorAll('.hand .card')];
        hand.forEach((c) => delete c.dataset.ciCard);
        const pick = hand.find(c => {
          if (c.classList.contains('unaffordable')) return false;
          const inst = combat.piles.hand.find(card => card.instanceId === c.dataset.instanceId);
          if (!inst) return false;
          const def = resolveCombatCard(combat, inst);
          if (!hasImmediateCombatImpact(def)) return false;
          const hostile = immediateCardEffects(def).some(effect => ['damage', 'poiseDamage', 'wardDamage'].includes(effect.op) && ['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies'].includes(effect.target));
          // Prove a real hostile action once, including a legitimate range
          // miss. Later samples need a possible hit or immediate protection.
          return !hostile || ${hostileProofs === 0} || combat.enemies.some(enemy => enemy.alive && previewCardHit(combat, inst.instanceId, enemy.id)?.hitChance > 0);
        });
        if (!pick) return false;
        pick.dataset.ciCard = 'true';
        return { cardId: pick.dataset.cardId, instanceId: pick.dataset.instanceId,
          maneuver: pick.dataset.combatManeuver,
          hostile: immediateCardEffects(resolveCombatCard(combat, combat.piles.hand.find(card => card.instanceId === pick.dataset.instanceId))).some(effect => ['damage', 'poiseDamage', 'wardDamage'].includes(effect.op) && ['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies'].includes(effect.target)),
          meterImpact: immediateCardEffects(resolveCombatCard(combat, combat.piles.hand.find(card => card.instanceId === pick.dataset.instanceId))).some(effect => ['poiseDamage', 'wardDamage'].includes(effect.op)) };
      })()`);
      lastPicked = picked;
      if (args.includes('--debug')) console.log('    picked', JSON.stringify(picked));
      if (!picked) {
        // A selected card consumes the first End Turn hold by cancelling its
        // targeting state. Mirror full-run-probe's bounded retry instead of
        // burning every sampling attempt on that same unchanged hand.
        const turn = await evalIn(`window.__combat.turn`);
        for (let attempt = 0; attempt < 3 && await evalIn(`window.__combat?.turn === ${turn} && window.__combat?.phase === 'player'`); attempt += 1) {
          const pt = await evalIn(`(() => { const el = document.querySelector('.combat .end-turn'); const r = el?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, hold: Number(el.dataset.holdMs) || 600 } : null; })()`);
          if (!pt) throw new Error('no End Turn');
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y }, S);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, S);
          await wait(pt.hold + 250);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, S);
          const transitionEnd = Date.now() + 4000;
          while (Date.now() < transitionEnd) {
            if (await evalIn(`window.__combat?.result != null || window.__combat?.turn > ${turn} || window.__combat?.phase !== 'player'`)) break;
            await wait(100);
          }
        }
        const deadline = Date.now() + 40000;
        while (Date.now() < deadline) {
          if (await evalIn(`window.__combat?.result != null || (window.__combat?.turn > ${turn} && (${idle}))`)) break;
          const decline = '.reaction-choice [data-control-role="exit"]';
          if (await evalIn(`!!document.querySelector('${decline}')`)) await click(decline, 'Back from the optional defensive reaction');
          else await wait(100);
        }
        await until(`window.__combat?.result != null || (window.__combat?.turn > ${turn} && (${idle}))`, `turn ${turn + 1} or the fight's end`, 1000);
        continue;
      }
      const before = await played();
      const mark = await evalIn(`(() => { window.__impact.measureMeters = ${!!picked.meterImpact}; window.__impact.logIndex = window.__combat.eventLog.length; return performance.now(); })()`);
      // Park the pointer off the hand so a hover lift or tooltip from the last
      // play does not cover the next card.
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 120 }, S);
      await wait(250);
      await click('[data-ci-card="true"]', 'an immediate-impact card', false);
      const t0 = Date.now();
      while (Date.now() - t0 < 3000 && (await played()) === before) {
        if (await evalIn(`!!document.querySelector('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])')`)) { await click('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])', 'its legal enemy target', false); break; }
        if (await evalIn(`!!document.querySelector('.combatant.enemy.targetable')`)) { await click('.combatant.enemy.targetable', 'its legal battlefield enemy', false); break; }
        if (await evalIn(`!!document.querySelector('.combatant.player.targetable, .combatant.player.armed')`)) { await click('.combatant.player.targetable, .combatant.player.armed', 'its legal source target', false); break; }
        await wait(30);
      }
      await until(`(window.__combat?.player?.counters?.cardsPlayedThisCombat || 0) > ${before}`, 'the card to resolve', 5000);
      await until(`window.__fx.trace.some(([at, stage, actor]) => at > ${mark} && stage === 'resolution' && actor === 'player')`, 'the measured player action to finish every presentation stage', 15000);
      const observed = await evalIn(`(async () => {
        const stages = window.__fx.trace.filter(([at, , actor]) => at > ${mark} && actor === 'player');
        const contactStage = stages.find(row => row[1] === 'contact');
        const numberStage = stages.find(row => row[1] === 'damage');
        const f = window.__impact.floatOwners.find(row => row?.actor === 'player' && row.stageAt === numberStage?.[0])?.at;
        const c = window.__impact.contactOwners.find(row => row?.actor === 'player' && row.stageAt === contactStage?.[0])?.at;
        if (c == null) return null;
        const up = window.__impact.ups.filter((t) => t > ${mark} && t < Math.min(c, f ?? Infinity)).pop();
        if (up == null) return null;
        const { hitStopMsFor } = await import('/src/content/combatFeel.js');
        const { groupBeats, guardHitFloatParts } = await import('/src/ui/fx.js');
        const beat = groupBeats(window.__combat.eventLog.slice(window.__impact.logIndex)).find(beat => beat.events.some(e => e.type === 'cardPlayed' && e.cardInstanceId === ${JSON.stringify(picked.instanceId)}));
        const holdMs = (beat?.events || []).filter(e => e.type === 'damageDealt').reduce((sum, e) => sum + hitStopMsFor(guardHitFloatParts(e).residual, (e.targetId === 'player' ? window.__combat.player : window.__combat.enemies.find(enemy => enemy.id === e.targetId))?.maxHp || 0) * window.__impactTiming.scale, 0);
        return { up, contact: c, number: f ?? null, receipts: (beat?.events || []).map(({ type }) => ({ type })), timing: window.__impactTiming, holdMs,
          clip: window.__impact.clips.find(clip => clip.at > ${mark}),
          stages };
      })()`);
      if (observed != null) {
        const sample = orderedImpactSample(observed);
        samples.push(sample.contactOverhead);
        if (sample.number != null) numbers.push(sample.numberOverhead);
        if (picked.hostile) hostileProofs++;
        console.log(`    play ${samples.length}: contact ${sample.contact} ms (authored ${sample.expectedContact}, overhead ${sample.contactOverhead}), ${sample.number == null ? 'no numeric readout (committed miss)' : `number ${sample.number} ms (authored ${sample.expectedNumber}, overhead ${sample.numberOverhead})`} (${picked.cardId}${picked.maneuver === 'counter' ? ', Counter protection' : ''})`);
      } else if (args.includes('--debug')) console.log('    unmeasured', JSON.stringify(await evalIn(`({ floats: window.__impact.floats.filter(t => t > ${mark}), contacts: window.__impact.contacts.filter(t => t > ${mark}), clips: window.__impact.clips.filter(c => c.at > ${mark}), stages: window.__fx.trace.filter(([at]) => at > ${mark}) })`)));
    }
    await cdp.send('Target.closeTarget', { targetId }).catch(() => null);
    if (!hostileProofs) throw new Error('no real hostile action completed its contact and stage proof');
    return { samples, numbers };
  };

  try {
    const { exitCode } = await judgeRounds(measure, { rounds: ROUNDS, budgetMs: BUDGET_MS, numberBudgetMs: NUMBER_BUDGET_MS });
    console.log('  boundary: real Chromium headless, 1440x900, default Normal Core2; raw latency reported, declared waits/clip/receipt holds excluded only from 400/750 ms overhead gates. Mouse clicks only; hostile stage proof and numeric protection/HP readouts required.');
    console.log('  Not checked: touch input, slow or fast pacing, phone layouts, or classes other than the Quick start one.');
    process.exitCode = exitCode;
  } catch (e) {
    console.error(`click-impact-probe: ${e.message}`);
    console.error('last picked card:', JSON.stringify(lastPicked));
    if (pageErrors.length) console.error('page errors:', pageErrors.join('\n'));
    console.error('target state:', JSON.stringify(await evalIn(`({
      selected: document.querySelector('.hand .card.selected')?.dataset.cardId,
      armed: document.querySelector('.hand .card.armed')?.dataset.cardId,
      targetableEnemies: [...document.querySelectorAll('.enemy.targetable')].map(e => e.dataset.eid),
      targetablePlayer: !!document.querySelector('.player.targetable'),
      cardsPlayed: window.__combat?.player?.counters?.cardsPlayedThisCombat,
      phase: window.__combat?.phase, player: { energy: window.__combat?.player?.energy, stamina: window.__combat?.player?.stamina, mana: window.__combat?.player?.mana, statuses: window.__combat?.player?.statuses },
      modal: document.querySelector(".card-choice, .confirmation-modal")?.innerText,
      body: document.body.innerText.slice(-2500),
    })`).catch(() => null)));
    process.exitCode = 1;
  } finally {
    cdp.close();
    await dropBrowser();
    server?.close();
  }
}

main();
