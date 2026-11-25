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

  // 3c. An effect row reads as a sentence, "[1] pts per [3] damage", and its example follows the boxes as typed.
  const sentence = await page.evaluate(() => {
    document.querySelector('.studio-tab[data-tab="weights"]').click();
    const row = document.querySelector('.weight-row input.weight-per[aria-label="damage per"]').closest('.weight-row');
    const order = [...row.querySelectorAll('.weight-sentence input')].map((el) => el.className);
    const words = [...row.querySelectorAll('.weight-sentence > :not(.weight-reset-btn)')].map((el) => (el.matches('.weight-words') ? el.textContent : `[${el.querySelector('input')?.className || el.className}]`)).filter(Boolean).join(' ');
    const weight = row.querySelector('input.weight-input');
    const per = row.querySelector('input.weight-per');
    const weightLabel = weight.getAttribute('aria-label');
    weight.value = '3';
    weight.dispatchEvent(new Event('input', { bubbles: true }));
    per.value = '5';
    per.dispatchEvent(new Event('input', { bubbles: true }));
    const example = row.querySelector('.weight-example').textContent;
    const intro = document.getElementById('weights-intro').textContent;
    document.querySelector('.studio-tab[data-tab="cards"]').click();
    return { order, words, weightLabel, example, intro };
  });
  assert.deepEqual(sentence.order, ['weight-input', 'weight-per'], 'the weight box comes before the per box');
  assert.equal(sentence.words, '[weight-input] pts per [weight-per] damage', 'the effect row reads "[n] pts per [n] damage"');
  assert.equal(sentence.weightLabel, 'damage points', 'the weight box is labelled as points');
  assert.equal(sentence.example, '10 damage = 6 pts', 'the example updates live from the typed boxes (3 pts per 5 damage)');
  assert.match(sentence.intro, /rarity discount is its CP/, 'the Weights tab explains how the parts add up');

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

  // 5c. The damage box is the card's own number, before the hero's bonus, so every number down to 0 sticks.
  //     The Starseer's INT and focus made Arcane Spark print 3 at any amount up to 1, so 1 snapped back to 3.
  const sparkAmounts = await page.evaluate(() => {
    const select = (cardId) => document.querySelector(`.studio-card-tile[data-card-id="${cardId}"]`).click();
    const kept = {};
    for (const typed of [0, 1, 2, 5]) {
      select('core.spark');
      const input = document.querySelector('#active-features-list [data-eff-amt]');
      input.value = String(typed);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      select('core.strike');
      select('core.spark');
      kept[typed] = document.querySelector('#active-features-list [data-eff-amt]').value;
    }
    return kept;
  });
  assert.deepEqual(sparkAmounts, { 0: '0', 1: '1', 2: '2', 5: '5' }, 'Arcane Spark keeps the damage typed, 0 included');

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

  // 6b. Add Feature search: typing narrows the list and picks the best name match; a rebuild keeps the owner's pick.
  const featureSearch = await page.evaluate(async () => {
    const search = document.getElementById('add-feature-search');
    const select = document.getElementById('add-feature-select');
    const all = [...select.options].filter((o) => o.value).length;
    search.value = 'poise dam';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const picked = select.value;
    const narrowed = [...select.options].filter((o) => o.value).length;
    const second = [...select.options].filter((o) => o.value)[1]?.value;
    select.value = second;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('btn-undo')?.click();
    document.getElementById('btn-redo')?.click();
    const kept = select.value;
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return { all, picked, narrowed, second, kept, cleared: [...select.options].filter((o) => o.value).length };
  });
  assert.equal(featureSearch.picked, 'effect:poiseDamage', 'the search picks Poise Damage for "poise dam"');
  assert.ok(featureSearch.narrowed > 0 && featureSearch.narrowed < featureSearch.all, `the list narrows (${featureSearch.narrowed} of ${featureSearch.all})`);
  assert.equal(featureSearch.kept, featureSearch.second, 'a rebuild keeps the picked feature');
  assert.equal(featureSearch.cleared, featureSearch.all, 'Escape restores the whole list');

  // 7. Auto-name gives the convention name (CardName, trimmed to naming.card.limit): a new card starts with it on, adding
  //    a status renames it, the name matches the hint's convention name, stays within the limit and fits its title box.
  const autoName = await page.evaluate(async () => {
    document.getElementById('btn-new-card').click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const before = document.getElementById('edit-name').value;
    const toggleOn = document.getElementById('toggle-auto-name').checked;
    const select = document.getElementById('add-feature-select');
    select.value = 'status:weak';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('btn-add-feature').click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const title = document.querySelector('#inspector-card-preview [data-card-binding="name"]');
    const hint = document.getElementById('name-hint').textContent;
    return { before, after: document.getElementById('edit-name').value, hint, toggleOn, scrollWidth: title?.scrollWidth ?? 0, clientWidth: title?.clientWidth ?? 0 };
  });
  const NAME_LIMIT = 24;
  assert.ok(autoName.toggleOn, 'a new card starts with Auto-name on');
  assert.match(autoName.before, /Strike/, `a new martial melee card is a Strike (${autoName.before})`);
  assert.notEqual(autoName.after, autoName.before, `adding a status renames an auto-named card (${autoName.before} -> ${autoName.after})`);
  assert.ok(autoName.hint.startsWith(`Convention: ${autoName.after} `), `the auto name is the convention name (${autoName.hint})`);
  assert.ok(autoName.after.length <= NAME_LIMIT, `the auto name keeps to the limit (${autoName.after})`);
  assert.ok(autoName.scrollWidth <= autoName.clientWidth, `the generated title fits its box (${autoName.scrollWidth} <= ${autoName.clientWidth})`);

  // 8. A duplicate starts auto-named with its convention name, never "(Copy)".
  const duplicateName = await page.evaluate(async () => {
    document.querySelector('.studio-card-tile[data-card-id="core.acidSplash"]').click();
    document.getElementById('btn-duplicate-card').click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { name: document.getElementById('edit-name').value, hint: document.getElementById('name-hint').textContent, autoName: document.getElementById('toggle-auto-name').checked };
  });
  assert.ok(duplicateName.autoName, 'a duplicate starts with Auto-name on');
  assert.doesNotMatch(duplicateName.name, /\(Copy\)/, `the duplicate's auto name has no "(Copy)" (${duplicateName.name})`);
  assert.ok(duplicateName.hint.startsWith(`Convention: ${duplicateName.name} `), `the duplicate takes its convention name (${duplicateName.hint})`);

  // 9. Keyword and multiplier-tag rows have the multiply-instead switch; unchecking stages the flat form.
  const flatSwitch = await page.evaluate(async (settle) => {
    document.querySelector('.studio-tab[data-tab="weights"]').click();
    const box = document.querySelector('input.weight-mult[aria-label="retain is a multiplier"]');
    const tagBox = document.querySelector('input.weight-mult[aria-label="Counterstrike (trait:counterstrike) is a multiplier"]');
    const before = { keyword: box?.checked, tag: tagBox?.checked };
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, settle));
    const row = box.closest('.weight-row');
    const result = {
      before,
      words: [...row.querySelectorAll('.weight-sentence > .weight-words')].map((el) => el.textContent).join('|'),
      value: row.querySelector('input.weight-input').value,
      pending: row.classList.contains('is-pending'),
      example: row.querySelector('.weight-example').textContent,
      naming: Boolean(document.querySelector('.naming-limit-group input.naming-max-chars')),
      keep: [...document.querySelectorAll('.naming-keep-item')].map((el) => el.dataset.part),
    };
    document.getElementById('btn-weights-discard').click();
    document.querySelector('.studio-tab[data-tab="cards"]').click();
    return result;
  }, DRAFT_SETTLE_MS);
  assert.deepEqual(flatSwitch.before, { keyword: true, tag: true }, 'retain and Counterstrike start as multipliers');
  assert.equal(flatSwitch.value, '0', 'switching to flat resets to the no-change value');
  assert.ok(flatSwitch.pending, 'the switch is staged');
  assert.match(flatSwitch.words, /^adds\|pts/, `the flat row reads "adds [n] pts" (${flatSwitch.words})`);
  assert.match(flatSwitch.example, /^Any card with it:/, `the flat example (${flatSwitch.example})`);
  assert.ok(flatSwitch.naming, 'the Naming group has a characters box');
  assert.deepEqual(flatSwitch.keep, ['base', 'rank', 'upgrade', 'element', 'effect', 'rarity'], 'the keep order lists every name part');

  // 10. Rename all: the dialog saves the current names, every card takes its convention name (one undo step),
  //     and Restore names > Default names puts the authored names back with Auto-name off.
  const renameAll = await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const tileName = (id) => document.querySelector(`.studio-card-tile[data-card-id="${id}"]`)?.textContent || '';
    document.querySelector('.studio-tab[data-tab="cards"]').click();
    const authored = tileName('core.backstep').includes('Backstep');
    document.getElementById('btn-rename-all').click();
    const dialogOpen = document.getElementById('rename-all-modal').open;
    document.getElementById('rename-all-set-name').value = 'Before rename';
    document.getElementById('btn-rename-all-save').click();
    await wait(400);
    const renamed = !tileName('core.backstep').includes('Backstep');
    const setRows = [...document.querySelectorAll('#restore-names-list .name-set-row span')].map((el) => el.textContent);
    document.getElementById('btn-undo').click();
    await wait(400);
    const undone = tileName('core.backstep').includes('Backstep');
    document.getElementById('btn-redo').click();
    await wait(400);
    document.getElementById('btn-restore-names').click();
    document.querySelector('#restore-names-list input[value="default"]').click();
    document.getElementById('btn-restore-names-apply').click();
    await wait(400);
    document.querySelector('.studio-card-tile[data-card-id="core.backstep"]').click();
    await wait(200);
    return {
      authored, dialogOpen, renamed, setRows, undone,
      restored: tileName('core.backstep').includes('Backstep'),
      autoNameOff: !document.getElementById('toggle-auto-name').checked,
    };
  });
  assert.ok(renameAll.authored, 'Backstep starts with its authored name');
  assert.ok(renameAll.dialogOpen, 'Rename all asks to save the current names first');
  assert.ok(renameAll.renamed, 'Rename all gives every card its convention name');
  assert.deepEqual(renameAll.setRows, ['Default names', 'Before rename'], 'the saved set joins Default names in Restore names');
  assert.ok(renameAll.undone, 'one undo puts every name back');
  assert.ok(renameAll.restored, 'Restore Default names gives back the authored name');
  assert.ok(renameAll.autoNameOff, 'restored cards have Auto-name off');

  // 11. Generate cards (owner, 2026-11-24): the modal opens on today's Core shape, Preview shows counts and sample
  //     names, Generate with Replace generated only makes the pool beside the Core cards, and one undo restores the list.
  const generate = await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const tiles = () => document.querySelectorAll('.studio-card-tile').length;
    const modal = document.getElementById('generate-cards-modal');
    const generated = async () => { document.getElementById('btn-gen-apply').click(); for (let t = 0; modal.open && t < 600; t++) await wait(100); };
    const before = tiles();
    document.getElementById('btn-generate-cards').click();
    const open = modal.open;
    const untitled = [...modal.querySelectorAll('input, select, button')].filter((el) => !el.closest('[title], [data-tip]')).map((el) => el.id || el.outerHTML.slice(0, 60));
    const sums = [...modal.querySelectorAll('[data-group] .gen-sum')].map((el) => el.textContent);
    modal.querySelector('input[name="gen-mode"][value="replaceGenerated"]').checked = true;
    document.getElementById('btn-gen-preview').click();
    const preview = document.getElementById('gen-preview');
    const sampleNames = preview.querySelectorAll('.gen-sample-names li').length;
    const previewText = preview.textContent;
    // An off-100 group shows red, and Generate scales it back to 100.
    const rare = modal.querySelector('[data-pct-rarity="rare"]');
    rare.value = String(Number(rare.value) + 10);
    rare.dispatchEvent(new Event('input', { bubbles: true }));
    const red = modal.querySelector('[data-sum="rarity"]').classList.contains('is-off');
    await generated();
    const toastText = document.getElementById('studio-toast').textContent;
    const after = tiles();
    const generatedCount = document.querySelectorAll('.studio-card-tile[data-card-id^="gen."]').length;
    const closed = !modal.open;
    // Generate again with Replace generated only: the generated cards are rebuilt, not added twice.
    document.getElementById('btn-generate-cards').click();
    const remembered = modal.querySelector('[data-sum="rarity"]').textContent;
    await generated();
    const again = tiles();
    document.getElementById('btn-undo').click();
    await wait(400);
    document.getElementById('btn-undo').click();
    await wait(400);
    return { before, open, untitled, sums, sampleNames, previewText, red, toastText, after, generated: generatedCount, closed, remembered, again, undone: tiles(), genLeft: document.querySelectorAll('.studio-card-tile[data-card-id^="gen."]').length };
  });
  assert.ok(generate.open, 'Generate cards opens its modal');
  assert.deepEqual(generate.untitled, [], 'every control in the modal has a tooltip');
  assert.ok(generate.sums.length >= 7 && generate.sums.every((t) => t === 'Total 100%'), `the default percent groups add up to 100 (${generate.sums})`);
  assert.equal(generate.sampleNames, 8, 'Preview shows 8 sample names');
  assert.match(generate.previewText, /106 cards[\s\S]*Rarity:[\s\S]*Rank:[\s\S]*School:/, 'Preview shows counts by rarity, rank and school');
  assert.ok(generate.red, 'a group that does not add up to 100 shows its total in red');
  assert.ok(generate.closed, 'Generate closes the modal');
  const exactCount = Number(generate.toastText.match(/(\d+) at their exact CP/)?.[1]);
  assert.ok(exactCount >= 90, `most generated cards show their exact target CP in the studio (${generate.toastText})`);
  assert.equal(generate.generated, 106, 'the default pool is 106 generated cards');
  assert.equal(generate.after, generate.before + 106, 'Replace generated only keeps the Core cards');
  assert.equal(generate.remembered, 'Total 100%', 'the modal reopens on the last (normalised) settings');
  assert.equal(generate.again, generate.after, 'a second Replace generated only rebuilds the generated cards instead of adding more');
  assert.equal(generate.undone, generate.before, 'undo puts the card list back');
  assert.equal(generate.genLeft, 0, 'no generated card is left after undo');

  // 11b. School counts that need more magic cards than the camp counts give turn martial cards magic, and Preview says so.
  const schoolNote = await page.evaluate(() => {
    const modal = document.getElementById('generate-cards-modal');
    document.getElementById('btn-generate-cards').click();
    for (const el of modal.querySelectorAll('[data-count-school], [data-count-camp]')) el.value = '';
    modal.querySelector('[data-count-school="fire"]').value = '6';
    modal.querySelector('[data-count-school="frost"]').value = '4';
    modal.querySelector('[data-count-camp="martial"]').value = '10';
    document.getElementById('btn-gen-preview').click();
    const text = document.getElementById('gen-preview').textContent;
    modal.close('cancel');
    return text;
  });
  assert.match(schoolNote, /10 martial cards became magic to fit the school counts/, 'Preview reports martial cards made magic');

  assert.deepEqual(pageErrors, [], 'no uncaught errors while editing');
  await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
  await page.close();
  console.log('score-studio browser: ok');
} finally {
  await browser.close();
  await server.close?.();
}
process.exit(0);
