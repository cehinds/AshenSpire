import test from 'node:test';
import assert from 'node:assert/strict';
import {cardLayoutDocumentWithChanges} from '../src/model/cardLayoutDocument.js';
import {rankAnchor} from '../src/ui/components/cardLayout.js';
const fixture=()=>({currentCard:'sample',order:[9,8,7,6,5,4,3,2,1],defaultLayout:'shared',referenceRects:{panel:{x:24,y:313,w:312,h:147}},layouts:{shared:{'rank-bar':{x:111,y:323,w:138,h:26},'rank-text':{x:149,y:326,w:62,h:20}}},groups:{textBox:{parent:'panel',members:['panel','panel-trim','rules','rank-bar','rank-text']}}});

test('a Rank 0 save preserves the positive-rank anchor when the box moves and scales',()=>{
  const current=fixture(),old=current.referenceRects.panel;
  const panel={x:old.x+20,y:old.y-30,w:old.w*1.25,h:old.h*1.25};
  const next=cardLayoutDocumentWithChanges(current,{order:current.order,layouts:{shared:{panel}},referenceRects:{panel:old},currentCard:'cinderSigil:rank-0'});
  const rank=current.layouts.shared['rank-bar'],saved=next.layouts.shared['rank-bar'];
  assert.ok(Math.abs((saved.x-panel.x)/panel.w-(rank.x-old.x)/old.w)<1e-10);
  assert.ok(Math.abs((saved.y-panel.y)/panel.h-(rank.y-old.y)/old.h)<1e-10);
  assert.equal(saved.w,rank.w*1.25);assert.ok(next.layouts.shared['rank-text']);
  assert.deepEqual(next.groups,current.groups);assert.equal(current.currentCard,'sample');
});
test('exported rank geometry is anchored to the authored panel, not the card origin',()=>{
  const doc=fixture(),panel=doc.referenceRects.panel,rank=rankAnchor(doc,panel).box;
  assert.deepEqual(rank,doc.layouts.shared['rank-bar']);
  const moved=rankAnchor(doc,{...panel,x:panel.x+25,y:panel.y-50}).box;
  assert.equal(moved.x,rank.x+25);assert.equal(moved.y,rank.y-50);
});
test('saving a tall fitted text box does not shrink the rank on the next render',()=>{
  const doc=fixture();doc.referenceRects.panel.h=250;doc.layouts.shared.panel={...doc.referenceRects.panel};
  const rank=rankAnchor(doc,{x:24,y:313,w:312,h:147}).box;
  assert.deepEqual(rank,doc.layouts.shared['rank-bar']);
});
