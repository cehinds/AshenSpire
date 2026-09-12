// Inject window.CARD_REFERENCE={config,registry} from card-reference.mjs.
// The existing gallery card() owns selection, inspection, targeting and WC4.
function resolveReferenceCardModel(definition){
 const id=typeof definition==='string'?definition:definition.id;
 const registry=CARD_REFERENCE.registry,chain=[],seen=new Set();let current=id;
 while(current){if(seen.has(current))throw new Error('Card reference inheritance cycle: '+current);seen.add(current);const entry=registry[current];if(!entry){if(current===id)current='WC0';else throw new Error('Missing card parent: '+current);continue}chain.unshift(entry);current=entry.parent}
 const model=Object.assign({},...chain,{id});
 model.visibleTags=(model.tags||[]).filter(tag=>Object.hasOwn(CARD_REFERENCE.config.tags,tag)).map(tag=>({id:tag,...CARD_REFERENCE.config.tags[tag]}));
 model.features=CARD_REFERENCE.config.features.filter(feature=>(model.construction||[]).includes(feature.tag)).sort((a,b)=>a.order-b.order);
 return model;
}
function cardReferenceEscape(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function renderReferenceCardFace(definition,readonly=false){
 const m=resolveReferenceCardModel(definition),escape=cardReferenceEscape,cfg=CARD_REFERENCE.config;
 const renderers={rules:()=>`<p>${escape(m.rules)}</p>`,facts:()=>m.facts.slice(0,cfg.body.maximumPreviewFacts).map(([label,value])=>`<p><span>${escape(label)}: </span>${escape(value)}</p>`).join(''),availability:()=>m.availability?`<p>${escape(m.availability)}</p>`:''};
 const body=m.features.map(feature=>renderers[feature.component]?.()||'').join('');
 const tags=m.visibleTags.map(tag=>`<button type="button" class="tag-tip-trigger" data-tag="${escape(tag.label)}" data-tag-description="${escape(tag.description)}" aria-label="${escape(tag.label)}">${escape(tag.label)}</button>`).join(' ');
 return `<div class="cardbox" data-card-model="${escape(m.id)}"${readonly?'':` tabindex="0" role="button" aria-pressed="false" aria-label="Select ${escape(m.name)}"`}><div class="cardband cardheader" data-component="WCI1"><span>${escape(m.name)}</span><span>${escape(m.headerState)}</span></div><div class="cardband cardart" data-component="WCI2"><span class="sigil" aria-hidden="true">${escape(m.glyph)}</span><span class="badges">${tags}</span></div><div class="cardband cardbody" data-component="WCF4">${body}${cfg.body.showFlavor?`<p><em>${escape(m.flavor)}</em></p>`:''}</div><div class="cardfooter" data-component="WCI3"><span>${escape(m.rarity)}</span><span>${m.owned==null?'':`${escape(cfg.metadata.ownedLabel)}: ${escape(m.owned)}`}</span></div></div>`;
}
function renderReferenceItemFacts(definition){
 const m=resolveReferenceCardModel(definition),escape=cardReferenceEscape;
 const facts=[['Type',m.kind],...m.facts,['Rarity',m.rarity],...(m.owned==null?[]:[['Owned',m.owned]]),...(m.availability?[['Availability',m.availability]]:[])];
 return `<section data-component="WCF4"><p>${escape(m.rules)}</p><dl class="reference-facts">${facts.map(([label,value])=>`<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>${m.visibleTags.length?`<h3>Properties</h3><dl class="reference-facts">${m.visibleTags.map(tag=>`<dt>${escape(tag.label)}</dt><dd>${escape(tag.description)}</dd>`).join('')}</dl>`:''}${m.flavor?`<h3>Lore</h3><p>${escape(m.flavor)}</p>`:''}<p>Illustrative reference values.</p></section>`;
}
