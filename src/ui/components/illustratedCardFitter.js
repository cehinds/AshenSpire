import {resetCardLayout,applyCardLayouts} from './cardLayout.js';
import {setData,setStyle} from '../domWrite.js';
import {layoutMetrics} from '../layoutMetrics.js';
import {uiConfig} from '../../config/generated/ui.js';
import {FACE_BUDGET} from '../../model/cardFaceBudget.js';
// Tunables live in content/config/ui/components/card.json (components.rulesFace.rulesText).
const FACE_TEXT=uiConfig.components.card.components?.rulesFace?.rulesText||{};
const RULES_MIN_PX=Number(FACE_TEXT.minPx)||6;
// On a phone (playtest 2026-11-17 item 39) card rules text runs phoneShrinkPt (CSS points, 4/3 px each) smaller and
// shows in full: no two-line glance budget, the rules fill their bay instead.
const PHONE_SHRINK_PX=(Number(FACE_TEXT.phoneShrinkPt)||0)*4/3;
const isPhoneLayout=()=>typeof document!=='undefined'&&document.documentElement?.dataset?.formFactor==='mobile';
const LINE_HEIGHT_FLOOR=Number(FACE_TEXT.lineHeightFloor)||0.92;
const LINE_HEIGHT_STEP=Number(FACE_TEXT.lineHeightStep)||0.04;
// Owner, 2026-11-17: the rules box holds up to boxLines lines of 20-25 characters inside paddingPx of inner padding,
// with no bleed. When the configured floor (minPx) cannot hold the face in that many lines, the floor drops to the size
// that does, never under hardMinPx on screen.
const RULES_BOX_LINES=Number(FACE_TEXT.boxLines)||4;
const RULES_PADDING_PX=Number(FACE_TEXT.paddingPx)>=0?Number(FACE_TEXT.paddingPx):1;
const RULES_HARD_MIN_PX=Number(FACE_TEXT.hardMinPx)||6;
// A smaller font that stops a single word standing alone on a line above the last: tried in steps of this share,
// down to LONE_WORD_FLOOR of the row's floor (never under the hard minimum).
const LONE_WORD_STEP=0.94, LONE_WORD_STEPS=8, LONE_WORD_FLOOR=0.8;
const ruleGeometry = new WeakMap();
// A rules row may carry two readings as inert <template>s (illustratedCard.js): the compact one it shows by default and a
// fuller "roomy" one. showReading swaps the visible clauses between them. The compact nodes are the painted ones (card.js
// binds the damage receipt to their numbers), so they are never cloned: they are set aside while the roomy reading shows
// and put back as they were. The roomy nodes are fresh clones, so the row announces `facereadingchange` for card.js to bind them.
const readings = new WeakMap();
export function showReading(text,reading){
  if(!text.childNodes||!text.querySelector)return false;
  let state=readings.get(text);
  const roomyShown=Boolean(state?.roomy?.length&&state.roomy[0].parentNode===text);
  if(reading==='compact'){
    if(roomyShown){
      for(const node of state.roomy)node.remove();
      state.roomy=null;
      const first=text.firstChild;
      for(const node of state.compact)text.insertBefore(node,first);
    }else{
      // Compact is on show (or the row was rewritten in place): what is there now is the painted reading.
      readings.set(text,{compact:[...text.childNodes].filter(node=>node.nodeName!=='TEMPLATE'),roomy:null});
    }
    text.dataset.faceReading='compact';
    return Boolean(text.querySelector?.(':scope > template[data-face-roomy]'));
  }
  const source=text.querySelector?.(':scope > template[data-face-roomy]');
  if(!source)return false;
  if(!state||roomyShown||state.compact.some(node=>node.parentNode!==text)){
    // Reached without a compact pass first: record what shows now.
    showReading(text,'compact');state=readings.get(text);
  }
  for(const node of state.compact)node.remove();
  const clone=source.content.cloneNode(true);
  for(const line of clone.querySelectorAll('[data-reading-line]')){line.classList.add('face-line');line.removeAttribute('data-reading-line');}
  state.roomy=[...clone.childNodes];
  text.insertBefore(clone,text.firstChild);
  text.dataset.faceReading='roomy';
  return true;
}
// The roomy reading uses the configured floor with the same phone reduction as the compact reading.
// A face whose full size is already below that keeps its full size as the floor.
// Owner, 2026-11-17: the box holds four lines of 20-25 characters, so the absolute floor gives way to `boxLines`, the size
// at which the roomy lines fill the box, never under FACE_BUDGET.boxMinPx on screen; the share of the full size (minScale) still holds.
export function roomyFloor(high,low,zoom,phoneShrink=0,boxLines=Infinity){
  const minimumOnScreen=Math.min(FACE_BUDGET.minPx-phoneShrink,Math.max(FACE_BUDGET.boxMinPx,boxLines*zoom));
  return Math.min(high,Math.max(low,high*FACE_BUDGET.minScale,Math.min(minimumOnScreen/zoom,high)));
}
/**
 * True when a rendered rules row has a line of one word above its last line (owner, 2026-11-17: only the last line
 * may hold a single word). A word may span text nodes ("1" in a number span, then "."); its line is its first character's.
 */
export function HasLoneWordLine(text){
  const doc=text?.ownerDocument;
  if(!doc?.createTreeWalker||!doc.createRange)return false;
  const nodes=[];let all='';
  const walker=doc.createTreeWalker(text,4);
  for(let node=walker.nextNode();node;node=walker.nextNode()){nodes.push([node,all.length]);all+=node.data;}
  const lines=[];
  for(const match of all.matchAll(/\S+/g)){
    let i=nodes.length-1;while(i>0&&nodes[i][1]>match.index)i--;
    const range=doc.createRange();range.setStart(nodes[i][0],match.index-nodes[i][1]);range.setEnd(nodes[i][0],match.index-nodes[i][1]+1);
    const rect=range.getClientRects()[0];if(!rect)continue;
    const last=lines[lines.length-1];
    if(last&&Math.abs(rect.top-last.top)<rect.height/2)last.words++;else lines.push({top:rect.top,words:1});
  }
  return lines.slice(0,-1).some(line=>line.words===1);
}
// Surface rules adjustments share the existing phone reduction, rather than
// stacking with it. Names, costs and inspection outside that surface keep their bounds.
const surfaceRulesReduction = face => Math.max(0, parseFloat(getComputedStyle(face).getPropertyValue('--card-rules-font-reduction-px')) || 0);
const rulesFontReduction = (phoneShrink, surfaceReduction) => Math.max(phoneShrink, surfaceReduction);
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
  return [width, fontEpoch, fontSize, zoom, isPhoneLayout() ? 'phone' : '', surfaceRulesReduction(face), face.className, face.parentElement?.className, face.dataset.designWidth,
    face.dataset.fullRules, face.dataset.cardLayoutId, face.querySelector('[data-face-overflow="true"]') ? 1 : 0,
    face.textContent, texts.join(',')].join('\u0001');
}

// Search fonts inside the authored bays. Text must never resize the parchment
// or consume artwork; names and costs retain their line budgets.
// One shared ResizeObserver refits a face whose own box changes (window resize, zoom, a selected card
// growing, a modal opening) and every watched face once the fonts are ready; batched in one frame, and
// faces that are off the page or hidden (width 0) are skipped by the fit itself. The observer measures the
// face's layout box, which the hand's rotate/scale transforms do not change.
// face -> its CURRENT card (a reused face moves to a new card element); liveFaces is the strong set the fonts
// pass walks, pruned whenever a face is found detached, so removed faces are released.
const faceCards = new WeakMap(), liveFaces = new Set(), pendingRefit = new Set();
let refitFrame = 0, sizeObserver = null, fontsAwaited = false;
function scheduleRefit(card) {
  pendingRefit.add(card);
  if (refitFrame || typeof requestAnimationFrame !== 'function') return;
  refitFrame = requestAnimationFrame(() => {
    refitFrame = 0;
    const batch = [...pendingRefit].filter(c => c.isConnected); pendingRefit.clear();
    if (batch.length) fitIllustratedCards(batch);
  });
}
function releaseFace(face) {
  liveFaces.delete(face); faceCards.delete(face); sizeObserver?.unobserve(face);
}
function watchFaces(pairs) {
  for (const face of [...liveFaces]) if (!face.isConnected) releaseFace(face);   // removed while hidden: no resize callback ever comes
  if (typeof ResizeObserver === 'function' && !sizeObserver) {
    sizeObserver = new ResizeObserver(list => {
      for (const e of list) {
        const face = e.target;
        if (!face.isConnected) { releaseFace(face); continue; }
        const card = faceCards.get(face);
        if (card && e.contentRect.width > 0) scheduleRefit(card);
      }
    });
  }
  for (const [card, face] of pairs) {
    if (typeof face.nodeType !== 'number') continue;
    faceCards.set(face, card);                       // every call: a reused face now belongs to this card
    if (!liveFaces.has(face)) { liveFaces.add(face); sizeObserver?.observe(face); }
  }
  if (!fontsAwaited && typeof document !== 'undefined' && document.fonts?.ready) {
    fontsAwaited = true;
    document.fonts.ready.then(() => {
      fontEpoch++;
      for (const face of [...liveFaces]) { if (!face.isConnected) { releaseFace(face); continue; } const card = faceCards.get(face); if (card?.isConnected) scheduleRefit(card); }
    }).catch(() => {});
  }
}

export function fitIllustratedCards(cards) {
  const faces=[],pairs=[];
  for(const card of cards){const face=card?.querySelector('.illustrated-card-face');if(face){faces.push(face);pairs.push([card,face]);}}
  watchFaces(pairs);
  watchFonts();
  const widths=faces.map(face=>face.clientWidth);
  const signatures=faces.map((face,i)=>widths[i]?fitSignature(face,widths[i]):null);
  const texts=[],skipped=new Set();
  const { zoom } = layoutMetrics();
  const phone=isPhoneLayout();
  const phoneShrink=phone?PHONE_SHRINK_PX:0;
  faces.forEach((face,i)=>{
    if(!widths[i])return;
    if(fitSignatures.get(face)===signatures[i]){skipped.add(face);return;}
    resetCardLayout(face);
    const scale=widths[i]/Number(face.dataset.designWidth);
    const fontReduction=rulesFontReduction(phoneShrink,surfaceRulesReduction(face));
    let textIndex=0;
    for(const text of face.querySelectorAll('.ic-text[data-auto-fit="true"]')){
      const rules=text.dataset.cardBinding==='rules';
      const layer=text.parentElement;
      const hasRoomy=rules&&showReading(text,'compact')&&Boolean(text.querySelector(':scope > template[data-face-roomy]'));
      const clauses=[...(text.querySelectorAll?.('[data-face-clause]')||[])];
      const bounded=text.dataset.faceLines==='true'&&clauses.length>0;
      const fullRules=face.dataset.fullRules==='true';
      const expandedHandRules=rules&&Number(text.dataset.maxLines)>3;
      // Rules on a face hold at most RULES_BOX_LINES rendered lines (owner, 2026-11-17); a complete-rules face reads as long as it is.
      const row={face,text,layer,scale,rules,bounded,clauses,signature:signatures[i],textIndex:textIndex++,fullRules,lineHeight:rules&&!fullRules?1.05:1.25,compact:rules&&!fullRules&&!expandedHandRules,
        lines:rules?(fullRules?Infinity:RULES_BOX_LINES):Number(text.dataset.maxLines)||1,pad:rules?RULES_PADDING_PX/zoom:0,
        hasHiddenLines:Boolean(face.querySelector('[data-face-overflow="true"]')),
        hasHiddenRules:face.dataset.rulesHidden==='true',hasRoomy};
      if(bounded){
        for(const clause of clauses)clause.style.display='';
      }
      if(rules){
        // A previous clipped fit must not constrain this fit's measurements.
        text.style.maxHeight='none';layer.style.justifyContent='';
        // A previous fit's ellipsis clamp must not outlive the need for it.
        text.style.overflow='';text.style.textOverflow='';text.style.webkitBoxOrient='';text.style.webkitLineClamp='unset';
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
        text.style.padding=row.pad+'px';text.style.boxSizing='border-box';
      }
      // Rules shrink until they fit their box, down to the configured on-screen
      // floor (rulesText.minPx). They used to stop at eleven on-screen pixels
      // and then overflow the parchment on a phone-sized card (owner 2026-11-04).
      row.fontReduction=rules?fontReduction:0;
      row.low=rules?Math.max(1,RULES_MIN_PX-row.fontReduction)/zoom:Number(text.dataset.minFont)*scale;
      row.high=Math.max(row.low,Number(text.dataset.maxFont)*scale-row.fontReduction/zoom);
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
  // A face's rules may go under the configured floor to the largest size that holds them in RULES_BOX_LINES lines inside
  // the box (the search below finds it), never under RULES_HARD_MIN_PX on screen. The floor still governs the roomy reading.
  for(const row of texts)if(row.rules&&!row.fullRules){
    row.low=Math.min(row.low,RULES_HARD_MIN_PX/zoom);
    row.high=Math.max(row.high,row.low);
  }
  // THE ROOMY READING, IF IT FITS. Each roomy-capable row tries its fuller text at the floor font in three phases (write
  // them all, read them all, put back the ones that did not fit) so a hand costs two layouts, not two per card.
  const roomyRows=texts.filter(row=>row.hasRoomy);
  for(const row of roomyRows){
    // One pixel spare inside the padding: scrollHeight rounds.
    row.floor=roomyFloor(row.high,row.low,zoom,row.fontReduction,(row.boxHeight-2*row.pad-1)/(FACE_BUDGET.lines*row.lineHeight));
    showReading(row.text,'roomy');
    Object.assign(row.text.style,{maxHeight:'none',lineHeight:String(row.lineHeight),fontSize:row.floor+'px',webkitLineClamp:'unset'});
  }
  for(const row of roomyRows){
    const lineBox=row.floor*row.lineHeight;
    // No rounding pixel on the box: a roomy reading that only fits by one is not shown (owner, 2026-11-17: no bleed).
    row.roomy=row.text.scrollHeight<=row.boxHeight&&row.text.scrollWidth<=row.text.clientWidth+1
      &&row.text.scrollHeight<=lineBox*FACE_BUDGET.lines+2*row.pad+1;
  }
  for(const row of roomyRows){
    if(!row.roomy)showReading(row.text,'compact');
    else row.low=Math.max(row.low,row.floor);
    row.clauses=[...row.text.querySelectorAll('[data-face-clause]')];
    row.face.dataset.rulesRoomy=String(row.roomy);
    if(row.roomy)row.text.dispatchEvent(new CustomEvent('facereadingchange',{bubbles:true}));
  }
  for(const row of texts)row.fitKey=[row.signature,row.textIndex,row.boxHeight,row.low,row.high,row.lineHeight,row.lines,row.rankInset,row.roomy?1:0].join('\u0002');
  // A face is taken from the cache only whole: its rows then all keep their old answer.
  const unknownFaces=new Set(texts.filter(row=>!fitResults.has(row.fitKey)).map(row=>row.face));
  for(const row of texts)if(!unknownFaces.has(row.face))row.result=fitResults.get(row.fitKey);
  const measured=texts.filter(row=>unknownFaces.has(row.face));
  const rules=texts.filter(row=>row.rules&&!row.bounded);
  for(const row of rules)row.face.dataset.rulesDense='false';
  const probe=(list,sizeOf)=>{
    for(const row of list){row.text.style.webkitLineClamp='unset';row.text.style.fontSize=sizeOf(row)+'px';}
    // A rules row gets no rounding pixel: its box is the parchment, and a pixel over is a bleed (owner, 2026-11-17).
    // The line count allows scrollHeight's rounding pixel; the box itself does not (a pixel over the parchment is a bleed).
    return list.map(row=>row.text.scrollHeight<=row.boxHeight+(row.rules&&!row.fullRules?0:1)&&row.text.scrollHeight<=sizeOf(row)*row.lineHeight*row.lines+2*row.pad+1&&row.text.scrollWidth<=row.text.clientWidth+1);
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
  // Owner, 2026-11-17: only the last line may hold a single word. A face that shows one above it tries a slightly
  // smaller font (every such row written, then read, per step), a little under its floor if need be, and keeps its size if none helps.
  let lonely=measured.filter(row=>row.rules&&!row.fullRules);
  for(const row of lonely)row.text.style.fontSize=row.result+'px';
  lonely=lonely.filter(row=>HasLoneWordLine(row.text));
  for(const row of lonely){row.widest=row.result;row.loneFloor=Math.max(RULES_HARD_MIN_PX/zoom,row.low*LONE_WORD_FLOOR);}
  for(let step=0;step<LONE_WORD_STEPS&&lonely.length;step++){
    for(const row of lonely){row.result=Math.max(row.loneFloor,row.result*LONE_WORD_STEP);row.text.style.fontSize=row.result+'px';}
    lonely=lonely.filter(row=>{
      if(!HasLoneWordLine(row.text))return false;
      if(row.result>row.loneFloor)return true;
      row.result=row.widest;return false;
    });
  }
  for(const row of lonely)row.result=row.widest;
  for(const row of measured){
    if(fitResults.size>=FIT_RESULTS_MAX)fitResults.delete(fitResults.keys().next().value);
    fitResults.set(row.fitKey,row.result);
  }
  for(const row of texts){
    setStyle(row.text,'fontSize',row.result+'px');
    row.overflow=row.compact&&(row.hasHiddenRules||row.hasHiddenLines);
    setStyle(row.text,'webkitLineClamp',row.rules?'unset':String(row.lines));
    setStyle(row.text,'display','block');
    setData(row.text,'fittedFont',String(row.result/row.scale));
    if(row.compact)setData(row.face,'rulesOverflow',String(row.overflow));
  }
  // Last resorts for rules that still overflow at the smallest size: tighten the
  // line height, then clamp with an ellipsis. Text never leaves the parchment.
  fitRulesToBox(texts.filter(row=>row.rules));
  // Every clause stays on the face at the readable floor; nothing is swapped for an Inspect prompt.
  // `rulesOverflow` still reports a bay too short for the words, for the Information door.
  const bounded=texts.filter(row=>row.bounded);
  const overBudget=row=>row.text.scrollHeight>row.boxHeight+1||row.text.scrollWidth>row.text.clientWidth+1;
  for(const row of bounded){
    row.omitSecondary=overBudget(row)||Boolean(row.clipped);
    if(row.omitSecondary||row.hasHiddenRules)setData(row.face,'faceOmitted','true');
    setData(row.face,'rulesExpanded','false');
    setData(row.face,'rulesDense','false');
    setData(row.face,'rulesNarrowFit',String(row.omitSecondary));
    setData(row.face,'rulesOverflow',String(row.omitSecondary||row.hasHiddenRules));
    setData(row.text,'rulesComplete',String(!row.omitSecondary&&!row.hasHiddenRules));
  }
  for(const row of rules){
    setData(row.face,'rulesExpanded','false');
    setData(row.face,'rulesNarrowFit','false');
  }
  // Content beyond the readable floor remains available through inspection.
  for(const row of rules){
    row.finalHeight=row.layer.clientHeight;
    // Lines actually rendered at the settled size (guarding a zero line box).
    const lineBox=(parseFloat(row.text.style.fontSize)||0)*(parseFloat(row.text.style.lineHeight)||row.lineHeight);
    row.renderedLines=lineBox>0?Math.round((row.text.scrollHeight-2*row.pad)/lineBox):0;
    row.overflow=Boolean(row.hasHiddenRules||row.hasHiddenLines||row.overflow||row.clipped
      ||row.renderedLines>row.lines
      ||row.text.scrollHeight>Math.min(row.finalHeight,row.text.clientHeight)+1
      ||row.text.scrollWidth>row.text.clientWidth+1);
  }
  for(const row of rules){
    setStyle(row.text,'maxHeight','100%');
    setStyle(row.layer,'justifyContent',row.overflow?'flex-start':'');
    setData(row.text,'rulesComplete',String(!row.overflow));
    setData(row.face,'rulesOverflow',String(row.overflow));
  }
  applyCardLayouts(faces.filter(face=>!skipped.has(face)));
  faces.forEach((face,i)=>{if(signatures[i]&&!skipped.has(face))fitSignatures.set(face,fitSignature(face,widths[i]));});
  // The signature is taken after the reading was chosen (the roomy swap changes the face's text), so a settled face is one pass, not two.
}

const overflowing=row=>row.text.scrollHeight>row.boxHeight+1||row.text.scrollWidth>row.text.clientWidth+1;
/**
 * Rows (`{text,boxHeight,lineHeight}`) that still overflow their box at the smallest font: tighten the line
 * height step by step to the floor, then clamp the lines with an ellipsis. Returns the rows it had to clip.
 */
export function fitRulesToBox(rows){
  let failing=rows.filter(overflowing);
  while(failing.length){
    let moved=false;
    for(const row of failing){
      const now=parseFloat(row.text.style.lineHeight)||row.lineHeight,next=Math.max(LINE_HEIGHT_FLOOR,now-LINE_HEIGHT_STEP);
      if(next<now-1e-6){row.text.style.lineHeight=String(next);moved=true;}
    }
    if(!moved)break;
    failing=failing.filter(overflowing);
  }
  for(const row of failing){
    const lineBox=(parseFloat(row.text.style.fontSize)||1)*(parseFloat(row.text.style.lineHeight)||row.lineHeight);
    const lines=Math.max(1,Math.floor(row.boxHeight/lineBox));
    Object.assign(row.text.style,{display:'-webkit-box',webkitBoxOrient:'vertical',webkitLineClamp:String(lines),overflow:'hidden',textOverflow:'ellipsis'});
    row.clipped=true;
  }
  return failing;
}
