import test from 'node:test';
import assert from 'node:assert/strict';
import { wireDesktopCombatHeader } from '../src/ui/components/combatLayout.js';
class Node {
  constructor(className='',doc=null) { this.className=className;this.ownerDocument=doc;this.children=[];this.parentNode=null;this.dataset={}; }
  get firstElementChild(){return this.children.find(node=>node.className!=='#comment')||null;}
  insertBefore(node,before=null){node.remove();const at=before?this.children.indexOf(before):this.children.length;if(at<0)throw new Error('Invalid sibling');this.children.splice(at,0,node);node.parentNode=this;return node;}
  remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  querySelector(selector){const direct=selector.startsWith(':scope > ');const classes=selector.replace(':scope > ','').split('.').filter(Boolean);const matches=node=>classes.every(name=>node.className.split(' ').includes(name));for(const child of this.children){if(matches(child))return child;if(!direct){const found=child.querySelector(selector);if(found)return found;}}return null;}
}
function fixture(){
  const doc={createComment:()=>new Node('#comment',doc)},node=name=>new Node(name,doc);
  const combat=node('combat'),header=node('combat-hud shared-hud'),top=node('hud-top'),cinders=node('hud-cinders-strip'),actions=node('hud-actions'),shield=node('shield'),menu=node('menu'),field=node('field'),ribbon=node('turn-ribbon'),enemy=node('enemy');
  combat.insertBefore(header);combat.insertBefore(field);header.insertBefore(top);top.insertBefore(cinders);top.insertBefore(actions);actions.insertBefore(shield);actions.insertBefore(menu);field.insertBefore(ribbon);field.insertBefore(enemy);
  return {combat,header,top,cinders,actions,shield,menu,field,ribbon,enemy};
}
test('desktop header moves existing live nodes and restores their exact slots on mode change',()=>{
  const f=fixture(),layout=wireDesktopCombatHeader(f.combat);
  layout.apply(false);assert.deepEqual(f.field.children,[f.ribbon,f.enemy]);
  layout.apply(true);layout.apply(true);
  assert.equal(f.ribbon.parentNode,f.header);assert.deepEqual(f.actions.children,[f.cinders,f.shield,f.menu]);
  f.combat.querySelector('.turn-ribbon').textContent='Enemy Turn';assert.equal(f.ribbon.textContent,'Enemy Turn');
  assert.equal(f.combat.dataset.desktopHeader,'true');
  layout.apply(false);
  assert.deepEqual(f.field.children,[f.ribbon,f.enemy]);assert.deepEqual(f.top.children,[f.cinders,f.actions]);assert.deepEqual(f.actions.children,[f.shield,f.menu]);assert.equal(f.combat.dataset.desktopHeader,undefined);
  layout.apply(true);layout.release();layout.release();
  assert.deepEqual(f.field.children,[f.ribbon,f.enemy]);assert.deepEqual(f.top.children,[f.cinders,f.actions]);
});
test('a repainted purse replaces its old node without resurrecting discarded HUD content',()=>{
  const f=fixture(),layout=wireDesktopCombatHeader(f.combat);layout.apply(true);
  f.cinders.remove();const replacement=new Node('hud-cinders-strip',f.combat.ownerDocument);f.top.insertBefore(replacement,f.top.firstElementChild);
  layout.apply(true);assert.equal(replacement.parentNode,f.actions);
  layout.release();assert.deepEqual(f.top.children,[replacement,f.actions]);assert(!f.combat.contains(f.cinders));
});
