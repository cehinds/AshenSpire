import {PAINTED_OUTFITS} from '../src/content/paintedOutfits.js';
import {COMBAT_EFFECT_ART} from '../src/content/combatEffectArt.js';
import {EXTRA_EFFECTS} from './new-effects.mjs';
import {contentBundle} from '../src/content/index.js';
import {createRegistries,resolveCard} from '../src/model/registries.js';
import {combatEffectPlan,combatEffectTags} from '../src/model/combatEffects.js';
export {PAINTED_OUTFITS};
export const effectFrames={...COMBAT_EFFECT_ART,...Object.fromEntries(Object.keys(EXTRA_EFFECTS).map(id=>[id,Array.from({length:6},(_,i)=>`assets/pose-effects/${id}${i+1}.webp`)]))};
export const catalog={actors:Object.keys(PAINTED_OUTFITS),effects:Object.keys(effectFrames),poses:actor=>Object.keys(PAINTED_OUTFITS[actor]?.frames||{})};
export const registry=createRegistries(contentBundle);
export const cards=registry.cards.all().filter(c=>['attack','skill','power'].includes(c.type)).sort((a,b)=>a.name.localeCompare(b.name));
export function cardContext(id,payment={}){const card=resolveCard(registry,{cardId:id}),tags=combatEffectTags(registry,card);return {card,context:{provider:'ashenspire',kind:'card',objectId:id,event:'actionResolved',tags,...payment},plan:combatEffectPlan({...card,cardTags:tags},payment)};}
export const labels={...EXTRA_EFFECTS};
