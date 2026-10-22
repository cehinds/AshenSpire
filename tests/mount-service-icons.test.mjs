import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
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


const registries = createRegistries(contentBundle);
for (const service of ['extract', 'install']) for (const affordable of [true, false]) {
  test(`${service} paints the Stone cost icon in its ${affordable ? 'affordable confirmation' : 'unaffordable refusal'}`, () => withKitDom(({document, Event}) => {
    // This layout-free DOM parses tags but not inline text. Record the HTML
    // written to the actual mounted regions to check their quote and label.
    const proto = Object.getPrototypeOf(document.body);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
    const written = new WeakMap();
    Object.defineProperty(proto, 'innerHTML', { configurable: true, set(html) { written.set(this, html); descriptor.set.call(this, html); } });
    // Use the fixture's paint clock on window too; this test does not advance
    // the confirmation shield beyond its destination paint boundary.
    window.requestAnimationFrame = requestAnimationFrame;
    const stones = affordable ? 5 : 1;
    const plan = { service, cost: 3, stones, candidates: [{
      itemRef: 'armament/greatsword', itemKind: 'armament', itemId: 'greatsword', itemName: 'Greatsword', equipped: true,
      cost: 3, stones, affordable, shortfall: affordable ? 0 : 2,
      mounts: [{ mountKey: 'granted:0', kind: 'granted', state: service === 'extract' ? 'authored' : 'open',
        cardId: service === 'extract' ? 'strike' : null, cardName: service === 'extract' ? 'Strike' : null,
        cards: service === 'install' ? [{ instanceId: 'deck-strike', cardId: 'strike', cardName: 'Strike', upgraded: false }] : [],
      }],
    }] };
    const selection = { itemRef: 'armament/greatsword', mountKey: 'granted:0', ...(service === 'install' ? { instanceId: 'deck-strike' } : {}) };
    const original = JSON.stringify({ plan, selection });
    const host = document.createElement('main'); document.body.append(host);
    const committed = [];
    const modal = mountMountServiceModal(host, mountServiceModel(registries, plan, selection), {
      registries, meta: { settings: {} }, onSelectItem() {}, onSelectMount() {}, onSelectCard() {}, onBack() {},
      onConfirm: value => committed.push(value),
    });
    const checkCost = container => {
      const cost = container.querySelector('.smith-economy-values');
      assert.ok(cost, 'the actual mounted cost region exists');
      const marker = cost.querySelector('.smith-stone-icon');
      assert.equal(marker.getAttribute('aria-hidden'), 'true', 'the icon is decorative beside the readable cost label');
      assert.equal(marker.querySelector('[data-engraved-icon]')?.dataset.engravedIcon, 'weight');
      assert.doesNotMatch(marker.textContent, /Stone|weight/, 'neither fallback copy nor a named icon token replaces the available artwork');
      let owner = cost; while (owner && !written.has(owner)) owner = owner.parentNode;
      assert.ok(owner, 'the mounted region received cost markup');
      const markup = written.get(owner);
      assert.ok(markup.includes('<b>Smithing Stone Cost</b>'));
      assert.ok(markup.includes('<strong class="smith-cost-required">3</strong>'));
      assert.ok(markup.includes(`<strong class="smith-cost-available">${stones}</strong>`));
    };
    checkCost(host);
    const confirm = host.querySelector('.mount-confirm');
    assert.equal(confirm.getAttribute('aria-disabled'), String(!affordable));
    confirm.dispatchEvent(new Event('click', { bubbles: true, detail: 0 }));
    const review = document.body.querySelector('.confirmation-modal');
    assert.ok(review, 'a short click opens the real review or refusal');
    checkCost(review);
    const approve = review.querySelector('.confirmation-confirm');
    if (affordable) { assert.ok(approve); assert.equal(approve.hidden, false); approve.click(); }
    else assert.equal(approve, null, 'an unaffordable review exposes no commit action');
    assert.equal(committed.length, affordable ? 1 : 0, 'affordability still controls the actual commit');
    if (affordable) assert.deepEqual(committed[0], { ...selection, instanceId: selection.instanceId });
    else review.querySelector('.confirmation-cancel').click();
    assert.equal(JSON.stringify({ plan, selection }), original, 'rendering cost artwork does not mutate item, mount, card or quoted cost');
    modal.close();
  }));
}
