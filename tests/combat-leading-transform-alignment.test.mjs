import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/ui/components/battlefieldStage.js',import.meta.url),'utf8');
const begin=source.indexOf('    for (const move of intentMoves) {'),end=source.indexOf('    // Idle names do not reserve footer rows',begin);
assert.ok(begin>0&&end>begin);
const alignment=source.slice(begin,end);
function apply(host,dx,dy,code=alignment){
  runInNewContext(code,{intentMoves:[{leadingHost:host,dx,dy}],
    anchorLocalBox:()=>({left:parseFloat(host.style.left)+host.transformX})});
}

test('actual alignment adds the measured delta to layout left and retains independent transforms',()=>{
  for(const transformX of [0,96.5421]){
    const host={transformX,style:{left:'-0.0100009px',translate:'0px -1.4029px',transform:`translate(${transformX}px,72.0909px)`}};
    const transform=host.style.transform;
    apply(host,0,.0191);
    assert.equal(parseFloat(host.style.left),-.0100009,'vertical correction cannot duplicate a painted horizontal transform');
    assert.ok(Math.abs(parseFloat(host.style.translate.split(' ')[1])-(-1.3838))<1e-9);
    assert.equal(host.style.transform,transform);
    apply(host,0,.0191);
    assert.equal(parseFloat(host.style.left),-.0100009,'repeated refits never accumulate the transform');
  }
});

test('captured phone zoom preserves one transform while real horizontal alignment still moves the host',()=>{
  const zoom=.83,host={transformX:96.5421,style:{left:'-0.01px',translate:'0 -1.4029px',transform:'matrix(1,0,0,1,96.5421,14.2596)'}};
  const before=(parseFloat(host.style.left)+host.transformX)*zoom;
  const intendedVisualShift=8,dx=intendedVisualShift/zoom;
  apply(host,dx,.02);
  const after=(parseFloat(host.style.left)+host.transformX)*zoom;
  assert.ok(Math.abs(after-before-intendedVisualShift)<1e-9,'the visual shift equals the measured delta exactly once');
});

test('the former painted-bound assignment reproduces the captured double translation',()=>{
  const old=alignment.replace('const hostLeft = parseFloat(leadingHost.style.left) || 0;',
    'const hostLeft = anchorLocalBox(leadingHost.offsetParent || leadingHost.parentElement, leadingHost).left;');
  const host={transformX:96.5421,style:{left:'-0.01px',translate:'0 -1.4029px',transform:'translate(96.5421px,72.0909px)'}};
  apply(host,0,.0191,old);
  assert.ok(Math.abs(parseFloat(host.style.left)-96.5321)<1e-9,'the old loop writes the transformed box back into layout left');
});
