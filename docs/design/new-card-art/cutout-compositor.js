/* Plain script so the downloaded viewer also works directly from file://. */
(() => {
 'use strict';
 const data=window.CARD_CUTOUT_DATA, $=id=>document.getElementById(id);
 if(!data){$('error').textContent='The component data file is missing. Keep cutouts-data.js beside this viewer.';return;}
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const copy=value=>JSON.parse(JSON.stringify(value));
 const categories=[...data.categories].sort((a,b)=>(b.revision||3)-(a.revision||3));
 let category=categories.find(c=>c.letter===new URLSearchParams(location.search).get('category'))||categories[0], activeCode=category.letter+'00', current, kept={}, edits={};
 try{const saved=JSON.parse(localStorage.getItem('ashen-card-cutouts-families-v3')||'{}');kept=saved.kept||{};edits=saved.edits||{};}catch{}
 const fields=['rotationDeg','opacity','x','y','width','height','scaleX','scaleY'];
 const asset=id=>data.assets[id];
 function css(t){return {position:'absolute',left:`${t.x/512*100}%`,top:`${t.y/640*100}%`,width:`${t.width/512*100}%`,height:`${t.height/640*100}%`,objectFit:'contain',transformOrigin:'50% 50%',transform:`translate(-50%, -50%) rotate(${t.rotationDeg}deg) scale(${t.scaleX}, ${t.scaleY})`,opacity:String(t.opacity),mixBlendMode:t.blendMode,pointerEvents:'none'};}
 function resolved(layer){const a=asset(layer.assetId),t={...a.defaultTransform,...layer.overrides};return {...layer,src:a.src,transform:t,css:{...css(t),zIndex:String(layer.zIndex),display:layer.visible?'block':'none'}};}
 function save(){edits[activeCode]=copy(current);try{localStorage.setItem('ashen-card-cutouts-families-v3',JSON.stringify({kept,edits}));}catch{$('status').textContent='Browser storage is unavailable; export JSON to retain these edits.';}}
 function imageLayer(layer){const r=resolved(layer),img=document.createElement('img');img.src=r.src;img.alt='';img.dataset.layer=r.id;Object.assign(img.style,r.css);return img;}
 function paintStage(node,composition){node.replaceChildren(...composition.layers.map(imageLayer));}
 function syncEditor(){
  $('code').textContent=`${activeCode} · ${category.label}`;
  $('visibility').innerHTML=current.layers.map(l=>`<label><input type="checkbox" data-layer="${l.id}" ${l.visible?'checked':''}>${esc(l.id)}</label>`).join('');
  $('visibility').querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{current.layers.find(l=>l.id===input.dataset.layer).visible=input.checked;save();syncEditor();}));
  const r=resolved(current.layers.find(l=>l.id===$('layer').value));
  for(const field of fields)$(field).value=r.transform[field];
  $('blendMode').value=r.transform.blendMode;
  $('background').value=current.layers.find(l=>l.id==='background').assetId;
  const secondary=current.layers.find(l=>l.id==='secondaryObject');$('secondary-object').value=secondary.visible?secondary.assetId:'hidden';
  paintStage($('stage'),current);showJSON();renderKept();
 }
 function showJSON(){$('json').textContent=JSON.stringify(resolved(current.layers.find(l=>l.id===$('layer').value)),null,2);}
 function selectCode(code){activeCode=code;current=copy(edits[code]||data.compositions[code]);$('object').value=current.objectDigit;$('effect').value=current.effectDigit;syncEditor();}
 function toggleKeep(key,row){if(kept[key])delete kept[key];else kept[key]=row;save();renderKept();$('status').textContent=`${Object.keys(kept).length} choices kept.`;}
 function renderKept(){
  $('kept').innerHTML=Object.keys(kept).length?Object.entries(kept).map(([key,row])=>`<li>${esc(row.label)} <button data-remove="${esc(key)}" aria-label="Remove ${esc(row.label)}">Remove</button></li>`).join(''):'<li>No choices kept yet.</li>';
  $('kept').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{delete kept[b.dataset.remove];save();renderKept();}));
  for(const kind of ['object','effect','composition']){const id=kind==='composition'?activeCode:current.layers.find(l=>l.id===(kind==='object'?'object':'foreground')).assetId;$(`keep-${kind}`).setAttribute('aria-pressed',String(Boolean(kept[`${kind}:${id}`])));}
 }
 function candidateTile(a,kind){
  const ref=kind==='object'?`${a.category}${a.digit}0`:`${a.category}0${a.digit}`;
  const orientations=kind==='object'?`<div class="orientations">${[-25,0,25].map(angle=>`<figure><img loading="lazy" src="${a.src}" alt="Same object rotated ${angle} degrees" style="transform:rotate(${angle}deg)"><figcaption>${angle}°</figcaption></figure>`).join('')}</div>`:'';
  return `<article class="tile"><a href="${a.src}" target="_blank" rel="noopener"><img class="cutout" loading="lazy" src="${a.src}" alt="${esc(a.name)} — ${kind} ${a.digit} alone"></a><h3>${ref} · ${kind} view</h3><div class="small">${esc(a.name)} · other layer hidden</div>${orientations}<button data-use="${kind}:${a.digit}">Use ${category.secondaryObjectIds&&kind==='object'?'pair':kind} ${a.digit}</button><a href="${a.src}" download="${a.category}-${kind}-${a.digit}.png">PNG</a></article>`;
 }
 function renderCategory(){
  $('categories').innerHTML=categories.map(c=>`<button data-category="${c.letter}" aria-pressed="${c.letter===category.letter}">${c.letter} · ${esc(c.label)}</button>`).join('');
  $('categories').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{category=data.categories.find(c=>c.letter===b.dataset.category);renderCategory();}));
  $('object').innerHTML=category.objectIds.map(id=>{const a=asset(id);return `<option value="${a.digit}">${a.digit} — ${esc(a.name)}</option>`;}).join('');
  $('effect').innerHTML=category.effectIds.map(id=>{const a=asset(id);return `<option value="${a.digit}">${a.digit} — ${esc(a.name)}</option>`;}).join('');
  selectCode(`${category.letter}00`);
  $('object-heading').textContent=category.secondaryObjectIds?'Shield components alone':'Objects alone';
  $('pair-note').hidden=!category.secondaryObjectIds;
  $('paired-objects').hidden=!category.secondaryObjectIds;
  $('paired-objects').innerHTML=category.secondaryObjectIds?'<h2>Sword components alone</h2><div class="grid">'+category.secondaryObjectIds.map(id=>{const a=asset(id);return `<article class="tile"><a href="${a.src}" download><img class="cutout" src="${a.src}" alt="${esc(a.name)}"></a><h3>${a.category}${a.digit}0 · sword alone</h3><a href="${a.src}" download>PNG</a></article>`;}).join('')+'</div>':'';
  $('objects').innerHTML=category.objectIds.map(id=>candidateTile(asset(id),'object')).join('');
  $('effects').innerHTML=category.effectIds.map(id=>candidateTile(asset(id),'effect')).join('');
  document.querySelectorAll('[data-use]').forEach(b=>b.addEventListener('click',()=>{const [kind,digit]=b.dataset.use.split(':');selectCode(`${category.letter}${kind==='object'?digit:current.objectDigit}${kind==='effect'?digit:current.effectDigit}`);$('stage').scrollIntoView({behavior:'smooth',block:'center'});}));
  $('examples').innerHTML=category.exampleCodes.map(code=>`<article class="tile"><div class="stage" data-code="${code}" aria-label="${code} assembled preview"></div><h3>${code}</h3><button data-compose="${code}">Edit ${code}</button></article>`).join('');
  $('examples').querySelectorAll('[data-code]').forEach(node=>paintStage(node,edits[node.dataset.code]||data.compositions[node.dataset.code]));
  $('examples').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{selectCode(b.dataset.compose);$('stage').scrollIntoView({behavior:'smooth',block:'center'});}));
 }
 $('secondary-object').innerHTML='<option value="hidden">Hidden</option>'+Object.values(data.assets).filter(a=>a.kind==='object').map(a=>`<option value="${a.id}">${a.category}${a.digit} · ${esc(a.name)}</option>`).join('');
 $('secondary-object').addEventListener('change',()=>{const l=current.layers.find(l=>l.id==='secondaryObject'),v=$('secondary-object').value;l.visible=v!=='hidden';if(l.visible)l.assetId=v;save();syncEditor();});
 const backgrounds=Object.values(data.assets).filter(a=>a.kind==='background');
 $('background').innerHTML=backgrounds.map(a=>`<option value="${a.id}">${a.digit} — ${esc(a.name)}</option>`).join('');
 $('backgrounds').innerHTML=backgrounds.map(a=>`<article class="tile"><a href="${a.src}" download="background-${a.digit}.png"><img class="cutout" loading="lazy" src="${a.src}" alt="${esc(a.name)} background"></a><h3>Background ${a.digit}</h3><p class="small">${esc(a.name)}</p><a href="${a.src}" download>PNG</a></article>`).join('');
 for(const id of ['object','effect'])$(id).addEventListener('change',()=>selectCode(`${category.letter}${$('object').value}${$('effect').value}`));
 $('background').addEventListener('change',()=>{current.layers.find(l=>l.id==='background').assetId=$('background').value;save();syncEditor();});
 $('layer').addEventListener('change',syncEditor);
 for(const field of fields)$(field).addEventListener('input',()=>{const input=$(field),n=Number(input.value);if(input.value===''||!Number.isFinite(n))return;const value=Math.min(Number(input.max),Math.max(Number(input.min),n));current.layers.find(l=>l.id===$('layer').value).overrides[field]=value;save();paintStage($('stage'),current);showJSON();});
 $('blendMode').addEventListener('change',()=>{current.layers.find(l=>l.id===$('layer').value).overrides.blendMode=$('blendMode').value;save();paintStage($('stage'),current);showJSON();});
 $('reset').addEventListener('click',()=>{delete edits[activeCode];current=copy(data.compositions[activeCode]);save();syncEditor();});
 for(const kind of ['object','effect','composition'])$(`keep-${kind}`).addEventListener('click',()=>{
  const id=kind==='composition'?activeCode:current.layers.find(l=>l.id===(kind==='object'?'object':'foreground')).assetId;
  toggleKeep(`${kind}:${id}`,{kind,id,label:kind==='composition'?`${activeCode} composition`:`${category.letter} ${kind} ${asset(id).digit} — ${asset(id).name}`});
 });
 $('clear').addEventListener('click',()=>{kept={};save();renderKept();});
 $('export').addEventListener('click',()=>{
  save();const choices=Object.values(kept),needed=new Set(),compositions={};
  const codes=new Set([activeCode,...choices.filter(r=>r.kind==='composition').map(r=>r.id)]);
  for(const code of codes){const c=copy(edits[code]||data.compositions[code]);c.layers=c.layers.map(layer=>{needed.add(layer.assetId);return resolved(layer);});compositions[code]=c;}
  for(const row of choices)if(row.kind!=='composition')needed.add(row.id);
  const result={formatVersion:1,coordinateSpace:data.coordinateSpace,codeScheme:data.codeScheme,references:data.references,keptChoices:choices,assets:Object.fromEntries([...needed].map(id=>[id,asset(id)])),compositions};
  const blob=new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='card-art-selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='Exported kept choices, PNG references, transforms and CSS.';
 });
 renderCategory();
})();
