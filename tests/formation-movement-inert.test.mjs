import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {formationGridHtml} from '../src/ui/components/formationGrid.js';

const source=readFileSync(new URL('../src/ui/components/formationMovement.js',import.meta.url),'utf8');
const implementation=source.slice(source.indexOf('export function wireFormationMovement')).replace('export function','function');
function fixture(){
  const holds=[],moves=[];
  const state={enabled:false,available:true,blocked:false,hold:false,veil:false};
  const element=()=>({dataset:{},attributes:{},hidden:false,inert:false,disabled:false,
    classList:{toggle(){}},setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(){},removeEventListener(){},append(){},remove(){}});
  const tiles=['A1','A2','B1'].map(cell=>Object.assign(element(),{dataset:{cell,occupied:cell==='A2'?'true':'false'}}));
  const grid=Object.assign(element(),{querySelectorAll:()=>tiles});
  const field=Object.assign(element(),{isConnected:true,querySelector:()=>grid});
  const api=runInNewContext(implementation+'\nwireFormationMovement',{
    document:{createElement:element,documentElement:{},body:{}},
    MutationObserver:class{observe(){}disconnect(){}},
    presentationConfig:()=>({movementEnabled:state.enabled,movementNeedsSelection:true,
      tileActivation:state.hold?'hold':'tap',moveActivation:'tap'}),
    armHold:(target,options)=>{holds.push({target,options});return{refresh(){},release(){}};},
    holdMs:()=>1000,veilIsOpen:()=>state.veil,openConfirmationModal(){},t:key=>key,
  })(field,{readSettings:()=>({}),holdConfig:{},available:()=>state.available,
    plan:()=>({ok:!state.blocked,cost:0}),move:cell=>moves.push(cell)});
  return{state,tiles,grid,holds,moves,api};
}

test('initial grid and all tiles are inert until production movement wiring enables them',()=>{
  const html=formationGridHtml();
  assert.match(html,/<div class="formation-grid" inert aria-hidden="true">/);
  assert.equal((html.match(/hidden disabled inert tabindex="-1"/g)||[]).length,36);
});

test('actual refresh preserves disabled-to-enabled-to-disabled semantics and usable mixed cells',()=>{
  const f=fixture();
  assert.equal(f.grid.inert,true);assert.equal(f.grid.attributes['aria-hidden'],'true');
  assert.ok(f.tiles.every(tile=>tile.disabled&&tile.inert&&tile.tabIndex===-1));
  f.state.enabled=true;f.api.refresh();
  assert.equal(f.grid.inert,false);assert.equal(f.grid.attributes['aria-hidden'],'false');
  assert.equal(f.tiles[0].disabled,false);assert.equal(f.tiles[0].inert,false);assert.equal(f.tiles[0].tabIndex,0);
  assert.equal(f.tiles[1].disabled,true);assert.equal(f.tiles[1].inert,true);assert.equal(f.tiles[1].tabIndex,-1);
  f.state.enabled=false;f.api.refresh();
  assert.equal(f.grid.inert,true);assert.ok(f.tiles.every(tile=>tile.inert&&tile.disabled));
});

test('no available moves and a veil make the grid inert; availability recovery restores usable tiles',()=>{
  const f=fixture();f.state.enabled=true;
  for(const key of ['blocked','veil']){
    f.state[key]=true;f.api.refresh();assert.equal(f.grid.inert,true);assert.ok(f.tiles.every(tile=>tile.inert));
    f.state[key]=false;f.api.refresh();assert.equal(f.grid.inert,false);
  }
  f.state.available=false;f.api.refresh();assert.equal(f.grid.inert,true);
  f.state.available=true;f.api.refresh();assert.equal(f.grid.inert,false);
});

test('active hold-confirm still commits only a usable tile and disabled tiles stay inert',()=>{
  const f=fixture();f.state.enabled=true;f.state.hold=true;f.api.refresh();
  assert.equal(f.holds[0].options.ms(),1000);
  f.holds[0].options.onConfirm();assert.deepEqual(f.moves,['A1']);
  f.holds[1].options.onConfirm();assert.deepEqual(f.moves,['A1']);
  f.state.enabled=false;f.api.refresh();assert.equal(f.tiles[2].disabled,true);assert.equal(f.tiles[2].inert,true);
});
