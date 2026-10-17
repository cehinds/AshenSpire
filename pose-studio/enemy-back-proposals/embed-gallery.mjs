// Feature authoring only: embed the review surface without changing game logic.
import {readFile,writeFile} from 'node:fs/promises';
import {validateManifest,safeAsset} from './model.mjs';
const target=process.argv[2];if(!target)throw Error('Provide the built feature HTML path');
const dir='pose-studio/enemy-back-proposals';
const manifest=JSON.parse(await readFile(dir+'/manifest.json','utf8')),errors=validateManifest(manifest);if(errors.length)throw Error(errors.join('; '));
const assets={};
for(const actor of manifest.actors)for(const p of actor.proposals)for(const sequence of [...Object.values(p.stances||{}),...Object.values(p.animations||{}),...Object.values(p.reactions||{}),...(p.designFrame?[{frames:[p.designFrame]}]:[])])for(const frame of sequence.frames||[]){
 if(!safeAsset(frame.asset))throw Error('Unsafe asset path');
 if(!assets[frame.asset])assets[frame.asset]='data:image/'+(frame.asset.endsWith('.png')?'png':'webp')+';base64,'+(await readFile(frame.asset)).toString('base64');
}
for(const actor of manifest.actors)if(actor.reference?.asset){const asset=actor.reference.asset;if(!safeAsset(asset))throw Error('Unsafe reference asset');assets[asset]='data:image/'+(asset.endsWith('.png')?'png':'webp')+';base64,'+(await readFile(asset)).toString('base64');}
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
let html=(await readFile(dir+'/index.html','utf8')).replace('<a href="../../workbench/index.html#mod=assets">Asset Gallery</a>','<span>Standalone review</span>');
const model=(await readFile(dir+'/model.mjs','utf8')).replace(/^export /gm,'');
let preview=(await readFile(dir+'/preview.mjs','utf8')).replace(/^import[^\n]+\n/gm,'').replace("await fetch('./manifest.json')",'await Promise.resolve(new Response(JSON.stringify(__manifest)))');
const code='const __manifest='+json(manifest)+';const __assets='+json(assets)+';const assetUrl=id=>__assets[id]||id;\n'+model+'\n'+preview;
html=html.replace('<link rel="stylesheet" href="./preview.css">','<style>'+await readFile(dir+'/preview.css','utf8')+'</style>').replace('<script type="module" src="./preview.mjs"></script>','<script type="module">'+code+'</script>');
// Keep feature HTML inside the existing sandboxed Pages preview.
const injected='<script type="module">const b=document.createElement("button"),d=document.createElement("dialog");b.textContent="Rear designs";b.id="enemy-rear-review-open";b.style.cssText="position:fixed;right:12px;top:12px;z-index:2147483645;padding:10px;background:#252b28;color:#f1dfb8;border:1px solid #ac996e;border-radius:5px";d.style.cssText="width:96vw;height:94vh;max-width:none;max-height:none;padding:0;background:#111414;color:#eee";const close=document.createElement("button");close.textContent="Close review";close.style.cssText="position:absolute;right:12px;top:8px;z-index:2;padding:8px";close.onclick=()=>d.close();const frame=document.createElement("iframe");frame.title="Enemy rear design review";frame.style.cssText="width:100%;height:100%;border:0";frame.srcdoc='+json(html)+';d.append(close,frame);b.onclick=()=>d.showModal();document.body.append(b,d);</script>';
const original=await readFile(target,'utf8');if(original.includes('enemy-rear-review-open'))throw Error('Review already embedded');
const output=original.replace(/<\/body>/i,injected+'</body>');
await writeFile(target,output);
console.log(JSON.stringify({target,uniqueAssets:Object.keys(assets).length,embeddedAssetBytes:Object.values(assets).reduce((n,v)=>n+Buffer.byteLength(v),0),htmlBytes:Buffer.byteLength(output)}));
