import test from 'node:test';
import assert from 'node:assert/strict';
import { damageReceiptLines, damageReceiptHtml, cardDamageReceipt } from '../src/ui/components/damageReceipt.js';

const first = { incoming: 20, hpLoss: 12, wardReduced: 5, blocked: 3,
  sources: [{id:'base',label:'Ember base',amount:16,stage:'base'}, {id:'ring',label:'Ash Ring',amount:4},
    {id:'ward',label:'Active Ward',multiplier:.75,amount:-5,stage:'mitigation'}] };
test('damage inspection preserves named source arithmetic and unequal sequential hits', () => {
  const receipt = cardDamageReceipt({values:[{op:'damage',damageReceipt:{version:1,targetId:'foe',hits:[first,{incoming:20,hpLoss:20,sources:[]}],totalDamage:32}}]});
  const lines = damageReceiptLines(receipt);
  assert.ok(lines.includes('Ash Ring: +4'));
  assert.ok(lines.includes('Active Ward: ×0.75 (mitigation)'));
  assert.ok(lines.includes('Ward −5; Block −3'));
  assert.equal(lines.at(-1),'2 hits · 32 total HP damage');
  assert.match(damageReceiptHtml(receipt,{targetName:'<Foe>'}),/Against &lt;Foe&gt;; on successful hits/);
  assert.match(damageReceiptHtml({...receipt,targetId:null}),/Before target defenses/);
});
test('missing engine receipts do not invent calculations', () => {
  assert.equal(cardDamageReceipt({values:[{op:'damage',value:20}]}),null);
  assert.equal(damageReceiptHtml(null),'');
});
