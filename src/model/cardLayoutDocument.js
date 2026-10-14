// Shared by the local editor and its save bridge so the downloaded document
// and the canonical game document contain exactly the same layout data.
export function cardLayoutDocumentWithChanges(current,input){
  const layout=structuredClone(input.layouts.shared);
  if(!layout['rank-bar']){
    const old=current.layouts?.[current.defaultLayout||'shared']||{},parent=old.panel||current.referenceRects.panel;
    for(const id of ['rank-bar','rank-text']){const r=old[id];if(r)layout[id]={x:layout.panel.x+(r.x-parent.x)*layout.panel.w/parent.w,y:layout.panel.y+(r.y-parent.y)*layout.panel.h/parent.h,w:r.w*layout.panel.w/parent.w,h:r.h*layout.panel.h/parent.h};}
  }
  return {...current,components:input.components??current.components,symbols:input.symbols??current.symbols,version:1,order:input.order,coordinateSpace:{width:360,height:540},defaultLayout:'shared',currentCard:typeof input.currentCard==='string'?input.currentCard.slice(0,120):current.currentCard,layouts:{shared:layout},referenceRects:input.referenceRects};
}
