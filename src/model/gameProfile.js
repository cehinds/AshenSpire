// Immutable per-run configuration snapshots. No mutable active-profile singleton.
import { gameProfileCatalog, gameProfileAuthors } from '../content/generated/gameProfiles.js';
import { resolveGameAuthor, validateResolvedGameProfile, freezeGameData, dataClone, GameConfigError } from '../../engine/kernel/gameConfig.js';
export { GameConfigError };
export function resolveGameProfile(idOrAuthor = 'current') {
  if (typeof idOrAuthor === 'string') {
    const alias = {'ashen.core@1.0.0':'core','ashen.current@1.0.0':'current'}[idOrAuthor] || idOrAuthor;
    if (!gameProfileAuthors[alias]) throw new GameConfigError('$/profile','unknown profile ID');
    return resolveGameAuthor(gameProfileAuthors[alias],gameProfileCatalog);
  }
  if (idOrAuthor?.hash) return validateGameProfileSnapshot(idOrAuthor);
  return resolveGameAuthor(idOrAuthor,gameProfileCatalog);
}
export function validateGameProfileSnapshot(profile) { return validateResolvedGameProfile(profile,gameProfileCatalog.runtimeHash); }
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
  if(gameModule(profile,'cards')) {
    const additions=gameContent(profile,'cards').map(def=>projectGameCard(profile,def.id));
    // Existing registry schemas use tags through the tagging relation table.
    const raw=additions.map(({tags,resourceCosts,kindIds,...def})=>def);
    bundle.cards=[...(bundle.cards||[]).filter(def=>!raw.some(row=>row.id===def.id)),...raw];
    bundle.equipment = {...bundle.equipment, cardExposure:[...(bundle.equipment?.cardExposure || []), ...raw.filter(def => def.effects.some(effect => effect.op === 'damage')).map(def => ({cardId:def.id,damageSchool:def.damageSchool,exposureBuildupPerHit:def.exposureBuildupPerHit}))]};
    bundle.tagging=[...(bundle.tagging||[]),...additions.flatMap(def=>(def.tags||[]).map(tagId=>({family:'card',objectId:def.id,tagId})))];
  }
  if(gameModule(profile,'class-selection')) {
    bundle.classes=(bundle.classes||[]).map(def=>{
      const row=gameContent(profile,'classes').find(item=>item.id===def.id);
      if(!row)return def;
      return {...def,maxHp:row.maxHp,cardPool:[...new Set([...(def.cardPool||[]),row.specialCardId])],startingSignatureCard:row.specialCardId};
    });
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
  return bundle;
}
export function bindGameProfileRegistries(registries,profile) { return Object.freeze({...registries,gameProfile:resolveGameProfile(profile)}); }
