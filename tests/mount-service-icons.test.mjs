import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountMountServiceModal } from '../src/ui/components/mountServiceModal.js';
import { renderEquipmentSetCell } from '../src/ui/components/armouryComponents.js';
import { equipmentSetCellModel } from '../src/ui/models/ArmouryModels.js';
import { mountServiceModel } from '../src/ui/models/MountServiceModel.js';

for (const service of ['extract', 'install']) {
  test(`${service} mounted active and stored candidate pills paint icons with independent state names`, () => withKitDom(({document}) => {
    const registries={cards:new Map(),equipment:{armaments:[{id:'axe',name:'Axe'},{id:'bow',name:'Bow'}],armour:[]}};
    const plan={service,stones:5,cost:1,candidates:[true,false].map((equipped,i)=>({
      itemRef:`armament/${i?'bow':'axe'}`,itemKind:'armament',itemId:i?'bow':'axe',itemName:i?'Bow':'Axe',equipped,
      cost:1,stones:5,shortfall:0,affordable:true,mounts:[{mountKey:'granted:0',kind:'granted',state:'open',cardId:'saved-card-id'}],
    }))};
    const original=JSON.stringify(plan);
    const host=document.createElement('main');document.body.append(host);
    const modal=mountMountServiceModal(host,mountServiceModel(registries,plan),{
      registries,meta:{settings:{}},onSelectItem(){},onSelectMount(){},onSelectCard(){},onBack(){},onConfirm(){},
    });
    for(const [itemRef,icon,label] of [['armament/axe','attack','worn'],['armament/bow','block','carried']]){
      const row=host.querySelector(`[data-item-ref="${itemRef}"]`),pill=row.querySelector('.smith-weapon-count');
      assert.ok(row,'actual modal candidate row mounted');
      assert.equal(pill.querySelector('[data-engraved-icon]')?.dataset.engravedIcon,icon);
      assert.equal(pill.querySelector('[data-engraved-icon]').getAttribute('aria-hidden'),'true');
      assert.equal(pill.textContent,'','named icon ID is not printed as content');
      assert.equal(pill.getAttribute('role'),'img');assert.equal(pill.getAttribute('aria-label'),label);
      assert.match(row.getAttribute('aria-label'),new RegExp(label));
      // Failed decorative art must not remove the state from the accessibility tree.
      pill.querySelector('[data-engraved-icon]').remove();
      assert.equal(pill.getAttribute('aria-label'),label);
    }
    assert.equal(JSON.stringify(plan),original,'stored item/mount/card identities remain unchanged');
    modal.close();
  }));
}


test('mounted locked armoury set resolves its named lock through the shared option renderer', () => withKitDom(({document}) => {
  const model=equipmentSetCellModel({slotId:'weapon',index:1,state:'next',rung:{name:'Next weapon set'}});
  const cell=renderEquipmentSetCell(model);document.body.append(cell);
  assert.equal(cell.querySelector('[data-engraved-icon]')?.dataset.engravedIcon,'lock');
  assert.doesNotMatch(cell.querySelector('.og').textContent,/lock/);
  assert.match(cell.outerHTML,/Next weapon set/);
  assert.equal(cell.disabled,true);
}));
