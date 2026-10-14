#!/usr/bin/env node
// Actual-screen screenshot QA for the stance/accuracy HUD. All UI is rendered
// by mountCombat; deterministic combat objects and card instances are fixtures.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const OUT = resolve(process.env.STANCE_COMBAT_QA_OUT || 'outputs/stance-combat');
mkdirSync(OUT, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const base = 'http://127.0.0.1:' + server.server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const errors = [];
const closingPages = new WeakSet();
const teardownAborts = [];
const imageCancellations = [];
const cancellationChecks = [];
const views = {};
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  generatedAt: new Date().toISOString(),
  fixtureBoundary: 'Screenshots use the production combat route and mountCombat renderer with production card/enemy definitions. Combat state, stance/status values, card instances, and RNG stream return values are deterministic QA fixtures; these captures are not player navigation recordings.',
  viewports: { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } },
  views,
  failures: [],
  browserErrors: errors,
  teardownAborts,
  imageCancellations,
};
let page;
let fixtureSeq = 0;
async function waitStableVisible(locator) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  await locator.evaluate(async element => {
    const animations = [];
    for (let node = element; node; node = node.parentElement) animations.push(...node.getAnimations());
    await Promise.all(animations.filter(animation => animation.playState === 'running'
      && Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map(animation => animation.finished.catch(() => {})));
  });
  const handle = await locator.elementHandle();
  await page.waitForFunction(element => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility !== 'visible' || Number(style.opacity) < 0.98) return false;
    }
    return true;
  }, handle, { timeout: 10000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function waitArt() {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all([...document.images].map(image => image.decode?.().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function capture(name, viewport, settleArt = true) {
  if (settleArt) await waitArt();
  const path = resolve(OUT, name + '.png');
  const jpg = resolve(OUT, name + '.jpg');
  await page.screenshot({ path, fullPage: false });
  await page.screenshot({ path: jpg, type: 'jpeg', quality: 82, fullPage: false });
  views[name] = {
    png: name + '.png', jpg: name + '.jpg', viewport,
    visibleText: await page.locator('body').innerText().catch(() => ''),
    viewportState: await page.evaluate(() => ({
      url: location.href, width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
    })),
  };
}
async function boot(viewport, query = '') {
  page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  const observedPage = page;
  await page.addInitScript(() => {
    // Record actual DOM image replacement/removal, rather than assuming that
    // every aborted image was an animation. Keep exact resolved source URLs.
    const changes = window.__stanceQaImageChanges = [];
    const record = (source, kind) => {
      if (!source) return;
      let url;
      try { url = new URL(source, document.baseURI).href; } catch { return; }
      changes.push({ url, kind, at: Date.now(), fixture: window.__stanceQaFixture || 0 });
      if (changes.length > 2000) changes.shift();
    };
    new MutationObserver(records => {
      for (const mutation of records) {
        if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG') {
          const previous = mutation.oldValue;
          if (previous && previous !== mutation.target.getAttribute('src')) record(previous, 'src-replaced');
        }
        for (const removed of mutation.removedNodes || []) {
          const images = removed.nodeType === 1
            ? [...(removed.tagName === 'IMG' ? [removed] : []), ...removed.querySelectorAll('img')] : [];
          for (const image of images) {
            record(image.currentSrc, 'image-removed');
            record(image.getAttribute('src'), 'image-removed');
          }
        }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'], attributeOldValue: true });
  });
  page.on('requestfailed', request => {
    const errorText = request.failure()?.errorText || '';
    // Sprite frame preloads may still be in flight after document images decode.
    // Only our explicit page teardown makes an aborted request expected; an
    // aborted live-page request or any other network failure still fails QA.
    if (closingPages.has(observedPage) && errorText === 'net::ERR_ABORTED') {
      teardownAborts.push({ url: request.url(), errorText });
      return;
    }
    const failure = 'request failed: ' + request.url() + ' ' + errorText
      + ' [fixture=' + fixtureSeq + ', pageClosing=' + closingPages.has(observedPage) + ', pageClosed=' + observedPage.isClosed() + ']';
    if (errorText !== 'net::ERR_ABORTED' || request.resourceType() !== 'image'
      || new URL(request.url()).origin !== base) {
      errors.push(failure);
      return;
    }
    const cancellation = { url: request.url(), errorText, fixture: fixtureSeq, verified: false };
    imageCancellations.push(cancellation);
    cancellationChecks.push(observedPage.evaluate(async ({ url, fixture }) => {
      const change = [...(window.__stanceQaImageChanges || [])].reverse().find(entry =>
        entry.url === url && entry.fixture === fixture && Date.now() - entry.at <= 5000);
      if (!change) throw new Error('no matching recent image source replacement or removal');
      // Verify the exact cancelled URL, not a fallback or a related frame.
      const response = await fetch(url, { cache: 'reload', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('asset verification HTTP ' + response.status);
      const bitmap = await createImageBitmap(await response.blob());
      const width = bitmap.width, height = bitmap.height;
      bitmap.close();
      if (!width || !height) throw new Error('asset verification decoded no pixels');
      return { change, status: response.status, width, height };
    }, { url: cancellation.url, fixture: cancellation.fixture }).then(result => {
      Object.assign(cancellation, result, { verified: true });
    }).catch(error => {
      cancellation.verificationError = error.message;
      errors.push(failure + ' [image cancellation verification failed: ' + error.message + ']');
    }));
  });
  await page.goto(base + '/?shot=combat&shotClass=starseer&shotExpansion=ward' + query, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('.combat').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('.combatant.player').waitFor({ state: 'visible', timeout: 30000 });
  await waitArt();
}
async function closePage(target) {
  if (!target) return;
  // Give outstanding sprite preloads a chance to finish while failures still
  // count as live-page errors. A bounded wait also permits teardown of a page
  // with a stalled connection; only its explicit abort is classified below.
  await target.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await Promise.all(cancellationChecks);
  closingPages.add(target);
  await target.close();
}
async function waitActionSettled() {
  // Early-callout captures intentionally precede the completed action. The
  // first damage float is not completion: mountCombat keeps the hand locked
  // until playTimeline finishes, and frame-swapping effects may still be live.
  await page.waitForFunction(() => {
    const hand = document.querySelector('.combat .hand');
    return hand?.getAttribute('aria-disabled') === 'false';
  }, null, { timeout: 15000 });
  // Include detached warmEffectFrames image requests, which document.images
  // and waitArt do not cover. Keep every request failure under the live audit.
  await page.waitForLoadState('networkidle', { timeout: 15000 });
}
async function remount(cards, options = {}) {
  const sequence = ++fixtureSeq;
  await page.evaluate(async ({ cards, options, sequence }) => {
    window.__stanceQaFixture = sequence;
    const { mountCombat } = await import('/src/ui/screens/combat.js');
    const { createRunState } = await import('/src/model/state.js');
    const combat = window.__combat, registries = combat.registries;
    const run = window.__combatRunForShot || createRunState({ seed: 7814, classId: 'starseer', registries });
    if (!window.__stanceQaInitial) window.__stanceQaInitial = {
      playerStatuses: structuredClone(combat.player.statuses),
      rngCounters: combat.rng.getCounters(),
      enemies: combat.enemies.map(enemy => ({
        hp: enemy.hp, maxHp: enemy.maxHp, alive: enemy.alive, block: enemy.block,
        statuses: structuredClone(enemy.statuses), combatStance: structuredClone(enemy.combatStance),
        knowledgeAction: structuredClone(enemy.knowledgeAction),
      })),
    };
    combat.phase = 'player';
    combat.player.alive = true;
    combat.player.statuses = structuredClone(window.__stanceQaInitial.playerStatuses);
    combat.rng.restoreCounters(window.__stanceQaInitial.rngCounters);
    combat.piles.hand = cards.map((cardId, index) => ({ instanceId: 'stance-qa-' + sequence + '-' + index, cardId, upgraded: false }));
    for (const [index, enemy] of combat.enemies.entries()) {
      const initial = window.__stanceQaInitial.enemies[index];
      if (!initial) continue;
      enemy.hp = initial.hp; enemy.maxHp = initial.maxHp; enemy.alive = initial.alive; enemy.block = initial.block;
      enemy.statuses = structuredClone(initial.statuses);
      enemy.combatStance = structuredClone(initial.combatStance);
      enemy.knowledgeAction = structuredClone(initial.knowledgeAction);
    }
    combat.player.energy = 10;
    combat.player.stamina = 10;
    const target = combat.enemies[0];
    combat.player.accuracyAdvantage = !!options.accuracyAdvantage;
    combat.player.accuracyDisadvantage = !!options.accuracyDisadvantage;
    if (target) {
      target.evadeAdvantage = false; target.evadeDisadvantage = false;
      target.nextEvadeMode = null; target.combatEvade = null;
      target.combatStance = options.enemyStance || null;
      const observer = combat.playerKey || 'player';
      const previousRead = target.knowledgeAction?.reads?.[observer] || {};
      target.knowledgeAction = {
        ...target.knowledgeAction,
        reads: {
          ...(target.knowledgeAction?.reads || {}),
          [observer]: { ...previousRead, visibility: options.unknown ? 'unknown' : 'exact' },
        },
      };
      if (!options.failedEvade) {
        const statuses = { ...target.statuses };
        delete statuses.evade;
        target.statuses = statuses;
      }
    }
    if (options.hud) {
      combat.player.block = 12;
      combat.player.wardBlock = 3;
      combat.player.persistentWard = { value: 5, max: 5 };
      combat.player.persistentPoise = { value: 4, max: 20 };
      combat.player.poiseMeter = { value: 4, max: 20 };
      combat.player.statuses = { ...combat.player.statuses, evade: { stacks: 2 } };
    }
    if (options.playerStance) combat.player.combatStance = options.playerStance;
    if (options.enemyStance) combat.enemies[0].combatStance = options.enemyStance;
    if (options.failedEvade) {
      combat.enemies[0].combatStance = { maneuver: 'evade', camp: 'physical', range: 'melee' };
      combat.enemies[0].statuses = { ...combat.enemies[0].statuses, evade: { stacks: 1 } };
    }
    if (options.evade) combat.enemies[0].combatEvade = { charges: 1, bonus: 100, advantage: false, disadvantage: false, expiresOnOwnerCycle: 1 };
    if (options.roll != null) {
      const { primeAccuracyRolls } = await import('/tests/accuracyFixture.mjs');
      primeAccuracyRolls(combat, { die: options.roll });
    }
    if (typeof window.__renderCombatForShot === 'function') window.__renderCombatForShot();
    else mountCombat(document.querySelector('#app'), {
      registries, run, combat,
      meta: { settings: { animationSpeed: options.slow ? 'slow' : 'instant', holdConfirm: 'off', reducedMotion: true } },
      onEnd() {},
    });
    window.__stanceQaRun = run;
  }, { cards, options, sequence });
  await page.locator('.combat').waitFor({ state: 'visible' });
  await waitArt();
}
async function assertChanceSurfaces(expectedMode) {
  const hud = page.locator('.combat-hit-chance:visible').first();
  await hud.waitFor({ state: 'visible', timeout: 10000 });
  const targetId = await page.evaluate(() => window.__combat.enemies.find(enemy => enemy.alive)?.id);
  assert.ok(targetId, 'a live target exists for the selected attack');
  const card = page.locator('.card-hit-chance[data-target-id="' + targetId + '"]:visible').first();
  await card.waitFor({ state: 'visible', timeout: 10000 });
  const [hudInfo, cardInfo] = await Promise.all([
    hud.evaluate(node => ({ text: node.innerText.trim(), mode: node.dataset.rollMode })),
    card.evaluate(node => ({ text: node.innerText.trim(), mode: node.dataset.rollMode })),
  ]);
  const cardOddsGeometry = await card.evaluate(node => {
    const odds = node.closest('.card-hit-chances');
    const selectedCard = odds?.closest('.card');
    if (!odds || !selectedCard) return { ok: false, reason: 'odds panel is not inside the selected card' };
    const rect = element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    return { ok: true, odds: rect(odds), selectedCard: rect(selectedCard), viewport: { width: innerWidth, height: innerHeight } };
  });
  assert.ok(cardOddsGeometry.ok, cardOddsGeometry.reason);
  assert.ok(cardOddsGeometry.odds.width > 0 && cardOddsGeometry.odds.height > 0, 'selected-card odds panel has visible geometry');
  assert.ok(cardOddsGeometry.odds.left >= 0 && cardOddsGeometry.odds.top >= 0
    && cardOddsGeometry.odds.right <= cardOddsGeometry.viewport.width
    && cardOddsGeometry.odds.bottom <= cardOddsGeometry.viewport.height,
  'selected-card odds panel remains fully inside the viewport');
  assert.ok(cardOddsGeometry.odds.left >= cardOddsGeometry.selectedCard.left
    && cardOddsGeometry.odds.top >= cardOddsGeometry.selectedCard.top
    && cardOddsGeometry.odds.right <= cardOddsGeometry.selectedCard.right
    && cardOddsGeometry.odds.bottom <= cardOddsGeometry.selectedCard.bottom,
  'selected-card odds panel remains fully inside the selected card');
  const percent = text => {
    const match = text.match(/([\d.]+)%/);
    assert.ok(match, 'percentage is visible: ' + text);
    return Number(match[1]);
  };
  assert.equal(hudInfo.mode, expectedMode, 'fighter HUD roll mode');
  assert.equal(cardInfo.mode, expectedMode, 'selected card roll mode');
  assert.equal(percent(hudInfo.text), percent(cardInfo.text), 'card and fighter HUD show the same exact hit chance');
  return { hud: hudInfo, card: cardInfo };
}

async function inspectCard(cardId, label) {
  const card = page.locator('.hand .card[data-card-id="' + cardId + '"]').first();
  await card.waitFor({ state: 'visible', timeout: 20000 });
  await card.focus();
  await card.press('Tab');
  const info = page.locator('.card-info-button:visible').first();
  await info.waitFor({ state: 'visible', timeout: 5000 });
  await info.press('Enter');
  const detail = page.locator('.card-inspection-modal:visible, .card-inspection-details:visible, .deck-editor-inspector:visible').first();
  await waitStableVisible(detail);
  if (cardId === 'crystalBarrier') {
    const rules = page.locator('.card-inspection-modal .ctext, .card-inspection-details .ctext').first();
    await rules.waitFor({ state: 'visible', timeout: 5000 });
    const fit = await rules.evaluate(node => ({
      scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
      scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
    }));
    assert.ok(fit.scrollHeight <= fit.clientHeight, 'Crystal Barrier text fits without vertical clipping');
    assert.ok(fit.scrollWidth <= fit.clientWidth, 'Crystal Barrier text fits without horizontal clipping');
    const rulesPanel = page.locator('.card-inspection-modal .ic-layer[data-component="rules"]').first();
    const faceLines = rulesPanel.locator('.face-line');
    const lineFits = await faceLines.evaluateAll(lines => lines.map(line => ({
      text: line.innerText.trim(),
      scrollWidth: line.scrollWidth,
      clientWidth: line.clientWidth,
    })));
    assert.ok(lineFits.length > 0, 'Crystal Barrier inspection exposes rules face lines');
    for (const line of lineFits) {
      assert.ok(line.scrollWidth <= line.clientWidth, 'Crystal Barrier face line fits horizontally: ' + line.text);
    }
    const lastFaceLine = faceLines.last();
    await lastFaceLine.waitFor({ state: 'visible', timeout: 5000 });
    const visualGap = await lastFaceLine.evaluate(line => {
      const panel = line.closest('.ic-layer[data-component="rules"]');
      return panel.getBoundingClientRect().bottom - line.getBoundingClientRect().bottom;
    });
    assert.ok(visualGap >= 2, 'Crystal Barrier final face line leaves at least 2px at the rules panel bottom');
  }
  await capture(label, { width: 1440, height: 1000 });
  await page.keyboard.press('Escape').catch(() => {});
}

try {
  await boot({ width: 1440, height: 1000 });
  await remount([], { hud: true });
  const hpRow = page.locator('.combatant.player .combat-health-row').first();
  assert.ok(await hpRow.count(), 'player HP row rendered');
  assert.doesNotMatch(await hpRow.innerText(), /\[object Object\]/, 'HP badges do not render object placeholders');
  const evadeBadge = page.locator('.combatant.player .combat-health-row [data-defense-kind="evade"]').first();
  assert.ok(await evadeBadge.locator('svg').count(), 'Evade badge uses its SVG icon');
  const evadeBox = await evadeBadge.boundingBox();
  assert.ok(evadeBox && evadeBox.width <= 26 && evadeBox.height <= 26, 'Evade badge icon fits the compact HUD row');
  for (const kind of ['evade', 'poise', 'ward', 'shield']) {
    assert.ok(await page.locator('.combatant.player .combat-health-row [data-defense-kind="' + kind + '"]').count(), 'player ' + kind + ' row rendered');
  }
  await capture('combat-hud-desktop', { width: 1440, height: 1000 });

  // Production cards are mounted into the real combat screen to expose each
  // changed card face and inspection panel in a stable authored state.
  await remount(['strike', 'defend', 'frostCounter', 'crystalBarrier']);
  await inspectCard('defend', 'card-inspection-defense');
  await inspectCard('frostCounter', 'card-inspection-counter');
  await inspectCard('crystalBarrier', 'card-inspection-spell');

  // Actual route's authored hand includes a damaging card and live enemy.
  await remount(['strike'], { roll: 20 });
  const attack = page.locator('.hand .card[data-card-id="strike"]').first();
  await attack.waitFor({ state: 'visible', timeout: 20000 });
  await attack.click();
  const chance = await assertChanceSurfaces('neutral');
  await capture('selected-damage-known-enemy', { width: 1440, height: 1000 });
  views['selected-damage-known-enemy'].hitChance = chance;

  await remount(['strike'], { unknown: true });
  await page.locator('.hand .card[data-card-id="strike"]').first().click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.combat-hit-chance:visible, .card-hit-chance:visible').count(), 0,
    'unknown enemy hides both fighter HUD and selected-card hit percentages');
  assert.equal(await page.locator('.card-hit-chances:visible').count(), 0, 'unknown enemy has no selected-card odds panel');
  await capture('selected-damage-unknown-enemy', { width: 1440, height: 1000 });

  await closePage(page);
  await boot({ width: 390, height: 844 });
  assert.ok(await page.locator('.combatant.player .combat-health-row').count(), 'phone player HP row rendered');
  await capture('combat-hud-phone', { width: 390, height: 844 });

  // Stance modes are rendered from production preview state; each capture
  // records the data-roll-mode value so desktop review can identify the case.
  for (const [mode, flags] of [
    ['neutral', {}],
    ['advantage', { accuracyAdvantage: true }],
    ['disadvantage', { accuracyDisadvantage: true }],
  ]) {
    await remount(['strike'], flags);
    await page.locator('.hand .card[data-card-id="strike"]').first().click();
    const modeNode = page.locator('.combat-hit-chance:visible[data-roll-mode="' + mode + '"]').first();
    await modeNode.waitFor({ state: 'visible', timeout: 10000 });
    const detail = await modeNode.evaluate(node => ({
      label: node.innerText.trim(),
      color: getComputedStyle(node).color,
      mode: node.dataset.rollMode,
    }));
    const surfaces = await assertChanceSurfaces(mode);
    assert.match(detail.label, /\b[\d.]+%/i, mode + ' displays a numeric hit percentage');
    assert.notEqual(detail.color, 'rgba(0, 0, 0, 0)', mode + ' has visible roll-mode color');
    await capture('phone-hit-' + mode, { width: 390, height: 844 });
    views['phone-hit-' + mode].hitChance = detail;
    views['phone-hit-' + mode].cardHitChance = surfaces.card;
  }
  const chances = ['advantage', 'neutral', 'disadvantage'].map(mode => {
    const match = views['phone-hit-' + mode].hitChance.label.match(/([\d.]+)%/);
    return match ? Number(match[1]) : NaN;
  });
  assert.ok(chances[0] > chances[1] && chances[1] > chances[2], 'accuracy modes order hit chances advantage > neutral > disadvantage');

  // Capture event callouts while the real action is in progress. Hit reports
  // are captured on the first callout frame, before the later damage callout.
  for (const [name, options, kind, label] of [
    ['hit-callout', { roll: 20, slow: true }, 'hit', /^Hit\b/],
    ['failed-evade-callout', { failedEvade: true, roll: 20, slow: true }, 'evadeFailed', /Hit — Evade Failed/],
    ['successful-miss-callout', { evade: true, roll: 1, slow: true }, 'missed', /Missed/],
  ]) {
    await remount(['strike'], options);
    await page.locator('.hand .card[data-card-id="strike"]').first().click();
    await page.locator('.enemy:not(.dead)').first().click();
    const callout = page.locator('.fx-callout[data-callout-kind="' + kind + '"]');
    await callout.waitFor({ state: 'visible', timeout: 15000 });
    assert.match(await callout.innerText(), label);
    if (kind === 'hit' || kind === 'evadeFailed') {
      await page.waitForTimeout(120);
      const damageFloats = page.locator('.float-num.dmg:visible, .float-num.poise:visible, .float-num.ward:visible');
      assert.equal(await damageFloats.count(), 0, name + ': hit outcome callout is visible before HP/Poise/Ward damage floats');
      await capture(name, { width: 390, height: 844 }, false);
      await damageFloats.first().waitFor({ state: 'visible', timeout: 3000 });
      views[name].eventOrder = 'hit callout captured before the first damage or pressure float';
    } else {
      await capture(name, { width: 390, height: 844 }, false);
    }
    // Settle only after the early frame was captured, before resetting the
    // next fixture or checking the final network audit.
    await waitActionSettled();
  }
  await Promise.all(cancellationChecks);
  report.browserErrors = errors;
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ output: OUT, head: report.head, views: Object.keys(views) }, null, 2));
} catch (error) {
  report.failures.push({ name: 'stance-combat', message: error.message, stack: error.stack });
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  throw error;
} finally {
  await closePage(page).catch(() => {});
  await browser.close();
  server.server.closeAllConnections?.();
  await new Promise(resolveClose => server.server.close(resolveClose));
}
