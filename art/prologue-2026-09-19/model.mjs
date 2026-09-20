export const sceneIds = ['warmth','year','carry','night','step'];
export const classIds = ['reaver','starseer','rogue','herald'];
export function validateSequence(value, defaults) {
  if (!value || value.schemaVersion !== 1 || value.kind !== defaults.kind) throw new Error('This is not a compatible AshenSpire opening preset.');
  const result = structuredClone(defaults);
  const string = (v, name, max=5000) => { if(typeof v !== 'string' || v.length>max) throw new Error(`${name} must be text, at most ${max} characters.`); return v; };
  const number = (v, name, min,max) => { if(typeof v !== 'number'||!Number.isFinite(v)||v<min||v>max) throw new Error(`${name} must be between ${min} and ${max}.`); return v; };
  if(!Array.isArray(value.scenes)||value.scenes.length!==5||new Set(value.scenes.map(s=>s.id)).size!==5) throw new Error('The preset must contain the five distinct opening scenes.');
  for(const target of result.scenes){const src=value.scenes.find(s=>s.id===target.id);if(!src)throw new Error(`Missing scene: ${target.id}`);for(const key of ['name','speaker','text'])target[key]=string(src[key],key,key==='text'?5000:160);target.seconds=number(src.seconds,'Scene duration',1,180);if(!['fade','push','ash','still'].includes(src.effect))throw new Error('Unknown transition effect.');target.effect=src.effect;if('location' in target)target.location=string(src.location,'Location',160);}
  for(const id of classIds){const src=value.classes?.[id];if(!src)throw new Error(`Missing class: ${id}`);result.classes[id].name=string(src.name,'Class name',160);result.classes[id].line=string(src.line,'Class dialogue');}
  for(const key of Object.keys(result.labels))result.labels[key]=string(value.labels?.[key],key,100);
  const p=value.presentation;if(!p)throw new Error('Missing presentation settings.');
  result.presentation.shadowStrength=number(p.shadowStrength ?? defaults.presentation.shadowStrength,'Character shadow strength',0,1);
  result.presentation.transitionSeconds=number(p.transitionSeconds,'Transition',0,30);result.presentation.speed=number(p.speed,'Speed',.25,3);result.presentation.wash=number(p.wash,'Colour wash',0,.4);
  if(!['accent','character'].includes(p.tintSource)||!Object.hasOwn(defaults.palettes.accent,p.accent)||!Object.hasOwn(defaults.palettes.character,p.characterTint)||typeof p.reduceMotion!=='boolean')throw new Error('Unknown motif or motion setting.');
  for(const key of ['tintSource','accent','characterTint','reduceMotion'])result.presentation[key]=p[key];
  return result;
}
/**
 * sceneNavigation(data, index) → where the Next button and the auto-advance
 * timer may go from `index`, derived from the sequence itself.
 *
 * The opening was six scenes and is now five. Every "is this the last one?"
 * here used to be the literal 5 or 6, so cutting a scene left the final scene
 * advancing into `data.scenes[5]` (undefined) and a counter reading "5 / 6".
 * `final` is the end of THIS sequence, whatever length it is, and `next` is
 * null there rather than an index nothing answers to.
 */
export function sceneNavigation(data, index) {
  const total = data.scenes.length;
  const final = index >= total - 1;
  return { total, final, next: final ? null : index + 1, counter: `${index + 1} / ${total}` };
}
export function sceneCopy(scene,data,classId){const cls=data.classes[classId];return{speaker:scene.speaker.replaceAll('{class}',cls.name).replaceAll('{name}','Forsaken'),text:scene.text.replaceAll('{classLine}',cls.line).replaceAll('{class}',cls.name)};}
export function motifColour(data){const p=data.presentation;if(p.tintSource==='character'&&p.characterTint==='gold')return data.palettes.accent[p.accent];return data.palettes[p.tintSource][p.tintSource==='accent'?p.accent:p.characterTint];}
