import {resetCardLayout,applyCardLayouts} from './cardLayout.js';
import {layoutMetrics} from '../layoutMetrics.js';
const ruleGeometry = new WeakMap();
// A face's fit is a pure function of its width, its text, its line budgets, the
// page scale and the loaded fonts, and a full fit is a search of many forced
// layouts. The inputs the last fit used are kept per face, and a face asked to
// fit again with the same inputs keeps the result it has (the hand refits every
// card on each render, and almost none of them changed).
const fitSignatures = new WeakMap();
let fontEpoch = 0, fontsWatched = false;
function watchFonts() {
  if (fontsWatched || typeof document === 'undefined' || !document.fonts?.addEventListener) return;
  fontsWatched = true;
  document.fonts.addEventListener('loadingdone', () => { fontEpoch++; });
}
function fitSignature(face, width) {
  const { fontSize, zoom } = layoutMetrics();
  const texts = [...face.querySelectorAll('.ic-text[data-auto-fit="true"]')]
    .map(text => `${text.dataset.maxLines}|${text.dataset.minFont}|${text.dataset.maxFont}|${text.dataset.cardBinding}`);
  return [width, fontEpoch, fontSize, zoom, face.className, face.parentElement?.className, face.dataset.designWidth,
    face.dataset.fullRules, face.dataset.cardLayoutId, face.querySelector('[data-face-overflow="true"]') ? 1 : 0,
    face.textContent, texts.join(',')].join('\u0001');
}

// Search every text in one batch. Complete effects use the authored readable
// floor, then borrow artwork height; names and costs keep their line budgets.
export function fitIllustratedCards(cards) {
  const faces=[];
  for(const card of cards){const face=card?.querySelector('.illustrated-card-face');if(face)faces.push(face);}
  watchFonts();
  const widths=faces.map(face=>face.clientWidth);
  const signatures=faces.map((face,i)=>widths[i]?fitSignature(face,widths[i]):null);
  const texts=[],skipped=new Set();
  const { zoom } = layoutMetrics();
  faces.forEach((face,i)=>{
    if(!widths[i])return;
    if(fitSignatures.get(face)===signatures[i]){skipped.add(face);return;}
    resetCardLayout(face);
    const scale=widths[i]/Number(face.dataset.designWidth);
    for(const text of face.querySelectorAll('.ic-text[data-auto-fit="true"]')){
      const rules=text.dataset.cardBinding==='rules';
      const layer=text.parentElement;
      // Compact faces show three semantic effects; each may wrap. Every
      // face can borrow artwork height before offering full inspection.
      const fullRules=face.dataset.fullRules==='true';
      const expandedHandRules=rules&&Number(text.dataset.maxLines)>3;
      const row={face,text,layer,scale,rules,fullRules,compact:rules&&!fullRules&&!expandedHandRules,
        // Semantic effect lines can wrap over multiple printed rows.
        lines:rules?Infinity:Number(text.dataset.maxLines)||1,
        hasHiddenLines:Boolean(face.querySelector('[data-face-overflow="true"]')),
        hasHiddenRules:face.dataset.rulesHidden==='true'};
      if(rules){
        // A previous clipped fit must not constrain this fit's measurements.
        text.style.maxHeight='none';layer.style.justifyContent='';
        row.cue=face.querySelector('.card-rules-inspect-cue');
        row.rankInset=0;
        row.panel=face.querySelector('[data-component="panel"]');
        row.panelTrim=face.querySelector('[data-component="panel-trim"]');
        row.rank=face.querySelector('.card-rank');
        row.art=face.querySelector('[data-component="art"]');
        if(!ruleGeometry.has(layer))ruleGeometry.set(layer,{top:layer.style.top,height:layer.style.height,panelTop:row.panel?.style.top,panelHeight:row.panel?.style.height,artHeight:row.art?.style.height});
        const original=ruleGeometry.get(layer);
        layer.style.top=original.top;layer.style.height=original.height;
        if(row.panel){row.panel.style.top=original.panelTop;row.panel.style.height=original.panelHeight;}
        if(row.panelTrim){row.panelTrim.style.top=original.panelTop;row.panelTrim.style.height=original.panelHeight;}
        if(row.art)row.art.style.height=original.artHeight;
        if(row.rank&&row.panel){
          row.rank.style.top=(parseFloat(row.panel.style.top)+Number(row.rank.dataset.panelInset))+'%';
        }
        text.style.display='block';
      }
      row.low=rules?Math.max(11/zoom,22*scale,Number(text.dataset.minFont)*scale):Number(text.dataset.minFont)*scale;
      row.high=Math.max(row.low,Number(text.dataset.maxFont)*scale);
      texts.push(row);
    }
  });
  if(!texts.length)return;
  // Reserve the rank header with separate measurement and mutation passes.
  // A collection can contain thousands of cards; interleaving these forces a
  // full layout for each card instead of once for the collection.
  for(const row of texts){
    if(!row.rank||!row.panel)continue;
    row.rankInset=Math.max(0,row.rank.offsetTop+row.rank.offsetHeight+4*row.scale-row.layer.offsetTop);
    row.rankTop=row.layer.offsetTop;row.rankHeight=row.layer.clientHeight;row.faceHeight=row.face.clientHeight;
  }
  for(const row of texts)if(row.rankInset){
    row.layer.style.top=(row.rankTop+row.rankInset)/row.faceHeight*100+'%';
    row.layer.style.height=Math.max(1,row.rankHeight-row.rankInset)/row.faceHeight*100+'%';
  }
  for(const row of texts)row.boxHeight=row.layer.clientHeight;
  // Measure the available bay BEFORE searching fonts. A preferred font may
  // need artwork space even when the original parchment bay is too short.
  // Geometry reads stay batched; resizing restarts from authored bounds.
  const rules=texts.filter(row=>row.rules);
  // Settle the rail at the preferred size before measuring its boundary.
  // Recomputing density after font reduction could expand the rail into
  // space already assigned to the parchment (and drift on the next resize).
  for(const row of rules)row.text.style.fontSize=row.high+'px';
  for(const row of rules)row.dense=row.text.scrollHeight>row.boxHeight*1.5;
  for(const row of rules)row.face.dataset.rulesDense=String(row.dense);
  for(const row of rules){
    row.height=row.face.clientHeight;row.top=row.layer.offsetTop;row.panelTop=row.panel?.offsetTop;row.panelHeight=row.panel?.clientHeight;row.artTop=row.art?.offsetTop;
    const title=row.face.querySelector('[data-card-binding="name"]');
    // Offsets stay in layout pixels, including the native UI zoom and rotated
    // hand. Mixing a screen rectangle with offsetTop shrinks this boundary.
    const titleBottom=title?title.parentElement.offsetTop+Math.max(title.parentElement.clientHeight,title.offsetTop+title.offsetHeight):0;
    const rail=row.face.querySelector('.card-tag-rail');
    const railBottom=rail?rail.offsetTop+rail.offsetHeight:0;
    row.rankSpace=0;
    // The centered rank can share a horizontal row with the narrow right rail.
    // Reserve its height below the title, while the panel stays below the rail.
    row.growthLimit=Math.max(0,Math.min(row.top,row.panelTop??row.top)-Math.max(titleBottom+row.rankSpace,railBottom)-Math.max(2,2*row.scale));
    // The parchment border scales with its image. Preserve its authored
    // interior margins as the panel grows, so text never sits on the ornament.
    // The rank's reserved header is a fixed-height anchor. Only the authored
    // parchment border grows with the panel; scaling the header again would
    // waste the extra room and clip dense effects on narrow cards.
    row.topInset=row.panelHeight?Math.max(0,(row.top-row.panelTop-row.rankInset)/row.panelHeight):0;
    const bottomInset=row.panelHeight?Math.max(0,(row.panelTop+row.panelHeight-row.top-row.boxHeight)/row.panelHeight):0;
    row.interiorScale=Math.max(.5,1-row.topInset-bottomInset);
    row.authoredHeight=row.boxHeight;
    row.boxHeight+=row.growthLimit*row.interiorScale;
  }
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
  for(const row of texts){
    row.text.style.fontSize=row.result+'px';
    row.overflow=row.compact&&(row.hasHiddenRules||row.hasHiddenLines);
    row.text.style.webkitLineClamp=row.rules?'unset':String(row.lines);
    row.text.style.display='block';
    row.text.dataset.fittedFont=String(row.result/row.scale);
    if(row.compact)row.face.dataset.rulesOverflow=String(row.overflow);
  }
  // Spend only the height the final font needs; a short card keeps its art.
  for(const row of rules){
    row.boxHeight=row.authoredHeight;row.extra=Math.min(row.growthLimit,Math.max(0,(row.text.scrollHeight-row.boxHeight)/row.interiorScale));row.face.dataset.rulesNarrowFit='false';
  }
  for(const row of rules){
    const {extra,height}=row;
    if(extra>1){
      row.layer.style.top=(row.top-extra*(1-row.topInset))/height*100+'%';row.layer.style.height=(row.boxHeight+extra*row.interiorScale)/height*100+'%';
      if(row.panel){row.panel.style.top=(row.panelTop-extra)/height*100+'%';row.panel.style.height=(row.panelHeight+extra)/height*100+'%';}
      if(row.panelTrim){row.panelTrim.style.top=row.panel.style.top;row.panelTrim.style.height=row.panel.style.height;}
      if(row.art)row.art.style.height=Math.max(0,row.panelTop-extra-row.artTop)/height*100+'%';
    }
    if(row.rank)row.rank.style.top=(parseFloat(row.panel.style.top)+Number(row.rank.dataset.panelInset))+'%';
    row.face.dataset.rulesExpanded=String(extra>1);
  }
  // The readable floor and available artwork may still be insufficient. Measure
  // the final bays together, then reserve an in-bay cue without losing any text.
  for(const row of rules){
    row.finalHeight=row.layer.clientHeight;
    row.cueHeight=Math.min(row.finalHeight,row.cue?.offsetHeight||0);
    row.overflow=Boolean(row.hasHiddenRules||row.hasHiddenLines||row.overflow
      ||row.text.scrollHeight>Math.min(row.finalHeight,row.text.clientHeight)+1
      ||row.text.scrollWidth>row.text.clientWidth+1);
  }
  for(const row of rules){
    row.text.style.maxHeight=row.overflow?`calc(100% - ${row.cueHeight}px)`:'100%';
    row.layer.style.justifyContent=row.overflow?'flex-start':'';
    row.text.dataset.rulesComplete=String(!row.overflow);
    row.face.dataset.rulesOverflow=String(row.overflow);
  }
  applyCardLayouts(faces.filter(face=>!skipped.has(face)));
  faces.forEach((face,i)=>{if(signatures[i]&&!skipped.has(face))fitSignatures.set(face,signatures[i]);});
}
