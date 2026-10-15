import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSummaryRules } from '../src/ui/components/illustratedCardFitter.js';

// Geometry fixture: model wrapped physical lines independently from clause count.
function fixture(lines) {
  const children=lines.map(lineCount=>({lineCount,hidden:false}));
  const text={children,dataset:{effectLineBudget:'3',minFont:'22',maxFont:'22'},style:{},parentElement:{clientHeight:100},clientWidth:120,
    querySelector(selector){return selector==='[data-summary-cue]'?children.find(c=>c.dataset?.summaryCue):children[0];},
    append(child){children.push(child);child.remove=()=>children.splice(children.indexOf(child),1);},
    ownerDocument:{createElement(){return {lineCount:1,dataset:{},hidden:false};}},
    get scrollHeight(){return children.filter(c=>!c.hidden).reduce((n,c)=>n+c.lineCount,0)*parseFloat(this.style.fontSize)*1.25;},get scrollWidth(){return 120;}};
  return {text,face:{clientWidth:180,dataset:{}}};
}

test('three-line budget counts all clauses together and removes whole secondary',()=>{
 const {text,face}=fixture([2,2]);fitSummaryRules(text,face,.5);
 assert.equal(text.children[0].hidden,false);assert.equal(text.children[1].hidden,true);
 assert.equal(text.dataset.summaryOmitted,'true');assert.equal(face.dataset.rulesExpanded,'false');
 assert.equal(parseFloat(text.style.fontSize),11);
});
test('overlong primary becomes an honest inspection cue without shrinking',()=>{
 const {text,face}=fixture([4,1]);fitSummaryRules(text,face,.5);
 assert.ok(text.children.slice(0,2).every(c=>c.hidden));
 assert.equal(text.children[2].textContent,'Inspect for full effects.');
 assert.equal(parseFloat(text.style.fontSize),11);
});
test('resize restores complete secondary when its physical lines fit',()=>{
 const {text,face}=fixture([2,2]);fitSummaryRules(text,face,.5);
 text.children[0].lineCount=1;text.children[1].lineCount=1;
 fitSummaryRules(text,face,.5);
 assert.ok(text.children.every(c=>!c.hidden));assert.equal(text.dataset.summaryOmitted,'false');
});
