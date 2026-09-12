import { bindCardInspection, openCardInspection } from './cardInspection.js';
import { cardActions } from '../../services/cardActions.js';
import { configureTooltipGlossary, decorateKeywords } from './tooltipGlossary.js';
// src/ui/components/card.js — DOM card renderer (mockup: card-anatomy.svg)
//
// All numbers shown come from the engine: in combat, previewCard tokens
// (live math, SPEC §3.13); outside combat, the card's own literal values via
// computeTokenBindings. No math happens here.

import { resolveCard } from '../../model/registries.js';
import { computeTokenBindings, relicTokens, tokenRe } from '../../model/validate.js';
import { flaskGrowthClause } from '../../model/flaskgrowth.js';
import { esc } from './tooltip.js';
import { statusTooltipText } from '../uiContent.js';
import { balance } from '../../content/balance.js';
import { flasks } from '../../content/flasks.js';
import { tagService } from '../../model/tagService.js';

/** Static token values straight off the def (for reward/pile/deck views). */
export function staticTokens(def) {
  const tokens = {};
  for (const b of computeTokenBindings(def.effects || [])) {
    const v = (def.effects[b.index] || {})[b.field];
    if (typeof v === 'number') tokens[b.token] = v;
  }
  return tokens;
}

/**
 * relicText(def) → plain text with every {token} replaced by the number the
 * relic's own data produces. EldenSpire#38.
 *
 * Beside fillTemplate() on purpose: that one is the card path (rich HTML, live
 * combat previews, up/down colouring); this one is the relic/flask path, which
 * is read in tooltips and list rows where the caller escapes the result itself.
 * They share the token SYNTAX, so they live together — one place to look when
 * the syntax changes — and they do not share a body, because one returns HTML
 * and the other returns text and merging them would mean an escaping decision
 * made in the wrong place.
 *
 * What replaced it: `textTemplate.replace(/[{}]/g, '')` at three call sites,
 * which stripped the braces and showed the player the KEY. An unresolved token
 * still renders as `{token}` here — braces and all — because a visible brace is
 * a bug report and a bare key is a sentence that looks fine and lies.
 */
export function relicText(def, registries = null) {
  if (!def || !def.textTemplate) return '';
  const tokens = relicTokens(def);
  const base = def.textTemplate.replace(tokenRe(), (m, tok) => (
    typeof tokens[tok] === 'number' ? String(tokens[tok]) : m
  ));
  // A growth row (balance.flaskGrowth) is a grant the player must be able to
  // read on the relic that carries it — but its amount has ONE home, the row,
  // so the sentence is DERIVED here rather than hand-typed into textTemplate
  // (Law 1 clause 2; the derivation and its boundary live at
  // flaskGrowthClause, model/flaskgrowth.js; corpus tools/flaskgrowth.mjs).
  // THE CLAUSE READS THE REGISTRIES IT IS HANDED — the same object the seam
  // (syncFlaskGrowth) derives from — so the day any mode forks balance
  // per-run, the tooltip describes the row the seam actually applies, not the
  // shipped one. Every run-facing call site passes its registries (source
  // contract in the corpus). The static fallback is for surfaces with no
  // registries in hand, where the one shipped bundle is the only truth there is.
  const bal = (registries && registries.balance) || balance;
  const defs = (registries && registries.flasks && registries.flasks.all()) || flasks;
  const grown = flaskGrowthClause(bal, defs, def.id);
  return grown ? `${base} ${grown}` : base;
}

function fillTemplate(def, tokens, baseTokens) {
  let html = esc(def.textTemplate);
  html = html.replace(tokenRe(), (m, tok) => {
    const v = tokens[tok];
    if (v == null) return m;
    let cls = 'val';
    if (baseTokens && typeof baseTokens[tok] === 'number') {
      if (v > baseTokens[tok]) cls += ' up';
      else if (v < baseTokens[tok]) cls += ' down';
    }
    return `<span class="${cls}">${v}</span>`;
  });
  // Light keyword coloring for readability.
  html = html
    .replace(/\b(Bleed|Crimson Blight|Staggered|Poise)\b/g, '<span class="st-bleed">$1</span>')
    .replace(/\b(Exhaust|Ethereal|Innate|Retain|Unplayable)\b/g, '<span class="kw">$1</span>');
  return html;
}

/**
 * renderCard(registries, ref, opts) → element.
 *   ref  — { cardId, upgraded, instanceId? }
 *   opts — { preview?    (previewCard result → live numbers),
 *            affordable? (bool; greys out when false),
 *            small?      (scale for reward/pile grids),
 *            tooltip?    (false suppresses the shared hover/focus tooltip) }
 */
export function renderCard(registries, ref, opts = {}) {
  configureTooltipGlossary(registries);
  const def = resolveCard(registries, ref);
  const el = document.createElement('div');
  // THE FACE IS THE KIT'S CARD (§10): a fixed box, fixed landmarks (name, art,
  // type band), and one shared row budget below the band that tags and text
  // divide. `as-card` is the recipe; the old class names stay as the hooks
  // every tool and screen reads.
  el.className = `card as-card playing-poker-card rarity-${def.rarity} cls-${def.class} type-${def.type}${ref.upgraded ? ' upgraded' : ''}`;
  // Type presentation is data (balance.ui.cardTypes): corner radii carry the
  // type (attack squarest → power roundest) and each type owns its banner
  // colour. Renaming a label here never touches engine logic.
  const ty = balance.ui.cardTypes[def.type];
  if (ty) {
    el.style.setProperty('--card-type-color', ty.color);
    el.style.setProperty('--card-radius', `${ty.radius}px`);
    el.style.setProperty('--card-art-radius', `${ty.art}px`);
  }
  // The class motif hue is DATA (class def cardTint), handed to CSS as a var so
  // adding a class brings its own card colour with no stylesheet edit. Colorless
  // cards have no owning class, so they fall back to the neutral frame.
  const owner = registries.classes.has(def.class) ? registries.classes.get(def.class) : null;
  if (owner && owner.cardTint) el.style.setProperty('--card-tint', owner.cardTint);
  if (opts.affordable === false) el.classList.add('unaffordable');
  if (ref.instanceId) el.dataset.instanceId = ref.instanceId;
  el.dataset.cardId = def.id;

  // Equipment-generated cards carry their profile's tags on `cardTags`; authored
  // cards resolve through the junction. BOTH read the ACTIVE registries — the
  // authored branch used to call the module-global `tagsFor`, so a bundle that
  // changed a card's tags changed what combat did with them and not what the
  // card showed, which is the chip strip lying about the run being played.
  const service = tagService(registries);
  const liveTagRows = (opts.preview?.values || []).filter((row) => Array.isArray(row.tags));
  const inheritedBy = new Map();
  for (const row of liveTagRows) for (const id of row.inheritedTags || []) {
    const sources = inheritedBy.get(id) || new Set(); sources.add(row.sourceName); inheritedBy.set(id, sources);
  }
  const resolvedTags = liveTagRows.length
    ? service.resolve([...new Set(liveTagRows.flatMap((row) => row.tags))])
    : def.cardTags && def.cardTags.length
    ? service.resolve(def.cardTags)
    : service.tagsOf('card', def);
  // Keep legacy schools for compatibility, but do not print Blood/Heavy twice
  // when the categorized theme/technique is the same visible word.
  const categorizedLabels = new Set(resolvedTags.filter((tag) => ['theme', 'technique'].includes(tag.domain)).map((tag) => tag.label.toLowerCase()));
  const tags = resolvedTags.filter((tag) => tag.domain !== 'card' || !categorizedLabels.has(tag.label.toLowerCase()));
  el.dataset.tagRows = tags.length ? '1' : '0';
  const base = staticTokens(def);
  const tokens = opts.preview ? { ...base, ...opts.preview.tokens } : base;
  // The badge numbers come from the framework cost profile (a preview's
  // numbers are the preview's own — it already resolved them); the badge
  // words come from the TermRegistry, like the tooltip's cost line.
  const pools = opts.preview ? null : registries.framework.costProfile(def);
  const cost = opts.preview ? (opts.preview.costIsX ? 'X' : opts.preview.cost) : (pools.variable ? 'X' : pools.action);
  const manaCost = opts.preview ? opts.preview.manaCost : pools.mana;
  const staminaCost = opts.preview ? opts.preview.staminaCost : pools.stamina;
  const resourceWord = (resource) => esc(registries.framework.resourceWord(resource));

  el.innerHTML =
    `<div class="card-costs"><div class="cost">${esc(cost)}</div>` +
    (manaCost ? `<div class="mana-cost" title="${resourceWord('mana')} cost">◆ ${esc(manaCost)}</div>` : '') +
    (staminaCost ? `<div class="stamina-cost" title="${resourceWord('stamina')} cost">● ${esc(staminaCost)}</div>` : '') +
    `</div><div class="cname">${esc(def.name)}</div>` +
    `<div class="art">${esc(def.icon || '❖')}</div>` +
    `<div class="ctype">${esc((ty && ty.label) || def.type.toUpperCase())}</div>` +
    // Subtypes: authored in content/source/tagging.csv. Untagged cards
    // render nothing here, so the layout is unchanged for them.
    (tags.length
      ? `<div class="cd-body"><div class="ctags cd-tags">${tags
          .map((t) => `<span class="ctag as-tag" style="--tag-color:#${esc(t.color)}" data-tip="${esc(t.blurb + (inheritedBy.has(t.id) ? ` Granted by ${[...inheritedBy.get(t.id)].join(', ')}.` : ''))}">${esc(t.glyph)} ${esc(t.label)}</span>`)
          .join('')}</div>`
      : '<div class="cd-body">') +
    `<div class="ctext cd-text">${fillTemplate(def, tokens, base)}</div></div>`;
  // MEASURED, NOT GUESSED: the name shrinks to one line, tags past the second
  // row defer to `+N`, and the text takes what the budget leaves. CSS cannot
  // count or measure, so the renderer reports after the first paint.
  scheduleCardFits([el]);

  // #61 M5: a matched tag-scoped vulnerability lights the card's boosted
  // number in the status row's own tint — "these cards just lit up" instead
  // of set-intersection math. Non-matching cards get nothing (absence = no
  // bonus; never a "+0%" badge).
  const boost = opts.preview && (opts.preview.values || []).find((v) => v.boostTint);
  if (boost) {
    el.classList.add('tag-boost');
    el.style.setProperty('--boost-tint', boost.boostTint);
  }

  // NO HOVER TOOLTIP ON A CARD (owner, 2026-09-11: "all cards will use the
  // (i) over on selection"). Selecting a card reveals its Information button
  // (bindCardInspection below), and that opens the same reading the hover used
  // to — `opts.tooltipFn` or cardTooltip — with the live costs. The cost badges
  // say their number and explain it there too. `opts.tooltip: false` remains
  // the callers' word for "no transient explanation" and now names the default.
  if (opts.small) el.dataset.small = 'true';
  if (opts.inspection !== false) bindCardInspection(el, { title: def.name, readOnly: opts.inspectReadOnly === true,
    touchSelectionSafe: Boolean(opts.preview?.needsTarget),
    actionOwnsTouch: opts.actionOwnsTouch === true,
    open: opener => {
      const details = document.createElement('div');
      const liveCosts = opts.preview ? { variable: !!opts.preview.costIsX, action: opts.preview.cost, mana: opts.preview.manaCost, stamina: opts.preview.staminaCost } : null;
      details.innerHTML = opts.tooltipFn ? opts.tooltipFn() : cardTooltip(registries, def, tokens, liveCosts);
      decorateKeywords(details);
      const face = renderCard(registries, ref, { ...opts, tooltip: false, inspection: false });
      details.classList.add('playing-card-details');
      // NO DEFAULT VERB. This line used to read
      //   `opts.inspectionAction || (() => ({ enabled: false, reason: 'Play cards from your combat hand.' }))`
      // and that fallback was the defect: every surface but combat inherited
      // combat's verb as a dead button, on the spoils screen most absurdly,
      // where the player had opened the card in order to take it.
      //
      // A surface now says which one it is (`opts.surface`) and hands over the
      // commits it owns (`opts.commands`); services/cardActions.js answers what
      // that surface offers. A card with nothing to offer gets a reading door
      // and no footer, which is the honest shape rather than an apology.
      const surface = opts.surface || 'none';
      return openCardInspection({ title: def.name, card: face, details, opener,
        actions: () => cardActions(surface, ref, { availability: opts.availability, only: opts.only }),
        commands: opts.commands || {} });
    } });
  return el;
}

/**
 * fitCardFace(el) — the three facts CSS cannot compute, reported as data
 * attributes the stylesheet reads (kit §10):
 *   data-name      long | verylong  — the name stepped its type down to stay one line
 *   data-tag-rows  0 | 1 | 2        — rows the tags took; text gets the rest
 *   data-tags-hidden n              — tags deferred past the second row (+n)
 *   data-truncated true             — both were full; the face carries the chevron
 */
const pendingFits = new Set();
let fitFrame = 0;

export function scheduleCardFits(cards) {
  for (const card of cards) pendingFits.add(card);
  if (fitFrame) return;
  fitFrame = requestAnimationFrame(() => {
    fitFrame = 0;
    const batch = [...pendingFits]; pendingFits.clear();
    fitCardFaces(batch);
  });
}

export function fitCardFace(el) { fitCardFaces([el]); }

// Every phase reads the whole batch before the next phase writes. The number
// of forced layouts is bounded by fitting stages, not by cards times tags.
function fitCardFaces(cards) {
  const rows = cards.filter(el => el?.isConnected).map(el => {
    const name = el.querySelector('.cname'), tags = el.querySelector('.ctags');
    return { el, name, tags, chips: [...(tags?.querySelectorAll('.ctag') || [])], more: null, hidden: 0, tagRows: 0 };
  });
  for (const row of rows) {
    row.el.dataset.name = '';
    row.tags?.querySelector('.as-tag.more')?.remove();
    row.chips.forEach(chip => { chip.hidden = false; });
  }
  const long = rows.filter(({name}) => name && name.scrollWidth > name.clientWidth + 1);
  long.forEach(row => { row.el.dataset.name = 'long'; });
  const veryLong = long.filter(({name}) => name.scrollWidth > name.clientWidth + 1);
  veryLong.forEach(row => { row.el.dataset.name = 'verylong'; });
  for (const row of rows) {
    const top = row.tags?.offsetTop || 0;
    row.positions = row.chips.map(chip => Math.round((chip.offsetTop - top) / Math.max(1, chip.offsetHeight + 2)));
  }
  for (const row of rows) {
    row.chips.forEach((chip, i) => {
      if (row.positions[i] >= 2) { chip.hidden = true; row.hidden++; }
      else row.tagRows = Math.max(row.tagRows, row.positions[i] + 1);
    });
    if (row.hidden) {
      row.more = document.createElement('span'); row.more.className = 'as-tag more';
      row.more.textContent = '+' + row.hidden;
      row.tags.appendChild(row.more);
    }
  }
  const overflow = rows.filter(({more,tags}) => more && Math.round((more.offsetTop - tags.offsetTop) / Math.max(1, more.offsetHeight + 2)) >= 2);
  for (const row of overflow) {
    const last = row.chips.filter(chip => !chip.hidden).pop();
    if (last) { last.hidden = true; row.hidden++; row.more.textContent = '+' + row.hidden; }
  }
  for (const row of rows) {
    if (row.more) {
      row.more.dataset.tip = row.chips.filter(chip => chip.hidden).map(chip => chip.textContent.trim()).join(' · ');
      row.el.dataset.tagsHidden = String(row.hidden);
    } else delete row.el.dataset.tagsHidden;
    row.el.dataset.tagRows = String(Math.min(2, row.tagRows));
  }
  const truncated = rows.map(({el}) => { const text = el.querySelector('.ctext'); return !!text && text.scrollHeight > text.clientHeight + 1; });
  rows.forEach((row, i) => { row.el.dataset.truncated = String(truncated[i]); });
}

// GUARDED ON WHAT THE BLOCK ACTUALLY USES, WHICH IS BOTH. `window` alone was
// the whole test, and both lines below reach for `document` — so a harness that
// stands up a bare `window` (tools/webaudio-stub.mjs installs
// `globalThis.window = { AudioContext }` and nothing else) walks straight into
// `ReferenceError: document is not defined` at import time, before a single
// check runs. That is what `node tools/verdict.mjs -- node
// tools/music-toggle-parity.mjs` was doing on every runner: dying of an
// unhandled exception, which verdict.mjs correctly reports as
// "HARNESS COULD NOT RUN" rather than as a finding.
//
// It stayed invisible because ci.yml is `workflow_dispatch:`-only, so the step
// that imports this module had not fired. The half-guard was wrong the day it
// was written; nothing was asking.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('resize', () => scheduleCardFits(document.querySelectorAll('.card')));
  document.fonts?.ready.then(() => scheduleCardFits(document.querySelectorAll('.card')));
}

/**
 * Tooltip HTML previewing what a card becomes when Smithed: current text in
 * muted, upgraded text below with changed values highlighted green/red (the
 * same up/down coloring cards use in play). All numbers come from the defs.
 */
export function upgradePreviewHtml(registries, ref) {
  const base = resolveCard(registries, { ...ref, upgraded: false });
  const upg = resolveCard(registries, { ...ref, upgraded: true });
  const baseTokens = staticTokens(base);
  const upgTokens = { ...baseTokens, ...staticTokens(upg) };
  const baseText = fillTemplate(base, baseTokens, null);
  const upgradedText = fillTemplate(upg, upgTokens, baseTokens);
  // Both lines are CARD TEXT, so both wear `.ctext` — the class the mark rules
  // are keyed to (ui.css). Without it the preview drew the number it had just
  // computed as changed in the same colour and weight as the word beside it.
  // `.ctext` carries the marks only; the card face's block layout stays on
  // `.card .ctext` and does not follow the text into the tooltip.
  let html = `<div class="tt-title">${esc(base.name)} → ${esc(base.name)}+</div>`;
  html += `<div class="ctext" style="color:var(--muted)">${baseText}</div>`;
  html += `<div class="ctext" style="margin-top:6px">${upgradedText}</div>`;
  if (upg.cost !== base.cost) html += `<div class="tt-kw">Cost <b>${esc(base.cost)}</b> → <b>${esc(upg.cost)}</b></div>`;
  if (baseText === upgradedText && upg.cost === base.cost) {
    html += '<div class="tt-kw">The authored upgrade has no visible numeric change in this preview.</div>';
  }
  return html;
}

/**
 * ONE GLOSSARY ROW, WORDS AND NUMBERS BOTH. Returns `null` for an unknown id or
 * a row that authored no tooltip — the two skips this loop always had.
 *
 * The registry lookup is optional on purpose: probe registries and minimal
 * fixtures hand card.js a `registries` with the framework overlay but no
 * `statuses`/`stances` map, and those callers must keep working. When the row
 * is reachable we substitute against it; when it is not, we fall back to the
 * words-only display, which is exactly the behavior this file had before.
 */
function glossaryEntry(registries, kind, id) {
  const source = kind === 'status' ? registries.statuses : registries.stances;
  const row = source?.get?.(id) || null;
  const withWords = kind === 'status'
    ? registries.frameworkTerms.withStatusWords
    : registries.frameworkTerms.withStanceWords;
  const display = row && typeof withWords === 'function'
    ? withWords(row)
    : (kind === 'status' ? registries.frameworkTerms.statusDisplay(id) : registries.frameworkTerms.stanceDisplay(id));
  if (!display || !display.tooltip) return null;
  return { name: display.name, tooltip: statusTooltipText(display) };
}

function cardTooltip(registries, def, tokens, liveCosts = null) {
  // Cost numbers come from the framework profile (or the preview's already
  // resolved live costs, when the card is in play) and the resource words from
  // TermRegistry — same rendered string, one authority for both.
  const pools = liveCosts || registries.framework.costProfile(def);
  // Terms are data; escape them like every other field before innerHTML.
  const word = (resource) => esc(registries.framework.resourceWord(resource));
  const costText = `${esc(pools.variable ? 'X' : pools.action)} ${word('action')}`
    + (pools.mana ? ` + ${esc(pools.mana)} ${word('mana')}` : '')
    + (pools.stamina ? ` + ${esc(pools.stamina)} ${word('stamina')}` : '');
  // THE TITLE IS THE NAME AND NOTHING ELSE (kit §08): type and cost sit on the
  // meta line as the same tag and value atoms the card face uses.
  let html = `<div class="tt-title">${esc(def.name)}</div>`
    + `<div class="ti-meta"><span class="as-tag">${esc(def.type)}</span><span class="ti-cost">${costText}</span></div>`;
  // Card text here too — same function, same marks, same class. The in-play
  // card tooltip had the identical defect; it is one fix, not two.
  html += `<div class="ctext">${fillTemplate(def, tokens, null)}</div>`;
  // Nested keyword + status tooltips (SPEC §7.3).
  const lines = [];
  for (const kw of def.keywords || []) {
    // Words resolve through the framework TermRegistry (one vocabulary home);
    // an id outside the keyword vocabulary is skipped, as before.
    const k = registries.framework.keywordDisplay(kw);
    if (k) lines.push(`<span class="inspection-tag" role="button" tabindex="0" data-tip="${esc(k.tooltip)}">${esc(k.name)}</span>`);
  }
  for (const eff of def.effects || []) {
    // Status/stance WORDS resolve through the per-bundle framework term
    // overlay — verbatim text, framework authority. Unknown ids and
    // tooltip-less entities keep their existing skip behavior.
    //
    // AND THE NUMBERS RESOLVE TOO, WHICH THEY DID NOT. `statusDisplay(id)`
    // returns the WORDS only — `{ name, tooltip }` and nothing of the row's
    // mechanics — so a status whose prose carries the row's own knobs printed
    // them at the player: a Gorefire Slash tooltip read "At {proc.threshold},
    // burst for {proc.burstPercent}% of max HP (min {proc.burstMin}, max
    // {proc.burstMax}), plus {proc.poiseDamage} Poise damage" — five visible
    // braces in one tooltip (screenshotted by Constantine 2026-09-03). The
    // same prose reads correctly on the combat meter, which goes through
    // statusTooltipText; nothing was reading it here.
    //
    // The seam already existed for exactly this: termOverlay.js's
    // `withStatusWords(def)` takes the WHOLE row, replaces the words, and lets
    // the mechanics ride through, "for a display site that needs the whole def
    // (mechanics numbers for tooltip substitution)". This is that site.
    if (eff.op === 'applyStatus') {
      const s = glossaryEntry(registries, 'status', eff.status);
      if (s && !def.textTemplate.includes(s.name)) lines.push(`<span class="inspection-tag" role="button" tabindex="0" data-tip="${esc(s.tooltip)}">${esc(s.name)}</span>`);
    }
    if (eff.op === 'enterStance') {
      const s = glossaryEntry(registries, 'stance', eff.stance);
      if (s && !def.textTemplate.includes(s.name)) lines.push(`<span class="inspection-tag" role="button" tabindex="0" data-tip="${esc(s.tooltip)}">${esc(s.name)}</span>`);
    }
  }
  const service = tagService(registries);
  const tags = def.cardTags?.length ? service.resolve(def.cardTags) : service.tagsOf('card', def);
  for (const tag of tags) lines.push(`<span class="inspection-tag" role="button" tabindex="0" data-tip="${esc(tag.blurb)}">${esc(tag.label)}</span>`);
  if (lines.length) html += `<div class="inspection-tags">${[...new Set(lines)].join('')}</div>`;
  return html;
}
