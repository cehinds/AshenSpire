// After a played-out sequence, finishRender() must leave the combat board showing the final state: the
// fields that only differ at the end of playback (player statuses, stance, evade, protection, enemy
// intents, hand and piles, affordability, the End Turn pulse, the counts) are asserted against the
// fight state itself, at phone and desktop size, after each play and after the enemy turn.
//
//   node tests/combat-finish-render-fields.browser.mjs         (Chromium via Playwright; CHROME overrides)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
import { protectionPresentation } from '../src/model/blockPresentation.js';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = `${(process.env.BASE_URL || `http://localhost:${server.server.address().port}`).replace(/\/$/, '')}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const errors = [];

// Read the board and the fight state in one go, inside the page.
const READ = `(async () => {
  const combat = window.__combat;
  const { projectCombatIntent } = await import('/src/ui/models/CombatIntentProjectionModel.js');
  const { combatIntentPresentation } = await import('/src/ui/models/CombatIntentModel.js');
  const { previewCard } = await import('/src/engine/combat.js');
  const text = (node) => (node ? node.textContent.trim() : null);
  const frameOf = (id) => id === 'player' ? document.querySelector('.combatant.player') : document.querySelector('.combatant.enemy[data-eid="' + id + '"]');
  const fighters = [combat.player, ...combat.enemies].map((entity) => {
    const isPlayer = entity === combat.player;
    const frame = frameOf(isPlayer ? 'player' : entity.id);
    const row = frame?.querySelector('.combat-health-row');
    const intent = !isPlayer && entity.alive ? combatIntentPresentation(projectCombatIntent(combat, entity.id)) : null;
    return {
      id: entity.id, isPlayer, alive: entity.alive, hp: entity.hp,
      entity: JSON.parse(JSON.stringify(entity)),
      dom: frame && {
        statusIds: [...frame.querySelectorAll('.statuses [data-status-id]')].map((n) => n.dataset.statusId).sort(),
        hp: Number(frame.querySelector('.combat-health-meter .m-value')?.dataset.currentHp ?? NaN),
        defense: row ? Number(row.dataset.defense) : null, ward: row ? Number(row.dataset.ward) : null,
        stance: [...frame.querySelectorAll('.stance-chip')].map((n) => n.className),
        evade: text(frame.querySelector('.foundation-evade')),
        intentValues: [...frame.querySelectorAll('.intent .intent-values .intent-value > span')].map(text),
        hasIntent: !!frame.querySelector('.intent'),
      },
      expectedIntentValues: intent ? intent.parts.filter((part) => part.value != null).map((part) => String(part.value)) : null,
    };
  });
  const hand = [...document.querySelectorAll('.hand .card')].map((card) => ({ id: card.dataset.instanceId, unaffordable: card.classList.contains('unaffordable') }));
  const quotes = combat.piles.hand.map((inst) => {
    try {
      const pv = previewCard(combat, inst.instanceId);
      return { id: inst.instanceId, affordable: combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && combat.player.mana >= pv.manaCost && combat.player.stamina >= (pv.staminaCost || 0) };
    } catch { return { id: inst.instanceId, affordable: null }; }
  });
  return {
    fighters, hand, quotes, handIds: combat.piles.hand.map((inst) => inst.instanceId),
    pulse: document.querySelector('.end-turn').classList.contains('pulse'),
    draw: combat.piles.draw.length, discard: combat.piles.discard.length, exhaust: combat.piles.exhaust.length,
    drawText: text(document.querySelector('.pile.draw .sp-v')), spentLabel: document.querySelector('.pile.spent')?.getAttribute('aria-label') ?? '',
    energy: combat.player.energy, orb: text(document.querySelector('.energy-orb')),
    foundation: !!combat.foundation, result: combat.result || null,
  };
})()`;

function assertBoard(state, label) {
  for (const f of state.fighters) {
    const tag = `${label}: ${f.id}`;
    if (!f.dom) { assert.equal(f.alive && !f.isPlayer, false, `${tag} has a frame while alive`); continue; }
    assert.equal(f.dom.hp, f.hp, `${tag} shows the current HP`);
    const want = protectionPresentation(f.entity);
    assert.equal(f.dom.defense, want.defense, `${tag} shows its Block`);
    assert.equal(f.dom.ward, want.ward, `${tag} shows its Ward (persistent ward and meter included)`);
    // Status tray: every plain status the fight holds is drawn (meters live in the bars), and nothing it no longer holds.
    const held = Object.entries(f.entity.statuses || {}).filter(([, inst]) => inst && !inst.meter && inst.stacks > 0).map(([id]) => id);
    for (const id of held) if (id !== 'evade' && id !== 'precision') assert.ok(f.dom.statusIds.includes(id), `${tag} draws held status ${id} (${f.dom.statusIds})`);
    for (const id of f.dom.statusIds) {
      const inst = f.entity.statuses?.[id];
      assert.ok(inst && (inst.meter ? inst.meter.value : inst.stacks) > 0, `${tag} draws only held statuses (${id})`);
    }
    if (f.isPlayer) {
      assert.equal(f.dom.stance.length, f.entity.stanceId ? 1 : 0, `${tag} draws the stance chip only while a stance is held`);
      if (f.entity.stanceId) assert.ok(f.dom.stance[0].includes(f.entity.stanceId), `${tag} stance chip names ${f.entity.stanceId}`);
      if (state.foundation && f.entity.evade > 0) assert.ok(f.dom.evade?.includes(String(f.entity.evade)), `${tag} shows evade ${f.entity.evade}`);
      else assert.equal(f.dom.evade, null, `${tag} shows no evade chip`);
    } else if (f.alive) {
      assert.deepEqual(f.dom.intentValues, f.expectedIntentValues, `${tag} shows the intent projected on the final state`);
    } else {
      assert.equal(f.dom.hasIntent, false, `${tag} (defeated) shows no intent`);
    }
  }
  assert.deepEqual(state.hand.map((card) => card.id).sort(), [...state.handIds].sort(), `${label}: the hand shows the cards in hand`);
  for (const quote of state.quotes) {
    if (quote.affordable === null) continue;
    assert.equal(state.hand.find((card) => card.id === quote.id)?.unaffordable, !quote.affordable, `${label}: ${quote.id} affordability follows the final energy`);
  }
  if (!state.result) assert.equal(state.pulse, state.quotes.some((quote) => quote.affordable), `${label}: End Turn pulses exactly while a card can be played`);
  assert.equal(state.drawText, String(state.draw), `${label}: draw pile count`);
  const spent = state.spentLabel.match(/\d+/g)?.map(Number) || [];
  assert.deepEqual(spent.slice(0, 2), [state.discard, state.exhaust], `${label}: discard and exhaust counts (${state.spentLabel})`);
  if (state.orb != null && state.energy != null) assert.ok(state.orb.includes(String(state.energy)), `${label}: the orb shows ${state.energy} (${state.orb})`);
}

try {
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install({ time: 0 });
    await page.goto(`${base}index.html?shot=combat&shotSeed=PERF1`, { waitUntil: 'domcontentloaded' });
    const READY = `!!(window.__combat && document.querySelector('.combatant.enemy') && document.querySelector('.hand .card') && document.querySelector('.end-turn') && !document.querySelector('.end-turn').disabled)`;
    for (let i = 0; i < 200 && !(await page.evaluate(READY)); i++) await page.clock.runFor(100);
    await page.clock.runFor(2000);
    const tap = async (selector) => {
      const box = await page.locator(selector).first().boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    };
    const idle = () => page.evaluate(`!document.querySelector('.end-turn').disabled || !!window.__combat.result`);
    const settle = async () => { for (let i = 0; i < 100 && !(await idle()); i++) await page.clock.runFor(100); await page.clock.runFor(600); };
    assertBoard(await page.evaluate(READ), `${width}px start`);
    for (let play = 1; play <= 2; play++) {
      const id = await page.evaluate(`[...document.querySelectorAll('.hand .card:not(.unaffordable)')].map((n) => n.dataset.instanceId)[0]`);
      if (!id) break;
      const selector = `.hand .card[data-instance-id="${id}"]`;
      await tap(selector); await page.clock.runFor(400);
      const target = await page.evaluate(`(() => { const e = document.querySelector('.combat[data-target-hud="true"] .combatant.enemy.targetable:not([inert])'); if (e) return '.combat[data-target-hud="true"] .combatant.enemy.targetable:not([inert])'; const p = document.querySelector('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])'); return p ? '.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])' : null; })()`);
      await tap(target || selector);
      await page.clock.runFor(300); await settle();
      assertBoard(await page.evaluate(READ), `${width}px after play ${play}`);
    }
    // End the turn (hold), let the enemies act, and read the board at the start of the next player turn.
    const end = await page.locator('.end-turn').boundingBox();
    const cx = end.x + end.width / 2, cy = end.y + end.height / 2;
    if (mobile) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] }); await page.clock.runFor(1300);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else { await page.mouse.move(cx, cy); await page.mouse.down(); await page.clock.runFor(1300); await page.mouse.up(); }
    const turn = await page.evaluate('window.__combat.turn');
    for (let i = 0; i < 200 && !(await page.evaluate(`(window.__combat.turn > ${turn} && !document.querySelector('.end-turn').disabled) || !!window.__combat.result`)); i++) await page.clock.runFor(300);
    await page.clock.runFor(800);
    assertBoard(await page.evaluate(READ), `${width}px next turn`);
    console.log('ok', width);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('combat finish render fields browser: ok');
} catch (error) { console.error(error); errors.push(String(error)); }
finally { await browser.close(); await server?.server?.close?.(); process.exit(errors.length ? 1 : 0); }
