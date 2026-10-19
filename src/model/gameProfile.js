// Immutable per-run configuration snapshots. No mutable active-profile singleton.
import { gameProfileCatalog, gameProfileAuthors } from '../content/generated/gameProfiles.js';
import { resolveGameAuthor, freezeGameData, dataClone, GameConfigError } from '../../engine/kernel/gameConfig.js';
import { markVerifiedProfile, validateVerifiedProfile } from './verifiedProfiles.js';
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
export function validateGameProfileSnapshot(profile) { return validateVerifiedProfile(profile,gameProfileCatalog.runtimeHash); }
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
  const chosen = alternate ? {...dataClone(def),...dataClone(alternate)} : dataClone(def);
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
  return bundle;
}
export function bindGameProfileRegistries(registries,profile) { return Object.freeze({...registries,gameProfile:resolveGameProfile(profile)}); }
