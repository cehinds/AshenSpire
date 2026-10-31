import {resetCardLayout,applyCardLayouts} from './cardLayout.js';
import {layoutMetrics} from '../layoutMetrics.js';
const ruleGeometry = new WeakMap();
// A face's fit is a pure function of its width, its text, its line budgets, the
// page scale and the loaded fonts, and a full fit is a search of many forced
// layouts. The inputs the last fit used are kept per face, and a face asked to
// fit again with the same inputs keeps the result it has (the hand refits every
// card on each render, and almost none of them changed).
const fitSignatures = new WeakMap();
// The font size a text row settled on, by everything the search read: the face's
// signature (width, text, fonts, scale), the row's place in the face, its box and
// its bounds. A hand re-render rebuilds a card's face whenever its preview or
// affordability moves, with the same text at the same size, and the 7-pass
// search (a forced layout per pass) found the same answer each time.
const fitResults = new Map();
const FIT_RESULTS_MAX = 800;
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

// Search fonts inside the authored bays. Text must never resize the parchment
// or consume artwork; names and costs retain their line budgets.
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
    let textIndex=0;
    for(const text of face.querySelectorAll('.ic-text[data-auto-fit="true"]')){
      const rules=text.dataset.cardBinding==='rules';
      const layer=text.parentElement;
      // Compact faces show three semantic effects; each may wrap inside
      // the same authored rules bay.
      const fullRules=face.dataset.fullRules==='true';
      const expandedHandRules=rules&&Number(text.dataset.maxLines)>3;
      const row={face,text,layer,scale,rules,signature:signatures[i],textIndex:textIndex++,fullRules,lineHeight:rules&&!fullRules?1.05:1.25,compact:rules&&!fullRules&&!expandedHandRules,
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
        // Two short benefit rows remain readable in the narrow native hand bay.
        text.style.lineHeight=String(row.lineHeight);
      }
      // Rules may shrink below the design font minimum, but never below
      // eleven on-screen pixels after the page's native zoom.
      row.low=rules?11/zoom:Number(text.dataset.minFont)*scale;
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
  for(const row of texts)row.fitKey=[row.signature,row.textIndex,row.boxHeight,row.low,row.high,row.lineHeight,row.lines,row.rankInset].join('\u0002');
  // A face is taken from the cache only whole: its rows then all keep their old answer.
  const unknownFaces=new Set(texts.filter(row=>!fitResults.has(row.fitKey)).map(row=>row.face));
  for(const row of texts)if(!unknownFaces.has(row.face))row.result=fitResults.get(row.fitKey);
  const measured=texts.filter(row=>unknownFaces.has(row.face));
  const rules=texts.filter(row=>row.rules);
  for(const row of rules)row.face.dataset.rulesDense='false';
  const probe=(list,sizeOf)=>{
    for(const row of list){row.text.style.webkitLineClamp='unset';row.text.style.fontSize=sizeOf(row)+'px';}
    return list.map(row=>row.text.scrollHeight<=Math.min(row.boxHeight,sizeOf(row)*row.lineHeight*row.lines)+1&&row.text.scrollWidth<=row.text.clientWidth+1);
  };
  const atHigh=probe(measured,row=>row.high);
  const search=[];
  measured.forEach((row,i)=>{if(atHigh[i])row.result=row.high;else{row.lo=row.low;row.hi=row.high;search.push(row);}});
  for(let pass=0;pass<7&&search.length;pass++){
    const mid=row=>(row.lo+row.hi)/2;
    const fits=probe(search,mid);
    search.forEach((row,i)=>{const size=mid(row);if(fits[i])row.lo=size;else row.hi=size;});
  }
  for(const row of search)row.result=row.lo;
  for(const row of measured){
    if(fitResults.size>=FIT_RESULTS_MAX)fitResults.delete(fitResults.keys().next().value);
    fitResults.set(row.fitKey,row.result);
  }
  for(const row of texts){
    row.text.style.fontSize=row.result+'px';
    row.overflow=row.compact&&(row.hasHiddenRules||row.hasHiddenLines);
    row.text.style.webkitLineClamp=row.rules?'unset':String(row.lines);
    row.text.style.display='block';
    row.text.dataset.fittedFont=String(row.result/row.scale);
    if(row.compact)row.face.dataset.rulesOverflow=String(row.overflow);
  }
  for(const row of rules){
    row.face.dataset.rulesExpanded='false';
    row.face.dataset.rulesNarrowFit='false';
  }
  // Content beyond the readable floor remains available through inspection.
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
