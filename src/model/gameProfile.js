// Immutable per-run configuration snapshots. No mutable active-profile singleton.
import { gameProfileCatalog, gameProfileAuthors } from '../content/generated/gameProfiles.js';
import { resolveGameAuthor, freezeGameData, dataClone, GameConfigError } from '../../engine/kernel/gameConfig.js';
import { markVerifiedProfile, validateVerifiedProfile } from './verifiedProfiles.js';
import { coreEvasionCompatibleRuntime } from './coreEvasionCompatibility.js';
import { upgradedDefinition } from './cardUpgrade.js';
import { deriveEnemyMoves, resolveEnemyMoveSources } from './enemyMoveSources.js';
export { GameConfigError };
// Catalog profiles are deterministic, so each id is resolved and digested once per process; later
// resolves return a fresh deep-frozen copy (callers rely on distinct snapshots) instead of re-hashing.
const resolvedById = new Map();
const resolveOnce = (key, make) => {
  const first = resolvedById.get(key);
  if (first) return markVerifiedProfile(freezeGameData(dataClone(first)));
  const made = markVerifiedProfile(make()); resolvedById.set(key, made); return made;
};
export function resolveGameProfile(idOrAuthor = 'current') {
  if (typeof idOrAuthor === 'string') {
    if (Object.hasOwn(gameProfileCatalog.bundles, idOrAuthor)) {
      return resolveOnce('bundle:'+idOrAuthor, () => resolveGameAuthor({formatVersion:1,core:idOrAuthor,modules:{}},gameProfileCatalog));
    }
    if (!gameProfileAuthors[idOrAuthor]) throw new GameConfigError('$/profile','unknown profile ID');
    return resolveOnce('author:'+idOrAuthor, () => resolveGameAuthor(gameProfileAuthors[idOrAuthor],gameProfileCatalog));
  }
  if (idOrAuthor?.hash) return validateGameProfileSnapshot(idOrAuthor);
  return resolveGameAuthor(idOrAuthor,gameProfileCatalog);
}
export function validateGameProfileSnapshot(profile) { return validateVerifiedProfile(profile,coreEvasionCompatibleRuntime(profile,gameProfileCatalog.runtimeHash)); }
function subjectProfile(subject) { return subject?.gameProfile || (subject?.formatVersion === 1 && subject?.modules ? subject : null); }
export function gameModule(subject,id) { return subjectProfile(subject)?.modules?.[id] || null; }
export function gameContent(subject,key) { return subjectProfile(subject)?.content?.[key]; }
export function projectGameCard(subject,idOrInstance) {
  if (!gameModule(subject,'cards') || gameModule(subject,'cards').mode === 'legacy') return null;
  const id = typeof idOrInstance === 'string' ? idOrInstance : idOrInstance?.cardId || idOrInstance?.id;
  const def = gameContent(subject,'cards')?.find(card => card.id === id);
  if (!def) return null;
  const pools = gameModule(subject,'resources');
  const enabled = pools?.include || [];
  const variants = gameContent(subject,'resourceVariants')?.[id];
  const variantKey = ['sp','mp'].filter(pool => enabled.includes(pool)).join(',') || 'none';
  const alternate = variants?.[variantKey];
  if ((!enabled.includes('sp') && def.staminaCost > 0) || (!enabled.includes('mp') && def.manaCost > 0)) {
    if (!alternate) throw new GameConfigError(`$/content/cards/${id}`,'missing authored disabled-resource variant');
  }
  let chosen = alternate ? {...dataClone(def),...dataClone(alternate)} : dataClone(def);
  // An upgraded copy applies def.upgrade once, over the base, exactly as Legacy resolveCard does (ability-grade cards excepted).
  if (typeof idOrInstance === 'object' && idOrInstance?.upgraded && !Array.isArray(chosen.gradeProfiles)) chosen = dataClone(upgradedDefinition(chosen));
  chosen.kindIds = ['classification.' + chosen.type];
  chosen.resourceCosts = {sp:chosen.staminaCost || 0,mp:chosen.manaCost || 0};
  return freezeGameData(chosen);
}
function cloneLegacy(value,seen = new Map()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const out = Array.isArray(value) ? [] : value instanceof Map ? new Map() : value instanceof Set ? new Set() : {};
  seen.set(value,out);
  if (value instanceof Map) for(const [key,item] of value)out.set(key,cloneLegacy(item,seen));
  else if(value instanceof Set)for(const item of value)out.add(cloneLegacy(item,seen));
  else for(const [key,item]of Object.entries(value))out[key]=cloneLegacy(item,seen);
  return out;
}
// The range adapter adds only the authored mobility capability. Existing
// offense payloads/prices remain the shared enemy definitions' authority.
function projectEnemyRangeContent(bundle, profile, baseBundle) {
  if (gameModule(profile, 'effects')?.fixCoreVersion !== 1 || !Array.isArray(bundle.enemies)) return;
  const authored = new Map((gameContent(profile, 'enemies') || []).map(row => [row.id, row]));
  if (![...authored.values()].some(row => row.rangeClosingMove !== undefined)) return;
  const cards = new Map((gameContent(profile, 'enemyCards') || []).map(row => [row.id, row]));
  const flat = new Map((resolveEnemyMoveSources(baseBundle).enemyMoves || []).map(({ id, enemyId, ...move }) => [JSON.stringify([enemyId, id]), cloneLegacy(move)]));
  const rangeOverrides = new Map(), closingKeys = new Set(), additions = [];
  bundle.enemies = bundle.enemies.map(def => {
    const row = authored.get(def.id);
    if (row?.rangeClosingMove === undefined) return def;
    const moves = Object.fromEntries(Object.entries(def.moves || {}).map(([id, move]) => [id, flat.get(JSON.stringify([def.id, id])) || move]));
    const owned = new Set(row.defaultDeck || []);
    const entry = Object.entries(row.cardHints || {}).find(([id, hint]) => owned.has(id) && hint.legacyMove === row.rangeClosingMove);
    const card = entry && cards.get(entry[0]), hint = entry?.[1];
    if (!card || !Number.isSafeInteger(card.staminaCost) || card.staminaCost < 0 || card.manaCost !== 0
      || card.effects?.length !== 1 || card.effects[0].op !== 'moveEngagement' || card.effects[0].target !== 'enemy' || card.effects[0].bands !== -1) {
      throw new GameConfigError(`$/content/enemies/${def.id}/rangeClosingMove`, 'requires an owned, explicitly priced one-band closing card');
    }
    moves[row.rangeClosingMove] = { intent: 'buff', sp: card.staminaCost, weight: hint.aiWeight ?? 0, effects: dataClone(card.effects) };
    closingKeys.add(JSON.stringify([def.id, row.rangeClosingMove]));
    additions.push(...[...(card.tags || []).filter(tagId => !tagId.startsWith('classification.')), 'classification.enemyMove'].map(tagId => ({ family: 'enemyMove', scope: def.id, objectId: row.rangeClosingMove, tagId })));
    // A retreat is the opposite one-band move: authored price (the closing price plus one), and a
    // dynamic weight the engine applies only while the fight is closer than the enemy prefers.
    if (row.rangeRetreatMove !== undefined) {
      const rEntry = Object.entries(row.cardHints || {}).find(([id, h]) => owned.has(id) && h.legacyMove === row.rangeRetreatMove);
      const rCard = rEntry && cards.get(rEntry[0]), rHint = rEntry?.[1];
      if (!rCard || !Number.isSafeInteger(rCard.staminaCost) || rCard.staminaCost < 0 || rCard.manaCost !== 0
        || rCard.effects?.length !== 1 || rCard.effects[0].op !== 'moveEngagement' || rCard.effects[0].target !== 'enemy' || rCard.effects[0].bands !== 1) {
        throw new GameConfigError(`$/content/enemies/${def.id}/rangeRetreatMove`, 'requires an owned, explicitly priced one-band retreat card');
      }
      moves[row.rangeRetreatMove] = { intent: 'buff', sp: rCard.staminaCost, weight: 0, retreatWeight: rHint.aiWeight ?? 0,
        ...(rHint.maxConsecutive ? { maxConsecutive: rHint.maxConsecutive } : {}), effects: dataClone(rCard.effects) };
      closingKeys.add(JSON.stringify([def.id, row.rangeRetreatMove]));
      additions.push(...[...(rCard.tags || []).filter(tagId => !tagId.startsWith('classification.')), 'classification.enemyMove'].map(tagId => ({ family: 'enemyMove', scope: def.id, objectId: row.rangeRetreatMove, tagId })));
    }
    for (const [id, metadata] of Object.entries(row.cardHints || {})) {
      const source = cards.get(id);
      // Core-only offense (owner, 2026-10-25): a hint with coreOffense "card" takes its move's hit count and per-hit
      // damage from the Core card, so a multi-hit move trimmed to fit the enemy's SP pool stays in Core content only.
      if (metadata.coreOffense === 'card' && moves[metadata.legacyMove]) {
        const hits = (source?.effects || []).filter(effect => effect.op === 'damage');
        if (hits.length !== 1 || !Number.isSafeInteger(hits[0].amount) || !Number.isSafeInteger(hits[0].hits ?? 1) || moves[metadata.legacyMove].damage === undefined) {
          throw new GameConfigError(`$/content/enemies/${def.id}/cardHints/${id}/coreOffense`, 'requires one whole-number damage effect on the card and a move with authored damage');
        }
        moves[metadata.legacyMove] = { ...moves[metadata.legacyMove], damage: hits[0].amount, hits: hits[0].hits ?? 1 };
      }
      // Core-only price (owner, 2026-10-25): a hint with coreSp "card" prices its move at the Core card's staminaCost, so a
      // single-hit attack is not left costing the stance-table 2 SP against a 1 SP pool. Legacy keeps the stance price.
      if (metadata.coreSp === 'card' && moves[metadata.legacyMove]) {
        if (!source || !Number.isSafeInteger(source.staminaCost) || source.staminaCost < 0) {
          throw new GameConfigError(`$/content/enemies/${def.id}/cardHints/${id}/coreSp`, 'requires an owned card with a whole-number staminaCost');
        }
        moves[metadata.legacyMove] = { ...moves[metadata.legacyMove], sp: source.staminaCost };
      }
      if ((owned.has(id) || (row.unlockCards || []).includes(id)) && moves[metadata.legacyMove] && source?.range !== undefined) {
        rangeOverrides.set(JSON.stringify([def.id, metadata.legacyMove]), source.range);
      }
    }
    return { ...def, moves, startingRange: row.startingRange, rangeClosingMove: row.rangeClosingMove, ...(row.rangeRetreatMove === undefined ? {} : { rangeRetreatMove: row.rangeRetreatMove }), rangeRoutePolicy: row.rangeRoutePolicy };
  });
  bundle.enemyMoves = deriveEnemyMoves(bundle.enemies);
  bundle.tagging = [...(bundle.tagging || []).filter(row => !(row.family === 'enemyMove' && (closingKeys.has(JSON.stringify([row.scope, row.objectId])) || rangeOverrides.has(JSON.stringify([row.scope, row.objectId])) && /^(range|reach):/.test(row.tagId)))),
    ...additions, ...[...rangeOverrides].map(([key, range]) => { const [scope, objectId] = JSON.parse(key); return { family: 'enemyMove', scope, objectId, tagId: `range:${range}` }; })];
}
export function applyGameProfileToContent(baseBundle,profileOrAuthor = 'current') {
  const profile = resolveGameProfile(profileOrAuthor), bundle=cloneLegacy(baseBundle);
  if(profile.foundation.mode === 'legacy') return bundle;
  if(gameModule(profile,'cards')?.mode === 'configured') {
    const additions=gameContent(profile,'cards').map(def=>projectGameCard(profile,def.id));
    // Existing registry schemas use tags through the tagging relation table.
    const raw=additions.map(({tags,resourceCosts,kindIds,combatEffectsTiming,...def})=>def);
    bundle.cards=[...(bundle.cards||[]).filter(def=>!raw.some(row=>row.id===def.id)),...raw];
    bundle.equipment = {...bundle.equipment, cardExposure:[...(bundle.equipment?.cardExposure || []).filter(row=>!raw.some(def=>def.id===row.cardId)), ...raw.filter(def => def.effects.some(effect => effect.op === 'damage')).map(def => ({cardId:def.id,damageSchool:def.damageSchool,exposureBuildupPerHit:def.exposureBuildupPerHit}))]};
    bundle.tagging=[...(bundle.tagging||[]).filter(row=>row.family!=='card'||!raw.some(def=>def.id===row.objectId)),...additions.flatMap(def=>(def.tags||[]).map(tagId=>({family:'card',objectId:def.id,tagId})))];
  }
  if(gameModule(profile,'class-selection')) {
    bundle.classes=(bundle.classes||[]).map(def=>{
      const row=gameContent(profile,'classes').find(item=>item.id===def.id);
      if(!row)return def;
      return {...def,maxHp:row.maxHp,...(row.description === undefined ? {} : {description:row.description}),...(gameModule(profile,'cards')?.mode === 'configured' ? {cardPool:[...new Set([...(def.cardPool||[]),row.specialCardId])],startingSignatureCard:row.specialCardId} : {})};
    });
  }
  if(gameModule(profile,'equipment')?.requirementsPolicy === 'none' && bundle.equipment) {
    // These six-point profiles deliberately omit the legacy attribute gates.
    // Strip both executable piece requirements and their authored table so
    // validation, equipment UI and mutation receipts see the same policy.
    bundle.equipment.equipmentRequirements = [];
    for (const key of ['armaments','armour']) bundle.equipment[key] = (bundle.equipment[key] || []).map(piece => ({...piece,requirements:{attributes:{}}}));
  }
  if(Array.isArray(bundle.resources)) {
    const pools=gameModule(profile,'resources')?.include||[],defenses=gameModule(profile,'defenses')?.include||[];
    bundle.resources=bundle.resources.filter(row=>{
      const id=row.source||row.id;
      if(['hp','health'].includes(id))return true;
      if(['mana','mp'].includes(id))return pools.includes('mp');
      if(['stamina','sp','energy','actions'].includes(id))return pools.includes(id==='energy'||id==='actions'?'actions':'sp');
      if(['poise','ward','block','barrier'].includes(id))return defenses.includes(id);
      return true;
    });
  }
  if(Array.isArray(bundle.enemies)) {
    // The runtime enemy registry compiles the shared act enemy lists; each profile's
    // own pack pins the starting poiseMax it plays with (Core 2 halved, Core 1 kept).
    const pinned=new Map((gameContent(profile,'enemies')||[]).filter(row=>Number.isInteger(row.poiseMax)).map(row=>[row.id,row.poiseMax]));
    bundle.enemies=bundle.enemies.map(def=>pinned.has(def.id)&&Number.isInteger(def.poiseMax)?{...def,poiseMax:pinned.get(def.id)}:def);
  }
  projectEnemyRangeContent(bundle, profile, baseBundle);
  return bundle;
}
export function bindGameProfileRegistries(registries,profile) { return Object.freeze({...registries,gameProfile:resolveGameProfile(profile)}); }
