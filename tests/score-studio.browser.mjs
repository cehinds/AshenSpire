// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/score-studio.browser.mjs
// Like the other tests/*.browser.mjs files it is run by hand: no workflow or run-node.mjs list picks these up.
// Real Chromium on the real Score Studio page (tools/score-studio/). Guards the audit's broken basics:
// card faces render at card size (the game's card stylesheets are linked), an edit reaches the local
// draft (auto-save runs after the edit, not before), and the card face shows what the inspector edits.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');

const CORE_POOL_SIZE = 106;
const DRAFT_KEY = 'ashenspire:scoreStudioDraft:v1';
const DRAFT_SETTLE_MS = 400;
const STUDIO_PATH = 'tools/score-studio/';

const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${server.url}${STUDIO_PATH}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction((count) => document.querySelectorAll('.studio-card-tile').length >= count, CORE_POOL_SIZE, { timeout: 120000 });

  // 1. The gallery holds the core pool, and the page raised no errors while booting.
  const tiles = await page.locator('.studio-card-tile').count();
  assert.equal(tiles, CORE_POOL_SIZE, `gallery shows the ${CORE_POOL_SIZE}-card core pool`);
  assert.deepEqual(pageErrors, [], 'no uncaught errors while the studio boots');

  // 2. A card face is card-shaped. Without illustrated-cards.css its layers stack in flow and the face runs
  //    over ten times taller than it is wide.
  const face = await page.evaluate(() => {
    const box = document.querySelector('.studio-card-stage .illustrated-card-face').getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  assert.ok(face.width > 0 && face.height < face.width * 2, `card face is card-shaped (${Math.round(face.width)}x${Math.round(face.height)})`);

  // 2b. The Score Breakdown formula adds up to the CP the inspector shows.
  const breakdown = await page.evaluate(() => ({
    formula: document.getElementById('breakdown-formula')?.textContent || '',
    summaryCp: document.querySelector('.inspector-score-big')?.textContent || '',
  }));
  const formulaParts = breakdown.formula.match(/^Raw (-?[\d.]+) − rarity (-?[\d.]+) = CP (-?[\d.]+)/);
  assert.ok(formulaParts, `breakdown formula line is shown (${breakdown.formula})`);
  assert.equal(Number(formulaParts[1]) - Number(formulaParts[2]), Number(formulaParts[3]), 'raw minus rarity equals CP in the formula');
  assert.equal(`CP ${formulaParts[3]}`, breakdown.summaryCp.trim(), 'the formula CP matches the inspector CP');

  // 2c. An edit that changes nothing the score reads keeps the score. The edited copy used to skip the game's
  //     card projection, so retyping Acid Splash's own name charged it an extra MP and dropped CP 13 to CP 5.
  const stable = await page.evaluate(() => {
    document.querySelector('.studio-card-tile[data-card-id="core.acidSplash"]').click();
    const before = document.getElementById('breakdown-formula').textContent;
    const input = document.getElementById('edit-name');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { before, after: document.getElementById('breakdown-formula').textContent };
  });
  assert.equal(stable.after, stable.before, 'retyping the same name leaves the score unchanged');

  // 2c. Card Basics fields carry weight chips, and the inspector card shows the breakdown's rank as a badge.
  const fieldAndRank = await page.evaluate(() => {
    const rankText = document.querySelector('.rank-pill')?.textContent || '';
    return {
      rarityChip: document.getElementById('field-score-rarity')?.textContent.trim() || '',
      targetChip: document.getElementById('field-score-target')?.textContent.trim() || '',
      badge: document.querySelector('#inspector-card-preview .studio-rank-badge')?.textContent.trim() || '',
      rankNumber: rankText.match(/Rank: (?:Rank (\d+)|Unranked)/)?.[1] ?? '0',
    };
  });
  assert.match(fieldAndRank.rarityChip, /^[−+±-]\d/, `the Rarity chip shows a signed number (${fieldAndRank.rarityChip})`);
  assert.match(fieldAndRank.targetChip, /[−+±-]\d/, `the Target chip shows a signed number (${fieldAndRank.targetChip})`);
  const ROMAN = ['U', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  assert.equal(fieldAndRank.badge, ROMAN[Number(fieldAndRank.rankNumber)], 'the inspector card\'s rank badge matches the breakdown rank');

  // 3. A weight edit is staged (owner, 2026-11-23): the draft's pending copy holds it at once, the applied
  //    config only after Apply. The draft used to be written before the edit was applied.
  const draftWeight = await page.evaluate(async ({ key, settle }) => {
    document.querySelector('.studio-tab[data-tab="weights"]').click();
    const input = document.querySelector('#weights-container input');
    const before = Number(input.value);
    const next = before + 3;
    input.value = String(next);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, settle));
    const staged = JSON.parse(localStorage.getItem(key));
    const applyLabel = document.getElementById('btn-weights-apply').textContent;
    document.getElementById('btn-weights-apply').click();
    await new Promise((resolve) => setTimeout(resolve, settle));
    const applied = JSON.parse(localStorage.getItem(key));
    document.querySelector('.studio-tab[data-tab="cards"]').click();
    return {
      before,
      next,
      applyLabel,
      stagedPending: staged?.pendingScoring?.costs?.sp?.weight,
      stagedApplied: staged?.scoring?.costs?.sp?.weight,
      saved: applied?.scoring?.costs?.sp?.weight,
      pendingAfterApply: applied?.pendingScoring ?? null,
    };
  }, { key: DRAFT_KEY, settle: DRAFT_SETTLE_MS });
  assert.equal(draftWeight.stagedPending, draftWeight.next, 'the draft pending copy holds the weight just typed');
  assert.notEqual(draftWeight.stagedApplied, draftWeight.next, 'a staged weight is not applied before Apply');
  assert.equal(draftWeight.applyLabel, 'Apply (1)', 'Apply counts the staged change');
  assert.equal(draftWeight.saved, draftWeight.next, 'after Apply the draft holds the weight just typed');
  assert.equal(draftWeight.pendingAfterApply, null, 'Apply empties the pending copy');

  // 3b. An effect's "per" edit is staged, marks its row pending, and after Apply marks it changed.
  const draftPer = await page.evaluate(async ({ key, settle }) => {
    document.querySelector('.studio-tab[data-tab="weights"]').click();
    const input = document.querySelector('.weight-row.has-per input.weight-per');
    const effect = input.getAttribute('aria-label').replace(/ per$/, '');
    const next = Number(input.value) + 1;
    input.value = String(next);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, settle));
    const rowOf = () => document.querySelector(`.weight-row.has-per input.weight-per[aria-label="${effect} per"]`).closest('.weight-row');
    const pending = rowOf().classList.contains('is-pending');
    document.getElementById('btn-weights-apply').click();
    await new Promise((resolve) => setTimeout(resolve, settle));
    const modified = rowOf().classList.contains('is-modified');
    document.querySelector('.studio-tab[data-tab="cards"]').click();
    return { next, pending, modified, saved: JSON.parse(localStorage.getItem(key))?.scoring?.effects?.[effect]?.per };
  }, { key: DRAFT_KEY, settle: DRAFT_SETTLE_MS });
  assert.ok(draftPer.pending, 'the staged per marks its weight row pending');
  assert.equal(draftPer.saved, draftPer.next, 'after Apply the draft holds the per just typed');
  assert.ok(draftPer.modified, 'the applied per marks its weight row changed');

  // 4. Renaming the selected card changes the name on its tile.
  const renamed = await page.evaluate(() => {
    const name = 'Studio Smoke Name';
    const input = document.getElementById('edit-name');
    input.value = name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const selected = document.querySelector('.studio-card-tile.is-selected .studio-card-stage');
    return { name, tileText: selected.innerText };
  });
  assert.ok(renamed.tileText.includes(renamed.name), 'the tile shows the edited name');

  // 5. Changing the SP cost changes the cost shown on the inspector's card.
  const cost = await page.evaluate(() => {
    const shown = () => document.querySelector('#inspector-card-preview [data-card-binding="stamina"]')?.textContent.trim();
    const input = document.getElementById('edit-sp');
    const next = Number(input.value) + 2;
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { next: String(next), shown: shown() };
  });
  assert.equal(cost.shown, cost.next, 'the inspector card shows the edited SP cost');

  // 5b. SP scores the cost typed, like MP. The reference fight reprices an edited card: Feint's multi-hit
  //     SP floor turned 0 SP into 3, and Brace stayed at 0 SP whatever was typed.
  const typedSp = await page.evaluate(() => {
    const spPill = () => [...document.querySelectorAll('.part-pill')].map((p) => p.textContent).find((t) => t.startsWith('SP:')) || 'none';
    const setSp = (cardId, value) => {
      document.querySelector(`.studio-card-tile[data-card-id="${cardId}"]`).click();
      const input = document.getElementById('edit-sp');
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const chip = document.getElementById('cost-score-sp');
      return {
        count: chip.querySelector('.feature-count').textContent,
        total: chip.querySelector('.feature-total').textContent,
        weight: Number(chip.title.match(/^(-?[\d.]+) per 1/)?.[1]),
        pill: spPill(),
      };
    };
    return { feintZero: setSp('core.feint', 0), braceTwo: setSp('core.brace', 2) };
  });
  assert.deepEqual([typedSp.feintZero.count, typedSp.feintZero.total, typedSp.feintZero.pill], ['×0', '0', 'none'], '0 SP scores 0 on a multi-hit card');
  const brace = typedSp.braceTwo;
  assert.ok(brace.weight < 0, `the SP chip names its weight (${brace.weight})`);
  assert.deepEqual([brace.count, Number(brace.total), brace.pill], ['×2', 2 * brace.weight, `SP: ${brace.total}`], '2 SP scores 2 x the SP weight on Brace');

  // 6. Removing the effects a card's text names drops those sentences from the text, so the face stops
  //    listing them. Acid Splash's text is "Apply {frail} Frail and {vulnerable} Vulnerable."
  const removed = await page.evaluate(() => {
    const tile = document.querySelector('.studio-card-tile[data-card-id="core.acidSplash"]');
    tile.click();
    while (document.querySelector('#active-features-list [data-rm-eff]')) {
      document.querySelector('#active-features-list [data-rm-eff]').click();
    }
    return {
      text: document.getElementById('edit-text').value,
      warnings: document.getElementById('text-warnings').innerText.trim(),
      face: document.querySelector('#inspector-card-preview').innerText,
    };
  });
  assert.ok(!removed.text.includes('{frail}') && !removed.text.includes('{vulnerable}'), `removed statuses leave the card text (${removed.text})`);
  assert.equal(removed.warnings, '', 'no stale-token warning once the sentences are gone');
  assert.ok(!/Frail|\{frail\}/.test(removed.face), 'the card face no longer lists the removed Frail');

  // 6b. A {token} typed into the text with no effect behind it is still flagged, under the text box and on the tile.
  const stale = await page.evaluate(() => {
    const input = document.getElementById('edit-text');
    input.value = 'Apply {frail} Frail.';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      warnings: document.getElementById('text-warnings').innerText,
      tileMarked: Boolean(document.querySelector('.studio-card-tile[data-card-id="core.acidSplash"] .text-warn-chip')),
    };
  });
  assert.match(stale.warnings, /Card text mentions \{frail\}, but the card has no Frail effect\./, 'a typed token with no effect is named as stale');
  assert.ok(stale.tileMarked, 'the gallery tile is marked when its card text has stale tokens');

  // 7. Card text Auto writes the text from the effects and keeps it in step as features change.
  const auto = await page.evaluate(() => {
    const toggle = document.getElementById('toggle-auto-text');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    const afterOn = document.getElementById('edit-text').value;
    document.querySelector('[data-quick-add="effect:block"]').click();
    const afterAdd = document.getElementById('edit-text').value;
    const input = document.getElementById('edit-text');
    input.value = 'My own words.';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { afterOn, afterAdd, offAfterTyping: !toggle.checked };
  });
  assert.equal(auto.afterOn, 'No effect.', 'Auto rewrites the text straight away');
  assert.match(auto.afterAdd, /Gain \{block\} Block\./, 'Auto adds the new effect to the text');
  assert.ok(auto.offAfterTyping, 'typing in the text box turns Auto off');

  // 8. Every section folds: the Art panes, the sandbox hand and log, and each weight group, and it remembers.
  const sections = await page.evaluate((key) => {
    document.querySelector('.studio-tab[data-tab="weights"]').click();
    const required = ['art-layers', 'art-preview', 'art-assets', 'sandbox-hand', 'sandbox-log', 'weights-costs', 'basics', 'features', 'override', 'breakdown'];
    const missing = required.filter((name) => !document.querySelector(`details[data-section="${name}"] > summary`));
    const log = document.querySelector('details[data-section="sandbox-log"]');
    log.open = false;
    return new Promise((resolve) => setTimeout(() => {
      resolve({ missing, stored: JSON.parse(localStorage.getItem(key) || '{}')['sandbox-log'] });
      log.open = true;
      document.querySelector('.studio-tab[data-tab="cards"]').click();
    }, 50));
  }, 'ashenspire:scoreStudioSections:v1');
  assert.deepEqual(sections.missing, [], 'every studio section is collapsible');
  assert.equal(sections.stored, false, 'a folded section is remembered');

  // 6b. A status row's ⓘ opens what the status does in play, from the game's own tooltip.
  const statusInfo = await page.evaluate(() => {
    document.querySelector('.studio-card-tile[data-card-id="core.acidSplash"]').click();
    document.querySelector('[data-quick-add="status:burn"]').click();
    const row = [...document.querySelectorAll('#active-features-list .feature-row')].find((r) => r.querySelector('[data-eff-stacks]'));
    row.querySelector('.info-btn').click();
    const line = row.querySelector('.feature-desc');
    return { hidden: line.hidden, does: line.innerText.match(/Does:\s*(.*)/)?.[1]?.trim() || '' };
  });
  assert.equal(statusInfo.hidden, false, 'the ⓘ opens the status description');
  assert.ok(statusInfo.does.length > 0 && !/No description yet/.test(statusInfo.does), `a status row says what it does (${statusInfo.does})`);

  // 7. Auto-name: a new card starts with it on; adding a status renames it, and the name fits its title box.
  const autoName = await page.evaluate(async () => {
    document.getElementById('btn-new-card').click();
    const before = document.getElementById('edit-name').value;
    const toggleOn = document.getElementById('toggle-auto-name').checked;
    const select = document.getElementById('add-feature-select');
    select.value = 'status:weak';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('btn-add-feature').click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const title = document.querySelector('#inspector-card-preview [data-card-binding="name"]');
    return { before, after: document.getElementById('edit-name').value, toggleOn, scrollWidth: title?.scrollWidth ?? 0, clientWidth: title?.clientWidth ?? 0 };
  });
  assert.ok(autoName.toggleOn, 'a new card starts with Auto-name on');
  assert.notEqual(autoName.after, autoName.before, `adding a status renames an auto-named card (${autoName.before} -> ${autoName.after})`);
  assert.ok(autoName.scrollWidth <= autoName.clientWidth, `the generated title fits its box (${autoName.scrollWidth} <= ${autoName.clientWidth})`);

  // 8. A duplicate is auto-named from its source's noun, never "(Copy)".
  const duplicateName = await page.evaluate(() => {
    document.querySelector('.studio-card-tile[data-card-id="core.acidSplash"]').click();
    document.getElementById('btn-duplicate-card').click();
    return { name: document.getElementById('edit-name').value, autoName: document.getElementById('toggle-auto-name').checked };
  });
  assert.ok(duplicateName.autoName, 'a duplicate starts with Auto-name on');
  assert.doesNotMatch(duplicateName.name, /\(Copy\)/, `the duplicate's auto name has no "(Copy)" (${duplicateName.name})`);

  assert.deepEqual(pageErrors, [], 'no uncaught errors while editing');
  await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
  await page.close();
  console.log('score-studio browser: ok');
} finally {
  await browser.close();
  await server.close?.();
}
process.exit(0);
