import { bindCardInspection, openCardInspection } from './cardInspection.js';
import { cardActions } from '../../services/cardActions.js';
import { configureTooltipGlossary, decorateKeywords } from './tooltipGlossary.js';
// src/ui/components/card.js — DOM card renderer (mockup: card-anatomy.svg)
//
// All numbers shown come from the engine: in combat, previewCard tokens
// (live math, SPEC §3.13); outside combat, the card's own literal values via
// computeTokenBindings. No math happens here.

import { resolveCard, relicPropertyRules } from '../../model/registries.js';
import { playingCardModel, playingCardClasses, staticCardTokens } from '../../model/playingCard.js';
import { cardFields, resolveCardLevel } from '../../model/cardFields.js';
import { cardShape } from '../models/CardSizeModel.js';
import { litCard } from './cardSelection.js';
import { relicTokens, tokenRe } from '../../model/validate.js';
import { flaskGrowthClause } from '../../model/flaskgrowth.js';
import { esc } from './tooltip.js';
import { statusTooltipText } from '../uiContent.js';
import { balance } from '../../content/balance.js';
import { flasks } from '../../content/flasks.js';
import { tagService } from '../../model/tagService.js';
import { metadataFooter, artworkAnchor } from '../models/IdentityModel.js';
import { t } from '../strings.js';

// WCI3: rarity at the start of the band, the owned count at the end, each only
// when the surface can state it. No domain action ever belongs in this band.
function metadataBand(rarity, owned) {
  const band = metadataFooter({ rarity, owned });
  const slot = (name, entry) => (entry
    ? `<span data-meta-slot="${name}" data-meta-kind="${entry.kind}">${esc(entry.kind === 'owned' ? t('card.meta.owned', { count: entry.value }) : entry.value)}</span>`
    : '');
  return `<div class="card-metadata" data-identity-part="metadata">${slot('start', band.start)}${slot('end', band.end)}</div>`;
}

/**
 * Static token values straight off the def (for reward/pile/deck views).
 *
 * The body moved to src/model/playingCard.js with the rest of the projection;
 * this stays as the name five files already import, so the extraction costs
 * no call site a rename that would prove nothing.
 */
export function staticTokens(def) { return staticCardTokens(def); }

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
  // The relic's own passives and its property rules' triggers are two homes for
  // one sentence's numbers since plan phase 2, so both are handed to the token
  // reader. Without registries only the passive half resolves, which is why
  // every run-facing call site passes them.
  const tokens = relicTokens(def, registries ? relicPropertyRules(registries, def) : []);
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
  // ONE PROJECTION, READ ONCE. Everything this function used to derive on its
  // way to innerHTML — the tag junction, the cost profile, the type row, the
  // class tint — is `model` now (src/model/playingCard.js). Drawing is what is
  // left. The output is byte-identical by construction: the model's bodies are
  // the ones that stood here.
  const model = playingCardModel(registries, ref, { preview: opts.preview || null });
  const el = document.createElement('div');
  // THE FACE IS THE KIT'S CARD (§10): a fixed box, fixed landmarks (name, art,
  // type band), and one shared row budget below the band that tags and text
  // divide. `as-card` is the recipe; the old class names stay as the hooks
  // every tool and screen reads.
  el.className = playingCardClasses(model);
  // Type presentation is data (balance.ui.cardTypes): corner radii carry the
  // type (attack squarest → power roundest) and each type owns its banner
  // colour. Renaming a label here never touches engine logic.
  if (model.paint.typeColor) {
    el.style.setProperty('--card-type-color', model.paint.typeColor);
    el.style.setProperty('--card-radius', `${model.paint.radiusPx}px`);
    el.style.setProperty('--card-art-radius', `${model.paint.artRadiusPx}px`);
  }
  // The class motif hue is DATA (class def cardTint), handed to CSS as a var so
  // adding a class brings its own card colour with no stylesheet edit. Colorless
  // cards have no owning class, so they fall back to the neutral frame.
  if (model.paint.tint) el.style.setProperty('--card-tint', model.paint.tint);
  if (opts.affordable === false) el.classList.add('unaffordable');
  if (model.instanceId) el.dataset.instanceId = model.instanceId;
  el.dataset.cardId = model.id;

  // Equipment-generated cards carry their profile's tags on `cardTags`; authored
  // cards resolve through the junction. BOTH read the ACTIVE registries — the
  // authored branch used to call the module-global `tagsFor`, so a bundle that
  // changed a card's tags changed what combat did with them and not what the
  // card showed, which is the chip strip lying about the run being played.
  const tags = model.tags;
  // `data-tag-rows` is set by `paint` below, because whether the chips are on
  // the face is now a question the presentation level answers as well as the
  // card's own data — and a second assignment here would be the older of two
  // answers winning on some paths.
  // The badge numbers come from the framework cost profile (a preview's
  // numbers are the preview's own — it already resolved them); the badge
  // words come from the TermRegistry, like the tooltip's cost line.
  const cost = model.costs.variable ? 'X' : model.costs.action;
  const manaCost = model.costs.mana;
  const staminaCost = model.costs.stamina;
  const resourceWord = (resource) => esc(registries.framework.resourceWord(resource));

  // WC0/WC1: keep every projected cost on the exposed left edge of a fan.
  // The existing framework/preview remains the authority for all values.
  // A ZERO ACTION COST IS A REAL, READABLE COST — it is the whole point of a
  // free card, and the fan's left edge is where a player counts what a turn can
  // afford. Dropping the row at 0 rendered rogueShiv (cost: 0) and its kin with
  // no ◆ at all, which reads as "no action cost printed" — i.e. unknown — not
  // as "free". Only the SECONDARY pools elide at zero: a card that spends no
  // stamina and no mana should not print two empty rails.
  const costRows = [
    ['action', 'cost', '◆', cost, true],
    ['stamina', 'stamina-cost', 'ϟ', staminaCost, false],
    ['mana', 'mana-cost', '♦', manaCost, false],
  ].filter(([, , , value, keepZero]) => value != null && (keepZero || value !== 0));
  el.dataset.wireframe = 'WC1';
  // THE SAME THREE LEVELS THE EQUIPMENT FACE USES, and deliberately the same
  // vocabulary rather than a second one shaped like it. dev unified these two
  // renderers behind models (src/model/playingCard.js) specifically so they
  // could share this; giving the playing card its own field table would re-fork
  // them the day after they were joined.
  //
  // The regions are `balance.ui.equipmentCard.regions` — the one vocabulary —
  // mapped onto this face's own landmarks:
  //
  //   art      the artwork well            facts   the cost rail
  //   type     the type band               tags    the subtype chips
  //   effects  the rule text               footer  the rarity/owned band
  //
  // `flavor` has no landmark ON THE FACE, and that is a layout decision rather
  // than an absence of data. This note used to claim a playing card authors no
  // flavour, which was false: `resolveCard` composes `profile.flavor ||
  // def.flavor`, the generated basic profiles author it, and so do the
  // colorless and co-op sets. Believing the comment meant the text was written
  // and shown to nobody.
  // The face has four fixed bands and no room to grow one, so the flavour is
  // carried by the reading door's pane — the same place, and the same
  // `inspection-lore` disclosure, the equipment card uses for its own.
  //
  // `cname` is not a region, for the same reason `.epc-name` is not: the title
  // is what tells one card from another and shows at every level.
  const identity = model.instanceId || model.id;
  const floor = opts.inspection === false ? 'inspect' : (opts.level || 'glance');
  const levelNow = () => resolveCardLevel({
    floor, lit: litCard() === identity, inspecting: opts.inspection === false,
  });
  let drawn = levelNow();
  const paint = (at) => {
    const visible = new Set(cardFields(at, { surface: opts.surface || 'none' }).visible);
    const region = (key, html) => (visible.has(key) ? html : '');
    // HIDE BY NOT RENDERING. A region left in the markup and hidden in CSS
    // still takes its share of the face's row budget, so the card would be the
    // same card with holes rather than a larger-typed one — and a screen
    // reader would announce a field the player cannot see.
    const body = region('type', `<div class="ctype">${esc(model.type.label)}</div>`)
      + region('effects', `<div class="ctext cd-text">${fillTemplate(def, model.tokens, model.baseTokens)}</div>`);
    // The information button and the chevron are children of the card that
    // `bindCardInspection` appended with their own listeners; a repaint must
    // hand them back rather than take them away.
    // WHAT A REPAINT MAY DESTROY IS WHAT IT DREW, AND NOTHING ELSE.
    //
    // This kept a NAMED PAIR — the `i` and the chevron — on the premise that
    // they are the only children a caller adds. They are not. The combat hand
    // appends a positional keycap, a `card-unavailable-reason` pill and its
    // `.hand-hit-lane` to the card AFTER the renderer has run (hand.js), and
    // selection repaints now, so the first tap on a card in combat deleted
    // them. The hit lane is part of how the hand decides what a touch landed
    // on, so this could move where a player's taps go.
    //
    // An allow-list of foreign children cannot be right, because the renderer
    // cannot know what a surface will add. Invert it: mark the children THIS
    // renderer drew and keep everything unmarked. New callers and new
    // decorations are then safe by default rather than by remembering to come
    // back and edit a list here.
    //
    // Guarded, because this renderer is also exercised against the minimal DOM
    // the wireframe tests build, which has no `children`. There is nothing to
    // keep on a first paint in any case — the door has not run yet.
    const kept = el.children
      ? [...el.children].filter((node) => node?.dataset?.cardPainted !== '1')
      : [];
    el.innerHTML =
      region('facts', `<div class="card-costs card-cost-rail">${costRows.map(([resource, cls, icon, value]) =>
        `<div class="${cls}" aria-label="${resourceWord(resource)} cost: ${esc(value)}"><span aria-hidden="true">${icon}</span> ${esc(value)}</div>`
      ).join('')}</div>`) +

      `<div class="cname" data-identity-part="name">${esc(model.name)}</div>` +
      region('art', `<div class="art" data-identity-part="artwork" data-artwork-anchor="${artworkAnchor('card')}"><span class="card-art-glyph">${esc(model.icon)}</span>` +
      // Subtypes: authored in content/source/tagging.csv. Untagged cards
      // render nothing here, so the layout is unchanged for them.
      (tags.length && visible.has('tags')
        ? `<div class="ctags cd-tags">${tags
            .map((t) => `<span class="ctag as-tag" style="--tag-color:#${esc(t.color)}" data-tip="${esc(t.blurb + (t.inheritedFrom.length ? ` Granted by ${t.inheritedFrom.join(', ')}.` : ''))}">${esc(t.glyph)} ${esc(t.label)}</span>`)
            .join('')}</div>`
        : '') + '</div>') +
      (body ? `<div class="cd-body">${body}</div>` : '') +
      region('footer', metadataBand(def.rarity, opts.owned));
    // Stamp what this paint drew BEFORE the kept children go back on, so the
    // next repaint can tell the two apart. Guarded for the same minimal DOM.
    if (el.children) for (const node of el.children) { if (node.dataset) node.dataset.cardPainted = '1'; }
    for (const node of kept) el.append(node);
    // A WITHHELD REGION GIVES ITS TRACK BACK.
    //
    // WC1 lays the face out on four authored bands — name / art / body /
    // metadata — and the level decides which of those children are drawn. The
    // bands were the authored four regardless, so a `glance` card that
    // withholds its metadata band left an EMPTY TRAILING TRACK: about a tenth
    // of the face spent on nothing, and none of it returned to the rule text.
    // That is the opposite of the claim levels are built on — that omitting a
    // region returns its pixels — and it held for the equipment face (whose
    // solver already recomputes rows) while quietly not holding here.
    //
    // The card states the bands for the children it ACTUALLY drew, in face
    // order. The numbers are still the authored ones; only the absent band is
    // dropped, so the remaining shares keep their proportions to each other.
    {
      const drawn = [
        true,                                   // .cname, always
        visible.has('art'),                     // .art
        Boolean(body),                          // .cd-body (type and/or effects)
        visible.has('footer'),                  // .card-metadata
      ];
      const bands = cardShape().bands.filter((_, index) => drawn[index]);
      el.style.setProperty('--card-bands', bands.map((b) => `${b}fr`).join(' '));
    }
    el.dataset.level = at;
    // `data-tag-rows` is what the stylesheet and every tool read to know the
    // text's share of the budget. At a level that withholds the chips there
    // are no tag rows, whatever the card's own data says.
    el.dataset.tagRows = tags.length && visible.has('tags') ? '1' : '0';
    // MEASURED, NOT GUESSED: the name shrinks to one line, tags past the second
    // row defer to `+N`, and the text takes what the budget leaves. CSS cannot
    // count or measure, so the renderer reports after the first paint.
    scheduleCardFits([el]);
  };
  paint(drawn);

  // #61 M5: a matched tag-scoped vulnerability lights the card's boosted
  // number in the status row's own tint — "these cards just lit up" instead
  // of set-intersection math. Non-matching cards get nothing (absence = no
  // bonus; never a "+0%" badge).
  if (model.paint.boostTint) {
    el.classList.add('tag-boost');
    el.style.setProperty('--boost-tint', model.paint.boostTint);
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
      const liveCosts = model.hasPreview ? model.costs : null;
      details.innerHTML = opts.tooltipFn ? opts.tooltipFn() : cardTooltip(registries, def, model.tokens, liveCosts);
      decorateKeywords(details);
      // AUTHORED FLAVOUR REACHES THE PLAYER, at the level that promises
      // everything. The note above the regions used to say a playing card
      // authors no flavour; that was simply false — `resolveCard` composes
      // `profile.flavor || def.flavor` (model/registries.js), the generated
      // basic profiles author it, and so do the colorless and co-op sets. It
      // was written, stored, and shown to nobody.
      // It goes in the reading door's pane rather than on the face, which is
      // exactly where the equipment card puts its own (`inspection-lore` in
      // equipmentCard.js) — same disclosure, same summary, so the two card
      // types read the same way at the same level.
      if (def.flavor) {
        const lore = document.createElement('details');
        lore.className = 'inspection-lore';
        const summary = document.createElement('summary');
        summary.textContent = 'Flavor';
        summary.tabIndex = 0;
        const text = document.createElement('p');
        text.textContent = def.flavor;
        lore.append(summary, text);
        details.append(lore);
      }
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
  // EXACTLY THE TWO CARDS WHOSE LEVEL CHANGED. A selection lights one card and
  // douses one card, and cardInspection.js fires both events on the card they
  // concern, so each face repaints itself. Nothing sweeps the document —
  // `document.querySelectorAll` is what dev deliberately deleted when the
  // selection store was extracted (see the header of cardSelection.js), and a
  // sweep is also how a card removed from the DOM kept being reconciled.
  //
  // The guard matters as much as the listener: `select()` runs on every tap,
  // including on a card that is already lit, and rebuilding the face under a
  // thumb mid-gesture would be a new defect wearing this feature's clothes.
  if (opts.inspection !== false) {
    const restate = () => {
      const next = levelNow();
      if (next === drawn) return;
      drawn = next;
      paint(drawn);
    };
    el.addEventListener('cardinspectionselect', restate);
    el.addEventListener('cardinspectiondouse', restate);
  }
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
  // WHICH ROW EACH CHIP LANDED ON — COUNTED, NOT DIVIDED, AND AGAINST THE
  // CHIP'S OWN ORIGIN.
  //
  // This was wrong twice, and on the one face that matters most it was wrong
  // silently. `chip.offsetTop` is measured from the chip's OFFSET PARENT, and
  // WC0 makes `.ctags` `position: absolute` (kit.css) — so on a playing card
  // the strip IS that offset parent and chip tops already start at 0. The old
  // line subtracted `tags.offsetTop`, which is measured from `.art` instead, so
  // every position came out negative, nothing ever cleared the `>= 2` test, and
  // the `+N` deferral NEVER FIRED on a combat card. The rows past the second
  // were then cut off by `.ctags`'s own `overflow: hidden` with no ellipsis and
  // no scroller. Measured at c63a09620, ?shot=combat, 1200x730: Guard Counter's
  // strip was 78 px of content in a 36 px box — 42 px of a card's subtypes
  // gone, and `data-tag-rows` reporting 0 for a five-chip card at 390x844.
  //
  // Second: the pitch. `chip.offsetHeight + 2` assumed a 2 px gap while the
  // stylesheet's is `0.3rem` (3 px at the shipped 10px root), so a row cost 20
  // px and the arithmetic charged 19 — a drift that grows with every row. There
  // is no need to divide at all: chips on one row share an offsetTop, so the
  // DISTINCT tops in order ARE the rows.
  for (const row of rows) {
    const tops = [...new Set(row.chips.map(chip => chip.offsetTop))].sort((a, b) => a - b);
    row.positions = row.chips.map(chip => tops.indexOf(chip.offsetTop));
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
  // `+N` is itself a chip and can be the thing that pushes the strip to a third
  // row. Same counting, same origin — and it REPEATS: dropping one chip can
  // widen `+N` from "+1" to "+10" and overflow again, which the single pass
  // below used to leave on the face. Bounded by the chip count, and every pass
  // reads the whole batch before the next one writes.
  for (let pass = 0; pass < 8; pass++) {
    const overflow = rows.filter((row) => {
      if (!row.more) return false;
      const live = [...row.chips.filter(chip => !chip.hidden), row.more];
      const tops = [...new Set(live.map(chip => chip.offsetTop))].sort((a, b) => a - b);
      return tops.indexOf(row.more.offsetTop) >= 2;
    });
    if (!overflow.length) break;
    for (const row of overflow) {
      const last = row.chips.filter(chip => !chip.hidden).pop();
      if (!last) continue;
      last.hidden = true; row.hidden++; row.more.textContent = '+' + row.hidden;
    }
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

/** W1h: the read-only reading a pile viewer shows beside its collection —
 *  the same body the card's own inspect door and tooltip use. */
export function cardDetailHtml(registries, ref) {
  const def = resolveCard(registries, ref);
  return cardTooltip(registries, def, playingCardModel(registries, ref).tokens);
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
