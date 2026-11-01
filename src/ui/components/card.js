import { bindDamageReceipt, cardDamageReceipt, damageReceiptHtml } from './damageReceipt.js';
import { bindCardComponentFailures } from '../cardArtLayers.js';
import { baseCardPresentation } from '../../content/generated/baseCards.js';
import { gameModule } from '../../model/gameProfile.js';
import { stanceOf, stanceEntryBonuses, stanceRulesFor, stanceRatingBonus } from '../../model/stanceRules.js';
import { cardSideTags } from './cardTagSymbols.js';
import { illustratedCardHtml, illustratedArtwork, fitIllustratedCards } from './illustratedCard.js';
import {applyCardAppearance} from './cardAppearance.js';
import { bindCardInspection, openCardInspection } from './cardInspection.js';
import { cardActions } from '../../services/cardActions.js';
import { configureTooltipGlossary, decorateKeywords } from './tooltipGlossary.js';
// src/ui/components/card.js — DOM card renderer (mockup: card-anatomy.svg)
//
// All numbers shown come from the engine: in combat, previewCard tokens
// (live math, SPEC §3.13); outside combat, the card's own literal values via
// computeTokenBindings. No math happens here.

import { resolveCard, relicPropertyRules } from '../../model/registries.js';
import { playingCardModel, playingCardDefinition, playingCardClasses, staticCardTokens, combatCardType } from '../../model/playingCard.js';
import { cardFields, resolveCardLevel } from '../../model/cardFields.js';
import { cardShape } from '../models/CardSizeModel.js';
import { litCard } from './cardSelection.js';
import { relicTokens, tokenRe } from '../../model/validate.js';
import { flaskGrowthClause } from '../../model/flaskgrowth.js';
import { esc } from './tooltip.js';
import { statusTooltipText } from '../uiContent.js';
import { balance } from '../../content/balance.js';
import { flasks } from '../../content/flasks.js';
import { cardTagExplanation } from '../../model/cardTagExplanation.js';
import { coreSmashClause } from '../../model/smashClause.js';
import { tagService } from '../../model/tagService.js';
import { metadataFooter, artworkAnchor } from '../models/IdentityModel.js';
import { cardArtFallbacks } from '../cardArtwork.js';
import { markArtPlaceholder } from '../artFallback.js';
import { registerCardArtRefresh } from '../cardArtStyle.js';
import { assetUrl } from '../assetmap.js';
import { t } from '../strings.js';
import { loreLine } from './loreLine.js';
import { cardChoice } from '../../model/cardChoices.js';
import { engravedIconHtml, engravedGlyphId } from './engravedIcon.js';
import { equipmentCardArt } from '../assets.js';
import { combatCardRange, combatProfileFor, combatProfileTags, numberedTraitRow } from '../../model/combatCardProfile.js';
import { ashenBlightCardLabel } from './ashenBlight.js';
import { ACTION_SIGILS, SCHOOL_SIGILS, cardSigilIdentity, mirrorSigil } from '../../content/combatSigils.js';
import { compactCardRules, sigilExplanationHtml } from './combatSigilView.js';
import { armsAsCoreCounter } from '../../model/profileStance.js';
import { cardFaceLines } from '../../model/cardFaceText.js';
import { cardFaceProjection, FACE_EFFECT_LINES } from '../../model/cardFaceProjection.js';
import { evadeGrantOnlyCard } from '../../model/fixCoreMechanics.js';
import { wardReadsAsPoise, wardOffCardText } from '../../model/wardOffCardText.js';
import { spellDefenseSplit } from '../../model/spellDefense.js';

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
export function staticTokens(def, registries = null, rules = null) { return staticCardTokens(def, registries, rules); }

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
  const tokens = relicTokens(def, registries ? relicPropertyRules(registries, def) : [], registries);
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

// `wardAsPoise` ({ preview }) is set when the run's profile has Ward switched off (Core 2): a card that authors
// `wardOffTextTemplate` then reads its Ward damage as Poise damage, one combined figure (model/wardOffCardText.js).
function fillTemplate(def, tokens, baseTokens, damageSequences = [], wardAsPoise = null, registries = null) {
  let template = def.textTemplate;
  // A Core Smash adds the shared rule sentence once (model/smashClause.js); an authored template that has it is left alone.
  const smashClause = coreSmashClause(def, registries);
  if (smashClause && !template.includes(smashClause)) template = `${template.trim()} ${smashClause}`;
  const projected = wardAsPoise ? wardOffCardText(def, tokens, baseTokens, wardAsPoise.preview) : null;
  if (projected) { template = projected.template; tokens = projected.tokens; baseTokens = projected.baseTokens; }
  const liveTokens = { ...tokens };
  let comparedTokens = baseTokens;
  // Complex cards retain authored clauses; their defensive amount still reads
  // the same allocation as the compact face and combat execution.
  template = template.replace(/\{(block(?:\.\d+)?)\}(?: (?:temporary )?(?:Barrier|Ward|Block))?/g, (match, token) => {
    if (token.startsWith('block') && def.defenseRulesVersion !== 2 && def.minCombatExpansionVersion !== 2) return match;
    const liveBlock = liveTokens[token + '.block'], liveWard = liveTokens[token + '.ward'];
    const split = Number.isFinite(liveBlock) && Number.isFinite(liveWard)
      ? { block: liveBlock, ward: liveWard } : spellDefenseSplit(def, liveTokens[token]);
    if (!split) return match;
    liveTokens[token + '.block'] = split.block;
    liveTokens[token + '.ward'] = split.ward;
    const baseSplit = baseTokens && spellDefenseSplit(def, baseTokens[token]);
    if (baseSplit) comparedTokens = { ...comparedTokens, [token + '.block']: baseSplit.block, [token + '.ward']: baseSplit.ward };
    return `{${token}.block} Block, {${token}.ward} Ward`;
  });
  for (const sequence of damageSequences) {
    if (!sequence?.amountToken || !sequence?.hitsToken || !Array.isArray(sequence.hitDamages)
      || sequence.hitDamages.length < 2 || sequence.hitDamages.every(amount => amount === sequence.hitDamages[0])) continue;
    const amount = sequence.amountToken.replaceAll('.', '\\.');
    const hits = sequence.hitsToken.replaceAll('.', '\\.');
    const pattern = new RegExp(`\\{${amount}\\}([^{}]*?)\\{${hits}\\}\\s+times`);
    template = template.replace(pattern,
      `{${sequence.amountToken}}$1(${sequence.totalDamage} total across ${sequence.hitDamages.length} hits)`);
    liveTokens[sequence.amountToken] = sequence.hitDamages.join(' + ');
  }
  let html = esc(template);
  html = html.replace(tokenRe(), (m, tok) => {
    const v = liveTokens[tok];
    if (v == null) return m;
    let cls = 'val';
    if (comparedTokens && typeof v === 'number' && typeof comparedTokens[tok] === 'number') {
      if (v > comparedTokens[tok]) cls += ' up';
      else if (v < comparedTokens[tok]) cls += ' down';
    }
    return `<span class="${cls}">${esc(v)}</span>`;
  });
  // Light keyword coloring for readability.
  html = html
    .replace(/\b(Bleed|Crimson Blight|Staggered|Poise)\b/g, '<span class="st-bleed">$1</span>')
    .replace(/\b(Exhaust|Ethereal|Innate|Retain|Unplayable)\b/g, '<span class="kw">$1</span>');
  return html;
}

// THE FACE A CARD WAS PAINTED WITH, kept so a card rebuilt for the same entry
// can take it over instead of parsing and fitting a second copy. Keyed by the
// card element: `html` is the face markup exactly as it was handed to
// innerHTML (before the appearance pass and the fitter touched the nodes),
// `at` the level it was drawn at, `receipt` what its damage numbers explain.
const paintedFaces = new WeakMap();
// A card element's in-place refresher (renderCard fills it): the opts it was built with, replaced.
const refreshers = new WeakMap();
// The art <img>'s error handler is bound once, to the image, and reads this: a
// face that moves to a rebuilt card keeps its handler, which must then repaint
// and mark the NEW card, and must keep the fallbacks it has already spent.
const artStates = new WeakMap();
// The text rows of a face (`.ic-text`) and everything around them. Two faces
// whose markup differs only INSIDE those rows are the same face with new words
// (the numbers a preview moved), and the rows are the only thing to rewrite.
const TEXT_ROW = /(<div class="ic-text"[^>]*>)([\s\S]*?)(<\/div>)/g;
function splitFace(html) {
  const rows = [];
  const skeleton = html.replace(TEXT_ROW, (_m, open, inner, close) => { rows.push(inner); return open + close; });
  return { skeleton, rows };
}
// Moves the painted nodes of `from` into `into` when the new face html is the
// old one or the old one with other words in its text rows. Returns the rows
// it rewrote (empty when none), or null when the face cannot be taken over, in
// which case `from` is left exactly as it was.
function takeOverFace(into, from, prior, html, receipt) {
  if (!from || prior.html === undefined) return null;
  let changed = [];
  const next = splitFace(html);
  if (prior.html !== html) {
    const old = splitFace(prior.html);
    if (old.skeleton !== next.skeleton || old.rows.length !== next.rows.length) return null;
    // A row holding a nested block is a row the pattern may have cut short.
    if (next.rows.some(row => row.includes('<div'))) return null;
    changed = next.rows.map((row, i) => (row === old.rows[i] ? -1 : i)).filter(i => i >= 0);
  }
  const painted = [...from.children].filter(node => node?.dataset?.cardPainted === '1');
  if (!painted.length) return null;
  const texts = painted.flatMap(node => [...node.querySelectorAll('.ic-text')]);
  if (texts.length !== next.rows.length) return null;
  // Rows the appearance pass re-skinned hold no words of their own.
  const rewrite = new Set(changed);
  if (prior.receipt !== receipt) rewrite.add(texts.findIndex(row => row.dataset.cardBinding === 'rules'));
  for (const i of rewrite) {
    if (i < 0) return null;
    const row = texts[i];
    if (row.dataset.customImage || row.querySelector('[data-card-decoration]')) return null;
  }
  for (const node of painted) into.append(node);
  for (const i of rewrite) texts[i].innerHTML = next.rows[i];
  return { rewrite, texts };
}

/**
 * renderCard(registries, ref, opts) → element.
 *   ref  — { cardId, upgraded, instanceId? }
 *   opts — { preview?    (previewCard result → live numbers),
 *            affordable? (bool; greys out when false),
 *            small?      (scale for reward/pile grids),
 *            tooltip?    (false suppresses the shared hover/focus tooltip),
 *            definition? (an already projected definition, e.g. the run's trait projection),
 *            rules?      (run rules for faces outside combat),
 *            reuseFace?  (the card element this one replaces: its painted face is taken over when this one's markup matches) }
 */
export function renderCard(registries, ref, opts = {}) {
  // The donor is read once and not kept: the door's closure spreads `opts` into the reading face it builds.
  const { reuseFace, ...ownOpts } = opts;
  opts = ownOpts;
  configureTooltipGlossary(registries);
  // Everything below that reads the opts is derived here, so refreshCard can re-derive it for a card kept in place
  // (a hand card whose preview or affordability moved). The door's closure reads these names when it opens.
  let def, rawModel, combatProfile, combatTags, expanded, model, damageWords, accessibleLabel;
  const deriveModel = () => {
    def = playingCardDefinition(registries, ref, opts);
    // ONE PROJECTION, READ ONCE. Everything this function used to derive on its
    // way to innerHTML — the tag junction, the cost profile, the type row, the
    // class tint — is `model` now (src/model/playingCard.js). Drawing is what is
    // left. The output is byte-identical by construction: the model's bodies are
    // the ones that stood here.
    rawModel = playingCardModel(registries, ref, { preview: opts.preview || null, definition: def });
    combatProfile = combatProfileFor(def);
    combatTags = combatProfileTags(combatProfile, registries);
    expanded = opts.preview?.combatExpansionVersion === 2 || opts.rules?.combatExpansionVersion === 2
      || def.defenseRulesVersion === 2 || def.minCombatExpansionVersion === 2;
    model = { ...rawModel, ...(expanded ? { faceType: combatCardType(def) } : {}),
      tags: [...rawModel.tags, ...combatTags.filter(tag => !rawModel.tags.some(existing => existing.id === tag.id))] };
    model.sideTags = cardSideTags(model, def, registries, opts.preview || null, opts.rules || null);
    // The combat hand's range chip (opts.range), by the same rule the deck editor uses.
    model.range = opts.range ? combatCardRange(def) : null;
    damageWords = model.tags.filter(tag => tag.id.startsWith('damage:')).map(tag => tag.label);
    accessibleLabel = [model.name, ACTION_SIGILS[model.sigils.action].label, model.sigils.mirror && mirrorSigil(model.sigils.mirror).mark.label,
      model.sigils.school && `${SCHOOL_SIGILS[model.sigils.school].label} school`,
      damageWords.length && `Damage: ${damageWords.join(', ')}`,
      ...model.sideTags.map(tag => tag.label + (Number.isInteger(tag.count) ? ` ${tag.count}${tag.countFormula ? ' + ' + tag.countFormula : ''}` : '')),
      rawModel.type.label,
      rawModel.type.subtype,
      rawModel.type.abilityLabel,
      rawModel.type.weaponArt,
      model.abilityRank !== null ? `rank ${model.abilityRank}` : model.rankBadge?.toLowerCase(),
    ].filter(Boolean).join(', ') + (opts.inspectReadOnly && opts.inspection !== false ? '. Enter to inspect. On touch, tap then Information.' : '');
  };
  deriveModel();
  const sourcePiece = ref.sourceArmamentId
    ? registries.equipment?.armaments?.find(piece => piece.id === ref.sourceArmamentId)
    : null;
  const equipmentPainting = sourcePiece ? equipmentCardArt(sourcePiece) : null;
  const el = document.createElement('div');
  // THE FACE IS THE KIT'S CARD (§10): a fixed box, fixed landmarks (name, art,
  // type band), and one shared row budget below the band that tags and text
  // divide. `as-card` is the recipe; the old class names stay as the hooks
  // every tool and screen reads.
  el.className = playingCardClasses(model) + ' illustrated-card';
  if (def.corrupted) el.classList.add('corrupted-card');
  if (expanded) el.classList.add('expanded-combat-card');
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
  if (combatProfile.camp) el.dataset.combatCamp = combatProfile.camp;
  if (combatProfile.maneuver) el.dataset.combatManeuver = combatProfile.maneuver;
  if (combatProfile.school) el.dataset.combatSchool = combatProfile.school;

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
  const resourceWord = (resource) => esc(registries.framework.resourceWord(resource));

  // WC0/WC1: keep every projected cost on the exposed left edge of a fan.
  // The existing framework/preview remains the authority for all values.
  // A ZERO ACTION COST IS A REAL, READABLE COST — it is the whole point of a
  // free card, and the fan's left edge is where a player counts what a turn can
  // afford. Dropping the row at 0 rendered rogueShiv (cost: 0) and its kin with
  // no skill at all, which reads as "no action cost printed" — i.e. unknown — not
  // as "free". Only the SECONDARY pools elide at zero: a card that spends no
  // stamina and no mana should not print two empty rails.
  const costRows = [
    ['stamina', 'cost stamina-cost', 'skill', cost, true],
    ['mana', 'mana-cost', 'MP', manaCost, false],
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
  // carried by the reading door's pane — the same place, and the same lore
  // line (components/loreLine.js), the equipment card uses for its own.
  //
  // `cname` is not a region, for the same reason `.epc-name` is not: the title
  // is what tells one card from another and shows at every level.
  const identity = model.instanceId || model.id;
  // See equipmentCard.js: `inspection: false` means "no door on this face",
  // not "this face says everything". An explicit level wins over the inert
  // default so a caller that binds the door to a wrapper still gets a resting
  // card at resting size.
  const floor = opts.level || (opts.inspection === false ? 'inspect' : 'glance');
  const levelNow = () => resolveCardLevel({
    floor, lit: litCard() === identity,
  });
  let drawn = levelNow();
  // Every printed surface uses the same compact benefits. A visible tag keeps
  // the exact amount and condition available without repeating it in the body.
  let faceRules, wardPoise, allFaceLines, faceLines;
  const deriveFace = () => {
    faceRules = gameModule(registries, 'cards');
    wardPoise = wardReadsAsPoise(registries) ? { preview: opts.preview || null } : null;
    const representedEffects = model.sideTags.flatMap(tag => tag.representedEffects || []);
    const representedEntry = model.sideTags.flatMap(tag => tag.representedEntry || []);
    const representedRules = model.sideTags.flatMap(tag => tag.representedRules || []);
    allFaceLines = baseCardPresentation[def.id] ? null : cardFaceLines(def, opts.preview || null, registries, opts.rules || null,
      { stanceEntry: false, representedEffects, representedEntry, representedRules });
    // The bounded projection selects whole qualified clauses after the live
    // model has suppressed benefits already represented by exact tag values.
    faceLines = allFaceLines && registries.gameProfile?.foundation?.mode === 'configured' && opts.level !== 'inspect'
      ? allFaceLines.slice(0, Math.min(faceRules?.faceMaxEffects ?? Infinity, faceRules?.faceMaxLines ?? Infinity)) : allFaceLines;
    if (faceLines && def.weightClassPriced) {
      const pricingNote = { kind: 'detail', html: 'Cost reflects your current weight' };
      faceLines.push(pricingNote);
      if (allFaceLines !== faceLines) allFaceLines?.push(pricingNote);
    }
  };
  deriveFace();
  let reuseFrom = reuseFace || null;
  const paint = (at) => {
    const visualCardId = baseCardPresentation[model.id]?.canonicalCardRef;
    const artwork = illustratedArtwork(visualCardId ? { cardId: visualCardId } : ref, visualCardId || model.id, {large:at==='inspect',equipmentArt:equipmentPainting,
      definition:def,registries,style:opts.artStyle});
    const kept = el.children?[...el.children].filter(node=>node?.dataset?.cardPainted!=='1'):[];
    const authoredRules = def.weightClassPriced
      ? fillTemplate(def,model.tokens,model.baseTokens,model.damageSequences,wardPoise,registries).replace(/ Light:.*$/,'')+' Cost reflects your current weight.'
      : fillTemplate(def,model.tokens,model.baseTokens,model.damageSequences,wardPoise,registries);
    // Under version-one combat a sentence that opens "In expanded combat," does not apply, so the face need not carry it.
    const appliedRules = expanded ? authoredRules : authoredRules.replace(/\s*In expanded combat,[^.]*\./g, '');
    // An authored short summary (`faceTemplate`) stands in for the Inspect cue; same live tokens, no shared rider clauses.
    const summaryHtml = Array.isArray(def.faceTemplate) && def.faceTemplate.length
      ? def.faceTemplate.map(line => fillTemplate({ id: def.id, type: def.type, tags: def.tags, cardTags: def.cardTags, combatProfile: def.combatProfile, evade: def.evade, textTemplate: line.replace(/\[v2:([^\]]*)\]/g, expanded ? '$1' : '').replace(/,? ?(\{[\w.]+\})×/, ', $1 times'), defenseRulesVersion: def.defenseRulesVersion, minCombatExpansionVersion: def.minCombatExpansionVersion },
        model.tokens, model.baseTokens, model.damageSequences, null, null).replace(/(<span class="val[^"]*">1<\/span>) cards\b/gi, '$1 card').replace(/[.,]\s*$/, '')) : null;
    const projection = cardFaceProjection(def, { lines: faceLines, authoredHtml: appliedRules, faceHtml: summaryHtml, registries,
      effects: opts.preview?.chargedEffects || def.effects || [] });
    const rulesHtml = compactCardRules(projection.clauses.map((line, i) => `<span class="face-line" data-face-kind="${line.kind}"${line.downside || line.kind === 'cost' ? ' data-face-downside="true"' : ''} data-face-clause="${i}">${line.html.replace(/\.$/, '')}.</span>`).join(' '))
      + `<span data-face-fallback style="display:none">${esc(t('card.face.inspectEffect'))}.</span>`
      + `<span data-face-fallback-short style="display:none" aria-label="${esc(t('card.face.inspectEffect'))}">${esc(t('deckEditor.inspect'))}.</span>`;
    el.dataset.faceLines = String(projection.clauses.length);
    el.dataset.faceOmitted = String(projection.omitted);
    if (projection.summarized) el.dataset.faceSummary = 'true'; else delete el.dataset.faceSummary;
    const faceHtml = illustratedCardHtml(model,{
      // The printed price is live; the full weight table stays in Information.
      rules: rulesHtml,
      painting:artwork===null?null:artwork?.path,
      equipmentArtwork:artwork?.equipment,
      artworkKind:artwork?.kind,
      artworkPosition:artwork?.position,
      artworkComposition:artwork,
      // Enlarging the face never enlarges its effect budget; the adjacent
      // Information reading carries every authored rule and damage receipt.
      completeRules: false,
      rulesOverflow: projection.omitted,
      glyph:engravedIconHtml(engravedGlyphId(model.icon))||esc(model.icon),
    });
    // The numbers on the face come from a preview, and a hand's previews move
    // on every play while the face itself rarely does. A card rebuilt for the
    // same entry (opts.reuseFace) takes over the nodes of the face it replaces
    // when this markup is that face's, or that face's with other words in its
    // text rows; only those rows are written, and only the first paint asks.
    const receipt = cardDamageReceipt(opts.preview);
    const receiptKey = receipt ? JSON.stringify([receipt, opts.preview.targetName]) : '';
    const donor = reuseFrom; reuseFrom = null;
    const priorFace = donor && paintedFaces.get(donor);
    const taken = priorFace && (priorFace.at === 'inspect') === (at === 'inspect')
      ? takeOverFace(el, donor, { html: priorFace.html, receipt: priorFace.receipt }, faceHtml, receiptKey) : null;
    if (!taken) {
      el.innerHTML = faceHtml;
      applyCardAppearance(el.querySelector('.illustrated-card-face'));
      bindDamageReceipt(el, opts.preview);
      if (def.corrupted) el.insertAdjacentHTML('beforeend', ashenBlightCardLabel(def));
      // The illustrated face owns the rank label and keeps it above its fitted panel.
      if(el.children)for(const node of el.children)if(node.dataset)node.dataset.cardPainted = '1';
    } else if (taken.texts.some((row, i) => taken.rewrite.has(i) && row.dataset.cardBinding === 'rules')) {
      // The rewritten rules lost their bindings with their nodes; the damage numbers explain themselves again.
      bindDamageReceipt(el, opts.preview);
    }
    paintedFaces.set(el, { html: faceHtml, at, receipt: receiptKey });
    for (const node of kept)el.append(node);
    el.dataset.level=at;
    el.dataset.cardLayout='illustrated-v1';
    scheduleCardFits([el]);
    el.setAttribute?.('aria-label',accessibleLabel);
    const image = el.querySelector?.('.playing-card-art');
    const art = image && artStates.get(image);
    if(image && taken && art){
      // A taken-over image keeps its handler and the fallbacks it has spent; it now answers to this card.
      art.host = el; art.repaint = () => paint(drawn);
    }else if(image){
      image.dataset.cardArt = artwork?.kind || 'illustrated';
      const fallbacks = cardArtFallbacks(ref, artwork, {large:at==='inspect',
        legacy:artwork?.kind==='simple'?illustratedArtwork(ref,model.id,{large:at==='inspect',equipmentArt:equipmentPainting,style:'Legacy'}):null});
      const state = { host: el, repaint: () => paint(drawn), fallbacks };
      artStates.set(image, state);
      image.addEventListener('error',()=>{
        markArtPlaceholder(state.host, state.repaint);
        const next=state.fallbacks.shift();
        if(next){
          image.parentNode?.querySelectorAll('[data-card-art-layers]').forEach(node=>node.remove());
          image.dataset.cardArt=next.kind;
          image.style.filter='';
          image.style.objectFit=next.fit||(next.extended?'cover':'contain');
          image.style.objectPosition=next.position||'center';
          image.src=assetUrl(next.path);
        }
      });
      bindCardComponentFailures(image.parentNode, image);
    }

  };
  paint(drawn);
  registerCardArtRefresh(el, () => paint(drawn));

  // #61 M5: a matched tag-scoped vulnerability lights the card's boosted
  // number in the status row's own tint — "these cards just lit up" instead
  // of set-intersection math. Non-matching cards get nothing (absence = no
  // bonus; never a "+0%" badge).
  const syncBoost = () => {
    el.classList.toggle('tag-boost', !!model.paint.boostTint);
    if (model.paint.boostTint) el.style.setProperty('--boost-tint', model.paint.boostTint);
    else el.style.removeProperty('--boost-tint');
  };
  if (model.paint.boostTint) syncBoost();

  // What is fixed on the element when it is built (its classes, type paint, identity, the
  // hold-to-select kind): a refresh may change the numbers on the face and nothing here.
  const shellKey = () => JSON.stringify([playingCardClasses(model), !!def.corrupted, !!expanded, model.paint.typeColor, model.paint.radiusPx,
    model.paint.artRadiusPx, model.paint.tint, model.instanceId || '', model.id, combatProfile.camp, combatProfile.maneuver, combatProfile.school,
    !!opts.small, !!opts.preview?.needsTarget, opts.inspection !== false]);
  const builtShell = shellKey();
  refreshers.set(el, next => {
    const { reuseFace: _unused, ...nextOpts } = next;
    const was = opts;
    opts = nextOpts;
    deriveModel(); deriveFace();
    if (shellKey() !== builtShell) { opts = was; deriveModel(); deriveFace(); return false; }
    el.classList.toggle('unaffordable', opts.affordable === false);
    syncBoost();
    reuseFrom = el; // the face is taken over from itself: only the words that moved are rewritten
    paint(drawn);
    reuseFrom = null;
    return true;
  });

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
      const reading = cardStatusContext(def, opts, registries);
      details.innerHTML = opts.tooltipFn ? sigilExplanationHtml(model.sigils) + opts.tooltipFn() + cardStatusDetailsHtml(registries, def, reading)
        : cardTooltip(registries, def, model.tokens, liveCosts, model.damageSequences, reading);
      const receipt = cardDamageReceipt(opts.preview);
      if (receipt) details.insertAdjacentHTML('beforeend', damageReceiptHtml(receipt, { targetName: opts.preview.targetName, expanded: true }));
      decorateKeywords(details);
      // AUTHORED FLAVOUR REACHES THE PLAYER, at the level that promises
      // everything. The note above the regions used to say a playing card
      // authors no flavour; that was simply false — `resolveCard` composes
      // `profile.flavor || def.flavor` (model/registries.js), the generated
      // basic profiles author it, and so do the colorless and co-op sets. It
      // was written, stored, and shown to nobody.
      // It goes in the reading door's pane rather than on the face, and it is
      // one line there: the identity line. The card's full description opens
      // in the lore modal from that line (components/loreLine.js), the same
      // element the equipment card uses, so the two card kinds read alike.
      const lore = loreLine({ text: def.flavor, title: def.name });
      if (lore) details.append(lore);
      const face = renderCard(registries, ref, { ...opts, tooltip: false, inspection: false, level: 'inspect', faceLineLimit: undefined });
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
        commands: opts.commands || {},
        // Combat's hand: the page lock lifts a frame after the door leaves.
        deferLift: surface === 'combat' });
    } });
  // The read-only binder adds keyboard behavior; retain the richer card name.
  el.setAttribute?.('aria-label',accessibleLabel);
  // EXACTLY THE TWO CARDS WHOSE LEVEL CHANGED. A selection lights one card and
  // douses one card, and cardInspection.js fires both events on the card they
  // concern, so each face updates its level. Nothing sweeps the document —
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
      const changesFace = (next === 'inspect') !== (drawn === 'inspect');
      drawn = next;
      if (changesFace) paint(drawn);
      else {
        // Glance and focus share artwork and rules. Keep their nodes and input
        // ownership; only inspection changes the printed face. The new level
        // can still change its CSS size or line budget, so retain the fit pass.
        el.dataset.level = drawn;
        scheduleCardFits([el]);
      }
    };
    el.addEventListener('cardinspectionselect', restate);
    el.addEventListener('cardinspectiondouse', restate);
  }
  return el;
}

/**
 * refreshCard(el, opts) → true when the card kept its element and now shows `opts` (a new preview,
 * affordability or availability): the face's moved words are rewritten in place, the classes follow, and the
 * reading door reads the new opts when it next opens. False when the new opts would change what the element
 * itself is built from (type, classes, identity); the caller then builds a new card, as before. `opts` is the
 * complete set renderCard was given, not a patch.
 */
export function refreshCard(el, opts) {
  const refresh = refreshers.get(el);
  return refresh ? refresh(opts) : false;
}

/**
 * fitCardFace(el) — the three facts CSS cannot compute, reported as data
 * attributes the stylesheet reads (kit §10):
 *   data-name      long | verylong  — the name stepped its type down to stay one line
 *   data-tag-rows  0 | 1 | 2        — rows the tags took; text gets the rest
 *   data-tags-hidden n              — tags deferred past the second row (+n)
 *   data-truncated true             — both were full; Information has the full text
 */
const pendingFits = new Set();
let fitFrame = 0;

// Selection changes the card's size, never the ordinary effect budget.
export function setHandFaceBudget(el, selected) {
  const rules = el?.querySelector?.('.ic-text[data-face-lines="true"]');
  if (!rules) return;
  const lines = String(FACE_EFFECT_LINES);
  if (rules.dataset.maxLines === lines) return;
  rules.dataset.maxLines = lines;
  scheduleCardFits([el]);
}

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
  fitIllustratedCards(cards.filter(card => card?.isConnected && card.classList.contains('illustrated-card')));
  const rows = cards.filter(el => el?.isConnected && !el.classList.contains('illustrated-card')).map(el => {
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
 * cardPlainText(registries, ref) → the card's effect text as a plain string:
 * the same template the face fills, with tags stripped. Pure string work, no
 * DOM, so it runs the same headless and in a browser.
 */
export function cardPlainText(registries, ref, opts = {}) {
  const def = playingCardDefinition(registries, ref, opts);
  const model = opts.preview ? playingCardModel(registries, ref, { ...opts, definition: def })
    : { tokens: staticTokens(def, registries, opts.rules || null), damageSequences: [] };
  const lines = opts.rules?.combatExpansionVersion === 2 || opts.preview?.combatExpansionVersion === 2 || evadeGrantOnlyCard(def)
    ? (baseCardPresentation[def.id] ? null : cardFaceLines(def, opts.preview || null, registries, opts.rules || null)) : null;
  // Plain string work only: no DOM, so it runs the same headless and in a
  // browser. Tags go first; &amp; is decoded last so "&amp;lt;" stays literal.
  return String(lines ? lines.map(line => line.html).join(' · ') : fillTemplate(def, model.tokens, null, model.damageSequences, wardReadsAsPoise(registries) ? { preview: opts.preview || null } : null, registries))
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/**
 * Tooltip HTML previewing what a card becomes when Smithed: current text in
 * muted, upgraded text below with changed values highlighted green/red (the
 * same up/down coloring cards use in play). All numbers come from the defs.
 */
export function upgradePreviewHtml(registries, ref, faces = null) {
  // `faces` ({ before, after } card definitions) lets a Core card-upgrade picker preview the plan's own faces,
  // the rolled step applied, so the preview is what the commit applies. Without it the authored upgrade is shown.
  const base = faces && faces.before ? faces.before : resolveCard(registries, { ...ref, upgraded: false });
  const upg = faces && faces.after ? faces.after : resolveCard(registries, { ...ref, upgraded: true });
  const baseTokens = staticTokens(base);
  const upgTokens = { ...baseTokens, ...staticTokens(upg) };
  let baseText = fillTemplate(base, baseTokens, null);
  let upgradedText = fillTemplate(upg, upgTokens, baseTokens);
  if (faces && faces.before && faces.after && !baseCardPresentation[base.id]) {
    // A procedural step (an added status, +hits) lives in the card's effects, not in its authored template, so the
    // preview reads the same face lines the card draws; lines the step changed are marked as raised.
    const lines = (def) => (cardFaceLines(def, null, registries, null) || []).filter(line => line.kind !== 'bonus');
    const beforeLines = lines(base), afterLines = lines(upg);
    if (beforeLines.length && afterLines.length) {
      const had = new Set(beforeLines.map(line => line.html));
      baseText = beforeLines.map(line => line.html).join(' · ');
      upgradedText = afterLines.map(line => had.has(line.html) ? line.html : line.html.replace(/class="val"/g, 'class="val up"')).join(' · ');
    }
  }
  // Both lines are CARD TEXT, so both wear `.ctext` — the class the mark rules
  // are keyed to (ui.css). Without it the preview drew the number it had just
  // computed as changed in the same colour and weight as the word beside it.
  // `.ctext` carries the marks only; the card face's block layout stays on
  // `.card .ctext` and does not follow the text into the tooltip.
  let html = `<div class="tt-title">${esc(base.name)} → ${esc(faces && faces.after ? upg.name : `${base.name}+`)}</div>`;
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
function glossaryEntry(registries, kind, id, context = {}) {
  if (id == null) return null;
  const source = kind === 'status' ? registries.statuses : registries.stances;
  // A maneuver ('attack'/'defend') is a stance word with no stance row: the
  // registry's get() throws for it, so an unknown id takes the words-only path.
  const row = (typeof source?.has === 'function' ? (source.has(id) ? source.get(id) : null) : source?.get?.(id)) || null;
  const withWords = kind === 'status'
    ? registries.frameworkTerms.withStatusWords
    : registries.frameworkTerms.withStanceWords;
  const display = row && typeof withWords === 'function'
    ? withWords(row)
    : (kind === 'status' ? registries.frameworkTerms.statusDisplay(id) : registries.frameworkTerms.stanceDisplay(id));
  if (!display) return null;
  const tooltip = statusTooltipText(display, context);
  return tooltip ? { name: display.name, tooltip } : null;
}

// Carry the actual run/preview rules into every status reading. A definition
// stamped v2 is evidence too; a definition with no version keeps the shared
// helper's explicitly labelled Classic/Expanded reading.
function cardStatusContext(def, { preview = null, rules = null } = {}, registries = null) {
  return {
    combatExpansionVersion: preview?.combatExpansionVersion ?? rules?.combatExpansionVersion
      ?? (def.minCombatExpansionVersion === 2 || def.defenseRulesVersion === 2 ? 2 : undefined),
    combatStatusRules: preview?.combatStatusRules ?? rules?.combatStatusRules,
    combatExpansionRules: preview?.combatExpansionRules ?? rules?.combatExpansionRules,
    foundation: preview?.foundation ?? rules?.foundation,
    coreStatusAuthority: preview?.coreStatusAuthority,
    fixCoreRules: preview?.coreStatusAuthority?.enabled === false ? undefined : rules?.fixCoreRules,
    gameProfile: preview?.coreStatusAuthority?.enabled === false ? undefined : rules?.gameProfile ?? registries?.gameProfile,
    chargedEffects: preview?.chargedEffects,
  };
}

// Information has no three-status cap. Every registered application, including
// nested counter/upcast riders, gets one visible complete reading. Tooltips
// remain useful, but duration and stacking never require another hover.
function cardStatusDetailsHtml(registries, def, context) {
  const ids = new Set(), visited = new Set();
  const walk = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 12 || visited.has(value)) return;
    visited.add(value);
    if (['applyStatus', 'buildup'].includes(value.op) && registries.statuses?.has?.(value.status)) ids.add(value.status);
    for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child, depth + 1);
  };
  for (const key of ['effects', 'counterPayload', 'upcast', 'schoolEffect']) walk(def[key]);
  walk(context.chargedEffects);
  const rows = [...ids].map(id => {
    const entry = glossaryEntry(registries, 'status', id, context);
    return entry ? `<div class="combat-rule-hint" data-inspection-status="${esc(id)}"><strong>${esc(entry.name)}:</strong> ${esc(entry.tooltip)}</div>` : '';
  }).join('');
  return rows ? `<section class="inspection-status-details">${rows}</section>` : '';
}

/** W1h: the read-only reading a pile viewer shows beside its collection —
 *  the same body the card's own inspect door and tooltip use. */
export function cardDetailHtml(registries, ref, opts = {}) {
  const def = playingCardDefinition(registries, ref, opts);
  const model = playingCardModel(registries, ref, { ...opts, definition: def });
  return cardTooltip(registries, def, model.tokens, model.hasPreview ? model.costs : null, model.damageSequences, cardStatusContext(def, opts, registries));
}

function cardTooltip(registries, def, tokens, liveCosts = null, damageSequences = [], statusContext = {}) {
  // Cost numbers come from the framework profile (or the preview's already
  // resolved live costs, when the card is in play) and the resource words from
  // TermRegistry — same rendered string, one authority for both.
  const pools = liveCosts || registries.framework.costProfile(def);
  // Terms are data; escape them like every other field before innerHTML.
  const word = (resource) => esc(registries.framework.resourceWord(resource));
  const costText = `${esc(pools.variable ? 'X' : pools.action)} ${word('action')}`
    + (pools.mana ? ` + ${esc(pools.mana)} ${word('mana')}` : '');
  // THE TITLE IS THE NAME AND NOTHING ELSE (kit §08): type and cost sit on the
  // meta line as the same tag and value atoms the card face uses.
  const identity = playingCardModel(registries, { cardId: def.id }, { definition: def });
  const typeText = [identity.type.label, identity.type.subtype, identity.type.abilityLabel, identity.type.weaponArt].filter(Boolean).join(' · ');
  let html = `<div class="tt-title">${esc(def.name)}</div>`
    + `<div class="ti-meta"><span class="as-tag">${esc(typeText)}</span><span class="ti-cost">${costText}</span></div>`;
  if (pools.estimated) html += '<div class="combat-rule-hint">Estimated price; temporary discounts may lower it.</div>';
  // Card text here too — same function, same marks, same class. The in-play
  // card tooltip had the identical defect; it is one fix, not two.
  const combatProfile = combatProfileFor(def);
  const commonStart = html.length;
  html += sigilExplanationHtml(cardSigilIdentity(combatCardType(def), combatProfile));
  if (registries.gameProfile?.foundation?.mode !== 'configured' && (def.defenseRulesVersion === 2 || def.minCombatExpansionVersion === 2)) {
    const stance = stanceOf(def);
    if (stance) {
      const ctx = { registries, combatExpansionVersion: 2, stanceRules: registries.balance?.stanceRules };
      const rules = stanceRulesFor(ctx), entry = stanceEntryBonuses(def, ctx);
      const magical = stance.camp === 'spell';
      const rated = { combatStance: stance };
      const bonuses = ['ar', 'pr', 'dr', 'ward'].map(id => [id, stanceRatingBonus(ctx, rated, id)]);
      const offense = bonuses.some(([id, amount]) => ['ar', 'pr'].includes(id) && amount > 0);
      const active = bonuses.filter(([, amount]) => amount > 0).map(([id, amount]) => '+' + amount + ' ' + (id === 'ward' ? 'Ward rating' : id.toUpperCase()));
      const grants = Object.entries(entry).filter(([, amount]) => amount > 0).map(([id, amount]) => '+' + amount + ' ' + ({ precision: t('card.tags.precision'), evade: 'Evade', block: 'Block', barrier: 'Barrier' })[id]);
      html += '<div class="combat-rule-hint"><strong>Stance:</strong> ' + esc(active.join(', ')) + ' while active; does not stack.'
        + (grants.length ? ' On changing stance: ' + esc(grants.join(', ')) + '.' : '')
        + ' Repeating the same stance grants no entry bonuses and costs ' + esc(rules.sameStanceDiscount) + ' less SP.'
        + (stance.maneuver === 'defend' ? ' Every play restores ' + esc(rules.defenseRestore) + ' Poise and Ward; excess becomes Block and Barrier.' : '')
        + (magical && offense ? ' Each existing status applied gains +' + esc(rules.spellStatusStacks) + ' stack.' : '') + '</div>';
    }
  }
  if (combatProfile.maneuver === 'counter') {
    // Core return help only where live arms the card (armsAsCoreCounter): Counter stances and spell Counters with coverage.
    const inCore = registries.gameProfile?.modules?.effects?.fixCoreVersion === 1;
    const coreCounter = inCore && armsAsCoreCounter(registries, def);
    const coreIneligible = inCore && !coreCounter;
    if (def.counterCoverage) {
      const c = def.counterCoverage;
      const names = { physical: 'Martial', spell: 'Spell', melee: t('deckEditor.range.melee'), reach: t('deckEditor.range.reach'), ranged: t('deckEditor.range.ranged'), single: 'Single', area: 'Area', damage: 'damage', status: 'status pressure' };
      const coverage = [c.camps, c.ranges, c.targeting, c.effects].map(ids => (ids || []).map(id => names[id] || id).join(' + ')).filter(Boolean).join(' · ');
      html += `<div class="combat-rule-hint"><strong>Counter coverage:</strong> ${esc(coverage)}${c.schools ? ` · ${esc(c.schools.join(' + '))}` : ''}. ${coreCounter ? esc(t('card.counter.help.core')) : coreIneligible ? 'The prepared stance remains until another maneuver replaces it.' : 'Return once after all covered damage and status pressure is resisted. Evade and Invulnerability give no return. The prepared stance remains until another maneuver replaces it.'}</div>`;
    } else html += `<div class="combat-rule-hint">${esc(t(coreCounter ? 'card.counter.help.core' : 'card.counter.help.legacy'))}</div>`;
  }
  if (def.defenseRange) html += `<div class="combat-rule-hint"><strong>Defense range:</strong> ${esc(def.defenseRange[0].toUpperCase() + def.defenseRange.slice(1))} · Covers ${esc(['melee', 'reach', 'ranged'].slice(0, ['melee', 'reach', 'ranged'].indexOf(def.defenseRange) + 1).map(range => t('deckEditor.range.' + range)).join(' + '))}.</div>`;
  if (identity.cardCategory === 'stance') {
    html += `<div class="combat-rule-hint"><strong>Stance group:</strong> ${esc(identity.stanceGroups.map(group => group === 'offense' ? 'Offense' : 'Defensive').join(' + '))}.</div>`;
    if (combatProfile.maneuver === 'counter' && def.defenseRulesVersion === 2)
      html += `<div class="combat-rule-hint"><strong>Return range:</strong> ${esc((combatProfile.range || 'melee')[0].toUpperCase() + (combatProfile.range || 'melee').slice(1))}. Return misses out of range, on a failed Accuracy check against base Evasion, or when avoided. A miss deals no HP, Poise, or Ward damage.</div>`;
    if (combatProfile.maneuver === 'sweep' && (def.tags || def.cardTags || []).includes('trait:reaction'))
      html += '<div class="combat-rule-hint">Reaction Sweep resolves before the incoming attack. Killing, staggering or controlling its attacker can interrupt it; otherwise the attack resumes.</div>';
  }
  // KEY FIRST (owner, 2026-11-01): the card's effect line and its effect-tag
  // definitions lead; the common type, school, stance and element explanations
  // follow, then the chips.
  const common = html.slice(commonStart);
  html = html.slice(0, commonStart);
  html += `<div class="ctext">${fillTemplate(def, tokens, null, damageSequences, wardReadsAsPoise(registries) ? { preview: null } : null, registries)}</div>`;
  html += cardStatusDetailsHtml(registries, def, statusContext);
  // Nested keyword + status tooltips (SPEC §7.3).
  // ONE CHIP PER DISTINCT TAG. Three authored ids carry the label "Spell"
  // (camp:spell, source:spell, maneuver:casting), so a spell card used to print
  // "Spell Spell Spell" — the old Set only removed byte-identical markup, and
  // each chip's tooltip differs. Chips are keyed by label; the tooltips of the
  // ids that share a label are merged into the one chip.
  // EFFECT TAGS (keywords and applied statuses) also list their tooltip text
  // inline, under the chips; card type, stance and element tags stay tooltip-only.
  const chips = new Map();
  const addChip = (label, tip, effect = false) => {
    const key = String(label).trim().toLowerCase();
    const chip = chips.get(key) || { label, tips: [], effectTips: [], effect: false };
    if (tip && !chip.tips.includes(tip)) chip.tips.push(tip);
    // Only effect sources (keyword, applied status) feed the inline text.
    if (effect && tip && !chip.effectTips.includes(tip)) chip.effectTips.push(tip);
    chip.effect ||= effect;
    chips.set(key, chip);
  };
  for (const kw of def.keywords || []) {
    // Words resolve through the framework TermRegistry (one vocabulary home);
    // an id outside the keyword vocabulary is skipped, as before.
    const k = registries.framework.keywordDisplay(kw);
    if (k) addChip(k.name, k.tooltip, true);
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
      const s = glossaryEntry(registries, 'status', eff.status, statusContext);
      if (s && !def.textTemplate.includes(s.name)) addChip(s.name, s.tooltip, true);
    }
    if (eff.op === 'enterStance') {
      // A chosen stance (Warrior's Vow) explains every stance it can offer.
      const ids = eff.choose ? (cardChoice(registries, def, def.class)?.options || []).map((o) => o.id) : [eff.stance];
      for (const id of ids) {
        const s = glossaryEntry(registries, 'stance', id, statusContext);
        if (s && !def.textTemplate.includes(s.name)) addChip(s.name, s.tooltip);
      }
    }
  }
  const service = tagService(registries);
  const tags = def.cardTags != null ? service.resolve(def.cardTags)
    : def.traitValues && Array.isArray(def.tags) ? service.resolve(def.tags) : service.tagsOf('card', def);
  for (const tag of tags) { const row = numberedTraitRow(tag, def.traitValues); addChip(row.label, cardTagExplanation(def, row, registries)); }
  for (const tag of combatProfileTags(combatProfile, registries).filter(tag => !tags.some(existing => existing.id === tag.id))) addChip(tag.label, cardTagExplanation(def, tag, registries));
  const rows = [...chips.values()];
  const effects = rows.filter((chip) => chip.effect && chip.effectTips.length);
  if (effects.length) html += `<dl class="inspection-effect-tags">${effects.map((chip) => `<dt>${esc(chip.label)}</dt><dd>${esc(chip.effectTips.join(' '))}</dd>`).join('')}</dl>`;
  html += common;
  if (rows.length) html += `<div class="inspection-tags">${rows.map((chip) => `<span class="inspection-tag${chip.effect ? ' inspection-tag-effect' : ''}" role="button" tabindex="0" data-tip="${esc(chip.tips.join(' '))}">${esc(chip.label)}</span>`).join('')}</div>`;
  return html;
}
