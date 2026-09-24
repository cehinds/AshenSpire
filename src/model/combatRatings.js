import { equippedPieces } from './loadout.js';
import { resolveUpgradedRelic } from './itemUpgrades.js';
import { evaluate } from './formulas.js';
import { cardIsMagical } from './attackCardDamage.js';
import { attributeRatingReceipt, equipmentRatingBase, ratingAttributeIds, ratingIds } from './ratingFormula.js';
import { LEGACY_RATING_FORMULA, STAT_ROW_KEY_PREFIX, legacyRatingFormulaFromSettings } from './statRows.js';
import { resolvedRuleRow } from './derivedStats.js';

export { ratingIds };
const attributes = ratingAttributeIds;
export const combatRatingDefaults = {
  enabled: true,
  // THE FIVE FORMULAS ARE NOT HERE (ruleset 7). AR, DR, PR, Poise and Ward
  // are rows of the derived-stat table (content/derivedStats.js), edited under
  // Advanced → Stats with every other stat, and `ratings` is filled with the
  // rows a run reads (model/statRows.js ratingsConfigFor). Equipment, relic
  // and status bonuses are added afterward by their owning receipts.
  resistance: { physicalK: 100, magicalK: 100, statusK: 100, maximum: 0.8 },
  impact: { magic: 1, light: 1, medium: 2, heavy: 3, colossal: 4,
    lightMaxWeight: 3, mediumMaxWeight: 6, heavyMaxWeight: 8, unarmed: 1, enemyPhysical: 2 },
  breaks: { poiseActionLoss: 1, wardActionLoss: 1, thresholdGrowth: 1.25, recoveryPerTurn: 0 },
  statuses: {
    bleed: { poise: 1, ward: 0 }, frost: { poise: 0.5, ward: 0.5 },
    insanity: { poise: 0, ward: 1 }, madness: { poise: 0, ward: 1 },
    crimsonBlight: { poise: 0.5, ward: 0.5 }, venom: { poise: 1, ward: 0 },
    burn: { poise: 0.25, ward: 0.75 },
  },
};
const prefix = 'gameConfig.combatRatings.';
const words = s => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

/**
 * ratingLabel(id) → what a PLAYER calls this rating.
 *
 * AR, DR and PR are acronyms; Poise and Ward are words. The tab name below has
 * always known that ("Poise formula", not "POISE formula") — the ROWS did not,
 * so one menu carried "POISE — Base" and "Straight Sword — additional WARD"
 * beside a tab spelling the same two the ordinary way, across some seven
 * hundred rows. One reader now, so the tab and its rows cannot disagree
 * (owner, 2026-09-21: "make them consistent with what I see with each other").
 */
const ratingLabel = (id) => (id === 'poise' || id === 'ward' ? words(id) : id.toUpperCase());

/**
 * phrase(id) → a key-derived label that reads like the ones beside it.
 *
 * `words()` splits camelCase and capitalises every word, which is right for a
 * NAME and wrong for a phrase. In this file it produced "Poise Action Loss"
 * and "Recovery Per Turn" directly beside the hand-written "Break threshold
 * multiplier" in the same tab — the same one-fact-two-voices split the
 * Advanced menu had everywhere else. Only the first word keeps its capital.
 * An all-caps acronym survives ("poiseDamageAR" → "Poise damage AR"); a
 * proper noun spelled in camelCase does not ("wyrmLord" → "Wyrm lord"), so
 * this is for field names, never for anything the game shows as a name.
 *
 * An enemy MOVE is a name. Combat shows it as one — "Halberd Sweep" on the
 * move card, the intent and the history (enemyMoveCards.js, combat.js) — so
 * its settings row uses the same spelling, not this.
 */
const phrase = (id) => words(id).replace(/(?!^)\b([A-Z])(?=[a-z])/g, (letter) => letter.toLowerCase());

export function ratingSourceKey(piece) {
  return piece.kind === 'armor' ? `armor:${piece.classId}:${piece.id}` : `armament:${piece.id}`;
}

// One lookup per bundle, not one scan per row: `resolveCombatRatings` asks for
// a piece by its rating source on every equipment row it reads.
const itemsByRatingSource = new WeakMap();
function itemByRatingSource(bundle) {
  let index = itemsByRatingSource.get(bundle);
  if (!index) {
    index = Object.fromEntries([...(bundle?.equipment?.armaments || []), ...(bundle?.equipment?.armour || [])]
      .map(piece => [ratingSourceKey(piece), piece]));
    itemsByRatingSource.set(bundle, index);
  }
  return index;
}

// The ceiling a rating row has always had, named once so the row, the
// validator and the legacy migration cannot drift.
const ITEM_RATING_MAX = 999;

function isMagicalPiece(equipment, piece) {
  const profile = (equipment?.basicCardProfiles || []).find(row => row.id === piece.attackProfile);
  return Boolean(profile && profile.damageSchool !== 'physical');
}

/**
 * THE ITEM'S RATINGS ARE THE ITEM'S OWN NUMBERS (owner, 2026-09-21: "if I edit
 * the AR in the settings for straight sword to 2 then it should show 2 on the
 * card and in combat + AR bonuses"). The per-item rows used to be a second
 * table of PLUSES on top of the authored columns, so the settings panel and the
 * item card disagreed by whatever the plus was, and a rating the owner wanted
 * LOWER than the authored one could not be typed at all. The rows are the
 * columns now: `itemRatings.<source>.<rating>` opens on the authored value and
 * whatever stands there is the item's rating everywhere — the card, the
 * equipment receipt and combat, with attributes, relics and statuses added on
 * top of it exactly as before.
 *
 * `authoredItemRatings` is the one reader of that projection, so the settings
 * row, the item column and the combat receipt cannot drift apart.
 */
export function authoredItemRatings(equipment, piece) {
  const magical = isMagicalPiece(equipment, piece);
  const attack = piece.attackRating || 0;
  return {
    ar: magical ? 0 : attack,
    dr: piece.defenseRating || 0,
    pr: magical ? attack : 0,
    poise: piece.kind === 'armor' ? piece.poiseThreshold || 0 : 0,
    ward: 0,
  };
}

/**
 * itemRatingColumn(equipment, piece, id) → the authored field this rating is
 * WRITTEN BACK to, or null when the item has no column for it.
 *
 * One column carries the attack rating and the school of the piece's attack
 * profile decides which rating it feeds (SPEC §13.4: physical Attack Rating
 * contributes AR, magical contributes PR), so a staff's PR and a sword's AR are
 * the same field seen from two sides. An armament's `poiseThreshold` is its
 * WEIGHT (`statProjection.ARMOUR_WEIGHT_RULE`), never its Poise, so it is left
 * alone; a rating with no column is still configurable and still reaches
 * combat, it just has nowhere on the card to print.
 */
export function itemRatingColumn(equipment, piece, id) {
  const magical = isMagicalPiece(equipment, piece);
  // ARMOUR AUTHORS NO ATTACK RATING AT ALL. It carries `poiseThreshold` and
  // nothing else, so treating "no attack profile" as "physical, therefore the
  // attackRating column" stamped a field onto an outfit that content never
  // gives one — and the row's note then promised a card that prints only DR
  // and Poise would show it.
  if (piece.kind === 'armor') return id === 'poise' ? 'poiseThreshold' : null;
  if (id === 'ar') return magical ? null : 'attackRating';
  if (id === 'pr') return magical ? 'attackRating' : null;
  if (id === 'dr') return piece.kind === 'armor' ? null : 'defenseRating';
  if (id === 'poise') return piece.kind === 'armor' ? 'poiseThreshold' : null;
  return null;
}

/**
 * The stored number as the ROW resolves it, not as this file would like it.
 *
 * THREE ANSWERS TO ONE STORED VALUE is what refusing gave (review, #1242): the
 * settings panel floors and clamps a hand-edited `2.7` to 2 and shows it, and
 * rejecting it here left the column on the authored 5 — the panel and the card
 * disagreeing, which is the defect this whole change exists to end. The rule is
 * `normalizeTunedNumber` (src/ui/models/CardSizeModel.js), the one gate every
 * other number row runs through: unreadable is unset, anything else is floored
 * into the row's own domain. It is restated rather than imported because a
 * model may not reach into the UI layer, and a test pins the two together.
 */
function itemRatingSetting(settings, piece, id) {
  const raw = settings[`${prefix}itemRatings.${ratingSourceKey(piece)}.${id}`];
  const value = typeof raw === 'string' ? Number(raw.trim()) : Number(raw);
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value)) return undefined;
  return Math.min(ITEM_RATING_MAX, Math.max(0, Math.floor(value)));
}

/**
 * applyItemRatingConfig(configured, authored, settings)
 *
 * The column, not a second table. Everything that shows an item's rating — the
 * item card, the Armoury comparison, `ratingReceipt` through `equippedPieces` —
 * reads the piece, so the configured number is written onto the piece and there
 * is nothing left for those readers to miss. Ratings with no column
 * (`itemRatingColumn` → null) stay in the rules object, where the receipt picks
 * them up.
 */
export function applyItemRatingConfig(configured, authored, settings = {}) {
  const write = (piece) => {
    let next = piece;
    for (const id of ratingIds) {
      const column = itemRatingColumn(authored.equipment, piece, id);
      if (!column) continue;
      const value = itemRatingSetting(settings, piece, id);
      if (value === undefined || next[column] === value) continue;
      next = { ...next, [column]: value };
    }
    return next;
  };
  const equipment = configured.equipment || authored.equipment || {};
  configured.equipment = {
    ...equipment,
    armaments: (equipment.armaments || []).map(write),
    armour: (equipment.armour || []).map(write),
  };
}

/**
 * migrateCombatRatingSettings(settings, bundle)
 *
 * A STORED PLUS BECOMES THE NUMBER IT USED TO MAKE. `bonuses.<item>.<rating>`
 * was the old per-item dial and it is gone; a profile that still holds one — or
 * a configuration file exported before this build — is read as the item's
 * rating: the authored value plus what the plus added. Keys are dropped only
 * when the item they name is gone, which is what the old table did anyway.
 * Relic and status bonuses are untouched: those ARE bonuses and stay bonuses.
 */
const LEGACY_ITEM_BONUS_KEY = /^gameConfig\.combatRatings\.bonuses\.(armament|armor):/;

/** Whether a stored profile still holds a per-item PLUS this build has retired. */
export function hasLegacyItemRatingSettings(settings = {}) {
  return Object.keys(settings || {}).some(key => LEGACY_ITEM_BONUS_KEY.test(key));
}

export function migrateCombatRatingSettings(settings = {}, bundle, warnings = null) {
  const legacy = Object.keys(settings).filter(key => LEGACY_ITEM_BONUS_KEY.test(key));
  if (!legacy.length || !bundle) return settings;
  const byKey = new Map([...(bundle.equipment?.armaments || []), ...(bundle.equipment?.armour || [])]
    .map(piece => [ratingSourceKey(piece), piece]));
  const next = { ...settings };
  const rounded = [];
  const capped = [];
  const weighed = [];
  for (const key of legacy) {
    const [source, id] = key.slice(`${prefix}bonuses.`.length).split('.');
    const piece = byKey.get(source);
    delete next[key];
    if (!piece || !ratingIds.includes(id)) continue;
    const current = `${prefix}itemRatings.${source}.${id}`;
    if (next[current] !== undefined) continue;
    const bonus = Number(settings[key]);
    if (!Number.isFinite(bonus)) continue;
    const exact = authoredItemRatings(bundle.equipment, piece)[id] + bonus;
    const value = Math.max(0, Math.min(ITEM_RATING_MAX, Math.round(exact)));
    if (value !== exact) (Math.round(exact) === value ? rounded : capped).push(`${piece.name} ${ratingLabel(id)} ${exact}→${value}`);
    if (id === 'poise' && piece.kind === 'armor' && bonus) weighed.push(`${piece.name} ${piece.poiseThreshold || 0}→${value}`);
    next[current] = value;
  }
  // THE TWO PLACES THE SUM CANNOT BE KEPT EXACTLY, said out loud rather than
  // discovered later (Copilot, on #1242). The old row was a generic numeric
  // row: it took fractions and it took 999 on top of an authored value. An
  // item's rating is a WHOLE NUMBER in the column it is written to —
  // `validate.js` refuses a non-integer `attackRating`, `defenseRating` or
  // `poiseThreshold` outright — and the row's own ceiling is the old one, so a
  // fractional plus rounds and a sum past the ceiling stops there. Both are
  // named where a reader can see them; everything else survives exactly.
  // AND THE ONE PLACE THE OLD DIAL AND THE NEW ROW ARE NOT THE SAME FACT. A
  // set's Poise threshold is also its weight (`statProjection.ARMOUR_WEIGHT_RULE`),
  // so a Poise plus that used to add a rating and nothing else now adds to what
  // the set costs to wear. Said out loud rather than found in a load receipt.
  if (warnings && weighed.length) {
    warnings.push(`A set's Poise is also its weight, so ${weighed.length === 1 ? 'one armour Poise bonus became' : `${weighed.length} armour Poise bonuses became`} part of what it costs to wear: ${weighed.join(', ')}. Everything else in the file was imported.`);
  }
  if (warnings && (rounded.length || capped.length)) {
    if (rounded.length) warnings.push(`An item's rating is a whole number, so ${rounded.length === 1 ? 'one fractional per-item bonus was' : `${rounded.length} fractional per-item bonuses were`} rounded: ${rounded.join(', ')}. Everything else in the file was imported.`);
    if (capped.length) warnings.push(`${capped.length === 1 ? 'One per-item bonus added up' : `${capped.length} per-item bonuses added up`} past the ${ITEM_RATING_MAX} a rating row accepts and stopped there: ${capped.join(', ')}. Everything else in the file was imported.`);
  }
  return next;
}

export function combatRatingRows(bundle) {
  const rows = [];
  const add = (path, def, label, topic, extra = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Stats', statTopic: topic,
    key: prefix + path, def, label,
    ...(typeof def === 'number' ? { type: 'number', min: 0, max: 999, step: 0.01, integer: false } : {}),
    note: 'Applies to new runs. Existing runs and combat saves keep their rules.', ...extra,
  });
  add('enabled', true, 'Enable ratings, Poise & Ward', 'General', {
    note: 'On: AR, DR, PR, Poise and Ward come from their stat rows under each topic. Off: Poise uses its older conversion and meter, shown under Poise. Applies to new runs.',
  });
  // (The per-rating formulas and the global multiplier moved to the stat rows
  // — Advanced → Stats → AR, DR, PR, Poise, Ward — in ruleset 7. Their old
  // keys convert on import: model/statRows.js migrateLegacyStatSettings.)
  for (const group of ['resistance', 'impact', 'breaks']) {
    for (const [field, value] of Object.entries(combatRatingDefaults[group])) add(`${group}.${field}`, value, ({ physicalK: 'Poise resistance curve', magicalK: 'Ward resistance curve', statusK: 'Status resistance curve', maximum: 'Resistance cap', magic: 'Magic impact', lightMaxWeight: 'Light weapon weight limit', mediumMaxWeight: 'Medium weapon weight limit', heavyMaxWeight: 'Heavy weapon weight limit', thresholdGrowth: 'Break threshold multiplier' })[field] || phrase(field), words(group), {
      min: field.endsWith('K') ? 0.01 : field === 'thresholdGrowth' ? 1 : 0,
      max: field === 'maximum' ? 0.95 : 999,
      note: field.endsWith('K') ? 'Rating needed for 50% resistance before the cap. A higher value makes resistance weaker.' : field === 'maximum' ? 'Maximum damage or status reduction: 0.8 means 80%.' : field === 'thresholdGrowth' ? 'After a break, multiply the threshold by this amount. 1.25 means 25% higher; 1 disables growth.' : group === 'impact' ? 'Physical hits pressure Poise; magical hits pressure Ward. Only hits that pass Block cause impact.' : 'Applies to new runs.',
      integer: group === 'impact' || field.endsWith('ActionLoss') || field === 'recoveryPerTurn',
      step: group === 'impact' || field.endsWith('ActionLoss') || field === 'recoveryPerTurn' ? 1 : 0.01,
    });
  }
  for (const status of bundle.statuses) {
    for (const id of ['poise', 'ward']) add(`statuses.${status.id}.${id}`, combatRatingDefaults.statuses[status.id]?.[id] || 0,
      `${status.name} — ${ratingLabel(id)} weight`, 'Status resistance', {
        max: 1, step: 0.05,
        note: 'Reduces hostile buildup or incoming stacks, never duration or proc severity. Both weights zero means unresisted. Weights are added without normalization.',
      });
    for (const id of ratingIds) add(`bonuses.status:${status.id}.${id}`, 0, `${status.name} — ${ratingLabel(id)} per stack`, 'Status bonuses', { note: id === 'poise' || id === 'ward' ? 'Extra resistance per status stack. Temporary bonuses do not change the current break threshold.' : 'Extra rating per status stack, added to eligible card effects.' });
  }
  // WHO WEARS IT, AND WHICH ONE IT IS. Every class owns a free starting
  // armour that shares its name with an "All classes" set piece — the Reaver
  // starts in a plain Wayfarer Plate, and the Wayfarer Plate set (+2 Block,
  // +4 max HP, STR 3) is a different item any class can earn. They are two
  // sources, `armor:reaver:default` and `armor:reaver:wayfarerPlate`, and their
  // rows used to both read "Wayfarer Plate (reaver)". The starting
  // piece is picked out the way loadout.js picks it (free, not a shared set),
  // and the class is named the way the rest of the menu names it.
  const classNames = new Map((bundle.classes || []).map((c) => [c.id, c.name || words(c.id)]));
  const ownerOf = (piece) => {
    if (!piece.classId) return '';
    const owner = classNames.get(piece.classId) || words(piece.classId);
    const starting = piece.kind === 'armor' && piece.unlock === '' && !piece.sharedSet;
    return ` (${owner}${starting ? ', starting armour' : ''})`;
  };
  for (const piece of [...bundle.equipment.armaments, ...bundle.equipment.armour]) {
    const authored = authoredItemRatings(bundle.equipment, piece);
    for (const id of ratingIds) add(`itemRatings.${ratingSourceKey(piece)}.${id}`, authored[id],
      `${piece.name}${ownerOf(piece)} — ${ratingLabel(id)}`, piece.kind === 'armor' ? 'Armour ratings' : 'Weapon ratings', {
        integer: true, step: 1, min: 0, max: ITEM_RATING_MAX,
        note: `The item’s own ${ratingLabel(id)}, not a bonus: the row opens on the authored number and whatever you leave here IS the item’s ${ratingLabel(id)}. `
          + `Attributes, relics and status bonuses are added to it.${itemRatingColumn(bundle.equipment, piece, id) ? ' The item card shows this number.' : ` ${piece.name} has no authored ${ratingLabel(id)} column, so this one is carried as a rating only and the item card does not print it.`}`
          + (id === 'dr' && piece.kind === 'armor' ? ' The DR the armour card prints is the Block its own effects add, which is a different number and is not set here.' : '')
          + (id === 'poise' && piece.kind === 'armor' ? ' Armour Poise is also its weight (SPEC §13.4): raising it raises what the set costs to wear.' : '')
          + ' Applies to a new run.',
      });
  }
  for (const relic of bundle.relics) for (const id of ratingIds) add(`bonuses.relic:${relic.id}.${id}`, 0, `${relic.name} — additional ${ratingLabel(id)}`, 'Relic bonuses');
  for (const enemy of bundle.enemies) {
    for (const id of ['poise', 'ward']) add(`enemyRatings.${enemy.id}.${id}`, enemy.poiseMax || 1, `${enemy.name} — ${ratingLabel(id)}`, 'Enemy defences', { integer: true, step: 1, note: 'Sets this enemy’s resistance rating and initial break threshold. Zero removes passive resistance; the break threshold stays at least 1.' });
    add(`enemyImpact.${enemy.id}`, -1, `${enemy.name} — physical impact`, 'Enemy impact', {
      min: -1, max: 99, integer: true, step: 1, note: '-1 uses the default enemy impact. Set 1, 2, 3 or 4 to match this enemy’s weapon class. Magical hits use the magic value.',
    });
    for (const [id, move] of Object.entries(enemy.moves)) add(`enemyAttackType.${enemy.id}:${id}`, 'auto',
      `${enemy.name} — ${move.name || words(id)} type`, 'Enemy attack types', { type: 'choice', dropdown: true, choices: ['auto', 'physical', 'magic'],
        note: 'Selects Poise or Ward for damage resistance and impact. Auto follows the attack’s authored type; untyped attacks are physical.',
      });
  }
  // TWO CARDS, ONE NAME. The Reaver's own "Enter: Bulwark" and the one the
  // Guardian shield creates for any class are two cards (`enterBulwark`,
  // `guardianBulwark`); so are the Rogue's "Hamstring" attack and the colorless
  // "Hamstring" skill. Their override rows both read "<name> — impact override",
  // so an edit to one gave no way to know which card it changed. A name that
  // is shared says whose card it is, in the words the armour rows above use;
  // a name that is not shared stays as it was.
  const cardNameCount = new Map();
  for (const card of bundle.cards) cardNameCount.set(card.name, (cardNameCount.get(card.name) || 0) + 1);
  const cardLabel = (card) => {
    if ((cardNameCount.get(card.name) || 0) < 2) return card.name;
    const owner = !card.class || card.class === 'colorless' ? 'All classes' : (classNames.get(card.class) || words(card.class));
    return `${card.name} (${owner})`;
  };
  for (const card of bundle.cards) add(`attackImpact.${card.id}`, -1, `${cardLabel(card)} — impact override`, 'Attack overrides', {
    min: -1, max: 99, integer: true, step: 1, note: '-1 uses attack type and weapon weight. 0 causes no impact. Other values override impact per hit.',
  });
  return rows;
}

/**
 * onGrid(value, row) → the value the row could actually have produced.
 *
 * THE PANEL'S STEP IS THE DOMAIN, AND THE IMPORT DOOR DOES NOT ENFORCE IT.
 * `parseAdvancedConfigFile` checks finite/min/max/integer and nothing else, so
 * a hand-edited configuration can carry a weight of 0.9999999999 on a row
 * whose step is 0.01 — a number no player could type here. `ratingReceipt`
 * floors with a 1e-9 epsilon (which is what makes 0.29 × 100 land on 29
 * instead of 28.999999999999996), and that epsilon would read such a weight as
 * a clean 1: the receipt would pay a point the config does not state. Snapping
 * to the row's own step closes it at the door instead of loosening the floor,
 * so the number the receipt uses is the number the panel would show.
 */
function onGrid(value, row) {
  if (!Number.isFinite(value) || !Number.isFinite(row.step) || row.step <= 0) return value;
  return Number((Math.round(value / row.step) * row.step).toFixed(6));
}

export function resolveCombatRatings(rawSettings, bundle) {
  const settings = migrateCombatRatingSettings(rawSettings || {}, bundle);
  const config = structuredClone(combatRatingDefaults);
  config.bonuses = {}; config.attackImpact = {}; config.enemyImpact = {}; config.enemyAttackType = {}; config.enemyRatings = {};
  config.itemRatings = {};
  // What a run born before ruleset 7 was priced by: the frozen formula, with
  // whatever its own configuration snapshot tuned (model/statRows.js).
  config.legacyRatings = legacyRatingFormulaFromSettings(rawSettings || {});
  // The rating rows a caller with no run reads: the table's AR, DR, PR, Poise
  // and Ward rows with their own settings keys over them (Stats → each rating).
  // A run reads its own snapshot's instead (model/statRows.js ratingsConfigFor).
  config.ratings = Object.fromEntries(ratingIds.map((id) => {
    const authored = resolvedRuleRow(bundle?.derivedStatRules, id);
    const row = authored ? { ...authored } : { ...LEGACY_RATING_FORMULA.ratings[id] };
    for (const field of ['base', ...attributes, 'perLevel', 'min', 'max']) {
      const value = Number(settings[`${STAT_ROW_KEY_PREFIX}${id}.${field}`]);
      if (settings[`${STAT_ROW_KEY_PREFIX}${id}.${field}`] !== undefined && Number.isFinite(value) && value >= 0) row[field] = value;
    }
    return [id, row];
  }));
  for (const row of combatRatingRows(bundle)) {
    const raw = settings[row.key] ?? (row.type === 'choice' || row.key.includes('.enemyRatings.') ? row.def : undefined);
    if (raw === undefined) continue;
    const value = row.type === 'choice' ? raw : typeof row.def === 'boolean' ? raw === true : onGrid(Number(raw), row);
    if (row.type === 'choice' && !row.choices.includes(value)) continue;
    if (typeof value === 'number' && (!Number.isFinite(value) || value < row.min || value > row.max || (row.integer && !Number.isInteger(value)))) continue;
    const path = row.key.slice(prefix.length).split('.');
    // A RATING WITH A COLUMN IS NOT WRITTEN TWICE. `applyItemRatingConfig` puts
    // it on the piece itself, and `ratingReceipt` reads the piece — keeping a
    // copy here would be a second home for one number, and the two would part
    // company the moment an upgrade moved the column. Only the ratings no item
    // column can hold (Ward, an armament's Poise, the off-school attack rating)
    // travel in the rules.
    if (path[0] === 'itemRatings') {
      const piece = itemByRatingSource(bundle)[path[1]];
      if (!piece || itemRatingColumn(bundle.equipment, piece, path[2])) continue;
    }
    let dest = config;
    for (const key of path.slice(0, -1)) dest = dest[key] ||= {};
    dest[path.at(-1)] = value;
  }
  // A status weight is written ONE FIELD AT A TIME, and the clone above carries
  // both fields only for the seven statuses `combatRatingDefaults.statuses`
  // names. Tuning Poise for any other status therefore created `{ poise: 0.5 }`
  // with no `ward` — which combatRatingProblems reads as a broken config and
  // reports as "Invalid status resistance weights" forever, on a panel the
  // player left in a perfectly reasonable state. The pair is the unit, so a
  // side nobody wrote reads 0: unresisted, which is exactly what the row's own
  // note promises for a status with no weights. A named status never reaches
  // this — its authored weight came in with the clone and is already finite —
  // so there is no second home for the defaults here.
  for (const weights of Object.values(config.statuses)) {
    for (const field of ['poise', 'ward']) if (!Number.isFinite(weights[field])) weights[field] = 0;
  }
  return config;
}

export function combatRatingProblems(config) {
  if (!config || typeof config !== 'object') return ['Missing combat rating rules'];
  const problems = [];
  // A MULTIPLIER THIS BUILD ADDED IS ABSENT FROM EVERY SAVED FIGHT, and
  // `combatSnapshotProblems` runs this over a restored snapshot's own rules.
  // Requiring the field would have refused every in-flight combat save written
  // before it existed — the run would not resume. Absent reads as 1, exactly
  // as `ratingReceipt` reads it; a WRITTEN one is still held to its domain.
  if (config.multiplier !== undefined && (!Number.isFinite(config.multiplier) || config.multiplier < 0)) problems.push('Invalid rating multiplier');
  // `ratings` is filled per run (statRows.js); a config that carries rows —
  // every saved fight does — must carry sound ones. An attribute a row does
  // not name weighs 0.
  if (config.ratings !== undefined) for (const id of ratingIds) {
    const r = config.ratings?.[id];
    if (!r || !Number.isFinite(r.base) || r.base < 0 || attributes.some(k => r[k] !== undefined && (!Number.isFinite(r[k]) || r[k] < 0))) problems.push(`Invalid ${id} formula`);
  }
  if (!config.resistance || ['physicalK', 'magicalK', 'statusK'].some(k => !(config.resistance[k] > 0)) || !(config.resistance.maximum >= 0 && config.resistance.maximum < 1)) problems.push('Invalid resistance curve');
  const impact = config.impact;
  if (!impact || !(impact.lightMaxWeight <= impact.mediumMaxWeight && impact.mediumMaxWeight <= impact.heavyMaxWeight)) problems.push('Weapon weight thresholds must be ordered');
  if (!impact || Object.values(impact).some(n => !Number.isInteger(n) || n < 0 || n > 999)) problems.push('Invalid impact values');
  const b = config.breaks;
  if (!b || !Number.isFinite(b.thresholdGrowth) || b.thresholdGrowth < 1 || ['poiseActionLoss', 'wardActionLoss', 'recoveryPerTurn'].some(k => !Number.isInteger(b[k]) || b[k] < 0 || b[k] > 999)) problems.push('Invalid break settings');
  for (const weights of Object.values(config.statuses || {})) if (!weights || ['poise', 'ward'].some(k => !Number.isFinite(weights[k]) || weights[k] < 0 || weights[k] > 1)) problems.push('Invalid status resistance weights');
  for (const bonuses of Object.values(config.bonuses || {})) if (!bonuses || Object.values(bonuses).some(n => !Number.isFinite(n) || n < 0 || n > 999)) problems.push('Invalid rating bonus');
  for (const ratings of Object.values(config.itemRatings || {})) if (!ratings || Object.values(ratings).some(n => !Number.isInteger(n) || n < 0 || n > ITEM_RATING_MAX)) problems.push('Invalid equipment rating');
  for (const n of [...Object.values(config.attackImpact || {}), ...Object.values(config.enemyImpact || {})]) if (!Number.isInteger(n) || n < -1 || n > 99) problems.push('Invalid impact override');
  if (Object.values(config.enemyAttackType || {}).some(v => !['auto', 'physical', 'magic'].includes(v))) problems.push('Invalid enemy attack type');
  for (const values of Object.values(config.enemyRatings || {})) if (!values || ['poise', 'ward'].some(id => !Number.isInteger(values[id]) || values[id] < 0 || values[id] > 999)) problems.push('Invalid enemy defences');
  return problems;
}

// The character level a rating row's `perLevel` reads: a run's level, or the
// level a fight was opened at (engine/combat.js stamps `characterLevel`).
function ratingLevelOf(run) {
  if (Number.isInteger(run?.level?.level)) return run.level.level;
  if (Number.isInteger(run?.characterLevel)) return run.characterLevel;
  return undefined;
}

export function ratingReceipt(registries, run, config) {
  const totals = Object.fromEntries(ratingIds.map(id => [id, 0]));
  const sources = [];
  const attributeReceipts = {};
  const add = (name, values, kind, sourceId = null) => {
    sources.push({ name, kind, ...(sourceId ? { sourceId } : {}), ...values });
    for (const id of ratingIds) totals[id] += Number(values[id]) || 0;
  };
  const stat = {};
  // EACH ATTRIBUTE TERM IS FLOORED ON ITS OWN, and the multipliers scale what
  // they add up to (owner, 2026-09-21): a weight IS the rate that attribute
  // converts at, so a 0.25 weight is "four points buy one", visible in the
  // receipt as the term it contributes rather than as a share of a pooled sum.
  //
  // NOTHING DIVIDES BY THE CREATION SCALE ANY MORE. A shrunken starting pool
  // used to be handed back to these formulas multiplied by its inverse — 12
  // points on the 35-point scale meant every attribute entered here at 2.92×
  // its own value, and a Starseer reading INT 8 on the sheet scored Ward as if
  // it held 23. The panel's own weights were the one honest description of the
  // arithmetic and they were wrong by that factor. The scale is gone from the
  // formulas entirely; a smaller pool now means smaller ratings, which is what
  // shrinking it says.
  for (const id of ratingIds) {
    attributeReceipts[id] = attributeRatingReceipt(config, run.attributes, id, ratingLevelOf(run));
    stat[id] = attributeReceipts[id].value;
  }
  add('Attributes', stat, 'attribute');
  if (run.loadout) for (const piece of equippedPieces(registries, run.loadout, run.class || run.player?.classId, { itemUpgradeLevels: run.itemUpgradeLevels || {} })) {
    // The piece is the configured, upgraded one, so its columns already ARE the
    // ratings the settings panel and the item card show.
    const values = authoredItemRatings(registries.equipment, piece);
    const configured = config.itemRatings?.[ratingSourceKey(piece)] || {};
    for (const id of ratingIds) if (Number.isFinite(configured[id])) values[id] = configured[id];
    // AN OLD PER-ITEM PLUS IS NOT ADDED HERE, and that is the compatibility
    // story rather than a hole in it (Copilot, on #1242). A saved fight carries
    // the rules it opened under, `bonuses.<item>` and all, and the registries
    // it is restored into are rebuilt from the RUN's own configuration
    // snapshot — the same settings those rules were resolved from — so
    // `migrateCombatRatingSettings` has already put authored + plus on the
    // piece above. Adding `config.bonuses[<item>]` on top of that would score
    // the plus twice and hand a resumed fight authored + 2 × plus.
    // The rating a card sourced from THIS piece reads (`sourceRatingValue`)
    // is the same item value: an override where the owner set one, the
    // column the item authors where they did not.
    values.effectiveRatings = Object.fromEntries(ratingIds.map((id) => [
      id,
      Number.isFinite(configured[id]) ? configured[id] : equipmentRatingBase(piece, id, { ratingId: id }),
    ]));
    add(piece.name, values, 'equipment', piece.id);
  }
  for (const id of run.relics || run.player?.relicIds || []) {
    const relic = resolveUpgradedRelic(registries, `relic/${id}`, run.itemUpgradeLevels?.[`relic/${id}`] || 0);
    const values = { ...config.bonuses?.[`relic:${id}`] };
    values.poise = (values.poise || 0) + (relic.passives?.poiseThresholdAdd || 0);
    for (const statId of ratingIds) values[statId] = (values[statId] || 0) + (relic.passives?.[`${statId}Bonus`] || 0);
    add(relic.name, values, 'relic', id);
  }
  return { totals, sources, attributeReceipts };
}

export function ratingValue(ctx, entity, id) {
  let value = entity?.ratings?.[id] || 0;
  for (const [status, instance] of Object.entries(entity?.statuses || {})) value += (ctx.ratingsRules?.bonuses?.[`status:${status}`]?.[id] || 0) * (instance.stacks || 0);
  return Math.max(0, value);
}

export function sourceRatingValue(ctx, entity, id, sourceArmamentId, equipmentScoped = false) {
  if ((!sourceArmamentId && !equipmentScoped) || !Array.isArray(entity?.ratingSources)) return ratingValue(ctx, entity, id);
  let value = 0;
  for (const source of entity.ratingSources) {
    if (source.kind !== 'equipment') value += Number(source[id]) || 0;
    else if (sourceArmamentId && source.sourceId === sourceArmamentId) value += Number(source.effectiveRatings?.[id] ?? source[id]) || 0;
  }
  for (const [status, instance] of Object.entries(entity.statuses || {})) {
    value += (ctx.ratingsRules?.bonuses?.[`status:${status}`]?.[id] || 0) * (instance.stacks || 0);
  }
  return Math.max(0, value);
}

export function isMagicalAttack(ctx, carrier) {
  const def = carrier?.cardId ? ctx.registries.cards.get(carrier.cardId) : null;
  return cardIsMagical({
    ...def,
    ...carrier,
    damageSchool: carrier?.damageSchool || def?.damageSchool,
    tags: carrier?.tags || def?.tags,
  });
}

export function ratingDamageMultiplier(ctx, target, magical) {
  if (!ctx.ratingsRules || !target?.ratings) return 1;
  const r = ctx.ratingsRules.resistance;
  const rating = ratingValue(ctx, target, magical ? 'ward' : 'poise');
  return 1 - Math.min(r.maximum, rating / (rating + (magical ? r.magicalK : r.physicalK)));
}

export function attackImpact(ctx, source, carrier) {
  const config = ctx.ratingsRules;
  if (!config) return 0;
  const explicit = config.attackImpact?.[carrier?.cardId];
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const magical = isMagicalAttack(ctx, carrier);
  // A PHYSICAL HIT A WEAPON LENDS IS AS HEAVY AS THE WEAPON (SPEC §13.4): the
  // weight category, and the per-enemy override, come before any card value,
  // or every weapon's Strike would land with the same cost-derived number and
  // a dagger would stagger like a warhammer.
  if (!magical) {
    const enemyOverride = config.enemyImpact?.[source?.enemyId];
    if (Number.isFinite(enemyOverride) && enemyOverride >= 0) return enemyOverride;
    const item = ctx.registries.equipment.armaments.find(p => p.id === carrier?.sourceArmamentId);
    if (item) {
      const w = item.weight || 0, i = config.impact;
      return w <= i.lightMaxWeight ? i.light : w <= i.mediumMaxWeight ? i.medium : w <= i.heavyMaxWeight ? i.heavy : i.colossal;
    }
  }
  // Otherwise the card's own Poise or Ward value (SPEC §3.4) is its impact.
  // The carrier holds the RESOLVED face's values — a staff's Strike carries
  // Ward — and the registry def is the fallback for a carrier built without.
  const def = carrier?.cardId ? ctx.registries.cards.get(carrier.cardId) : null;
  const ratingValues = carrier?.cardRatingValues
    || (carrier?.upgraded ? def?.upgrade?.cardRatingValues : null)
    || def?.cardRatingValues;
  const calculated = ratingValues?.[magical ? 'ward' : 'poise'];
  if (calculated !== undefined) {
    return Math.max(0, evaluate(calculated, { energySpent: carrier?.energySpent || 0 }));
  }
  if (magical) return config.impact.magic;
  return source?.kind === 'enemy' ? config.impact.enemyPhysical : config.impact.unarmed;
}
