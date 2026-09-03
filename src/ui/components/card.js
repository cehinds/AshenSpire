// src/ui/components/card.js — DOM card renderer (mockup: card-anatomy.svg)
//
// All numbers shown come from the engine: in combat, previewCard tokens
// (live math, SPEC §3.13); outside combat, the card's own literal values via
// computeTokenBindings. No math happens here.

import { resolveCard } from '../../model/registries.js';
import { computeTokenBindings, relicTokens, tokenRe } from '../../model/validate.js';
import { flaskGrowthClause } from '../../model/flaskgrowth.js';
import { attachTooltip, esc } from './tooltip.js';
import { statusTooltipText } from '../uiContent.js';
import { balance } from '../../content/balance.js';
import { flasks } from '../../content/flasks.js';
import { tagsFor } from '../../content/tags.js';

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
  const def = resolveCard(registries, ref);
  const el = document.createElement('div');
  el.className = `card rarity-${def.rarity} cls-${def.class} type-${def.type}${ref.upgraded ? ' upgraded' : ''}`;
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

  const tags = def.cardTags && def.cardTags.length
    ? def.cardTags.map((id) => registries.tags.find((t) => t.id === id)).filter(Boolean)
    : tagsFor(def.id);
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
    `<div class="cost">${esc(cost)}</div>` +
    (manaCost ? `<div class="mana-cost" title="${resourceWord('mana')} cost">◆ ${esc(manaCost)}</div>` : '') +
    (staminaCost ? `<div class="stamina-cost" title="${resourceWord('stamina')} cost">● ${esc(staminaCost)}</div>` : '') +
    `<div class="cname">${esc(def.name)}</div>` +
    `<div class="art">${esc(def.icon || '❖')}</div>` +
    `<div class="ctype">${esc((ty && ty.label) || def.type.toUpperCase())}</div>` +
    // Subtypes: authored in content/source/cardTagging.csv. Untagged cards
    // render nothing here, so the layout is unchanged for them.
    (tags.length
      ? `<div class="ctags">${tags
          .map((t) => `<span class="ctag" style="--tag-color:#${esc(t.color)}" title="${esc(t.blurb)}">${esc(t.glyph)} ${esc(t.label)}</span>`)
          .join('')}</div>`
      : '') +
    `<div class="ctext">${fillTemplate(def, tokens, base)}</div>`;

  // #61 M5: a matched tag-scoped vulnerability lights the card's boosted
  // number in the status row's own tint — "these cards just lit up" instead
  // of set-intersection math. Non-matching cards get nothing (absence = no
  // bonus; never a "+0%" badge).
  const boost = opts.preview && (opts.preview.values || []).find((v) => v.boostTint);
  if (boost) {
    el.classList.add('tag-boost');
    el.style.setProperty('--boost-tint', boost.boostTint);
  }

  // opts.tooltipFn overrides the default tooltip. A parent that already owns a
  // persistent detail region may suppress the transient tooltip entirely.
  if (opts.tooltip !== false) {
    // A combat card's preview already resolved its live costs (Weight Class
    // pricing, Power reductions); the tooltip must say the same numbers the
    // badge and the engine do, so it takes them instead of re-deriving.
    const liveCosts = opts.preview
      ? { variable: !!opts.preview.costIsX, action: opts.preview.cost, mana: opts.preview.manaCost, stamina: opts.preview.staminaCost }
      : null;
    attachTooltip(el, () => (opts.tooltipFn ? opts.tooltipFn() : cardTooltip(registries, def, tokens, liveCosts)));
  }
  if (opts.small) {
    el.style.transform = 'scale(0.92)';
  }
  return el;
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
  let html = `<div class="tt-title">${esc(def.name)} — ${esc(def.type)}, cost ${costText}</div>`;
  // Card text here too — same function, same marks, same class. The in-play
  // card tooltip had the identical defect; it is one fix, not two.
  html += `<div class="ctext">${fillTemplate(def, tokens, null)}</div>`;
  // Nested keyword + status tooltips (SPEC §7.3).
  const lines = [];
  for (const kw of def.keywords || []) {
    // Words resolve through the framework TermRegistry (one vocabulary home);
    // an id outside the keyword vocabulary is skipped, as before.
    const k = registries.framework.keywordDisplay(kw);
    if (k) lines.push(`<b>${esc(k.name)}</b> — ${esc(k.tooltip)}`);
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
      if (s) lines.push(`<b>${esc(s.name)}</b> — ${esc(s.tooltip)}`);
    }
    if (eff.op === 'enterStance') {
      const s = glossaryEntry(registries, 'stance', eff.stance);
      if (s) lines.push(`<b>${esc(s.name)}</b> — ${esc(s.tooltip)}`);
    }
  }
  if (def.flavor) lines.push(`<i>${esc(def.flavor)}</i>`);
  if (lines.length) html += `<div class="tt-kw">${lines.join('<br>')}</div>`;
  return html;
}
