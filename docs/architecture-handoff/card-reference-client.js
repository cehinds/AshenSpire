// Inject window.CARD_REFERENCE={config,registry} from card-reference.mjs.
// The existing gallery card() owns selection, inspection, targeting and WC4.
function resolveReferenceCardModel(definition){
 const id=typeof definition==='string'?definition:definition.id;
 const registry=CARD_REFERENCE.registry,chain=[],seen=new Set();let current=id;
 while(current){if(seen.has(current))throw new Error('Card reference inheritance cycle: '+current);seen.add(current);const entry=registry[current];if(!entry){if(current===id)current='WC0';else throw new Error('Missing card parent: '+current);continue}chain.unshift(entry);current=entry.parent}
 const model=Object.assign({},...chain,{id});
 if(model.costs)model.costs={...model.costs,...(CARD_REFERENCE.config.costs.sampleOverrides[id]||{}),...(typeof definition==='object'&&definition.projectedCosts?definition.projectedCosts:{})};
 model.visibleTags=(model.tags||[]).filter(tag=>Object.hasOwn(CARD_REFERENCE.config.tags,tag)).map(tag=>({id:tag,...CARD_REFERENCE.config.tags[tag]}));
 model.features=CARD_REFERENCE.config.features.filter(feature=>(model.construction||[]).includes(feature.tag)).sort((a,b)=>a.order-b.order);
 return model;
}
function cardReferenceEscape(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function referenceCardCostRows(model){
 const cfg=CARD_REFERENCE.config.costs;if(!model.costs)return [];
 return cfg.order.filter(id=>Object.hasOwn(cfg.providers,id)).flatMap(id=>{const provider=cfg.providers[id],value=id==='action'&&model.costs.variable?cfg.variableLabel:model.costs[id];return value!=null&&(cfg.showZero||value!==0)?[{id,...provider,value}]:[]});
}
function renderCardCosts(definition){
 const model=definition.costs?definition:resolveReferenceCardModel(definition),cfg=CARD_REFERENCE.config.costs,escape=cardReferenceEscape,rows=referenceCardCostRows(model);
 if(!rows.length)return '';
 const icons={diamond:'<path d="M12 2 22 12 12 22 2 12Z"/>',bolt:'<path d="M14 2 4 14h7l-1 8 10-13h-7Z"/>',droplet:'<path d="M12 2C9 7 4 11 4 16a8 8 0 0 0 16 0c0-5-5-9-8-14Z"/>'};
 return `<div class="card-costs" data-component="WC1.costs" aria-label="Card costs" style="--card-cost-header:${CARD_REFERENCE.config.geometry.bands.header}%;--card-cost-width:${cfg.railWidthRem}rem;--card-cost-inset:${cfg.insetRem}rem;--card-cost-gap:${cfg.gapRem}rem;--card-cost-font:${cfg.fontRem}rem;--card-cost-icon:${cfg.iconSizeRem}rem;--card-cost-outline:${escape(cfg.outlineColor)}">${rows.map(row=>`<span class="card-cost tag-tip-trigger" data-tag="${escape(row.label)}" data-tag-description="${escape(row.label+': '+row.value)}" aria-label="${escape(row.label+': '+row.value)}" style="color:${escape(row.color)}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[row.icon]||icons.diamond}</svg><strong>${escape(row.value)}</strong></span>`).join('')}</div>`;
}
function renderReferenceCardFace(definition,readonly=false){
 const m=resolveReferenceCardModel(definition),escape=cardReferenceEscape,cfg=CARD_REFERENCE.config;
 const renderers={rules:()=>`<p>${escape(m.rules)}</p>`,facts:()=>m.facts.slice(0,cfg.body.maximumPreviewFacts).map(([label,value])=>`<p><span>${escape(label)}: </span>${escape(value)}</p>`).join(''),availability:()=>m.availability?`<p>${escape(m.availability)}</p>`:''};
 const body=m.features.map(feature=>renderers[feature.component]?.()||'').join('');
 const tags=m.visibleTags.map(tag=>`<button type="button" class="tag-tip-trigger" data-tag="${escape(tag.label)}" data-tag-description="${escape(tag.description)}" aria-label="${escape(tag.label)}">${escape(tag.label)}</button>`).join(' ');
 return `<div class="cardbox${referenceCardCostRows(m).length?' has-card-costs':''}" data-card-model="${escape(m.id)}" style="--card-cost-width:${cfg.costs.railWidthRem}rem;--card-cost-inset:${cfg.costs.insetRem}rem"${readonly?'':` tabindex="0" role="button" aria-pressed="false" aria-label="Select ${escape(m.name)}"`}>${renderCardCosts(m)}<div class="cardband cardheader" data-component="WCI1"><span>${escape(m.name)}</span><span>${escape(m.headerState)}</span></div><div class="cardband cardart" data-component="WCI2"><span class="sigil" aria-hidden="true">${escape(m.glyph)}</span><span class="badges">${tags}</span></div><div class="cardband cardbody" data-component="WCF4">${body}${cfg.body.showFlavor?`<p><em>${escape(m.flavor)}</em></p>`:''}</div><div class="cardfooter" data-component="WCI3"><span>${escape(m.rarity)}</span><span>${m.owned==null?'':`${escape(cfg.metadata.ownedLabel)}: ${escape(m.owned)}`}</span></div></div>`;
}
function renderReferenceItemFacts(definition){
 const m=resolveReferenceCardModel(definition),escape=cardReferenceEscape;
 const facts=[['Type',m.kind],...referenceCardCostRows(m).map(row=>[row.label+' cost',row.value]),...m.facts,['Rarity',m.rarity],...(m.owned==null?[]:[['Owned',m.owned]]),...(m.availability?[['Availability',m.availability]]:[])];
 return `<section data-component="WCF4"><p>${escape(m.rules)}</p><dl class="reference-facts">${facts.map(([label,value])=>`<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>${m.visibleTags.length?`<h3>Properties</h3><dl class="reference-facts">${m.visibleTags.map(tag=>`<dt>${escape(tag.label)}</dt><dd>${escape(tag.description)}</dd>`).join('')}</dl>`:''}${m.flavor?`<h3>Lore</h3><p>${escape(m.flavor)}</p>`:''}<p>Illustrative reference values.</p></section>`;
}
