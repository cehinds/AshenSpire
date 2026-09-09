import {writeFileSync} from 'node:fs';
import {contentBundle} from '../../src/content/index.js';
import {createRegistries,resolveCard} from '../../src/model/registries.js';
import {tagService} from '../../src/model/tagService.js';
import {combatEffectFor} from '../../src/model/combatEffects.js';
import {COMBAT_EFFECT_ART} from '../../src/content/combatEffectArt.js';
const reg=createRegistries(contentBundle),service=tagService(reg),groups=new Map();
const classes=['reaver','starseer','rogue','herald'];
const profiles=contentBundle.equipment.basicCardProfiles;
for(const base of reg.cards.all().filter(c=>['attack','skill','power'].includes(c.type))){
 for(const profile of [null,...profiles.filter(p=>p.baseCardId===base.id)])for(const upgraded of [false,true]){
  const card=resolveCard(reg,{cardId:base.id,upgraded,...(profile?{profileId:profile.id}:{})});
  const tags=(card.cardTags?.length?card.cardTags:service.tagsOf('card',card)).map(t=>typeof t==='string'?t:t.id).sort();
  const variants=classes.map(cls=>({cls,plan:combatEffectFor({...card,cardTags:tags},cls)}));
  const distinct=new Map();for(const v of variants){const key=JSON.stringify(v.plan);if(!distinct.has(key))distinct.set(key,{plan:v.plan,classes:[]});distinct.get(key).classes.push(v.cls);}
  for(const {plan,classes:owners} of distinct.values()){
   const owner=distinct.size>1?owners.join('/'):'any class';
   const key=JSON.stringify([card.type,tags,profile?.id||'',plan,owner]);
   if(!groups.has(key))groups.set(key,{type:card.type,tags,profile:profile?.id||null,plan,owner,cards:new Set()});
   groups.get(key).cards.add(card.name+(upgraded&&!card.name.endsWith('+')?' +':''));
  }
 }
}
const rows=[...groups.values()].map(g=>({...g,cards:[...g.cards]})).sort((a,b)=>a.type.localeCompare(b.type)||a.tags.join().localeCompare(b.tags.join())||(a.profile||'').localeCompare(b.profile||''));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const line=r=>`${r.type} · ${r.tags.join(' + ')||'no tags'}${r.profile?' · '+r.profile:''}${r.owner!=='any class'?' · '+r.owner:''} → ${r.plan?.kind||'no added effect'}${r.plan?.projectile?' (projectile → impact)':r.plan?.at==='target'?' (target)':' (caster)'}`;
writeFileSync(new URL('inspection/current-tag-mappings.json',import.meta.url),JSON.stringify(rows,null,2));
writeFileSync(new URL('inspection/current-tag-mappings.md',import.meta.url),'Current resolved card/tag mappings. Base and upgraded cards are included. Equipment profiles use the same effective tags as solo/co-op combat. Class alternatives are shown only where they change the effect. This is the existing resolver, before the proposed combination-rule refactor.\n\n'+rows.map(r=>'- **'+line(r)+'** — '+r.cards.join(', ')).join('\n'));
const chunks=[];for(let i=0;i<rows.length;i+=12)chunks.push(rows.slice(i,i+12));
const html=`<!doctype html><html><meta charset="utf-8"><title>Current tag → sprite mappings</title><style>body{margin:0;background:#10191d;color:#e8e1d2;font:15px system-ui}main{max-width:1200px;margin:auto}section{padding:24px;box-sizing:border-box;width:1200px}h1{font:30px Georgia;margin:0 0 8px}p{color:#abbabd;margin:0 0 18px}ul{list-style:disc;margin:0;padding-left:20px;display:grid;grid-template-columns:1fr 1fr;gap:12px}li{background:#1e2c31;border:1px solid #425056;padding:10px;margin-left:8px;min-height:138px}strong{font-size:14px}small{display:block;color:#b7c4c4;margin-top:4px;line-height:1.3}.frames{display:flex;gap:3px;margin-top:6px}.frames img{width:72px;height:72px;object-fit:contain;background:#152125}a{color:#dfc98e}</style><main><p style="padding:20px"><a href="index.html?guards=1">Animated effect gallery</a> · Source snapshot: current local build · Six actual WebP frames per strip</p>${chunks.map((chunk,i)=>`<section id="page-${i+1}"><h1>Current card tags → sprite sets · ${i+1}/${chunks.length}</h1><p>Existing assignments, including equipment and card-specific exceptions. These are not the proposed new rules.</p><ul>${chunk.map(r=>`<li><strong>${esc(line(r))}</strong><small>${esc(r.cards.slice(0,3).join(', ')+(r.cards.length>3?' · +'+(r.cards.length-3)+' more variants':''))}</small><div class="frames">${(COMBAT_EFFECT_ART[r.plan?.kind]||[]).map((src,j)=>`<img src="../../${src}" alt="${r.plan.kind} frame ${j+1}">`).join('')}</div></li>`).join('')}</ul></section>`).join('')}</main></html>`;
writeFileSync(new URL('current-tag-mappings.html',import.meta.url),html);
console.log(JSON.stringify({cards:reg.cards.all().length,groups:rows.length,pages:chunks.length,sets:[...new Set(rows.map(r=>r.plan?.kind).filter(Boolean))].sort()},null,2));
