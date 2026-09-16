import {validate,resolveBindings,sample} from './model.mjs';
// Host services retain authority over mechanics. This adapter only produces
// presentation frames, and requires an explicit confirmed event identity.
export function createPresentationAdapter(project,{catalog,render,now=()=>performance.now(),schedule=cb=>requestAnimationFrame(cb),cancel=id=>cancelAnimationFrame(id)}={}){
 const errors=validate(project,catalog);if(errors.length)throw Error(errors.join('; '));
 if(typeof render!=='function')throw Error('A presentation render callback is required');
 let ticket=null,seen=new Set(),generation=0;
 const stop=()=>{generation++;if(ticket!==null)cancel(ticket);ticket=null;render(null);};
 return {stop,dispatch(event){
  if(!event||typeof event.id!=='string'||!event.id)throw Error('Confirmed event ID required');
  if(seen.has(event.id))return {played:false,reason:'duplicate event'};
  const resolved=resolveBindings(project,event);if(!resolved.winner)return {played:false,reason:resolved.conflict?'conflicting bindings':'no match',resolved};
  seen.add(event.id);if(seen.size>1000)seen.delete(seen.values().next().value);stop();const started=now(),run=generation;
  const tick=()=>{if(run!==generation)return;const elapsed=now()-started;if(elapsed>=project.duration){stop();return;}render(sample(project,elapsed,event.preferences||{}));ticket=schedule(tick);};tick();return {played:true,resolved};
 }};
}
