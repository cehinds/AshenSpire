const ruleGeometry = new WeakMap();

// Search every text in one batch. Complete effects use the authored readable
// floor, then borrow artwork height; names and costs keep their line budgets.
export function fitIllustratedCards(cards) {
  const faces=[];
  for(const card of cards){const face=card?.querySelector('.illustrated-card-face');if(face)faces.push(face);}
  const widths=faces.map(face=>face.clientWidth);
  const texts=[];
  faces.forEach((face,i)=>{
    if(!widths[i])return;
    const scale=widths[i]/Number(face.dataset.designWidth);
    for(const text of face.querySelectorAll('.ic-text[data-auto-fit="true"]')){
      const rules=text.dataset.cardBinding==='rules';
      const layer=text.parentElement;
      const row={face,text,layer,scale,rules,lines:rules?Infinity:Number(text.dataset.maxLines)||1};
      if(rules){
        row.panel=face.querySelector('[data-component="panel"]');
        row.art=face.querySelector('[data-component="art"]');
        if(!ruleGeometry.has(layer))ruleGeometry.set(layer,{top:layer.style.top,height:layer.style.height,panelTop:row.panel?.style.top,panelHeight:row.panel?.style.height,artHeight:row.art?.style.height});
        const original=ruleGeometry.get(layer);
        layer.style.top=original.top;layer.style.height=original.height;
        if(row.panel){row.panel.style.top=original.panelTop;row.panel.style.height=original.panelHeight;}
        if(row.art)row.art.style.height=original.artHeight;
        text.style.display='block';
      }
      row.low=rules?Math.max(Math.min(11,widths[i]/12),22*scale,Number(text.dataset.minFont)*scale):Number(text.dataset.minFont)*scale;
      row.high=Math.max(row.low,Number(text.dataset.maxFont)*scale);
      texts.push(row);
    }
  });
  if(!texts.length)return;
  for(const row of texts)row.boxHeight=row.layer.clientHeight;
  const probe=(list,sizeOf)=>{
    for(const row of list){row.text.style.webkitLineClamp='unset';row.text.style.fontSize=sizeOf(row)+'px';}
    return list.map(row=>row.text.scrollHeight<=Math.min(row.boxHeight,sizeOf(row)*1.25*row.lines)+1&&row.text.scrollWidth<=row.text.clientWidth+1);
  };
  const atHigh=probe(texts,row=>row.high);
  const search=[];
  texts.forEach((row,i)=>{if(atHigh[i])row.result=row.high;else{row.lo=row.low;row.hi=row.high;search.push(row);}});
  for(let pass=0;pass<7&&search.length;pass++){
    const mid=row=>(row.lo+row.hi)/2;
    const fits=probe(search,mid);
    search.forEach((row,i)=>{const size=mid(row);if(fits[i])row.lo=size;else row.hi=size;});
  }
  for(const row of search)row.result=row.lo;
  for(const row of texts){row.text.style.fontSize=row.result+'px';row.text.style.webkitLineClamp=row.rules?'unset':String(row.lines);row.text.dataset.fittedFont=String(row.result/row.scale);}
  // Measure the whole batch before expanding any panel. No per-card search or
  // layout loop, and a resize starts from authored geometry rather than drift.
  const rules=texts.filter(row=>row.rules),narrow=[];
  for(const row of rules){
    row.height=row.face.clientHeight;row.top=row.layer.offsetTop;row.panelTop=row.panel?.offsetTop;row.panelHeight=row.panel?.clientHeight;row.artTop=row.art?.offsetTop;
    const title=row.face.querySelector('[data-card-binding="name"]');
    const titleBottom=title?title.getBoundingClientRect().bottom-row.face.getBoundingClientRect().top:0;
    row.growthLimit=Math.max(0,Math.min(row.top,row.panelTop??row.top)-titleBottom-2*row.scale);
    row.authoredHeight=row.boxHeight;
    if(row.text.scrollHeight>row.boxHeight+row.growthLimit+1){
      // Supported narrow shelves use the authored minimum only after the
      // preferred floor and all available artwork space have been spent.
      row.lo=Math.min(row.result,Number(row.text.dataset.minFont)*row.scale);
      row.hi=row.result;row.boxHeight+=row.growthLimit;narrow.push(row);
    }
  }
  for(let pass=0;pass<7&&narrow.length;pass++){
    const mid=row=>(row.lo+row.hi)/2,fits=probe(narrow,mid);
    narrow.forEach((row,i)=>{const size=mid(row);if(fits[i])row.lo=size;else row.hi=size;});
  }
  for(const row of narrow){row.result=row.lo;row.text.style.fontSize=row.result+'px';row.text.dataset.fittedFont=String(row.result/row.scale);}
  for(const row of rules){row.boxHeight=row.authoredHeight;row.extra=Math.min(row.growthLimit,Math.max(0,row.text.scrollHeight-row.boxHeight));row.face.dataset.rulesNarrowFit=String(narrow.includes(row));}
  for(const row of rules){
    const {extra,height}=row;
    if(extra>1){
      row.layer.style.top=(row.top-extra)/height*100+'%';row.layer.style.height=(row.boxHeight+extra)/height*100+'%';
      if(row.panel){row.panel.style.top=(row.panelTop-extra)/height*100+'%';row.panel.style.height=(row.panelHeight+extra)/height*100+'%';}
      if(row.art)row.art.style.height=Math.max(0,row.panelTop-extra-row.artTop)/height*100+'%';
    }
    row.face.dataset.rulesExpanded=String(extra>1);row.text.dataset.rulesComplete='true';
  }
}
