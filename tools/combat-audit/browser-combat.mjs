// Compiled HTML combat audit. Fixtures change data, never production functions.
// QA_BUILD_URL and QA_SOURCE_URL must identify the same committed build.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadavg, freemem, cpus } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser } from '../browser.mjs';
export function assertResumeIdentity(report, current) {
  assert.ok(report.htmlSha256, 'resumed report must pin compiled HTML bytes');
  assert.equal(report.htmlSha256, current.htmlSha256, 'resumed compiled HTML byte identity');
  assert.deepEqual(report.build, current.build, 'resumed artifact identity');
  assert.deepEqual(report.sourceDigests, current.sourceDigests, 'resumed immutable source identity');
}

async function main() {
const sourceRoot = resolve(process.env.QA_REFERENCE_SOURCE || new URL('../../src/', import.meta.url).pathname);
const [{ contentBundle }, { createRegistries }, { SFX_MANIFEST, resolveRecipe }] = await Promise.all([
  import(pathToFileURL(resolve(sourceRoot, 'content/index.js')).href),
  import(pathToFileURL(resolve(sourceRoot, 'model/registries.js')).href),
  import(pathToFileURL(resolve(sourceRoot, 'content/sfx.js')).href),
]);

const registries = createRegistries(contentBundle);
const classes = registries.classes.ids();
const arg = name => process.argv.find(x => x.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const mode = arg('mode') || 'cards';
const deviceFilter = arg('device');
const cardFilter = arg('card');
const classFilter = arg('class');
const variantFilter = arg('variant');
const pace = arg('pace') || 'fast';
const curated = arg('curated') === 'true';
const resumePath = arg('resume');
const caseKey = row => [row.device, row.classId, row.category || 'card', row.cardId, row.variant,
  ...(row.category === 'enemy-turn' ? [row.enemyIds.join('+')] : [])].join('/');
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
if (mode === 'summarize') {
  const paths = (arg('reports') || '').split(',').filter(Boolean).map(path => resolve(path));
  assert.ok(paths.length, 'summarize requires explicit authoritative --reports paths');
  const inputs = paths.map(path => ({ path, report: JSON.parse(readFileSync(path, 'utf8')),
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }));
  const latest = new Map(), history = [];
  const expectedDevices = (arg('expected-devices') || 'desktop,phone').split(',');
  assert.ok(expectedDevices.length && expectedDevices.every(device => ['desktop', 'phone'].includes(device)), 'expected devices must explicitly name desktop and/or phone');
  const key = caseKey;
  for (const input of inputs) {
    assert.ok(input.report.finished, `authoritative report must be complete: ${input.path}`);
    assert.ok(input.report.cases?.length, `authoritative report must have nonempty cases: ${input.path}`);
    assert.ok(input.report.inventory?.cards?.length && input.report.inventory.cards.every(card => card.classes?.length), `authoritative report must have nonempty authored inventory: ${input.path}`);
    assert.deepEqual(input.report.build, inputs[0].report.build, 'combined report artifact identity');
    assert.deepEqual(input.report.sourceDigests, inputs[0].report.sourceDigests, 'combined source identity');
    assert.deepEqual(input.report.inventory, inputs[0].report.inventory, 'combined authored inventory identity');
    input.report.cases.forEach((row, index) => {
      const record = { key: key(row), status: row.status, report: input.path, index,
        reason: row.input?.refusal || row.before?.refused || row.error || null };
      latest.set(record.key, record); history.push(record);
    });
  }
  const required = new Set();
  for (const input of inputs) for (const device of expectedDevices) {
    for (const card of input.report.inventory.cards) for (const classId of card.classes) {
      required.add([device, classId, 'card', card.id, 'base'].join('/'));
      if (card.upgraded) required.add([device, classId, 'card', card.id, 'upgraded'].join('/'));
    }
    for (const row of input.report.cases.filter(row => row.category === 'card' && row.variant === 'base'))
      for (const tier of row.before?.upcastTiers || []) required.add([row.device, row.classId, 'card', row.cardId, `upcast-${tier}`].join('/'));
  }
  const failures = history.filter(row => row.status === 'failed').map(row => ({ ...row,
    latest: latest.get(row.key), resolved: ['passed', 'expected-refusal'].includes(latest.get(row.key)?.status) }));
  const result = { build: inputs[0].report.build, provenance: inputs.map(({ path, sha256, report }) => ({ path, sha256, attempts: report.cases.length, runs: report.runs || [{ pace: report.pace, started: report.started }] })),
    counts: Object.fromEntries(['passed', 'expected-refusal', 'failed'].map(status => [status, [...latest.values()].filter(row => row.status === status).length])),
    expectedDevices, latestKeys: latest.size, requiredKeys: required.size, missingKeys: [...required].filter(key => !latest.has(key)),
    runtimeErrors: inputs.flatMap(({ path, report }) => report.errors.map(error => ({ report: path, ...error }))),
    historicalFailures: failures, cases: [...latest.values()],
    limits: ['Compiled input/effect parity covers the pinned baseline; current integrated-build critical validation is reported separately.',
      'Base and upgraded required keys come from authored inventory. Upcast keys use resolved default-profile tiers captured by the base-case preview.',
      'Historical failed attempts remain linked to their latest same-key rerun. Expected unplayable refusals are counted separately from paid effects.'] };
  writeFileSync(resolve(out, 'combined-manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result.counts, latestKeys: result.latestKeys, requiredKeys: result.requiredKeys, missing: result.missingKeys.length,
    runtimeErrors: result.runtimeErrors.length, historicalFailures: failures.length, unresolvedHistory: failures.filter(row => !row.resolved).length, out }));
  process.exit(result.counts.failed || result.missingKeys.length || result.runtimeErrors.length ? 1 : 0);
}
if (!url || !source) throw new Error('QA_BUILD_URL must name the served compiled standalone HTML');
const html = await (await fetch(url)).text();
const htmlSha256 = createHash('sha256').update(html).digest('hex');
if (process.env.QA_EXPECT_HTML_SHA256) assert.equal(htmlSha256, process.env.QA_EXPECT_HTML_SHA256, 'compiled HTML byte identity');
const build = { source: html.match(/const SOURCE = '([a-f0-9]+)'/)?.[1], ordinal: html.match(/const ORDINAL = '(\d+)'/)?.[1] };
assert.ok(build.source, 'compiled HTML loader and source receipt are required');
assert.ok(process.env.QA_EXPECT_SOURCE && process.env.QA_EXPECT_ORDINAL, 'QA_EXPECT_SOURCE and QA_EXPECT_ORDINAL pin the immutable artifact');
assert.equal(build.source, process.env.QA_EXPECT_SOURCE, 'compiled SOURCE identity');
assert.equal(build.ordinal, process.env.QA_EXPECT_ORDINAL, 'compiled ORDINAL identity');
const sourceFiles = [];
function listSource(dir) { for (const e of readdirSync(dir, { withFileTypes: true })) {
  const path = resolve(dir, e.name); if (e.isDirectory()) listSource(path); else if (e.name.endsWith('.js')) sourceFiles.push(path);
} }
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
    assert.equal(served.match(/export const BUILT = '([^']*)'/)?.[1], html.match(/const BUILT = '([^']*)'/)?.[1], 'generated BUILT source stamp matches compiled artifact');
    assert.equal(served.match(/export const EDITION = '([^']*)'/)?.[1], 'high', 'source entrypoint retains high edition');
    assert.ok(['high','light'].includes(html.match(/const EDITION = '([^']*)'/)?.[1]), 'compiled edition is an authored build tier');
    assert.equal(served.match(/export const RUN_PATH = '([^']*)'/)?.[1], 'source tree', 'source entrypoint identifies source tree');
    assert.equal(html.match(/const RUN_PATH = '([^']*)'/)?.[1], 'standalone file', 'compiled entrypoint identifies standalone file');
    assert.equal(digest(normalizeStamp(served)), digest(normalizeStamp(readFileSync(path, 'utf8'))), 'buildversion code identity excluding generated stamp fields');
  } else assert.equal(sourceDigests[relative], digest(readFileSync(path)), `immutable source fixture identity: ${relative}`);
}));
const previousReport = resumePath ? JSON.parse(readFileSync(resolve(resumePath), 'utf8')) : null;
if (previousReport) assertResumeIdentity(previousReport, { build, htmlSha256, sourceDigests });
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const owner = await launchBrowser({ browser: process.env.CHROME || '/usr/bin/chromium', prefix: 'ca-' });
const browser = await chromium.connectOverCDP(owner.wsUrl);
const report = previousReport || { url, source, sourceRoot, build, htmlSha256, sourceDigests, inventory, mode, pace, host: { cpuCount: cpus().length, load: loadavg(), freeMemory: freemem(), samples: [] },
  fixture: 'Fresh createRunCombat from the screenshot run, canonical enemies/knowledge/moves, custom difficulty hpMult=20 and resource maxima 200. One registered card plus legal draw/discard fillers. Data fields only copied into the live fight; original runtime functions, listeners, dispatch, target resolver, renderer and timeline preserved. These are isolated fixtures, not earned playthroughs.',
  cases: [], errors: [], platformWarnings: [], networkFailures: [], animationDispatch: [], started: new Date().toISOString(), coverageLimits: [
    'Source-engine oracle parity proves compiled input and effect resolution match canonical source. Independent intended-effect/conditional trigger contracts are reported by the engine audit.',
    'Relic/status registries are inventoried here; exhaustive relic/status activation belongs to the engine audit.',
  ] };
if (resumePath) {
  report.runs ||= [{ pace: report.pace, started: report.started }];
  report.runs.push({ pace, started: new Date().toISOString(), resumedFrom: resumePath });
  report.pace = pace; delete report.finished; delete report.counts;
}
const latestCases = new Map(report.cases.map(row => [caseKey(row), row]));
const completedCase = (device, classId, row) => {
  const entry = latestCases.get(caseKey({ device, classId, ...row }));
  return entry && ['passed','expected-refusal'].includes(entry.status) ? entry : null;
};
let activeCase = null;
const checkpoint = () => writeFileSync(resolve(out, `report-${mode}-${deviceFilter || 'both'}-${classFilter || 'all'}-${variantFilter || 'all'}.json`), JSON.stringify(report, null, 2));
const tap = async (page, locator, device) => device === 'phone' ? locator.tap({ timeout: 6000 }) : locator.click({ timeout: 6000 });

async function boot(context, classId) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page); page.__auditAudioNodes = [];
  await cdp.send('WebAudio.enable');
  cdp.on('WebAudio.audioNodeCreated', event => page.__auditAudioNodes.push({ at: Date.now(), node: event.node.nodeType }));
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
    window.__auditClickReceipts = [];
    addEventListener('click', event => {
      const at = performance.now(), before = window.__combat?.eventLog.length || 0;
      const target = event.target.closest('[data-instance-id],[data-eid],button')?.className || event.target.tagName;
      setTimeout(() => {
        const paid = window.__combat?.eventLog.slice(before).filter(e => e.type === 'cardPlayed') || [];
        for (const receipt of paid) window.__auditClickReceipts.push({ inputAt: at, receiptAt: performance.now(), inputToReceiptMs: performance.now() - at, instanceId: receipt.cardInstanceId, target });
      }, 0);
    }, true);
    addEventListener('unhandledrejection', e => window.__auditUnhandled.push(String(e.reason?.stack || e.reason)));
    new PerformanceObserver(list => window.__auditLongTasks.push(...list.getEntries().map(e => ({ at: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
  });
  const settings = encodeURIComponent(JSON.stringify({ animSpeed: pace }));
  const kit = arg('main-hand') ? `&shotKit=1&shotMainHand=${encodeURIComponent(arg('main-hand'))}&shotOffHand=${encodeURIComponent(arg('off-hand') || '')}` : '';
  const pools = curated ? '' : '&shotMaxHp=200&shotMaxMana=200&shotMaxStamina=200&shotMana=200';
  await page.goto(`${url}?shot=combat&shotClass=${classId}&shotSeed=B${pools}&shotSettings=${settings}${kit}`, { waitUntil: 'domcontentloaded' });
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
    if (!row.curated) {
      run.maxHp = run.maxMana = run.maxStamina = 200; run.hp = 100; run.mana = run.stamina = 100;
      run.ashenBlightBasePools = { maxHp: 200, maxMana: 200, maxStamina: 200 };
    }
    c.rng.restoreCounters(window.__auditBaseRng);
    if (row.relicId) run.relics = [...new Set([...run.relics, row.relicId])];
    const native = row.profileId ? run.deck.find(i => i.cardId === row.cardId && i.profileId === row.profileId) : null;
    if (row.profileId && !native) throw new Error(`No canonical equipped ${row.cardId}@${row.profileId} instance in the run deck`);
    if (native) run.deck = run.deck.filter(i => i !== native);
    const inst = { ...(native || {}), cardId: row.cardId || 'strike', instanceId: row.instanceId, upgraded: row.variant === 'upgraded',
      ...(row.school ? { damageSchool: row.school } : {}) };
    run.deck = [...run.deck, inst, ...Array.from({ length: 10 }, (_, i) => ({ cardId: i % 2 ? 'defend' : 'strike', instanceId: `audit-fill-${row.instanceId}-${i}`, upgraded: false }))];
    const prefix = row.prePlayCard ? { cardId: row.prePlayCard, instanceId: `${inst.instanceId}-prefix`, upgraded: false } : null;
    if (prefix) run.deck.push(prefix);
    window.__auditInstanceId = inst.instanceId;
    const enemies = row.enemyIds || ['wanderingSoldier', 'wanderingSoldier'];
    const encounter = c.registries.encounters.all().find(e => enemies.every(id => e.enemies.includes(id)));
    const fresh = createRunCombat({ registries: c.registries, rng: c.rng, run, enemyIds: enemies, encounter, hpMult: row.victory || row.curated ? 1 : 20,
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
    c.piles.hand = [inst, ...(prefix ? [prefix] : []), ...c.piles.hand.filter(i => i.instanceId !== inst.instanceId && i.instanceId !== prefix?.instanceId).slice(0, 2)];
    c.piles.draw = run.deck.filter(i => !c.piles.hand.some(h => h.instanceId === i.instanceId));
    c.piles.discard = []; c.piles.exhaust = [];
    if (!row.curated) {
      c.player.energy = row.deniedCost ? 0 : 20; c.player.energyMax = 20;
      c.player.mana = row.deniedCost ? 0 : Math.floor(c.player.maxMana / 2); c.player.stamina = row.deniedCost ? 0 : Math.floor(c.player.maxStamina / 2);
      c.player.hp = Math.ceil(c.player.maxHp / 2);
    }
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
    window.__auditSelectedOrigin = null;
    const sample = () => {
      const host = document.querySelector('.combatant.player .alternative-card-stage'), stage = host?.__poseStage, canvas = host?.querySelector('canvas');
      let hash = null;
      if (canvas) try {
        const probe = document.createElement('canvas'); probe.width = probe.height = 32; const context = probe.getContext('2d');
        context.drawImage(canvas, 0, 0, 32, 32); const bytes = context.getImageData(0, 0, 32, 32).data;
        let h = 2166136261; for (const byte of bytes) h = Math.imul(h ^ byte, 16777619); hash = h >>> 0;
      } catch (error) { hash = String(error); }
      window.__auditFrameSamples.push({ at: performance.now(), hash, missing: !stage, pose: stage?.pose,
        art: stage?.currentArt, action: stage?.presentation?.action, stance: stage?.stance, rest: stage?.rest,
        // The live setStance contract only exposes a non-null stance when its
        // held frame exists; restPose resolves that value to stance-<id>.
        heldPose: stage?.stance ? `stance-${stage.stance}` : null });
      if (window.__auditSampling) requestAnimationFrame(sample);
    };
    if (row.sampleAnimation) requestAnimationFrame(sample);
    return { ...window.__auditStart, refused, preview: { needsTarget: preview.needsTarget, cost: preview.cost, manaCost: preview.manaCost, staminaCost: preview.staminaCost }, choice, plan,
      effects: def.effects, tags: def.cardTags || def.tags, attack: def.attack, upcastTiers: def.upcast?.unlockedTiers || [], knowledge: !!c.enemyKnowledge, rng: c.rng.getCounters(),
      instance: inst, loadout: c.loadout };
  }, { source, row });
}

async function finishPending(page, device, chooseReaction = false) {
  const choices = [];
  for (let i = 0; i < 18; i++) {
    await page.waitForFunction(() => window.__combat.result
      || window.__combat.pendingReaction && !!document.querySelector('.reaction-choice')
      || window.__combat.pendingAbilityDiscard && !!document.querySelector('.discard-choice')
      || document.querySelector('.end-turn')?.disabled === false, null, { timeout: 30000 });
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
  const card = page.locator(`.hand .card[data-instance-id="${row.instanceId}"]`);
  await card.waitFor({ state: 'visible' });
  await tap(page, card, device);
  if (row.upcastTier && !before.refused && !row.deniedCost) {
    await tap(page, card.locator('.card-upcast'), device);
    await card.locator('.card-upcast-rank').selectOption(String(row.upcastTier));
  }
  if (row.sampleAnimation) {
    await page.waitForFunction(() => !!document.querySelector('.combatant.player .alternative-card-stage')?.__poseStage, null, { timeout: 600 }).catch(() => {});
    await page.evaluate(async () => {
    await document.querySelector('.combatant.player .alternative-card-stage')?.__poseStage?.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.evaluate(() => {
      const stage = document.querySelector('.combatant.player .alternative-card-stage')?.__poseStage;
      window.__auditSelectedOrigin = { at: performance.now(), missing: !stage, pose: stage?.pose, stance: stage?.stance, rest: stage?.rest, action: stage?.presentation?.action };
    });
  }
  if (row.curated) await page.screenshot({ path: resolve(out, `${device}-${row.classId}-${row.cardId}-selected.png`) });
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
  const intent = { type: 'playCard', cardInstanceId: row.instanceId, ...(before.plan.mode === 'enemy' ? { targetId: 'e1' } : {}),
    ...(before.choice ? { choice: before.choice.options.find(o => !o.active).id } : {}), ...(row.upcastTier ? { upcastTier: row.upcastTier } : {}) };
  await page.evaluate(intent => window.__auditOracleDispatch(window.__auditOracle, intent), intent);
  if (before.plan.mode === 'enemy') {
    if (row.figureTarget) {
      const point = await page.evaluate(() => {
        const frame = document.querySelector('.combatant.enemy[data-eid="e1"]'), sprite = frame.querySelector('.sprite'), b = sprite.getBoundingClientRect();
        for (let yi = 1; yi < 10; yi++) for (let xi = 1; xi < 10; xi++) {
          const x = b.left + b.width * xi / 10, y = b.top + b.height * yi / 10, hit = document.elementFromPoint(x, y);
          if (hit?.closest('.combatant.enemy') === frame || hit?.closest('.enemy-target-button')?.dataset.eid === 'e1') return { x, y };
        }
        return null;
      });
      assert.ok(point, 'enemy figure has an accessible pointer target');
      if (device === 'phone') await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    } else await tap(page, page.locator('.enemy-target-button:not([disabled])').first(), device);
  }
  else {
    await tap(page, page.locator('.combatant.player .player-action-intent'), device);
  }
  if (before.choice) await tap(page, page.locator('.card-choice [data-choice]:not([disabled])').first(), device);
  await page.waitForFunction(() => window.__combat.eventLog.slice(window.__auditStart.eventCount).some(e => e.type === 'cardPlayed' && e.cardInstanceId === window.__auditInstanceId), null, { timeout: 10000 });
  if (row.curated) {
    await page.waitForFunction(() => !!document.querySelector('.combatant.player .alternative-card-stage')?.__poseStage?.presentation?.action, null, { timeout: 5000 });
    await page.screenshot({ path: resolve(out, `${device}-${row.classId}-${row.cardId}-paid-action.png`) });
  }
  return { choices: await finishPending(page, device, row.chooseReaction), invalidTargetRecovered: !!row.invalidTarget };
}

async function receipt(page) {
  return page.evaluate(() => {
    const c = window.__combat, events = c.eventLog.slice(window.__auditStart.eventCount);
    window.__auditSampling = false;
    const stage = document.querySelector('.combatant.player .alternative-card-stage')?.__poseStage;
    return { hp: c.enemies.map(e => e.hp), player: { hp: c.player.hp, energy: c.player.energy, mana: c.player.mana, stamina: c.player.stamina },
      events, pile: ['hand', 'draw', 'discard', 'exhaust'].find(p => c.piles[p].some(i => i.instanceId === window.__auditInstanceId)) || 'consumedPower',
      pending: !!(c.pendingReaction || c.reactionResume || c.pendingAbilityDiscard), queue: c.queue.length, phase: c.phase, turn: c.turn, result: c.result,
      unhandled: window.__auditUnhandled, longTasks: window.__auditLongTasks.filter(e => e.at >= window.__auditStart.at),
      latencyMs: performance.now() - window.__auditStart.at, aiming: document.querySelectorAll('.aiming').length,
      runtimePreserved: Object.entries(window.__auditRuntime).every(([key, fn]) => c[key] === fn),
      oracle: { events: window.__auditOracle.eventLog.slice(window.__auditStart.eventCount), player: window.__auditOracle.player,
        enemies: window.__auditOracle.enemies, piles: window.__auditOracle.piles, phase: window.__auditOracle.phase },
      actual: { player: c.player, enemies: c.enemies, piles: c.piles, phase: c.phase }, frames: window.__auditFrameSamples,
      selectedOrigin: window.__auditSelectedOrigin,
      stage: stage ? { animationSetId: stage.animationSetId, pose: stage.pose, stance: stage.stance, rest: stage.rest, alternateWeaponPoses: stage.poses.filter(p => p.startsWith('weapon:')) } : null,
      inputReceipts: window.__auditClickReceipts.filter(r => r.inputAt >= window.__auditStart.at) };
  });
}

async function endTurnAndPlayNext(page, device, row) {
  const plan = await page.evaluate(async source => (await import(source + 'engine/handRules.js')).discardChoicePlan(window.__combat), source);
  const discardIds = plan.cards.slice(0, plan.minimum).map(c => c.instanceId);
  await tap(page, page.locator('.end-turn'), device);
  await tap(page, page.locator('.confirmation-modal .confirmation-confirm'), device);
  if (plan.prompt) {
    await page.waitForSelector('.hand-discard-modal');
    for (const id of discardIds) await tap(page, page.locator(`.hand-discard-modal input[data-discard-id="${id}"]`), device);
  }
  await page.evaluate(discardIds => window.__auditOracleDispatch(window.__auditOracle, { type: 'endTurn', discardIds }), discardIds);
  if (plan.prompt) await tap(page, page.locator('.hand-discard-confirm'), device);
  const choices = await finishPending(page, device, row.chooseReaction);
  await page.waitForSelector('.end-turn:not([disabled])', { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__combat.turn), 2, 'enemy turn completes into player turn two');
  assert.equal(await page.locator('.hand .card.selected,.hand .card.armed').count(), 0, 'end turn clears targeting');
  const recovered = [];
  for (let i = 0; i < 9; i++) {
    const recovery = await page.evaluate(async source => {
      const { controlGate, recoveryControls } = await import(source + 'engine/combatStatusControl.js');
      const { resolveCombatCard } = await import(source + 'engine/combatExpansion.js');
      const c = window.__combat;
      if (c.piles.hand.some(card => controlGate(c, c.player, resolveCombatCard(c, card)).allowed)) return null;
      return recoveryControls(c, c.player).find(row => !row.disabled && c.player.energy >= row.costPerStack) || null;
    }, source);
    if (!recovery) break;
    const intent = { type: 'recoverControl', selections: [{ status: recovery.status, stacks: 1 }] };
    await page.evaluate(intent => window.__auditOracleDispatch(window.__auditOracle, intent), intent);
    await tap(page, page.locator(`[data-control-recovery="${recovery.status}"]`), device);
    await finishPending(page, device); recovered.push(recovery.status);
  }
  const next = await page.evaluate(async source => {
    const { previewCard, cardChoicePlan } = await import(source + 'engine/combat.js');
    const { resolveCombatCard } = await import(source + 'engine/combatExpansion.js');
    const { controlGate } = await import(source + 'engine/combatStatusControl.js');
    const c = window.__combat;
    const inst = c.piles.hand.find(i => { const p = previewCard(c, i.instanceId), def = resolveCombatCard(c, i); return controlGate(c, c.player, def).allowed && !c.registries.framework.isUnplayable(def) && p.cost <= c.player.energy && p.manaCost <= c.player.mana; });
    if (!inst) return null;
    const p = previewCard(c, inst.instanceId), choice = cardChoicePlan(c, inst.instanceId);
    return { instanceId: inst.instanceId, cardId: inst.cardId, needsTarget: p.needsTarget, choice: choice?.options.find(o => !o.active)?.id };
  }, source);
  assert.ok(next, 'a real affordable next-turn card is available');
  const intent = { type: 'playCard', cardInstanceId: next.instanceId, ...(next.needsTarget ? { targetId: 'e1' } : {}), ...(next.choice ? { choice: next.choice } : {}) };
  await page.evaluate(intent => window.__auditOracleDispatch(window.__auditOracle, intent), intent);
  await tap(page, page.locator(`.hand .card[data-instance-id="${next.instanceId}"]`), device);
  if (next.needsTarget) await tap(page, page.locator('.enemy-target-button:not([disabled])').first(), device);
  else await tap(page, page.locator('.combatant.player .player-action-intent'), device);
  if (next.choice) await tap(page, page.locator(`.card-choice [data-choice="${next.choice}"]`), device);
  await page.waitForFunction(id => window.__combat.eventLog.some(e => e.type === 'cardPlayed' && e.cardInstanceId === id), next.instanceId, { timeout: 10000 });
  choices.push(...await finishPending(page, device));
  return { discardIds, choices, recovered, next };
}

async function runCase(page, device, classId, row) {
  row.classId = classId;
  row.instanceId = `audit-${report.cases.length}-${row.cardId}-${row.variant}`;
  activeCase = { device, classId, ...row };
  const entry = { ...activeCase, status: 'running' }; report.cases.push(entry);
  latestCases.set(caseKey(entry), entry);
  const errorStart = report.errors.length;
  const audioStart = page.__auditAudioNodes.length, networkStart = report.networkFailures.length;
  try {
    entry.before = await fixture(page, row);
    if (row.prePlayCard) {
      const instanceId = `${row.instanceId}-prefix`;
      const needsTarget = await page.evaluate(async ({ source, instanceId }) => (await import(source + 'engine/combat.js')).previewCard(window.__combat, instanceId).needsTarget, { source, instanceId });
      await page.evaluate(({ instanceId, needsTarget }) => window.__auditOracleDispatch(window.__auditOracle, { type: 'playCard', cardInstanceId: instanceId, ...(needsTarget ? { targetId: 'e1' } : {}) }), { instanceId, needsTarget });
      await tap(page, page.locator(`.hand .card[data-instance-id="${instanceId}"]`), device);
      await tap(page, needsTarget ? page.locator('.enemy-target-button:not([disabled])').first() : page.locator('.combatant.player .player-action-intent'), device);
      await page.waitForFunction(id => window.__combat.eventLog.some(e => e.type === 'cardPlayed' && e.cardInstanceId === id), instanceId);
      await finishPending(page, device);
    }
    entry.input = await play(page, device, row, entry.before);
    if (row.recoverControl) {
      const refusalEvidence = entry.input;
      const intent = { type: 'recoverControl', selections: [{ status: row.activeControl, stacks: 1 }] };
      await page.evaluate(intent => window.__auditOracleDispatch(window.__auditOracle, intent), intent);
      await tap(page, page.locator(`[data-control-recovery="${row.activeControl}"]`), device);
      await finishPending(page, device);
      assert.equal(await page.evaluate(status => !!window.__combat.player.statuses[status]?.stacks, row.activeControl), false, 'real recovery control removes active lock');
      entry.input = { ...await play(page, device, row, { ...entry.before, refused: null }), refusalEvidence, recovered: true };
    }
    if (row.endTurn) entry.enemyTurn = await endTurnAndPlayNext(page, device, row);
    if (row.deniedRecovery) entry.input = { ...entry.input, refusalEvidence: structuredClone(entry.input), refusal: null, recoveredAtNextTurn: true };
    if (row.sampleAnimation) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    entry.after = await receipt(page);
    if (row.category?.endsWith('counter-return')) assert.ok(entry.after.events.some(e => e.type === 'combatCounterTriggered' && e.cardInstanceId === row.instanceId), 'the real incoming action triggers this prepared Counter return');
    if (row.profileId) {
      assert.equal(entry.before.instance.profileId, row.profileId, 'played instance comes from canonical equipped profile');
      assert.equal(entry.after.stage?.animationSetId, `class-cards-${classId}`, 'equipped profile retains default class artwork');
      assert.deepEqual(entry.after.stage.alternateWeaponPoses, [], 'alternate weapon animation families stay disabled');
    }
    entry.audioNodes = page.__auditAudioNodes.slice(audioStart);
    for (const failure of report.networkFailures.slice(networkStart)) {
      const match = new URL(failure.url).pathname.match(/^\/assets\/sfx\/([^/]+)\.ogg$/);
      if (match && !Object.hasOwn(SFX_MANIFEST, decodeURIComponent(match[1])) && resolveRecipe(decodeURIComponent(match[1])).recipe.length
        && entry.audioNodes.some(n => ['Oscillator','AudioBufferSource'].includes(n.node))) failure.classification = 'optional-cue-with-observed-synthesis';
      else { failure.classification = 'unexpected-resource-failure'; report.errors.push({ case: activeCase, kind: 'network', message: failure.url }); }
    }
    if (row.sampleAnimation) {
      const frames = entry.after.frames, actionFrames = frames.filter(f => f.action);
      const first = frames.find(f => f.at >= (entry.after.selectedOrigin?.at || 0) && f.action && f.heldPose);
      const measured = first?.heldPose && entry.after.selectedOrigin?.pose === first.heldPose ? entry.after.selectedOrigin : undefined;
      const origin = measured || (first ? { at: first.at, pose: first.heldPose, stance: first.stance, method: 'expected-held-pose-from-live-stage-contract' } : undefined);
      const actions = [];
      let current = null;
      for (const frame of frames.filter(f => f.at >= (entry.after.selectedOrigin?.at || 0))) {
        if (frame.action !== current?.action) {
          if (current) { current.completed = !frame.action; current.after = frame; current.returnedToOrigin = current.origin === frame.pose; actions.push(current); }
          current = frame.action ? { action: frame.action, origin: frame.heldPose, first: frame, hashes: [] } : null;
        }
        if (current && typeof frame.hash === 'number') current.hashes.push(frame.hash);
      }
      if (current) actions.push({ ...current, completed: false });
      for (const action of actions) { action.frameChanged = new Set(action.hashes).size > 1; delete action.hashes; }
      report.animationDispatch.push({ device, classId, cardId: row.cardId, receiptId: row.instanceId, dispatchType: 'paid-card', cardPlayed: entry.after.events.some(e => e.type === 'cardPlayed'),
        presentationKind: entry.after.events.some(e => e.type === 'combatCounterTriggered' && e.cardInstanceId === row.instanceId) ? 'counter-return'
          : entry.before.tags.includes('maneuver:counter') ? 'held-preparation' : 'finite-playback',
        frameChanged: new Set(actionFrames.map(f => f.hash).filter(h => typeof h === 'number')).size > 1, actionStarted: actionFrames.length > 0,
        actionCompleted: actionFrames.length > 0 && !frames.at(-1)?.action,
        returnedToOrigin: !!origin && origin.pose === frames.at(-1)?.pose, origin, originMethod: measured ? 'measured-post-selection' : origin?.method,
        selectedOrigin: entry.after.selectedOrigin, actions, tags: entry.before.tags, before: frames[0], after: frames.at(-1), frames });
    }
    const paid = entry.after.events.filter(e => e.type === 'cardPlayed' && e.cardInstanceId === row.instanceId);
    assert.equal(paid.length, entry.input.refusal ? 0 : 1, 'one paid card receipt per play');
    if (!entry.input.refusal) {
      assert.notEqual(entry.after.pile, 'hand', 'played card leaves hand');
      const sum = type => entry.after.events.filter(e => e.type === type).reduce((n, e) => n + (e.amount || 0), 0);
      if (!row.endTurn) {
        const recoverySpent = entry.after.events.filter(e => e.type === 'controlRecovered').reduce((n, e) => n + (e.cost || 0), 0);
        assert.equal(entry.after.player.energy, entry.before.player.energy - sum('energySpent') - recoverySpent + sum('energyGained') + sum('energyRecovered') + sum('staminaRecovered'), 'Actions/Stamina alias ledger balances');
        assert.equal(entry.after.player.mana, entry.before.player.mana - sum('manaSpent') + sum('manaRestored') + sum('manaRecovered'), 'Mana ledger balances');
      }
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
    if (row.curated) {
      await page.screenshot({ path: resolve(out, `${device}-${classId}-${row.cardId}-held.png`) });
      entry.gallery = { build, classId, device, cardId: row.cardId, canonicalPools: true, fixture: 'Canonical screenshot run pools and enemy HP; authored card added to a legal run deck, paid through real input.',
        captures: ['selected', 'paid-action', 'held'].map(phase => resolve(out, `${device}-${classId}-${row.cardId}-${phase}.png`)) };
    }
    const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    entry.parity = { actualState: hash(entry.after.actual), oracleState: hash({ player: entry.after.oracle.player, enemies: entry.after.oracle.enemies, piles: entry.after.oracle.piles, phase: entry.after.oracle.phase }),
      actualEffects: hash(entry.after.events), oracleEffects: hash(entry.after.oracle.events) };
    delete entry.after.oracle;
    // Exact comparison above uses the full receipt. Large formula-context
    // snapshots are redundant in raw successful evidence, so retain effect data.
    for (const event of entry.after.events) { delete event.abilityEntities; delete event.abilityBefore; }
    if (['strike', 'defend', 'starSpark', 'guardCounter', 'warriorsVow', 'bindingParry', 'ricochet', 'bloodPact'].includes(row.cardId) && row.variant === 'base')
      await page.screenshot({ path: resolve(out, `${device}-${classId}-${row.cardId}.png`) });
  } catch (error) {
    entry.status = 'failed'; entry.error = error.stack;
    try { entry.failureState = await receipt(page); await page.screenshot({ path: resolve(out, `failure-${device}-${classId}-${row.cardId}-${row.variant}.png`) }); } catch { /* original error retained */ }
  }
  if (entry.status === 'failed' || report.cases.length % 25 === 0 || mode !== 'cards') console.log(JSON.stringify({ cases: report.cases.length, ...activeCase, status: entry.status, error: entry.error?.split('\n')[0], latencyMs: entry.after?.latencyMs }));
  if (report.cases.length % 25 === 0) report.host.samples.push({ cases: report.cases.length, at: new Date().toISOString(), load: loadavg(), freeMemory: freemem() });
  if (report.cases.length % 10 === 0 || entry.status === 'failed' || mode !== 'cards') checkpoint();
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
          const row = { cardId: card.id, variant, category: 'card', figureTarget: card.id.length % 2 === 0, curated,
            sampleAnimation: pace === 'normal' && variant === 'base' && ['strike','defend','starSpark','guardCounter','sweepingBlow','crimsonCleave','quickstep','bindingParry','ricochet','cometFragment','litany','bloodPact','bashingBlow','evasiveGuard','wardingStar','nockAndWait','progression-falling-constellation'].includes(card.id) };
          let baseEntry = completedCase(device, classId, row);
          if (!baseEntry && !await runCase(page, device, classId, row)) {
            await page.close(); page = await boot(context, classId);
          }
          baseEntry ||= latestCases.get(caseKey({ device, classId, ...row }));
          if (variant === 'base' && (!variantFilter || variantFilter === 'all')) for (const upcastTier of baseEntry.before?.upcastTiers || []) {
            const upcast = { ...row, variant: `upcast-${upcastTier}`, upcastTier, sampleAnimation: false };
            if (!completedCase(device, classId, upcast) && !await runCase(page, device, classId, upcast)) { await page.close(); page = await boot(context, classId); }
          }
        }
      }
      if (mode === 'negatives') {
        const rows = [
          { cardId: 'strike', deniedCost: true, category: 'insufficient-resources' },
          { cardId: 'strike', deniedCost: true, deniedRecovery: true, endTurn: true, category: 'empty-resources-endturn-recovery' },
          { cardId: 'strike', activeControl: 'dazed', category: 'controlled' },
          { cardId: 'strike', activeControl: 'dazed', recoverControl: true, category: 'controlled-recovery' },
          { cardId: 'guardianBulwark', repeatStance: true, category: 'repeat-stance' },
          { cardId: 'strike', invalidTarget: true, category: 'invalid-target-recovery' },
          { cardId: 'strike', category: 'legal-after-refusals', figureTarget: true },
        ];
        for (const row of rows) if (!await runCase(page, device, classId, { ...row, variant: 'base' })) { await page.close(); page = await boot(context, classId); }
      }
      if (mode === 'profiles') {
        assert.ok(arg('profile') && arg('main-hand'), 'profiles require canonical equipped --profile and --main-hand');
        await runCase(page, device, classId, { cardId: 'strike', profileId: arg('profile'), category: 'equipment-profile', variant: `profile-${arg('profile')}`, figureTarget: true, sampleAnimation: pace === 'normal' });
      }
      if (mode === 'enemies' || mode === 'scenarios') {
        const rows = mode === 'enemies' ? inventory.enemies.filter(id => !arg('enemy') || arg('enemy').split(',').includes(id))
          .map(enemyId => ({ cardId: 'strike', enemyIds: [enemyId], category: 'enemy-turn', endTurn: true })) : [
          { cardId: 'strike', enemyIds: ['gildedKnight'], category: 'enemy-reaction', endTurn: true },
          { cardId: 'defend', enemyIds: ['wanderingSoldier'], category: 'guarded-enemy-turn', endTurn: true },
          { cardId: 'evasiveGuard', enemyIds: ['wanderingSoldier'], category: 'evade-enemy-turn', endTurn: true },
          ...[
            { cardId: classId === 'reaver' ? 'guardCounter' : 'spikedReprisal', enemyIds: ['wanderingSoldier'], category: 'guard-counter-return', endTurn: true, prePlayCard: 'defend' },
            { cardId: 'dodgeRoll', enemyIds: ['wanderingSoldier'], category: 'evasion-counter-return', endTurn: true, prePlayCard: 'defend' },
          ],
          { cardId: 'defend', enemyIds: ['wanderingSoldier'], category: 'defend-selected-origin', prePlayCard: 'strike' },
          ...(classId === 'herald' ? [{ cardId: 'bloodPact', category: 'spell-selected-origin', prePlayCard: 'strike' }] : []),
          { cardId: 'strike', enemyStatuses: [{ status: 'invulnerability', stacks: 1 }], category: 'damage-without-health-loss' },
          { cardId: 'strike', enemyIds: ['wanderingSoldier'], category: 'victory-reward', victory: true },
        ];
        for (const row of rows.filter(row => !arg('category') || arg('category').split(',').includes(row.category))) {
          if (!await runCase(page, device, classId, { ...row, variant: 'base', sampleAnimation: pace === 'normal', figureTarget: true })) { await page.close(); page = await boot(context, classId); }
          else if (row.victory) {
            const entry = report.cases.at(-1);
            try {
              assert.equal(entry.after.result, 'victory', 'the killing play wins the canonical encounter');
              await page.waitForSelector('#reward-expand:not([disabled])', { timeout: 30000 });
              const before = await page.evaluate(() => window.__spoils());
              assert.ok(before.pendingReward && before.savedPendingReward, 'victory writes a durable reward receipt');
              await tap(page, page.locator('#reward-expand'), device);
              await page.waitForSelector('#reward-continue:not([disabled])', { timeout: 15000 });
              await page.screenshot({ path: resolve(out, `${device}-${classId}-victory-reward.png`) });
              await tap(page, page.locator('#reward-continue'), device);
              await tap(page, page.locator('.confirmation-modal .confirmation-confirm'), device);
              await page.waitForFunction(done => window.__spoils().done === done + 1 && !window.__spoils().pendingReward, before.done, { timeout: 15000 });
              const after = await page.evaluate(() => window.__spoils());
              assert.equal(after.savedPendingReward, null, 'reward completion clears persisted receipt');
              entry.reward = { before, after };
            } catch (error) { entry.status = 'failed'; entry.rewardError = error.stack; entry.rewardText = await page.locator('body').innerText(); }
            checkpoint(); await page.close(); page = await boot(context, classId);
          }
        }
      }
      await page.close();
    }
    await context.close();
  }
} finally {
  report.finished = new Date().toISOString();
  report.counts = Object.fromEntries(['passed', 'expected-refusal', 'failed'].map(status => [status, [...latestCases.values()].filter(c => c.status === status).length]));
  report.attempts = report.cases.length;
  checkpoint(); await browser.close(); await owner.close();
}
console.log(JSON.stringify({ counts: report.counts, out }));
if (report.counts.failed) process.exitCode = 1;
}

if (resolve(process.argv[1] || '') === new URL(import.meta.url).pathname) await main();
