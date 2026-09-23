// src/ui/models/StatsPreviewModel.js — the worked examples on Advanced → Stats,
// decided without a DOM.
//
// "I'd also like … useful examples that change when I make adjustments so
// that I can see what's changing … show the expanded calculation and total
// amount" (owner, 2026-09-21). Every example is computed by the SAME model the
// game uses — the configured content bundle a new run is born from, the
// derived-stat engine, the hand rules and the rating formula — so an example
// cannot describe arithmetic the game does not do.
//
// The subject is the character in play when Settings is opened during a run,
// or a chosen class's starting attributes otherwise, and every example says
// which it is.

import { contentBundle } from '../../content/index.js';
import { advancedConfigStructuralProblems, configuredContentBundle } from '../../model/advancedConfig.js';
import { validateContent } from '../../model/validate.js';
import { playerPoiseThresholdReceipt } from '../../model/statProjection.js';
import { deriveStat, levelBonus, resolveDerivedStatRules } from '../../model/derivedStats.js';
import { resolveHandRules, scaledCardsReceipt } from '../../model/handRules.js';
import { ratingReceipt, resolveCombatRatings } from '../../model/combatRatings.js';
import { attributeRatingReceipt, ratingAttributeIds } from '../../model/ratingFormula.js';
import { createRegistries } from '../../model/registries.js';
import { createRunState } from '../../model/state.js';

/** The settings key that remembers which class the out-of-run examples use. */
export const STATS_EXAMPLE_CLASS_KEY = 'settingsStatsExampleClass';

const DERIVED_BY_TOPIC = Object.freeze({ Actions: 'energy', 'Draw & hand': 'draw', HP: 'hp', Stamina: 'stamina', Mana: 'mana', Poise: 'poise' });
const RATING_BY_TOPIC = Object.freeze({ 'Attack rating (AR)': 'ar', 'Defence rating (DR)': 'dr', 'Power rating (PR)': 'pr', Poise: 'poise', Ward: 'ward' });
const RATING_LABELS = Object.freeze({ ar: 'AR', dr: 'DR', pr: 'PR', poise: 'Poise', ward: 'Ward' });

// Four places, so a typed weight such as 0.125 or 0.9999 is shown as the
// number that was multiplied, not a rounding of it.
const num = (value) => String(Number(Number(value).toFixed(4)));
const plural = (count, one, many = `${one}s`) => `${num(count)} ${count === 1 ? one : many}`;

/** The classes an out-of-run example can be read from, in content order. */
export function statsExampleClasses(bundle = contentBundle) {
  return (bundle.classes || []).map((classDef) => ({ id: classDef.id, label: classDef.name || classDef.id }));
}

/**
 * statsExampleSubject(settings, previewAttributes) → whose attributes the
 * examples read: the current character, or the stored example class's
 * starting attributes under the configured creation mode.
 */
export function statsExampleSubject(settings = {}, previewAttributes = null, configured = configuredContentBundle(contentBundle, settings), previewLevel = null) {
  const shortLabel = Object.fromEntries((configured.attributes || []).map((attribute) => [attribute.id, attribute.shortLabel || attribute.label]));
  if (previewAttributes) {
    const attributes = Object.fromEntries((configured.attributes || []).map((attribute) => [attribute.id, Number(previewAttributes[attribute.id]) || 0]));
    const level = Number.isInteger(previewLevel) && previewLevel >= 1 ? previewLevel : 1;
    // THESE SETTINGS, YOUR ATTRIBUTES. A run keeps the rules it was born
    // under (`derivedStatRuleSnapshot`), and every row here applies to a new
    // run, so the example is what these settings make of the character in
    // play, and says so rather than claiming to be its sheet (Codex, #1252).
    return { current: true, label: `Your attributes at level ${level}, under these settings`, classDef: null, attributes, shortLabel, level };
  }
  const classes = configured.classes || [];
  const classDef = classes.find((row) => row.id === settings[STATS_EXAMPLE_CLASS_KEY]) || classes[0] || {};
  const mode = configured.attributeRules?.defaultMode;
  const preset = configured.attributeRules?.presets?.[mode]?.[classDef.id] || {};
  const attributes = Object.fromEntries((configured.attributes || []).map((attribute) => [attribute.id, Number(preset[attribute.id]) || 0]));
  return { current: false, label: `Example: a new ${classDef.name || 'character'}`, classDef, classId: classDef.id, attributes, shortLabel, level: 1 };
}

function attributeList(subject) {
  return Object.entries(subject.attributes).map(([id, value]) => `${subject.shortLabel[id] || id} ${value}`).join(' · ');
}

// The last verdict, keyed by every setting that can reach the content bundle
// (the `settings…` keys only remember what the screen shows).
let lastRefusal = { key: null, refused: null };
function refusalFor(settings, configured) {
  const key = JSON.stringify(Object.entries(settings || {}).filter(([name]) => !name.startsWith('settings')));
  if (key === lastRefusal.key) return lastRefusal.refused;
  const validation = validateContent(configured);
  const structural = advancedConfigStructuralProblems(contentBundle, settings);
  const refused = structural[0] || (validation.ok ? null : `${validation.errors[0].path}: ${validation.errors[0].msg}`);
  lastRefusal = { key, refused };
  return refused;
}

// Everything an example reads, resolved once per preview: the configured
// bundle, whose attributes, and the three rule sets built from it.
function previewContext(settings, previewAttributes, previewLevel, forcedRefusal = null) {
  // THE BUNDLE A RUN WOULD ACTUALLY GET. A configuration the game refuses is
  // not applied: `main.js` `rebuildRegistries` keeps the authored content until
  // `validateContent` and the structural checks pass. The example runs the
  // same two checks and does the same, and says why, rather than showing a
  // number no run has or going blank over a refusal on another tab (review
  // and Codex, #1252). The verdict is kept for the settings it was reached on,
  // so switching the example character or the topic does not repeat it.
  let configured = configuredContentBundle(contentBundle, settings);
  let refused = forcedRefusal || refusalFor(settings, configured);
  if (refused) configured = contentBundle;
  // A NEW CHARACTER IS BORN BY THE REAL DOOR. `createRunState` folds the
  // class's starting relics into its derived rules (a Reaver's Forsaken
  // Medallion is +10 HP), so an example read off the raw table would show a
  // number no new Reaver has. The run's own rule snapshot is what it uses.
  // A character in play is shown from its own attributes instead.
  const registries = createRegistries(configured);
  let newRun = null;
  if (!previewAttributes) {
    try {
      newRun = createRunState({ seed: 0, classId: statsExampleSubject(settings, null, configured).classId, registries });
    } catch (error) {
      if (configured === contentBundle) throw error;
      refused = error.message;
      configured = contentBundle;
      return previewContext(settings, previewAttributes, previewLevel, refused);
    }
  }
  const subject = statsExampleSubject(settings, previewAttributes, configured, previewLevel);
  const lazy = (build) => { let value; let done = false; return () => { if (!done) { value = build(); done = true; } return value; }; };
  return {
    configured, subject, settings, refused, registries,
    derived: lazy(() => resolveDerivedStatRules(configured.derivedStatRules, {
      attributeIds: (configured.attributes || []).map((attribute) => attribute.id),
      classFields: ['maxHp', 'maxMana'],
    })),
    // THE RULES A FIGHT IS HANDED: `main.js` passes `registries.balance.
    // combatRatings`, which only the configured bundle carries. A refused
    // configuration falls back to the authored content, which carries none,
    // so the fight runs with ratings off and so does the example — never the
    // rejected overrides (Codex, on #1252).
    ratings: lazy(() => configured.balance?.combatRatings || { ...resolveCombatRatings({}, configured), enabled: false }),
    newRun: () => newRun,
    hand: lazy(() => resolveHandRules(settings, configured.attributes)),
  };
}

// How many more points of one attribute move its floored term, and by how
// much: `floor(points × weight)` moves at the next multiple of 1 ÷ weight.
function nextStep(points, weight) {
  if (!(weight > 0)) return null;
  const term = (value) => Math.floor(value * weight + 1e-9);
  for (let more = 1; more <= 1000; more += 1) {
    const gain = term(points + more) - term(points);
    if (gain > 0) return { more, gain };
  }
  return null;
}

// One attribute term, written the same way for a pool and a rating: the
// attribute as the sheet shows it, its weight, and what it rounds down to.
const termText = (short, points, weight, value) => `${short} ${points} × ${num(weight)} → ${value}`;

function derivedExample(ctx, statId) {
  const { configured, subject } = ctx;
  const presentation = configured.derivedStatRules.presentation?.[statId] || {};
  const label = presentation.faceLabel || presentation.label || statId;
  const raw = ctx.derived();
  const run = ctx.newRun();
  const resolved = run?.derivedStatRuleSnapshot?.rules || raw;
  const rule = resolved.rules[statId];
  const classDef = subject.classDef || configured.classes?.[0];
  const at = (level) => deriveStat(resolved, statId, { attributes: subject.attributes, classDef, level });
  // What the starting relics added to this stat's base: the run's own rule
  // against the table it was folded from, so no relic vocabulary is restated
  // here (tools/onevocab.mjs). The sources only supply the names.
  const tableBase = raw.rules[statId]?.base;
  const relicFlat = run && Number.isFinite(rule.base) && Number.isFinite(tableBase) ? rule.base - tableBase : 0;
  const relicNames = [...new Set((run?.derivedStatRuleSnapshot?.relicModifiers?.sources || [])
    .filter((source) => source.resource === statId)
    .map((source) => configured.relics?.find((relic) => relic.id === source.relicId)?.name || source.relicId))];
  // The subject's own level: a character in play is shown as it stands
  // (the run door derives at `characterLevelOf(run)`), a new one at level 1.
  const now = subject.level || 1;
  const receipt = at(now);
  const short = (id) => subject.shortLabel[id] || id;
  // RULESET 6, TERM BY TERM (#1253): base + Σ floor(attribute × weight) +
  // floor((level − 1) × per level). Each term is floored on its own, so each
  // is shown with the number it floored to.
  const used = Object.entries(receipt.weights).filter(([, weight]) => weight);
  const attributeTerms = used.map(([id, weight]) => termText(short(id), subject.attributes[id], weight, receipt.terms[id]));
  // A table still in the old tier vocabulary divides and multiplies the summed
  // terms; say so rather than show a sum that is not the one used.
  const tiered = receipt.pointsPerIncrease !== 1 || receipt.gain !== 1;
  const attributePart = !used.length ? '' : tiered
    ? ` + ${num(receipt.gain)} × ${plural(receipt.tier, 'step')} (${attributeTerms.join(' + ')}, ÷ ${num(receipt.pointsPerIncrease)})`
    : ` + ${attributeTerms.join(' + ')}`;
  const perLevel = receipt.perLevel;
  const levelTerm = (entry) => (perLevel && entry.level > 1 ? ` + ${plural(entry.level - 1, 'level')} × ${num(perLevel)} → ${num(entry.levelBonus)}` : '');
  const relicTerm = relicFlat ? ` + ${num(relicFlat)} from ${relicNames.join(' and ') || 'starting relics'}` : '';
  const expression = `${num(receipt.base - relicFlat)} base${relicTerm}${attributePart}${levelTerm(receipt)}`;
  const capped = (entry) => (entry.cap !== null && entry.raw > entry.cap ? entry.cap : null);
  // A character always has at least 1 HP (`state.js` clamps the maximum), so
  // a formula that sums to less says so instead of showing a 0 no run has.
  const floor = (entry) => (statId === 'hp' && entry.value < 1 ? 1 : entry.value);
  const floorNote = (entry) => (floor(entry) !== entry.value ? `, raised to 1 (a character always has at least 1 HP)` : '');
  const lines = [{ label: `${label} at level ${now}`, expression: expression + floorNote(receipt), total: floor(receipt), capped: capped(receipt) }];
  // The next level at which the floored level term moves, if it ever does.
  if (perLevel > 0) {
    let next = null;
    for (let level = now + 1; level <= now + 1000; level += 1) {
      if (levelBonus(rule, level) > receipt.levelBonus) { next = level; break; }
    }
    if (next) {
      const later = at(next);
      lines.push({ label: `${label} at level ${next}`, expression: `${num(later.raw - later.levelBonus)}${levelTerm(later)}${floorNote(later)}`, total: floor(later), capped: capped(later) });
    }
  }
  const steps = tiered ? [] : used
    .map(([id, weight]) => [id, nextStep(subject.attributes[id], weight)])
    .filter(([, step]) => step);
  return {
    kind: 'derived', id: statId, title: label, lines,
    hint: [
      ...steps.map(([id, { more, gain }]) => `${more} more ${short(id)} would add ${num(gain)} to ${label}.`),
      'Each term rounds down on its own.',
      subject.current ? 'Your run in progress keeps the rules it started with; these apply to a new run. Not included: relics, equipment, and permanent changes from events (such as lost max HP).' : '',
    ].filter(Boolean).join(' '),
    sense: presentation.sense || '',
  };
}

function handExample(ctx) {
  const { subject } = ctx;
  const rules = ctx.hand();
  const line = (label, rule) => {
    const receipt = scaledCardsReceipt(rule, subject.attributes);
    const short = subject.shortLabel[receipt.stat] || receipt.stat;
    const expression = receipt.statEnabled
      ? `${receipt.base} base + ${plural(receipt.bonus, 'extra card')} (${short} ${receipt.points} − ${receipt.baseline}, ÷ ${receipt.pointsPerCard}, whole cards only), kept within ${receipt.minimum}–${receipt.maximum}`
      : `${receipt.base} base, kept within ${receipt.minimum}–${receipt.maximum}`;
    return { label, expression, total: receipt.value };
  };
  const capacity = line('Hand capacity', rules.capacity);
  const opening = line('Opening hand', rules.starting);
  if (opening.total > capacity.total) {
    opening.expression += `, then limited to capacity ${capacity.total}`;
    opening.total = capacity.total;
  }
  // Drawing stops when the deck runs out (engine/actions.js `drawCards`). A
  // new character's deck is the one its run was dealt: `startingDeckSize`
  // budgets only the filler, and bound grant/package cards ride on top
  // (loadout.js `startingDeckPlan`), so the setting is not the deck length.
  // A character in play may have grown or thinned theirs, so the example says
  // so instead of guessing.
  const deck = ctx.newRun()?.deck?.length;
  if (!subject.current && Number.isInteger(deck) && opening.total > deck) {
    opening.expression += `, then limited to the ${deck}-card starting deck`;
    opening.total = deck;
  } else if (subject.current) {
    opening.expression += '; fewer if the deck holds fewer';
  }
  // A fixed draw never takes the hand past capacity (engine/handRules.js
  // `turnDrawCount` draws min(room, wanted)), and retained cards leave less
  // room, so the example states the most a turn can draw.
  let turn;
  if (rules.drawMode === 'fill') {
    turn = { label: 'Each turn, at most', expression: `draw until the hand holds ${capacity.total}`, total: capacity.total };
  } else {
    // Replacements for optional discards ride on top of the fixed amount
    // (`pendingDiscardDraw`), still within capacity.
    const replacing = rules.retain && rules.promptDiscard && rules.replaceDiscards;
    turn = line(replacing ? 'Cards drawn each turn, before replacements' : 'Cards drawn each turn, at most', rules.turn);
    if (turn.total > capacity.total) {
      turn.expression += `, then limited to capacity ${capacity.total}`;
      turn.total = capacity.total;
    }
    if (replacing) turn.expression += '; plus one for each card you chose to discard, never past capacity';
    if (rules.retain) turn.expression += '; fewer when kept cards fill the hand';
  }
  // Either mode stops when there is nothing left to draw (engine/actions.js
  // `drawCards`), and without a reshuffle the discard pile never refills it.
  turn.expression += rules.reshuffle
    ? '; fewer once the draw and discard piles are both empty'
    : '; fewer once the draw pile is empty (the discard pile is not reshuffled)';
  return {
    kind: 'hand', id: 'hand', title: 'Hand', lines: [opening, turn, capacity],
    hint: rules.retain ? 'Unplayed cards stay in hand.' : 'Unplayed cards are discarded at turn end.',
    sense: '',
  };
}

function ratingExample(ctx, id) {
  const { subject } = ctx;
  const config = ctx.ratings();
  const receipt = attributeRatingReceipt(config, subject.attributes, id);
  const used = ratingAttributeIds.filter((attributeId) => receipt.weights[attributeId]);
  const terms = used.map((attributeId) => termText(subject.shortLabel[attributeId] || attributeId, receipt.values[attributeId], receipt.weights[attributeId], receipt.terms[attributeId]));
  // A NEW CHARACTER'S STARTING RELICS, as combat adds them (`ratingReceipt`'s
  // relic sources: the configured `relic:<id>` bonus and the relic's own
  // passive), so "starting relics included" is true of ratings too (Codex,
  // on #1252). Equipment stays out: it is shown on its item.
  const run = ctx.newRun();
  const relics = run ? ratingReceipt(ctx.registries, run, config).sources
    .filter((source) => source.kind === 'relic' && Number(source[id])) : [];
  const relicTotal = relics.reduce((sum, source) => sum + Number(source[id]), 0);
  const expression = `${num(receipt.base)} base + ${terms.join(' + ') || 'no attributes'}`
    + (receipt.multiplier !== 1 ? `, sum ${receipt.weighted} × ${num(receipt.multiplier)} all ratings → ${receipt.attribute}` : '')
    + relics.map((source) => ` + ${num(source[id])} from ${source.name}`).join('');
  return {
    kind: 'rating', id, title: `${RATING_LABELS[id]} rating`,
    lines: [{ label: relics.length ? `${RATING_LABELS[id]} before equipment` : `${RATING_LABELS[id]} from attributes`, expression, total: receipt.value + relicTotal }],
    hint: `Each term rounds down on its own. ${!config.enabled ? 'Ratings are off, so combat does not use this formula.'
      : run ? 'Starting relics included; equipment and statuses add on top.' : 'Equipment, relics and statuses add on top of this.'}`,
    sense: '',
    off: !config.enabled,
  };
}

function overviewExample(ctx) {
  const config = ctx.ratings();
  const derived = ['hp', 'energy', 'stamina', 'mana']
    .filter((id) => ctx.configured.derivedStatRules.rules[id])
    .map((id) => derivedExample(ctx, id));
  const hand = handExample(ctx);
  const lines = [
    ...derived.map((example) => ({ label: example.title, expression: example.lines[0].expression, total: example.lines[0].total })),
    { label: 'Opening hand', expression: hand.lines[0].expression, total: hand.lines[0].total },
    ...(config.enabled
      ? ['poise', 'ward', 'ar', 'dr', 'pr'].map((id) => {
        const example = ratingExample(ctx, id);
        return { label: example.lines[0].label, expression: example.lines[0].expression, total: example.lines[0].total };
      })
      : [(({ lines: [first] }) => ({ label: 'Poise', expression: first.expression, total: first.total }))(derivedExample(ctx, 'poise'))]),
  ];
  return { kind: 'overview', id: 'overview', title: 'Stat block', lines, hint: ctx.subject.current
    ? 'At your current level, under these settings; your run in progress keeps the rules it started with. Not included: relics, equipment, and permanent changes from events.'
    : 'Starting relics included; equipment adds on top.', sense: '' };
}

/**
 * statsTopicPreview(settings, topic, previewAttributes) → the worked examples
 * for one Stats topic, or null for a topic that has none (the per-item
 * tables). Never throws: a combination the engine refuses is reported as the
 * example's text, which is what a player tuning a dial needs to see.
 */
export function statsTopicPreview(settings = {}, topic, previewAttributes = null, previewLevel = null) {
  const derivedId = DERIVED_BY_TOPIC[topic];
  const ratingId = RATING_BY_TOPIC[topic];
  if (!derivedId && !ratingId && topic !== 'Overview') return null;
  let ctx;
  try {
    ctx = previewContext(settings, previewAttributes, previewLevel);
  } catch (error) {
    return { subject: null, attributes: '', examples: [], problem: `These settings cannot build a character: ${error.message}` };
  }
  const examples = [];
  const attempt = (build) => {
    try { examples.push(build()); } catch (error) { examples.push({ kind: 'problem', id: 'problem', title: 'Not calculable', lines: [], hint: error.message, sense: '' }); }
  };
  const { subject } = ctx;
  const ratingsOn = ctx.ratings().enabled;
  if (topic === 'Overview') attempt(() => overviewExample(ctx));
  if (topic === 'Draw & hand') attempt(() => handExample(ctx));
  if (ratingId && (ratingsOn || topic !== 'Poise')) attempt(() => ratingExample(ctx, ratingId));
  if (derivedId) attempt(() => {
    const example = derivedExample(ctx, derivedId);
    if (derivedId === 'draw') example.legacy = 'Used by LAN co-op and older saved fights. Solo fights use the hand rules above.';
    if (derivedId === 'poise') {
      example.legacy = ratingsOn ? 'Used only when ratings are off.' : 'Ratings are off: combat uses this, plus worn armour and relic Poise.';
      // What combat stamps is the whole threshold (`playerPoiseThresholdReceipt`):
      // this row, the body armour worn and the relics' Poise (Codex, #1252).
      if (!ratingsOn && ctx.newRun()) {
        const threshold = playerPoiseThresholdReceipt(ctx.registries, ctx.newRun());
        const parts = [`${num(threshold.attribute)} from attributes`];
        if (threshold.equipment) parts.push(`${num(threshold.equipment)} from armour`);
        if (threshold.relic) parts.push(`${num(threshold.relic)} from relics`);
        example.lines.push({ label: 'Poise in combat', expression: parts.join(' + '), total: threshold.value });
      } else if (!ratingsOn) {
        example.hint = `${example.hint} Worn armour and relic Poise add on top in combat.`;
      }
    }
    return example;
  });
  return {
    subject: { current: subject.current, label: subject.label, classId: subject.classId || null },
    attributes: attributeList(subject),
    examples,
    problem: null,
    // Hand rules are read from the settings at every fight (`main.js`
    // `enterCombat`), not from the content bundle, so a refusal leaves them in
    // force and the notice says so (Codex, on #1252).
    refused: ctx.refused ? `These settings are refused (${ctx.refused}), so a new run keeps the authored stat and rating rules until they are corrected, and the example shows those. Hand rules are applied on their own: a valid group applies as set, and a group whose limits are refused uses its defaults.` : null,
  };
}
