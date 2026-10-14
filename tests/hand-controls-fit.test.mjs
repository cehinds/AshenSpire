import test from 'node:test';
import assert from 'node:assert/strict';
import { handLayout, handInfoPosition } from '../src/ui/models/HandLayout.js';
import { revealHandUpcastControl } from '../src/ui/components/handInspectionOverlay.js';
import { measureHandUpcastHeight } from '../src/ui/components/hand.js';

test('complete native chooser measurement ignores fan transforms and is cached across selection', () => {
  const originalStyle=globalThis.getComputedStyle;
  let clones=0,removed=0,sample;
  const originalPicker={hidden:true};
  const controls={textContent:'Upcast Tier 1 Tier 2', parentElement:{appendChild(node){assert.equal(node,sample);}},
    cloneNode(){
      clones++;
      const picker={hidden:originalPicker.hidden};
      sample={style:{},setAttribute(){},querySelectorAll:()=>[picker],offsetHeight:70,
        getBoundingClientRect(){throw Error('The rotated screen rectangle is not the local layout height');},
        remove(){removed++;assert.equal(picker.hidden,false);assert.equal(this.inert,true);assert.equal(this.style.visibility,'hidden');}};
      return sample;
    }};
  globalThis.getComputedStyle=()=>({font:'12px Georgia',paddingTop:'3px',paddingBottom:'3px',borderTopWidth:'1px',borderBottomWidth:'1px',gap:'4px'});
  try {
    const cache=new WeakMap(),input={zoom:.74,width:232,cache};
    assert.equal(measureHandUpcastHeight(controls,input),70,'local height is neither rotated nor divided by zoom twice');
    assert.equal(measureHandUpcastHeight(controls,input),70);
    assert.equal(clones,1,'selection and subsequent layout frames reuse the stable row measurement');
    assert.equal(originalPicker.hidden,true,'measurement never reveals the real picker');
    assert.equal(removed,1);
    assert.equal(measureHandUpcastHeight(controls,{...input,width:172}),70);
    assert.equal(clones,2,'a changed tools-reserved viewport width permits a fresh wrap measurement');
  } finally {
    if(originalStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=originalStyle;
  }
});

test('a clipped, tools-reserved hand contains every selected face and its below-card row', () => {
  for (const viewport of [320,390,1365]) for (const height of [185,208,234,300]) for (const zoom of [.67,.74,1,1.5]) {
    const controlsHeight = 52 / zoom;
    const plan = handLayout({width:(viewport-148)/zoom,height:height/zoom,count:10,rem:16/zoom,zoom,controlsHeight});
    for (const slot of plan.cards) {
      const selectedTop = plan.top + slot.y - plan.lift;
      assert.ok(selectedTop * zoom >= 0, `${viewport}/${height}/${zoom}: selected face clears the top`);
      assert.ok((selectedTop + plan.cardHeight + controlsHeight) * zoom <= height-1+1e-7,
        `${viewport}/${height}/${zoom}: full face and 44px controls clear the footer`);
    }
    assert.ok(plan.cardWidth * zoom >= 80-1e-7, 'the authored minimum readable face is retained');
    assert.ok(plan.step * zoom >= 44-1e-7, 'native card exposure remains a physical touch target');
  }
});

test('a compact paged hand reserves two native chooser rows without shrinking its readable face', () => {
  // The 320px lane retains two44px pagers and the compact labelled tools.
  // Its remaining96px is the actual port, not the unreserved viewport width.
  for (const zoom of [.67, .738, .74, 1, 1.5]) {
    const port = { width: 96 / zoom, height: 234 / zoom };
    const controlsHeight = 100 / zoom;
    const plan = handLayout({ ...port, count: 8, rem: 16 / zoom, zoom, controlsHeight });
    assert.ok(plan.cardWidth * zoom >= 80 - 1e-7, 'the card does not shrink to the former72px port');
    assert.ok(plan.cardWidth <= port.width, 'native paging can admit the entire readable face');
    for (const slot of plan.cards) {
      const top = plan.top + slot.y - plan.lift;
      assert.ok(top >= 0, 'selection cannot hide the top of the card');
      assert.ok(top + plan.cardHeight + controlsHeight <= port.height - 1 / zoom,
        'both44px input rows fit below the whole selected face');
    }
  }
});

test('a native minimum-width change remeasures the complete wrapped chooser', () => {
  const originalStyle = globalThis.getComputedStyle;
  let minWidth = 0, clones = 0;
  const input = {};
  const controls = { textContent: 'Upcast Tier 2', querySelectorAll: () => [input], parentElement: { appendChild() {} },
    cloneNode() { clones++; return { style: {}, setAttribute() {}, querySelectorAll: () => [], offsetHeight: minWidth ? 100 : 52, remove() {} }; } };
  globalThis.getComputedStyle = node => node === input ? { font: '12px Georgia', minHeight: '44px', minWidth: `${minWidth}px` } :
    { font: '12px Georgia', paddingTop: '3px', paddingBottom: '3px', borderTopWidth: '1px', borderBottomWidth: '1px', gap: '4px' };
  try {
    const options = { zoom: .738, width: 96 / .738, cache: new WeakMap() };
    assert.equal(measureHandUpcastHeight(controls, options), 52);
    minWidth = 44;
    assert.equal(measureHandUpcastHeight(controls, options), 100, '44px width wraps instead of compressing the picker');
    assert.equal(clones, 2);
    assert.equal(measureHandUpcastHeight(controls, options), 100);
    assert.equal(clones, 2, 'the complete wrapped reserve is stable after selection');
  } finally {
    if (originalStyle === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = originalStyle;
  }
});

test('a readable native tier label updates the wrapping reserve at phone and compact widths', () => {
  const originalStyle = globalThis.getComputedStyle;
  try {
    for (const zoom of [.738, .83, 1]) for (const physicalWidth of [96, 148]) {
      let pickerWidth = 44, clones = 0;
      const button = {}, picker = { hidden: true };
      const controls = { textContent: 'Upcast Base tier 0', querySelectorAll: () => [button, picker],
        parentElement: { appendChild() {} },
        cloneNode() {
          clones++;
          return { style: {}, setAttribute() {}, querySelectorAll: () => [], remove() {},
            get offsetHeight() {
              // A complete native row includes the button, arrow/label width,
              // gap and borders. Browsers wrap the row rather than shrink it.
              return (64 + 4 + pickerWidth + 8 <= physicalWidth ? 52 : 100) / zoom;
            } };
        } };
      globalThis.getComputedStyle = node => node === picker || node === button ? {
        font: `${12 / zoom}px Georgia`, minHeight: `${44 / zoom}px`,
        minWidth: `${(node === picker ? pickerWidth : 44) / zoom}px`
      } : { font: `${12 / zoom}px Georgia`, gap: `${4 / zoom}px` };
      const options = { zoom, width: physicalWidth / zoom, cache: new WeakMap() };
      const initial = measureHandUpcastHeight(controls, options);
      pickerWidth = 88;
      const height = measureHandUpcastHeight(controls, options);
      assert.equal(height, 100 / zoom, 'the complete readable picker reserves both rows');
      if (physicalWidth === 148) assert.ok(height > initial, 'a previously single row now wraps');
      assert.equal(measureHandUpcastHeight(controls, options), height);
      assert.equal(clones, 2, 'the changed native minimum width invalidates the old reserve once');
      assert.equal(picker.hidden, true, 'measuring leaves the real picker and selection unchanged');
      const plan = handLayout({ width: options.width, height: 234 / zoom, count: 8,
        rem: 16 / zoom, zoom, controlsHeight: height });
      assert.ok(plan.cardWidth * zoom >= 80 - 1e-7);
      for (const slot of plan.cards) {
        const top = plan.top + slot.y - plan.lift;
        assert.ok(top >= 0);
        assert.ok(top + plan.cardHeight + height <= 233 / zoom + 1e-7,
          'the readable face and complete selector remain inside the hand');
      }
    }
  } finally {
    if (originalStyle === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = originalStyle;
  }
});

test('native child touch-target style changes invalidate a reserve even when parent typography is unchanged', () => {
  const originalStyle=globalThis.getComputedStyle;
  let minHeight=32,clones=0;
  const input={};
  const controls={textContent:'Upcast',querySelectorAll:()=>[input],parentElement:{appendChild(){}},
    cloneNode(){clones++;return{style:{},setAttribute(){},querySelectorAll:()=>[],offsetHeight:minHeight+8,remove(){}};}};
  globalThis.getComputedStyle=node=>node===input?{font:'12px Georgia',minHeight:`${minHeight}px`,minWidth:'0px'}:
    {font:'12px Georgia',paddingTop:'3px',paddingBottom:'3px',borderTopWidth:'1px',borderBottomWidth:'1px',gap:'4px'};
  try {
    const options={zoom:1,width:232,cache:new WeakMap()};
    assert.equal(measureHandUpcastHeight(controls,options),40);
    minHeight=44;
    assert.equal(measureHandUpcastHeight(controls,options),52,'the final formation target cannot reuse the initial32px child reserve');
    assert.equal(clones,2);
    assert.equal(measureHandUpcastHeight(controls,options),52);
    assert.equal(clones,2,'stable scoped styles reuse the final measured row');
  } finally {
    if(originalStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=originalStyle;
  }
});

test('reserving controls is stable across hand size and absent controls preserve existing geometry', () => {
  const input={width:242,height:208,rem:16,controlsHeight:52};
  const five=handLayout({...input,count:5}),many=handLayout({...input,count:20});
  assert.equal(five.cardWidth,many.cardWidth);
  assert.equal(five.cardHeight,many.cardHeight);
  assert.ok(many.span>input.width, 'excess cards retain native horizontal travel');
  const ordinary={width:242,height:208,count:5,rem:16};
  assert.deepEqual(handLayout(ordinary),handLayout({...ordinary,controlsHeight:0}));
});

function selectedGeometry({top=480,height=160,bottom=688,zoom=.74}) {
  const props=new Map();
  const shift=()=> (parseFloat(props.get('--hand-upcast-rise'))||0)*zoom;
  const card={classList:{contains:name=>name==='card'},
    style:{getPropertyValue:key=>props.get(key)||'',setProperty:(key,value)=>props.set(key,value),removeProperty:key=>props.delete(key)},
    getBoundingClientRect:()=>({left:80,right:200,width:120,top:top+shift(),bottom:top+height+shift(),height})};
  const control={parentElement:card,getBoundingClientRect:()=>({left:80,right:226,width:146,
    top:top+height+shift(),bottom:top+height+52+shift(),height:52})};
  const hand={clientWidth:242/zoom,scrollLeft:0,scrollTop:17,
    getBoundingClientRect:()=>({left:0,right:242,width:242,top:440,bottom})};
  return{hand,card,control,props};
}

test('a full selected-card union clears both clipping edges with stable zoom-correct translation', () => {
  const {hand,card,control,props}=selectedGeometry({top:500});
  revealHandUpcastControl(hand,control,390);
  assert.equal(control.getBoundingClientRect().bottom,687);
  assert.ok(card.getBoundingClientRect().top>=441);
  assert.ok(control.getBoundingClientRect().top>=card.getBoundingClientRect().bottom);
  const settled=props.get('--hand-upcast-rise');
  revealHandUpcastControl(hand,control,390);
  assert.equal(props.get('--hand-upcast-rise'),settled);
  assert.equal(hand.scrollTop,17);
});

test('top clipping is corrected and a genuinely oversized union is never hidden by a false bottom-only fit', () => {
  const fitting=selectedGeometry({top:430,height:140});
  revealHandUpcastControl(fitting.hand,fitting.control,390);
  assert.equal(fitting.card.getBoundingClientRect().top,441);
  assert.ok(fitting.control.getBoundingClientRect().bottom<=687);
  const impossible=selectedGeometry({top:445,height:250});
  revealHandUpcastControl(impossible.hand,impossible.control,390);
  assert.equal(impossible.props.has('--hand-upcast-rise'),false,
    'capacity must be supplied by the layout rather than translating a cropped face above the hand');
});

test('Information stays above its owner, within the reserved hand width, and clear of player HP', () => {
  const card={left:50,right:180,width:130,top:480};
  const port={left:40,right:212};
  const hp={left:30,right:140,top:415,bottom:470};
  const placement=handInfoPosition({card,port,size:44,gap:10,viewportWidth:320,obstacles:[hp]});
  assert.ok(placement.left-22>=port.left);
  assert.ok(placement.left+22<=port.right);
  assert.ok(placement.top+44<=card.top-10);
  assert.ok(placement.left-22>=hp.right || placement.left+22<=hp.left || placement.top+44<=hp.top || placement.top>=hp.bottom);
  assert.deepEqual(card,{left:50,right:180,width:130,top:480}, 'anchoring never moves the card or HUD');
});

test('an Information door blocked across the whole row moves above the HUD instead of covering HP', () => {
  const placement=handInfoPosition({card:{left:50,right:180,width:130,top:480},port:{left:40,right:212},
    size:44,gap:10,viewportWidth:320,obstacles:[{left:0,right:320,top:415,bottom:470}]});
  assert.ok(placement.top+44<415);
});
