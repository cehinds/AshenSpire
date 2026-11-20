// Immutable per-run configuration snapshots. No mutable active-profile singleton.
import { gameProfileCatalog, gameProfileAuthors } from '../content/generated/gameProfiles.js';
import { resolveGameAuthor, freezeGameData, dataClone, GameConfigError } from '../../engine/kernel/gameConfig.js';
import { markVerifiedProfile, validateVerifiedProfile } from './verifiedProfiles.js';
import { SUPPORTED_CORE } from './retiredProfile.js';
import { coreEvasionCompatibleRuntime } from './coreEvasionCompatibility.js';
import { applyUpgradeSteps, upgradeCount, upgradeStepsOf, ApplyDrawbackSteps } from './cardUpgrade.js';
import { cardRank, rankedEffectsCapped } from './cardRank.js';
import { applyRamp, playsEverOf } from './cardRamp.js';
import { ProjectEnemyContent } from './enemyProjection.js';
import { CardSpellTraditions, SpellTraditionsActive } from './spellTraditions.js';
export { GameConfigError };
// Catalog profiles are deterministic, so each id is resolved and digested once per process; later
// resolves return a fresh deep-frozen copy (callers rely on distinct snapshots) instead of re-hashing.
const resolvedById = new Map();
const resolveOnce = (key, make) => {
  const first = resolvedById.get(key);
  if (first) return markVerifiedProfile(freezeGameData(dataClone(first)));
  const made = markVerifiedProfile(make()); resolvedById.set(key, made); return made;
};
export function resolveGameProfile(idOrAuthor = 'default') {
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
// The one "is this the Core game" predicate: a profile, or a run/registries carrying one, authored on the supported Core.
export function isCoreProfile(subject) { return subjectProfile(subject)?.author?.core === SUPPORTED_CORE; }
// `rampless` leaves a ramp unapplied: the registry copy of a card stays plain so resolveCard can ramp it with the instance's plays (SPEC §4.3).
export function projectGameCard(subject,idOrInstance,{rampless=false}={}) {
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
  if (SpellTraditionsActive({ gameProfile: subject.gameProfile || subject }) && chosen.tags?.includes('camp:spell')) {
    chosen.tags = [...new Set([...chosen.tags, ...CardSpellTraditions(chosen).map(id => 'tradition:' + id)])];
  }
  // An upgraded copy applies def.upgrade once, over the base, exactly as Legacy resolveCard does (ability-grade cards excepted).
  if (typeof idOrInstance === 'object' && upgradeCount(idOrInstance) && !Array.isArray(chosen.gradeProfiles)) chosen = dataClone(applyUpgradeSteps(chosen, upgradeStepsOf(idOrInstance)));
  // A ranked ability card keeps its grade numbers; only a drawback-removal step applies to it (review of #2819).
  else if (typeof idOrInstance === 'object' && upgradeCount(idOrInstance)) chosen = dataClone(ApplyDrawbackSteps(chosen, upgradeStepsOf(idOrInstance)));
  // Card ranks (SPEC 13.4o) when the profile turns them on: each rank past 1 adds 1 to the primary number, as Legacy's resolveCard does.
  if (typeof idOrInstance === 'object' && gameModule(subject,'progression')?.cardRanks === true && !Array.isArray(chosen.gradeProfiles) && cardRank(idOrInstance) > 1) {
    chosen = {...chosen, effects: rankedEffectsCapped(chosen, cardRank(idOrInstance) - 1), rank: cardRank(idOrInstance)};
  }
  // Ramp lands last, after upgrade and rank growth, so the amount it wraps is still a plain number (SPEC §4.3).
  if (chosen.ramp && !rampless) chosen = applyRamp(chosen, chosen.ramp.scope === 'run' ? playsEverOf(idOrInstance) : 0, (chosen.tags || []).filter(tag => !tag.startsWith('classification.')));
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
// Core weapon arts (owner 2026-11-01) are the legacy default-art cards. A configured profile that
// disables a resource pool refuses any card that still costs it (profileCardCosts), so the arts get
// the same rule every Core variant has: a disabled pool's cost is 0. Pools that are on are untouched.
function projectWeaponArtResources(bundle,profile) {
  if(gameModule(profile,'equipment')?.weaponArts !== true || gameModule(profile,'cards')?.mode !== 'configured') return;
  const pools=gameModule(profile,'resources')?.include||[],sp=pools.includes('sp'),mp=pools.includes('mp');
  if(sp&&mp) return;
  const ids=new Set((bundle.equipment?.armaments||[]).flatMap(piece=>[...(piece.weaponCardPackage?.weaponArtDefaults||[]),...(piece.weaponCardPackage?.learnableArts||[])]));
  const zero=def=>{
    const out={...def};
    if(!sp&&out.cost!==undefined) out.cost=0;
    if(!sp&&out.staminaCost!==undefined) out.staminaCost=0;
    if(!mp&&out.manaCost!==undefined) out.manaCost=0;
    return out;
  };
  bundle.cards=(bundle.cards||[]).map(def=>{
    if(!ids.has(def.id)) return def;
    // 'fixed' keeps the derived action cost (src/model/actionCosts.js) from re-pricing a pool that is off.
    const out={...zero(def),costRule:'fixed'};
    // An ability-grade art (a Riposte, a Frost Nova) takes its price from its grade row, not the card.
    if(Array.isArray(def.gradeProfiles)) out.gradeProfiles=def.gradeProfiles.map(row=>({...row,...(sp?{}:{actionCost:0}),...(mp?{}:{manaCost:0})}));
    if(def.legacyFace&&typeof def.legacyFace==='object') out.legacyFace=zero(def.legacyFace);
    if(def.upgrade&&typeof def.upgrade==='object') out.upgrade=zero(def.upgrade);
    return out;
  });
}
// Item signatures (SPEC "The gear vocabulary", owner 2026-11-19). A profile-owned content.gear row may carry `signatureMods`; when the
// array is PRESENT (an empty one included) it replaces the matched piece's authored raw mods, and when it is absent the piece is untouched.
// The type / armour-group base is not here: GearPieceMods adds it on top of whatever `mods` the piece holds, so it still applies unchanged.
// Projecting the registry piece itself, once, is what makes stat pools (runMods), card rules and turn grants (GearSummary) and the
// equipment help text read one and the same piece; a per-reader override would be three facts that could disagree.
// Gated on typeEffectsVersion 1 as well as on presence: a saved profile without the type pass keeps its original item modifiers (SPEC,
// the `typeEffectsVersion` opt-in paragraph), and a signature without the type pass would strip the raw mods while the gear vocabulary that
// replaces them (turnGrant and the rest) stays switched off. Existing saves never carry the key, so presence alone already pins them.
// `bundle` is the caller's private clone (cloneLegacy) and every replaced piece is a new object, so neither the base content nor the
// frozen profile snapshot is written to.
function projectGearSignatures(bundle,profile) {
  if(gameModule(profile,'gear')?.typeEffectsVersion !== 1 || !bundle.equipment) return;
  const rows=(gameContent(profile,'gear')||[]).filter(row=>Array.isArray(row.signatureMods));
  if(!rows.length) return;
  const signatureOf=piece=>rows.find(row=>(row.source?.id || row.id)===piece.id && (row.kind==='armor')===(piece.kind==='armor')
    && (piece.kind!=='armor' || !row.classes || row.classes.includes(piece.classId)));
  for (const key of ['armaments','armour']) bundle.equipment[key]=(bundle.equipment[key]||[]).map(piece=>{
    const row=signatureOf(piece);
    return row ? {...piece,mods:[...row.signatureMods]} : piece;
  });
}
/** @param {string | object} [profileOrAuthor] */
export function applyGameProfileToContent(baseBundle,profileOrAuthor = 'default') {
  const profile = resolveGameProfile(profileOrAuthor), bundle=cloneLegacy(baseBundle);
  if(profile.foundation.mode === 'legacy') return bundle;
  if(gameModule(profile,'cards')?.mode === 'configured') {
    const additions=gameContent(profile,'cards').map(def=>projectGameCard(profile,def.id,{rampless:true}));
    // Existing registry schemas use tags through the tagging relation table.
    const raw=additions.map(({tags,resourceCosts,kindIds,combatEffectsTiming,...def})=>def);
    bundle.cards=[...(bundle.cards||[]).filter(def=>!raw.some(row=>row.id===def.id)),...raw];
    bundle.equipment = {...bundle.equipment, cardExposure:[...(bundle.equipment?.cardExposure || []).filter(row=>!raw.some(def=>def.id===row.cardId)), ...raw.filter(def => def.effects.some(effect => effect.op === 'damage')).map(def => ({cardId:def.id,damageSchool:def.damageSchool,exposureBuildupPerHit:def.exposureBuildupPerHit}))]};
    bundle.tagging=[...(bundle.tagging||[]).filter(row=>row.family!=='card'||!raw.some(def=>def.id===row.objectId)),...additions.flatMap(def=>(def.tags||[]).map(tagId=>({family:'card',objectId:def.id,tagId})))];
  }
  projectWeaponArtResources(bundle,profile);
  projectGearSignatures(bundle,profile);
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
  // A profile pins the enemy roster it was authored with. A run stamped with an older profile never meets an encounter that fields an
  // enemy its pack does not carry: that enemy would have no stamina pool, stats or moves under the profile's rules (the Codex roster,
  // 2026-11-18, is the first addition to meet an older pinned profile).
  const pinnedRoster=new Set((gameContent(profile,'enemies')||[]).map(row=>row.id));
  if(pinnedRoster.size) {
    if(Array.isArray(bundle.enemies)) bundle.enemies=bundle.enemies.filter(def=>pinnedRoster.has(def.id));
    if(Array.isArray(bundle.enemyMoves)) bundle.enemyMoves=bundle.enemyMoves.filter(row=>pinnedRoster.has(row.enemyId));
    if(Array.isArray(bundle.encounters)) bundle.encounters=bundle.encounters.filter(row=>!Array.isArray(row.enemies)||row.enemies.every(id=>pinnedRoster.has(id)));
    // Rows tagging what was dropped would tag nothing, which the registry refuses.
    const allEnemies=new Set((baseBundle.enemies||[]).map(def=>def.id)), keptEncounters=new Set((bundle.encounters||[]).map(row=>row.id));
    const allEncounters=new Set((baseBundle.encounters||[]).map(row=>row.id));
    if(Array.isArray(bundle.tagging)) bundle.tagging=bundle.tagging.filter(row=>!((row.family==='enemy'&&allEnemies.has(row.objectId)&&!pinnedRoster.has(row.objectId))
      ||(row.family==='enemyMove'&&allEnemies.has(row.scope)&&!pinnedRoster.has(row.scope))||(row.family==='encounter'&&allEncounters.has(row.objectId)&&!keptEncounters.has(row.objectId))));
  }
  if (gameModule(profile, 'effects')?.fixCoreVersion === 1) {
    ProjectEnemyContent(bundle, profile.content, baseBundle, cloneLegacy);
  }
  if (SpellTraditionsActive({ gameProfile: profile })) {
    // Base-library and enemy-projected cards also use the canonical tag join.
    // Derive their membership from authored school identity, in the same way
    // as profile cards, rather than leaving their visible icons unregistered.
    const tagsByCard = new Map();
    for (const row of bundle.tagging || []) if (row.family === 'card') {
      if (!tagsByCard.has(row.objectId)) tagsByCard.set(row.objectId, []);
      tagsByCard.get(row.objectId).push(row.tagId);
    }
    for (const card of bundle.cards || []) {
      const tags = tagsByCard.get(card.id) || [];
      if (!tags.includes('camp:spell')) continue;
      for (const id of CardSpellTraditions({ ...card, tags })) {
        const tagId = 'tradition:' + id;
        if (!tags.includes(tagId)) bundle.tagging.push({ family: 'card', objectId: card.id, tagId });
      }
    }
  }
  return bundle;
}
export function bindGameProfileRegistries(registries,profile) { return Object.freeze({...registries,gameProfile:resolveGameProfile(profile)}); }
