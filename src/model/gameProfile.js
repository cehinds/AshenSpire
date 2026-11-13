// Immutable per-run configuration snapshots. No mutable active-profile singleton.
import { gameProfileCatalog, gameProfileAuthors } from '../content/generated/gameProfiles.js';
import { resolveGameAuthor, freezeGameData, dataClone, GameConfigError } from '../../engine/kernel/gameConfig.js';
import { markVerifiedProfile, validateVerifiedProfile } from './verifiedProfiles.js';
import { SUPPORTED_CORE } from './retiredProfile.js';
import { coreEvasionCompatibleRuntime } from './coreEvasionCompatibility.js';
import { applyUpgradeSteps, upgradeCount, upgradeStepsOf } from './cardUpgrade.js';
import { cardRank, rankedEffectsCapped } from './cardRank.js';
import { applyRamp, playsEverOf } from './cardRamp.js';
import { ProjectEnemyContent } from './enemyProjection.js';
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
  // An upgraded copy applies def.upgrade once, over the base, exactly as Legacy resolveCard does (ability-grade cards excepted).
  if (typeof idOrInstance === 'object' && upgradeCount(idOrInstance) && !Array.isArray(chosen.gradeProfiles)) chosen = dataClone(applyUpgradeSteps(chosen, upgradeStepsOf(idOrInstance)));
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
  if (gameModule(profile, 'effects')?.fixCoreVersion === 1) {
    ProjectEnemyContent(bundle, profile.content, baseBundle, cloneLegacy);
  }
  return bundle;
}
export function bindGameProfileRegistries(registries,profile) { return Object.freeze({...registries,gameProfile:resolveGameProfile(profile)}); }
