// Compiled HTML combat audit. Fixtures change data, never production functions.
// QA_BUILD_URL and QA_SOURCE_URL must identify the same committed build.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser.mjs';
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';

const registries = createRegistries(contentBundle);
const classes = registries.classes.ids();
const arg = name => process.argv.find(x => x.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const mode = arg('mode') || 'cards';
const deviceFilter = arg('device');
const cardFilter = arg('card');
const classFilter = arg('class');
const variantFilter = arg('variant');
const url = process.env.QA_BUILD_URL;
const source = process.env.QA_SOURCE_URL || (url && new URL('./src/', url).href);
const out = resolve(process.env.QA_OUTPUT || '/workspace/scratch/full-combat-audit/browser');
mkdirSync(out, { recursive: true });
const inventory = {
  cards: registries.cards.all().map(card => ({ id: card.id, class: card.class, type: card.type,
    classes: card.class === 'colorless' ? classes : [card.class], keywords: card.keywords || [],
    upgraded: !!card.upgrade, upcast: card.upcast?.unlockedTiers || [],
    targets: [...new Set((card.effects || []).map(e => e.target).filter(Boolean))],
    effects: [...new Set((card.effects || []).map(e => e.op))], tags: card.tags || [] })),
  enemies: registries.enemies.ids(), relics: registries.relics.ids(),
  statuses: registries.statuses.ids(), stances: registries.stances.ids(), classes,
};
inventory.legalClassCardPairs = inventory.cards.reduce((n, card) => n + card.classes.length, 0);
if (mode === 'inventory') {
  writeFileSync(resolve(out, 'inventory.json'), JSON.stringify(inventory, null, 2));
  console.log(JSON.stringify({ ...Object.fromEntries(['cards', 'enemies', 'relics', 'statuses', 'stances'].map(k => [k, inventory[k].length])), legalClassCardPairs: inventory.legalClassCardPairs, out }));
  process.exit(0);
}
if (!url || !source) throw new Error('QA_BUILD_URL must name the served compiled standalone HTML');
const html = await (await fetch(url)).text();
const build = { source: html.match(/const SOURCE = '([a-f0-9]+)'/)?.[1], ordinal: html.match(/const ORDINAL = '(\d+)'/)?.[1] };
assert.ok(build.source, 'compiled HTML loader and source receipt are required');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const owner = await launchBrowser({ browser: process.env.CHROME || '/usr/bin/chromium', prefix: 'ca-' });
const browser = await chromium.connectOverCDP(owner.wsUrl);
const report = { url, source, build, inventory, mode,
  fixture: 'Fresh createRunCombat from the screenshot run, canonical enemies/knowledge/moves, custom difficulty hpMult=20 and resource maxima 200. One registered card plus legal draw/discard fillers. Data fields only copied into the live fight; original runtime functions, listeners, dispatch, target resolver, renderer and timeline preserved. These are isolated fixtures, not earned playthroughs.',
  cases: [], errors: [], started: new Date().toISOString(), coverageLimits: [
    'Browser card coverage checks authored input, paid receipts, pile transition, resource payment and resulting effect events/state; conditional trigger crossproducts are reported by the engine audit.',
    'Relic/status registries are inventoried here; exhaustive relic/status activation belongs to the engine audit.',
  ] };
let activeCase = null;
const checkpoint = () => writeFileSync(resolve(out, `report-${mode}-${deviceFilter || 'both'}-${classFilter || 'all'}-${variantFilter || 'all'}.json`), JSON.stringify(report, null, 2));
const tap = async (page, locator, device) => device === 'phone' ? locator.tap({ timeout: 6000 }) : locator.click({ timeout: 6000 });

async function boot(context, classId) {
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push({ case: activeCase, kind: 'pageerror', message: e.stack }));
  page.on('console', e => {
    if (e.type() === 'error' || /\[combat\].*(rejected|ignored|refused|failed|not previewable)/.test(e.text()))
      report.errors.push({ case: activeCase, kind: e.type(), message: e.text() });
  });
  await page.addInitScript(() => {
    window.__auditUnhandled = []; window.__auditLongTasks = [];
    addEventListener('unhandledrejection', e => window.__auditUnhandled.push(String(e.reason?.stack || e.reason)));
    new PerformanceObserver(list => window.__auditLongTasks.push(...list.getEntries().map(e => ({ at: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(`${url}?shot=combat&shotClass=${classId}&shotSeed=B&shotMaxHp=200&shotMaxMana=200&shotMaxStamina=200&shotMana=200`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.end-turn:not([disabled])', { timeout: 30000 });
  await page.evaluate(() => { window.__auditBaseRun = structuredClone(window.__combatRunForShot); window.__auditRuntime = Object.fromEntries(Object.entries(window.__combat).filter(([, v]) => typeof v === 'function')); });
  return page;
}

async function fixture(page, row) {
  return page.evaluate(async ({ source, row }) => {
    const [{ createRunCombat }, { resolveCombatCard }, { previewCard, cardChoicePlan }, { cardTargetPlan }, { assertFoundationPlayable }, { controlGate }] = await Promise.all([
      import(source + 'engine/runCombat.js'), import(source + 'engine/combatExpansion.js'), import(source + 'engine/combat.js'),
      import(source + 'model/cardTargets.js'), import(source + 'engine/combatRules.js'), import(source + 'engine/controlStatuses.js')]);
    const c = window.__combat;
    if (c.pendingReaction || c.reactionResume || c.pendingAbilityDiscard || c.queue.length || document.querySelector('.hand')?.inert)
      throw new Error('Previous case left pending state or animation; refusing fixture reset');
    for (const [key, fn] of Object.entries(window.__auditRuntime)) if (c[key] !== fn) throw new Error(`Runtime function changed: ${key}`);
    const run = structuredClone(window.__auditBaseRun);
    if (row.relicId) run.relics = [...new Set([...run.relics, row.relicId])];
    const inst = { cardId: row.cardId || 'strike', instanceId: 'audit-card', upgraded: row.variant === 'upgraded',
      ...(row.school ? { damageSchool: row.school } : {}) };
    run.deck = [inst, ...Array.from({ length: 10 }, (_, i) => ({ cardId: i % 2 ? 'defend' : 'strike', instanceId: `audit-fill-${i}`, upgraded: false }))];
    const enemies = row.enemyIds || ['wanderingSoldier', 'wanderingSoldier'];
    const encounter = c.registries.encounters.all().find(e => enemies.every(id => e.enemies.includes(id)));
    const fresh = createRunCombat({ registries: c.registries, rng: c.rng, run, enemyIds: enemies, encounter, hpMult: row.victory ? 1 : 20,
      enemyStatuses: row.enemyStatuses || [], playerStatuses: row.playerStatuses || [] });
    // Runtime closures retain the original fight identity. Only serializable data changes.
    for (const key of Object.keys(c)) if (typeof c[key] !== 'function' && key !== 'registries' && key !== 'rng') delete c[key];
    for (const [key, value] of Object.entries(fresh)) if (typeof value !== 'function' && key !== 'registries' && key !== 'rng') c[key] = value;
    c.piles.hand = [inst, ...c.piles.hand.filter(i => i.instanceId !== inst.instanceId).slice(0, 2)];
    c.piles.draw = run.deck.filter(i => !c.piles.hand.some(h => h.instanceId === i.instanceId));
    c.piles.discard = []; c.piles.exhaust = [];
    c.player.energy = row.deniedCost ? 0 : 200; c.player.energyMax = 200;
    c.player.mana = row.deniedCost ? 0 : c.player.maxMana; c.player.stamina = row.deniedCost ? 0 : c.player.maxStamina;
    // A repeat-enter refusal gets a separate expected-refusal case; initial stance cards can enter normally.
    if (!row.repeatStance && c.registries.cards.get(inst.cardId).effects?.some(e => e.op === 'enterStance' && e.stance === c.player.stanceId)) c.player.stanceId = null;
    if (row.victory) { c.enemies = c.enemies.slice(0, 1); c.enemies[0].hp = 1; }
    const def = resolveCombatCard(c, inst, row.upcastTier ? { upcastTier: row.upcastTier } : {});
    const preview = previewCard(c, inst.instanceId, undefined, row.upcastTier);
    let refused = c.registries.framework.isUnplayable(def) ? 'authored unplayable card' : null;
    if (!controlGate(c, c.player, def).allowed) refused = 'active control restriction';
    try { assertFoundationPlayable(c, def); } catch (error) { refused = error.message; }
    const choice = cardChoicePlan(c, inst.instanceId);
    const plan = cardTargetPlan({ ...def, combatPreview: preview }, c.player.id, c.enemies, [{ ...c.player, connected: true }], { solo: true });
    window.__renderCombatForShot();
    window.__auditStart = { hp: c.enemies.map(e => e.hp), player: { hp: c.player.hp, energy: c.player.energy, mana: c.player.mana, stamina: c.player.stamina }, eventCount: c.eventLog.length, at: performance.now() };
    return { ...window.__auditStart, refused, preview: { needsTarget: preview.needsTarget, cost: preview.cost, manaCost: preview.manaCost, staminaCost: preview.staminaCost }, choice, plan,
      effects: def.effects, tags: def.cardTags || def.tags, attack: def.attack, knowledge: !!c.enemyKnowledge };
  }, { source, row });
}

async function finishPending(page, device, chooseReaction = false) {
  const choices = [];
  for (let i = 0; i < 18; i++) {
    await page.waitForFunction(() => window.__combat.result || !document.querySelector('.hand')?.inert, null, { timeout: 30000 });
    const pending = await page.evaluate(() => ({ reaction: window.__combat.pendingReaction, discard: window.__combat.pendingAbilityDiscard, result: window.__combat.result }));
    if (pending.discard) {
      await page.waitForSelector('.discard-choice [data-discard-id]', { timeout: 5000 });
      for (let n = 0; n < pending.discard.count; n++) await tap(page, page.locator('.discard-choice [data-discard-id]').nth(n), device);
      await tap(page, page.locator('.discard-choice button').filter({ hasText: new RegExp(`^Discard ${pending.discard.count}$`) }), device);
      choices.push({ kind: 'discard', count: pending.discard.count });
    } else if (pending.reaction) {
      await page.waitForSelector('.reaction-choice', { timeout: 5000 });
      if (chooseReaction && !choices.some(c => c.kind === 'reactionPlayed')) {
        const option = page.locator('.reaction-choice [data-reaction-option]').first();
        await tap(page, option, device);
        choices.push({ kind: 'reactionPlayed', option: await option.getAttribute('data-reaction-option') });
        await tap(page, page.locator('.reaction-choice button').filter({ hasText: /^Play$/ }), device);
      } else {
        await tap(page, page.locator('.reaction-choice button').filter({ hasText: /^(Resolve|Back)$/ }).first(), device);
        choices.push({ kind: 'reactionResolved', stack: !!await page.locator('.reaction-stack').count() });
      }
    } else return choices;
  }
  throw new Error('Reaction/discard did not settle after 18 choices');
}

async function play(page, device, row, before) {
  const card = page.locator('.hand .card[data-instance-id="audit-card"]');
  await card.waitFor({ state: 'visible' });
  if (row.upcastTier) {
    await tap(page, card.locator('.card-upcast'), device);
    await card.locator('.card-upcast-rank').selectOption(String(row.upcastTier));
  }
  await tap(page, card, device);
  if (before.refused || row.deniedCost) {
    assert.equal(await page.evaluate(() => window.__combat.eventLog.slice(window.__auditStart.eventCount).some(e => e.type === 'cardPlayed')), false);
    assert.equal(await page.locator('.end-turn').isEnabled(), true);
    return { refusal: before.refused || 'insufficient resource fixture', choices: [] };
  }
  if (before.plan.mode === 'enemy') await tap(page, page.locator('.enemy-target-button:not([disabled])').first(), device);
  else {
    // Confirm by the actual card gesture (selection then double tap), also available with mouse.
    await tap(page, card, device); await tap(page, card, device);
  }
  if (before.choice) await tap(page, page.locator('.card-choice [data-choice]:not([disabled])').first(), device);
  await page.waitForFunction(() => window.__combat.eventLog.slice(window.__auditStart.eventCount).some(e => e.type === 'cardPlayed' && e.cardInstanceId === 'audit-card'), null, { timeout: 10000 });
  return { choices: await finishPending(page, device, row.chooseReaction) };
}

async function receipt(page) {
  return page.evaluate(() => {
    const c = window.__combat, events = c.eventLog.slice(window.__auditStart.eventCount);
    return { hp: c.enemies.map(e => e.hp), player: { hp: c.player.hp, energy: c.player.energy, mana: c.player.mana, stamina: c.player.stamina },
      events, pile: ['hand', 'draw', 'discard', 'exhaust'].find(p => c.piles[p].some(i => i.instanceId === 'audit-card')) || 'consumedPower',
      pending: !!(c.pendingReaction || c.reactionResume || c.pendingAbilityDiscard), queue: c.queue.length, phase: c.phase, turn: c.turn, result: c.result,
      unhandled: window.__auditUnhandled, longTasks: window.__auditLongTasks.filter(e => e.at >= window.__auditStart.at),
      latencyMs: performance.now() - window.__auditStart.at, aiming: document.querySelectorAll('.aiming').length,
      runtimePreserved: Object.entries(window.__auditRuntime).every(([key, fn]) => c[key] === fn) };
  });
}

async function runCase(page, device, classId, row) {
  activeCase = { device, classId, ...row };
  const entry = { ...activeCase, status: 'running' }; report.cases.push(entry);
  const errorStart = report.errors.length;
  try {
    entry.before = await fixture(page, row);
    entry.input = await play(page, device, row, entry.before);
    entry.after = await receipt(page);
    const paid = entry.after.events.filter(e => e.type === 'cardPlayed' && e.cardInstanceId === 'audit-card');
    assert.equal(paid.length, entry.input.refusal ? 0 : 1, 'one paid card receipt per play');
    if (!entry.input.refusal) {
      assert.notEqual(entry.after.pile, 'hand', 'played card leaves hand');
      assert.equal(entry.after.player.energy, entry.before.player.energy - paid[0].energySpent, 'Actions paid once');
    }
    assert.equal(entry.after.pending, false, 'no pending state remains');
    assert.equal(entry.after.queue, 0, 'effect queue drained');
    assert.equal(entry.after.runtimePreserved, true, 'production runtime functions preserved');
    assert.deepEqual(entry.after.unhandled, [], 'no unhandled rejection');
    assert.equal(report.errors.length, errorStart, 'no caught dispatch/animation/console failures');
    entry.status = entry.input.refusal ? 'expected-refusal' : 'passed';
    if (['strike', 'defend', 'starSpark', 'guardCounter', 'warriorsVow', 'bindingParry', 'ricochet', 'bloodPact'].includes(row.cardId) && row.variant === 'base')
      await page.screenshot({ path: resolve(out, `${device}-${classId}-${row.cardId}.png`) });
  } catch (error) {
    entry.status = 'failed'; entry.error = error.stack;
    try { entry.failureState = await receipt(page); await page.screenshot({ path: resolve(out, `failure-${device}-${classId}-${row.cardId}-${row.variant}.png`) }); } catch { /* original error retained */ }
  }
  console.log(JSON.stringify({ ...activeCase, status: entry.status, error: entry.error?.split('\n')[0], latencyMs: entry.after?.latencyMs }));
  checkpoint();
  return entry.status !== 'failed';
}

try {
  for (const device of ['desktop', 'phone'].filter(d => !deviceFilter || d === deviceFilter)) {
    const context = await browser.newContext({ viewport: device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: device === 'phone' });
    for (const classId of classes.filter(id => !classFilter || id === classFilter)) {
      let page = await boot(context, classId);
      const cards = inventory.cards.filter(card => card.classes.includes(classId) && (!cardFilter || cardFilter.split(',').includes(card.id)));
      for (const card of cards) {
        const variants = ['base', ...(card.upgraded ? ['upgraded'] : [])].filter(v => !variantFilter || variantFilter === v);
        for (const variant of variants) {
          if (!await runCase(page, device, classId, { cardId: card.id, variant })) {
            await page.close(); page = await boot(context, classId);
          }
        }
      }
      await page.close();
    }
    await context.close();
  }
} finally {
  report.finished = new Date().toISOString();
  report.counts = Object.fromEntries(['passed', 'expected-refusal', 'failed'].map(status => [status, report.cases.filter(c => c.status === status).length]));
  checkpoint(); await browser.close(); await owner.close();
}
console.log(JSON.stringify({ counts: report.counts, out }));
if (report.counts.failed) process.exitCode = 1;
