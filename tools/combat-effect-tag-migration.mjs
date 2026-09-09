// One-time, reviewable authoring migration. Runtime reads the CSV junction only.
import {readFileSync,writeFileSync} from 'node:fs';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {tagService} from '../src/model/tagService.js';
const reg=createRegistries(contentBundle),ts=tagService(reg);
const words=['blade','guard','blood','gorefire','starstone','ritual','blight','oath','flourish','ash','heavy','pierce','ranged','precision','guile','venom','shield','barrier','ward','magic','arcane','dodge','riposte','heal','cleanse','bind','frost','bulwark','utility'];
const append=(file,marker,body)=>{const path='content/source/'+file;let s=readFileSync(path,'utf8');s=s.split(marker)[0].trimEnd();writeFileSync(path,s+'\n'+marker+'\n'+body+'\n');};
append('tagDomains.csv','# Combat presentation','presentation,Combat presentation,"Sprite selection only; never damage or resistance identity."');
append('tagFamilyDomains.csv','# Combat presentation','card,presentation\nbasicCardProfile,presentation');
append('tags.csv','# Combat presentation',words.map(w=>`fx:${w},presentation,${w},9FC3E8,✧,"${w} visual identity; no combat modifier."`).join('\n'));
const overrides={
 shieldBash:['shield'],guardCounter:['riposte'],riposte:['riposte'],
 crystalBarrier:['barrier','magic'],umbralWard:['barrier','arcane'],starstoneWard:['ward','arcane'],wardingStar:['ward','magic'],frostVeil:['ward','frost'],bracingStance:['bulwark','guard'],
 starSlicer:['blade','starstone'],moonrendCut:['blade','starstone'],astralCleave:['blade','starstone'],starstoneKris:['pierce','starstone'],
 impale:['pierce'],stomp:['heavy'],kickOff:['heavy'],cleavingBlow:['heavy','blade'],meteorite:['starstone','ranged','heavy'],meteorSwarm:['starstone','ranged','heavy'],
 smokeBomb:['ash','guile'],bloodPact:['ritual'],enterBulwark:['bulwark','guard'],enterGorefire:['gorefire'],
 goreblood:['blood'],sanguinePact:['blood'],stigmata:['blood'],lifeTithe:['blood'],communion:['blood'],emberTide:['gorefire'],
};
const entries=[];
for(const card of reg.cards.all()){
 if(!['attack','skill','power'].includes(card.type))continue;
 const tags=new Set(ts.idsOf('card',card).filter(t=>words.includes(t)));
 const effects=[...(card.effects||[]),...(card.upgrade?.effects||[])];
 if(!tags.size){
  if(card.class==='starseer')tags.add('starstone');
  else if(card.class==='herald')tags.add('ritual');
  else if(card.type==='attack')tags.add('blade');
 }
 for(const e of effects){
  if(e.op==='dodgeRoll')tags.add('dodge');
  if(e.op==='heal')tags.add('heal');
  if(e.op==='applyStatus'){
   const key={bleed:'blood',frost:'frost',crimsonBlight:'blight',venom:'venom'}[e.status];if(key)tags.add(key);
   if(['weak','vulnerable'].includes(e.status)&&e.target==='enemy'&&card.type==='skill')tags.add('bind');
  }
 }
 if(card.type==='skill'&&effects.some(e=>e.op==='block')&&!tags.has('flourish')&&!tags.has('guile')&&!tags.has('dodge'))tags.add('guard');
 for(const tag of overrides[card.id]||[])tags.add(tag);
 if(card.type==='attack'&&tags.has('starstone')&&!['blade','pierce'].some(t=>tags.has(t)))tags.add('ranged');
 if(!tags.size)tags.add('utility');
 for(const tag of tags)entries.push(`card,,${card.id},fx:${tag}`);
}
const profileExtras={shieldAttack:['shield'],shieldGuard:['shield','guard'],weaponGuard:['guard'],unarmedGuard:['guard'],staffGuard:['guard','magic','ward'],sceptreGuard:['guard','arcane','ward'],sceptreArcaneAttack:['arcane'],unarmedTechnique:['dodge'],staffTechnique:['ritual']};
for(const p of reg.equipment.basicCardProfiles){
 const tags=new Set([...ts.idsOf('basicCardProfile',p).filter(t=>words.includes(t)),...(profileExtras[p.id]||[])]);
 if(!tags.size)tags.add('utility');for(const tag of tags)entries.push(`basicCardProfile,,${p.id},fx:${tag}`);
}
append('tagging.csv','# Combat presentation',entries.join('\n'));
console.log(`Authored ${entries.length} isolated presentation associations.`);
