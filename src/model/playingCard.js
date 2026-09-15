// src/model/playingCard.js — what a playing card IS, with no opinion about
// how it looks.
//
// WHY THIS EXISTS, AND WHY IT IS THIS SHAPE. Equipment has had a model since
// its face was built: `src/model/equipmentCard.js` projects a piece into
// `{ id, name, type, facts, bonuses, tags, flavor, requirement, rarity }` and
// `renderEquipmentCard` draws that and nothing else. The playing card — the
// most-drawn object in the game, and the one on every surface the card series
// has been correcting — never got the same treatment. `renderCard` resolved
// the definition, the tag junction, the cost profile, the type presentation
// and the class tint INSIDE the function that writes innerHTML, so the answer
// to "what is this card" existed only as a side effect of drawing one.
//
// That is why five renderers could not share anything: there was nothing to
// share. A view can be swapped; a projection tangled into a view cannot.
//
// THE LINE THIS FILE HOLDS: the model says WHAT A CARD IS, the view says HOW
// IT READS. So the filled text template — which escapes, wraps changed numbers
// in `.val.up` / `.val.down`, and colours keywords — stays in the view where
// the other HTML lives; this file hands over the TOKENS that fill it and the
// base to compare against, which is the data half of that same job. The same
// line is why `accent`, `color` and `radius` appear here as VALUES and never
// as CSS: a number a designer authored is data; the property it is assigned to
// is presentation.
//
// PURE AND FROZEN, like every model beside it: no DOM, no callbacks, no live
// run object retained. Everything is read at call time and the result is deep
// frozen, so a renderer cannot quietly make the model its scratch space.

import { resolveCard } from './registries.js';
import { tagService } from './tagService.js';
import { computeTokenBindings } from './validate.js';
import { balance } from '../content/balance.js';

const freeze = (value) => Object.freeze(value);

/**
 * The numbers a card's own template substitutes, before any live preview.
 * The body is the renderer's `staticTokens` verbatim — it reads the definition
 * through the shared token binder and nothing else, which is what makes it a
 * projection rather than a step of drawing.
 *
 * `card.js` keeps exporting `staticTokens` as a re-export of this, because
 * five files import that name and a rename would be churn that proves nothing.
 */
export function staticCardTokens(def) {
  const tokens = {};
  for (const binding of computeTokenBindings(def.effects || [])) {
    const value = (def.effects[binding.index] || {})[binding.field];
    if (typeof value === 'number') tokens[binding.token] = value;
  }
  return tokens;
}

/**
 * playingCardModel(registries, ref, { preview }) → a frozen record.
 *
 * `ref` is `{ cardId, upgraded, instanceId? }` — the same shape `renderCard`
 * has always taken. `preview` is combat's live resolution when the card is in
 * a hand; without one the card reads its authored numbers.
 *
 * WHAT THE CALLER GETS, AND WHY EACH PIECE IS HERE RATHER THAN IN THE VIEW:
 *
 *   identity   id, instanceId, name, icon, rarity, classId, upgraded
 *              — what the card is. The instrument hooks (`data-card-id`,
 *              `data-instance-id`) are these, so they stop being re-derived.
 *
 *   type       id and label. The label used to be computed inline as
 *              `(ty && ty.label) || def.type.toUpperCase()`, which meant an
 *              authored type with no row silently changed case.
 *
 *   costs      action / mana / stamina / variable, from the framework profile
 *              or the preview's already-resolved numbers. One answer, so the
 *              face badge and the tooltip cost line cannot disagree — they
 *              computed it separately before.
 *
 *   tags       resolved through the ACTIVE registries, with the legacy-school
 *              duplicate filtered and the inheritance sources attached. This
 *              is the most tangled derivation in the old renderer and the one
 *              most worth having somewhere testable.
 *
 *   paint      authored colours and radii as values. See the line above.
 *
 *   tokens     what fills the text template, and `base` to compare against so
 *              a raised number can be marked as raised.
 */
export function playingCardModel(registries, ref, { preview = null } = {}) {
  const def = resolveCard(registries, ref);
  const base = staticCardTokens(def);

  // Type presentation is authored data (balance.ui.cardTypes): corner radii
  // carry the type (attack squarest → power roundest) and each type owns its
  // banner colour. A type with no row keeps the card drawable.
  const typeRow = balance.ui.cardTypes[def.type] || null;

  // The class motif hue is authored on the class (`cardTint`). Colourless
  // cards have no owning class and fall back to the neutral frame, which is
  // an ABSENT tint rather than a default one — the view decides what neutral
  // looks like.
  const owner = registries.classes.has(def.class) ? registries.classes.get(def.class) : null;

  // COSTS. A preview has already resolved its own numbers; without one the
  // framework's cost profile is the authority. Both paths land in one record
  // so the badge and the tooltip cannot drift, which they could before —
  // each computed its own.
  const profile = preview ? null : registries.framework.costProfile(def);
  const costs = freeze({
    variable: preview ? !!preview.costIsX : !!profile.variable,
    action: preview ? preview.cost : profile.action,
    mana: preview ? preview.manaCost : profile.mana,
    stamina: preview ? (preview.staminaCost || 0) : (profile.stamina || 0),
  });

  // TAGS, resolved against the ACTIVE registries in all three branches.
  // Equipment-generated cards carry their profile's tags on `cardTags`;
  // authored cards resolve through the junction; a card in play carries the
  // live rows its preview resolved. The authored branch used to reach a
  // module-global resolver, so a bundle that changed a card's tags changed
  // what combat did with them and not what the card showed.
  const service = tagService(registries);
  const liveTagRows = (preview?.values || []).filter((row) => Array.isArray(row.tags));
  const inheritedBy = new Map();
  for (const row of liveTagRows) {
    for (const id of row.inheritedTags || []) {
      const sources = inheritedBy.get(id) || new Set();
      sources.add(row.sourceName);
      inheritedBy.set(id, sources);
    }
  }
  const resolved = liveTagRows.length
    ? service.resolve([...new Set(liveTagRows.flatMap((row) => row.tags))])
    : def.cardTags && def.cardTags.length
      ? service.resolve(def.cardTags)
      : service.tagsOf('card', def);
  // Keep legacy schools for compatibility, but do not print Blood/Heavy twice
  // when the categorized theme/technique is the same visible word.
  const categorized = new Set(
    resolved.filter((tag) => ['theme', 'technique'].includes(tag.domain))
      .map((tag) => tag.label.toLowerCase())
  );
  const tags = freeze(resolved
    .filter((tag) => tag.domain !== 'card' || !categorized.has(tag.label.toLowerCase()))
    .map((tag) => freeze({
      id: tag.id,
      label: tag.label,
      glyph: tag.glyph,
      color: tag.color,
      blurb: tag.blurb,
      // An array rather than a Set: a model is serializable, and a Set is not.
      inheritedFrom: freeze([...(inheritedBy.get(tag.id) || [])]),
    })));

  // A matched tag-scoped vulnerability lights the card's boosted number in the
  // status row's own tint. Absence means no bonus — never a "+0%" badge.
  const boost = (preview?.values || []).find((row) => row.boostTint) || null;

  return freeze({
    id: def.id,
    instanceId: ref.instanceId || null,
    name: def.name,
    icon: def.icon || '❖',
    rarity: def.rarity,
    classId: def.class,
    upgraded: !!ref.upgraded,
    type: freeze({
      id: def.type,
      label: (typeRow && typeRow.label) || def.type.toUpperCase(),
    }),
    costs,
    tags,
    paint: freeze({
      typeColor: typeRow ? typeRow.color : null,
      radiusPx: typeRow ? typeRow.radius : null,
      artRadiusPx: typeRow ? typeRow.art : null,
      tint: (owner && owner.cardTint) || null,
      boostTint: boost ? boost.boostTint : null,
    }),
    // The text template's own data. The view fills and escapes it; `base` is
    // what a live number is compared against to be marked raised or lowered.
    tokens: freeze(preview ? { ...base, ...preview.tokens } : { ...base }),
    baseTokens: freeze({ ...base }),
    hasPreview: !!preview,
  });
}

/**
 * The face's class list, derived once from the model. The old renderer built
 * this string inline; every tool in the repo reads these hooks, so deriving
 * them in one place is what lets a second renderer exist without the hooks
 * drifting apart.
 */
export function playingCardClasses(model) {
  return `card as-card playing-poker-card rarity-${model.rarity}`
    + ` cls-${model.classId} type-${model.type.id}${model.upgraded ? ' upgraded' : ''}`;
}
