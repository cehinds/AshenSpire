// Compiled HTML combat audit. Fixtures change data, never production functions.
// QA_BUILD_URL and QA_SOURCE_URL must identify the same committed build.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
assert.ok(process.env.QA_EXPECT_SOURCE && process.env.QA_EXPECT_ORDINAL, 'QA_EXPECT_SOURCE and QA_EXPECT_ORDINAL pin the immutable artifact');
assert.equal(build.source, process.env.QA_EXPECT_SOURCE, 'compiled SOURCE identity');
assert.equal(build.ordinal, process.env.QA_EXPECT_ORDINAL, 'compiled ORDINAL identity');
const sourceFiles = [];
function listSource(dir) { for (const e of readdirSync(dir, { withFileTypes: true })) {
  const path = resolve(dir, e.name); if (e.isDirectory()) listSource(path); else if (e.name.endsWith('.js')) sourceFiles.push(path);
} }
const sourceRoot = resolve(new URL('../../src/', import.meta.url).pathname);
listSource(sourceRoot);
const sourceDigests = {};
for (let i = 0; i < sourceFiles.length; i += 16) await Promise.all(sourceFiles.slice(i, i + 16).map(async path => {
  const relative = path.slice(sourceRoot.length + 1), response = await fetch(source + relative);
  assert.equal(response.ok, true, `source fixture module ${relative} served`);
  const digest = data => createHash('sha256').update(data).digest('hex');
  const served = await response.text();
  sourceDigests[relative] = digest(served);
  const normalizeStamp = text => text.replace(/export const (SOURCE|ORDINAL|BUILT|RUN_PATH|EDITION) = '[^']*';/g, 'export const $1 = \'STAMP\';');
  if (relative === 'buildversion.js') {
    assert.equal(served.match(/export const SOURCE = '([^']+)'/)?.[1], build.source, 'served source stamp matches compiled artifact');
    assert.equal(served.match(/export const ORDINAL = '([^']+)'/)?.[1], build.ordinal, 'served source ordinal matches compiled artifact');
    for (const field of ['BUILT', 'RUN_PATH', 'EDITION']) assert.equal(served.match(new RegExp(`export const ${field} = '([^']*)'`))?.[1], html.match(new RegExp(`const ${field} = '([^']*)'`))?.[1], `generated ${field} source stamp matches compiled artifact`);
    assert.equal(digest(normalizeStamp(served)), digest(normalizeStamp(readFileSync(path, 'utf8'))), 'buildversion code identity excluding generated stamp fields');
  } else assert.equal(sourceDigests[relative], digest(readFileSync(path)), `immutable source fixture identity: ${relative}`);
}));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const owner = await launchBrowser({ browser: process.env.CHROME || '/usr/bin/chromium', prefix: 'ca-' });
const browser = await chromium.connectOverCDP(owner.wsUrl);
const report = { url, source, build, sourceDigests, inventory, mode,
  fixture: 'Fresh createRunCombat from the screenshot run, canonical enemies/knowledge/moves, custom difficulty hpMult=20 and resource maxima 200. One registered card plus legal draw/discard fillers. Data fields only copied into the live fight; original runtime functions, listeners, dispatch, target resolver, renderer and timeline preserved. These are isolated fixtures, not earned playthroughs.',
  cases: [], errors: [], platformWarnings: [], networkFailures: [], animationDispatch: [], started: new Date().toISOString(), coverageLimits: [
    'Source-engine oracle parity proves compiled input and effect resolution match canonical source. Independent intended-effect/conditional trigger contracts are reported by the engine audit.',
    'Relic/status registries are inventoried here; exhaustive relic/status activation belongs to the engine audit.',
  ] };
let activeCase = null;
const checkpoint = () => writeFileSync(resolve(out, `report-${mode}-${deviceFilter || 'both'}-${classFilter || 'all'}-${variantFilter || 'all'}.json`), JSON.stringify(report, null, 2));
const tap = async (page, locator, device) => device === 'phone' ? locator.tap({ timeout: 6000 }) : locator.click({ timeout: 6000 });

async function boot(context, classId) {
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push({ case: activeCase, kind: 'pageerror', message: e.stack }));
  page.on('console', e => {
    if (/Blocked call to navigator.vibrate|Failed to load resource:/.test(e.text()))
      report.platformWarnings.push({ case: activeCase, kind: e.type(), message: e.text(), location: e.location() });
    else if (e.type() === 'error' || /\[combat\].*(rejected|ignored|refused|failed|not previewable)/.test(e.text()))
      report.errors.push({ case: activeCase, kind: e.type(), message: e.text() });
  });
  page.on('response', response => { if (response.status() >= 400) report.networkFailures.push({ case: activeCase, status: response.status(), url: response.url() }); });
  await page.addInitScript(() => {
    window.__auditUnhandled = []; window.__auditLongTasks = [];
    addEventListener('unhandledrejection', e => window.__auditUnhandled.push(String(e.reason?.stack || e.reason)));
    new PerformanceObserver(list => window.__auditLongTasks.push(...list.getEntries().map(e => ({ at: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(`${url}?shot=combat&shotClass=${classId}&shotSeed=B&shotMaxHp=200&shotMaxMana=200&shotMaxStamina=200&shotMana=200`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.end-turn:not([disabled])', { timeout: 30000 });
  await page.evaluate(() => { window.__auditBaseRun = structuredClone(window.__combatRunForShot); window.__auditBaseRng = window.__combat.rng.getCounters(); window.__auditRuntime = Object.fromEntries(Object.entries(window.__combat).filter(([, v]) => typeof v === 'function')); });
  return page;
}

async function fixture(page, row) {
  return page.evaluate(async ({ source, row }) => {
    const [{ createRunCombat }, { resolveCombatCard }, { previewCard, cardChoicePlan, dispatch }, { cardTargetPlan }, { assertFoundationPlayable, candidateState }, { controlGate }] = await Promise.all([
      import(source + 'engine/runCombat.js'), import(source + 'engine/combatExpansion.js'), import(source + 'engine/combat.js'),
      import(source + 'model/cardTargets.js'), import(source + 'engine/combatRules.js'), import(source + 'engine/combatStatusControl.js')]);
    const c = window.__combat;
    if (c.pendingReaction || c.reactionResume || c.pendingAbilityDiscard || c.queue.length || document.querySelector('.hand')?.inert)
      throw new Error('Previous case left pending state or animation; refusing fixture reset');
    for (const [key, fn] of Object.entries(window.__auditRuntime)) if (c[key] !== fn) throw new Error(`Runtime function changed: ${key}`);
    const run = structuredClone(window.__auditBaseRun);
    run.maxHp = run.maxMana = run.maxStamina = 200; run.hp = 100; run.mana = run.stamina = 100;
    run.ashenBlightBasePools = { maxHp: 200, maxMana: 200, maxStamina: 200 };
    c.rng.restoreCounters(window.__auditBaseRng);
    if (row.relicId) run.relics = [...new Set([...run.relics, row.relicId])];
    const inst = { cardId: row.cardId || 'strike', instanceId: 'audit-card', upgraded: row.variant === 'upgraded',
      ...(row.school ? { damageSchool: row.school } : {}) };
    run.deck = [inst, ...Array.from({ length: 10 }, (_, i) => ({ cardId: i % 2 ? 'defend' : 'strike', instanceId: `audit-fill-${i}`, upgraded: false }))];
    const enemies = row.enemyIds || ['wanderingSoldier', 'wanderingSoldier'];
    const encounter = c.registries.encounters.all().find(e => enemies.every(id => e.enemies.includes(id)));
    const fresh = createRunCombat({ registries: c.registries, rng: c.rng, run, enemyIds: enemies, encounter, hpMult: row.victory ? 1 : 20,
      enemyStatuses: row.enemyStatuses || [], playerStatuses: row.playerStatuses || [] });
    // The unchanged live commit callback owns this same run encounter. Mirror the
    // canonical fixture's accepted knowledge receipt into the host run, too.
    Object.assign(window.__combatRunForShot, structuredClone(run));
    if (fresh.enemyKnowledge?.encounter) {
      window.__combatRunForShot.enemyKnowledgeState.currentEncounter = structuredClone(fresh.enemyKnowledge.encounter);
      window.__combatRunForShot.enemyKnowledgeState.visitOrdinal = fresh.enemyKnowledge.encounter.visit;
    }
    // Runtime closures retain the original fight identity. Only serializable data changes.
    for (const key of Object.keys(c)) if (typeof c[key] !== 'function' && key !== 'registries' && key !== 'rng') delete c[key];
    for (const [key, value] of Object.entries(fresh)) if (typeof value !== 'function' && key !== 'registries' && key !== 'rng') c[key] = value;
    c.piles.hand = [inst, ...c.piles.hand.filter(i => i.instanceId !== inst.instanceId).slice(0, 2)];
    c.piles.draw = run.deck.filter(i => !c.piles.hand.some(h => h.instanceId === i.instanceId));
    c.piles.discard = []; c.piles.exhaust = [];
    c.player.energy = row.deniedCost ? 0 : 20; c.player.energyMax = 20;
    c.player.mana = row.deniedCost ? 0 : Math.floor(c.player.maxMana / 2); c.player.stamina = row.deniedCost ? 0 : Math.floor(c.player.maxStamina / 2);
    c.player.hp = Math.ceil(c.player.maxHp / 2);
    // A repeat-enter refusal gets a separate expected-refusal case; initial stance cards can enter normally.
    const stance = c.registries.cards.get(inst.cardId).effects?.find(e => e.op === 'enterStance' && e.stance)?.stance;
    if (row.repeatStance) c.player.stanceId = stance;
    else if (stance === c.player.stanceId) c.player.stanceId = null;
    if (row.activeControl) c.player.statuses[row.activeControl] = { stacks: 1 };
    if (row.victory) { c.enemies = c.enemies.slice(0, 1); c.enemies[0].hp = 1; }
    const def = resolveCombatCard(c, inst, row.upcastTier ? { upcastTier: row.upcastTier } : {});
    let preview = previewCard(c, inst.instanceId, undefined, row.upcastTier);
    if (preview.costIsX && !row.deniedCost) { c.player.energy = 3; preview = previewCard(c, inst.instanceId, undefined, row.upcastTier); }
    let refused = c.registries.framework.isUnplayable(def) ? 'authored unplayable card' : null;
    if (!controlGate(c, c.player, def).allowed) refused = 'active control restriction';
    try { assertFoundationPlayable(c, def); } catch (error) { refused = error.message; }
    const choice = cardChoicePlan(c, inst.instanceId);
    const plan = cardTargetPlan({ ...def, combatPreview: preview }, c.player.id, c.enemies, [{ ...c.player, connected: true }], { solo: true });
    window.__auditOracle = candidateState(c);
    window.__auditOracleDispatch = dispatch;
    window.__renderCombatForShot();
    window.__auditStart = { hp: c.enemies.map(e => e.hp), player: { hp: c.player.hp, energy: c.player.energy, mana: c.player.mana, stamina: c.player.stamina }, eventCount: c.eventLog.length, at: performance.now() };
    window.__auditFrameSamples = []; window.__auditSampling = !!row.sampleAnimation;
    const sample = () => {
      const host = document.querySelector('.combatant.player .alternative-card-stage'), stage = host?.__poseStage, canvas = host?.querySelector('canvas');
      let hash = null;
      if (canvas) try {
        const probe = document.createElement('canvas'); probe.width = probe.height = 32; const context = probe.getContext('2d');
        context.drawImage(canvas, 0, 0, 32, 32); const bytes = context.getImageData(0, 0, 32, 32).data;
        let h = 2166136261; for (const byte of bytes) h = Math.imul(h ^ byte, 16777619); hash = h >>> 0;
      } catch (error) { hash = String(error); }
      window.__auditFrameSamples.push({ at: performance.now(), hash, missing: !stage, pose: stage?.pose,
        art: stage?.currentArt, action: stage?.presentation?.action, stance: stage?.stance, rest: stage?.rest });
      if (window.__auditSampling) requestAnimationFrame(sample);
    };
    if (row.sampleAnimation) requestAnimationFrame(sample);
    return { ...window.__auditStart, refused, preview: { needsTarget: preview.needsTarget, cost: preview.cost, manaCost: preview.manaCost, staminaCost: preview.staminaCost }, choice, plan,
      effects: def.effects, tags: def.cardTags || def.tags, attack: def.attack, upcastTiers: def.upcast?.unlockedTiers || [], knowledge: !!c.enemyKnowledge, rng: c.rng.getCounters() };
  }, { source, row });
}

async function finishPending(page, device, chooseReaction = false) {
  const choices = [];
  for (let i = 0; i < 18; i++) {
    await page.waitForFunction(() => window.__combat.result || !document.querySelector('.hand')?.inert, null, { timeout: 30000 });
    const pending = await page.evaluate(() => ({ reaction: window.__combat.pendingReaction, discard: window.__combat.pendingAbilityDiscard, result: window.__combat.result }));
    if (pending.discard) {
      await page.waitForSelector('.discard-choice [data-discard-id]', { timeout: 5000 });
      const ids = await page.locator('.discard-choice [data-discard-id]').evaluateAll(nodes => nodes.map(n => n.dataset.discardId));
      for (let n = 0; n < pending.discard.count; n++) await tap(page, page.locator('.discard-choice [data-discard-id]').nth(n), device);
      await page.evaluate(cardInstanceIds => window.__auditOracleDispatch(window.__auditOracle, { type: 'chooseDiscard', cardInstanceIds }), ids.slice(0, pending.discard.count));
      await tap(page, page.locator('.discard-choice button').filter({ hasText: new RegExp(`^Discard ${pending.discard.count}$`) }), device);
      choices.push({ kind: 'discard', count: pending.discard.count });
    } else if (pending.reaction) {
      await page.waitForSelector('.reaction-choice', { timeout: 5000 });
      if (chooseReaction && !choices.some(c => c.kind === 'reactionPlayed')) {
        const option = page.locator('.reaction-choice [data-reaction-option]').first();
        await tap(page, option, device);
        choices.push({ kind: 'reactionPlayed', option: await option.getAttribute('data-reaction-option') });
          const optionId = await option.getAttribute('data-reaction-option');
          await page.evaluate(({ offerId, optionId }) => window.__auditOracleDispatch(window.__auditOracle, { type: 'chooseReaction', offerId, optionId }), { offerId: pending.reaction.id, optionId });
          await tap(page, page.locator('.reaction-choice button').filter({ hasText: /^Play$/ }), device);
      } else {
        await page.evaluate(offerId => window.__auditOracleDispatch(window.__auditOracle, { type: 'chooseReaction', offerId, optionId: null }), pending.reaction.id);
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
    const reason = await page.locator('[role="tooltip"]').allTextContents();
    assert.ok(reason.join(' ').trim(), 'refusal has a visible explanation');
    return { refusal: before.refused || 'insufficient resource fixture', visibleReason: reason, choices: [] };
  }
  if (row.invalidTarget) {
    const point = await page.locator('.combatant.player .sprite').boundingBox();
    assert.ok(point, 'wrong-side player figure exists');
    if (device === 'phone') await page.touchscreen.tap(point.x + point.width / 2, point.y + point.height / 2);
    else await page.mouse.click(point.x + point.width / 2, point.y + point.height / 2);
    const denied = await receipt(page);
    assert.deepEqual(denied.events, [], 'wrong-side target emits no effects');
    assert.deepEqual(denied.player, before.player, 'wrong-side target spends no pools');
    assert.equal(denied.pile, 'hand', 'wrong-side target keeps card');
    const blank = await page.evaluate(() => {
      const root = document.querySelector('.combat');
      for (let y = 80; y < innerHeight - 150; y += 40) for (let x = 30; x < innerWidth - 30; x += 60) {
        const hit = document.elementFromPoint(x, y);
        if (root?.contains(hit) && !hit.closest('.combatant,button,.hand,.card,.as-tip,.modal,input')) return { x, y };
      }
      return null;
    });
    assert.ok(blank, 'pointer-accessible empty field cancels targeting');
    if (device === 'phone') await page.touchscreen.tap(blank.x, blank.y); else await page.mouse.click(blank.x, blank.y);
    assert.equal(await page.locator('.hand .card.selected,.hand .card.armed').count(), 0, 'wrong-side selection can be cancelled');
    await tap(page, card, device);
  }
  const intent = { type: 'playCard', cardInstanceId: 'audit-card', ...(before.plan.mode === 'enemy' ? { targetId: 'e1' } : {}),
    ...(before.choice ? { choice: before.choice.options.find(o => !o.active).id } : {}), ...(row.upcastTier ? { upcastTier: row.upcastTier } : {}) };
  await page.evaluate(intent => window.__auditOracleDispatch(window.__auditOracle, intent), intent);
  if (before.plan.mode === 'enemy') {
    if (row.figureTarget) {
      const point = await page.evaluate(() => {
        const frame = document.querySelector('.combatant.enemy[data-eid="e1"]'), sprite = frame.querySelector('.sprite'), b = sprite.getBoundingClientRect();
        for (let yi = 1; yi < 10; yi++) for (let xi = 1; xi < 10; xi++) {
          const x = b.left + b.width * xi / 10, y = b.top + b.height * yi / 10, hit = document.elementFromPoint(x, y);
          if (hit?.closest('.combatant.enemy') === frame && !hit.closest('button')) return { x, y };
        }
        return null;
      });
      assert.ok(point, 'enemy figure has an accessible pointer target');
      if (device === 'phone') await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    } else await tap(page, page.locator('.enemy-target-button:not([disabled])').first(), device);
  }
  else {
    // Confirm by the actual card gesture (selection then double tap), also available with mouse.
    await tap(page, card, device); await tap(page, card, device);
  }
  if (before.choice) await tap(page, page.locator('.card-choice [data-choice]:not([disabled])').first(), device);
  await page.waitForFunction(() => window.__combat.eventLog.slice(window.__auditStart.eventCount).some(e => e.type === 'cardPlayed' && e.cardInstanceId === 'audit-card'), null, { timeout: 10000 });
  return { choices: await finishPending(page, device, row.chooseReaction), invalidTargetRecovered: !!row.invalidTarget };
}

async function receipt(page) {
  return page.evaluate(() => {
    const c = window.__combat, events = c.eventLog.slice(window.__auditStart.eventCount);
    window.__auditSampling = false;
    return { hp: c.enemies.map(e => e.hp), player: { hp: c.player.hp, energy: c.player.energy, mana: c.player.mana, stamina: c.player.stamina },
      events, pile: ['hand', 'draw', 'discard', 'exhaust'].find(p => c.piles[p].some(i => i.instanceId === 'audit-card')) || 'consumedPower',
      pending: !!(c.pendingReaction || c.reactionResume || c.pendingAbilityDiscard), queue: c.queue.length, phase: c.phase, turn: c.turn, result: c.result,
      unhandled: window.__auditUnhandled, longTasks: window.__auditLongTasks.filter(e => e.at >= window.__auditStart.at),
      latencyMs: performance.now() - window.__auditStart.at, aiming: document.querySelectorAll('.aiming').length,
      runtimePreserved: Object.entries(window.__auditRuntime).every(([key, fn]) => c[key] === fn),
      oracle: { events: window.__auditOracle.eventLog.slice(window.__auditStart.eventCount), player: window.__auditOracle.player,
        enemies: window.__auditOracle.enemies, piles: window.__auditOracle.piles, phase: window.__auditOracle.phase },
      actual: { player: c.player, enemies: c.enemies, piles: c.piles, phase: c.phase }, frames: window.__auditFrameSamples };
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
    if (row.sampleAnimation) {
      const frames = entry.after.frames, actionFrames = frames.filter(f => f.action);
      report.animationDispatch.push({ device, classId, cardId: row.cardId, receiptId: 'audit-card', dispatchType: 'paid-card', cardPlayed: entry.after.events.some(e => e.type === 'cardPlayed'),
        frameChanged: new Set(actionFrames.map(f => f.hash).filter(h => typeof h === 'number')).size > 1, actionStarted: actionFrames.length > 0,
        actionCompleted: actionFrames.length > 0 && !frames.at(-1)?.action,
        returnedToOrigin: frames[0]?.pose === frames.at(-1)?.pose, before: frames[0], after: frames.at(-1), frames });
    }
    const paid = entry.after.events.filter(e => e.type === 'cardPlayed' && e.cardInstanceId === 'audit-card');
    assert.equal(paid.length, entry.input.refusal ? 0 : 1, 'one paid card receipt per play');
    if (!entry.input.refusal) {
      assert.notEqual(entry.after.pile, 'hand', 'played card leaves hand');
      const sum = type => entry.after.events.filter(e => e.type === type).reduce((n, e) => n + (e.amount || 0), 0);
      assert.equal(entry.after.player.energy, entry.before.player.energy - sum('energySpent') + sum('energyGained') + sum('energyRecovered'), 'Actions ledger balances');
      assert.equal(entry.after.player.mana, entry.before.player.mana - sum('manaSpent') + sum('manaRestored') + sum('manaRecovered'), 'Mana ledger balances');
      assert.deepEqual(entry.after.events, entry.after.oracle.events, 'compiled damage/status/heal/draw/stance/effect receipts match canonical engine');
      assert.deepEqual(entry.after.actual, { player: entry.after.oracle.player, enemies: entry.after.oracle.enemies, piles: entry.after.oracle.piles, phase: entry.after.oracle.phase }, 'effect state and resources match canonical engine');
    } else {
      assert.equal(entry.after.pile, 'hand', 'refused card stays in hand');
      assert.deepEqual(entry.after.player, entry.before.player, 'refused resources unchanged');
      assert.deepEqual(entry.after.events, [], 'refused input emits no effects');
      assert.equal(await page.locator('.hand .card.selected,.hand .card.armed').count(), 0, 'refused card has no armed selection');
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
      const cards = mode === 'cards' ? inventory.cards.filter(card => card.classes.includes(classId) && (!cardFilter || cardFilter.split(',').includes(card.id))) : [];
      for (const card of cards) {
        const variants = ['base', ...(card.upgraded ? ['upgraded'] : [])].filter(v => !variantFilter || variantFilter === v);
        for (const variant of variants) {
          const row = { cardId: card.id, variant, category: 'card', figureTarget: card.id.length % 2 === 0,
            sampleAnimation: variant === 'base' && ['strike','defend','starSpark','guardCounter','sweepingBlow','crimsonCleave','quickstep','bindingParry','ricochet','cometFragment','litany','bloodPact'].includes(card.id) };
          const entryIndex = report.cases.length;
          if (!await runCase(page, device, classId, row)) {
            await page.close(); page = await boot(context, classId);
          }
          if (variant === 'base' && (!variantFilter || variantFilter === 'all')) for (const upcastTier of report.cases[entryIndex].before?.upcastTiers || [])
            if (!await runCase(page, device, classId, { ...row, variant: `upcast-${upcastTier}`, upcastTier, sampleAnimation: false })) { await page.close(); page = await boot(context, classId); }
        }
      }
      if (mode === 'negatives') {
        const rows = [
          { cardId: 'strike', deniedCost: true, category: 'insufficient-resources' },
          { cardId: 'strike', activeControl: 'dazed', category: 'controlled' },
          { cardId: 'guardianBulwark', repeatStance: true, category: 'repeat-stance' },
          { cardId: 'strike', invalidTarget: true, category: 'invalid-target-recovery' },
          { cardId: 'strike', category: 'legal-after-refusals', figureTarget: true },
        ];
        for (const row of rows) if (!await runCase(page, device, classId, { ...row, variant: 'base' })) { await page.close(); page = await boot(context, classId); }
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
