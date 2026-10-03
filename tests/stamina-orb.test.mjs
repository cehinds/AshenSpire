import test from 'node:test';
import assert from 'node:assert/strict';
import { staminaOrbModel, manaRingEnabled, combatVitals } from '../src/ui/models/StaminaOrbModel.js';
import { staminaOrb } from '../src/content/staminaOrb.js';
import { paintStaminaOrb, staminaOrbHtml } from '../src/ui/components/staminaOrb.js';

test('approved assembly retains separately positioned text and hidden sigil', () => {
  assert.equal(staminaOrb.layers.sigil.visible, false);
  assert.equal(staminaOrb.layers.number.size, 150);
  assert.equal(staminaOrb.layers.number.y, 0);
  assert.equal(staminaOrb.layers.label.y, 14);
  assert.equal(staminaOrb.layers.diamond.size, 130);
  assert.equal(staminaOrb.layers.spent.size, 60);
});

test('mana gems start at noon and run counterclockwise with one gem per maximum', () => {
  for (const maxMana of [3, 6, 12, 24, 60]) {
    const m = staminaOrbModel({ mana: 2, maxMana });
    assert.equal(m.gems.length, maxMana);
    assert.equal(m.gems.filter(g => g.id === 'diamond').length, 2);
    assert.ok(Math.abs(m.gems[0].x - 450) < 1e-9);
    assert.ok(m.gems[0].y < 450);
    assert.ok(m.gems[1].x < 450);
    for (const g of m.gems) assert.ok(Math.abs(Math.hypot(g.x-450,g.y-450)-337.5) < 1e-8);
  }
  assert.ok(staminaOrbModel({maxMana:60}).gems[0].size < staminaOrbModel({maxMana:12}).gems[0].size);
});

test('ring defaults on, disabled ring restores the MP bar, zero mana remains safe', () => {
  const bars = [{id:'hp'}, {id:'mana'}];
  assert.equal(manaRingEnabled(), true);
  assert.deepEqual(combatVitals(bars, {}), [{id:'hp'}]);
  assert.equal(combatVitals(bars, {manaRing:false}), bars);
  assert.equal(staminaOrbModel({mana:4,maxMana:12,settings:{manaRing:false}}).gems.length, 0);
  assert.equal(staminaOrbModel({maxMana:0}).gems.length, 0);
  assert.equal(staminaOrbModel({mana:-1,maxMana:3}).available, 0);
  assert.equal(staminaOrbModel({mana:10,maxMana:3}).available, 3);
});

test('live repaint updates remaining SP and mana gems, including bonus SP', () => {
  const svg = {innerHTML:''}, value = {textContent:''}, attrs = {};
  const orb = {dataset:{},querySelector:s=>s==='svg'?svg:value,setAttribute:(k,v)=>attrs[k]=v};
  assert.match(staminaOrbHtml(), /viewBox="0 0 900 900"/);
  paintStaminaOrb(orb,{stamina:5,maxStamina:3,mana:3,maxMana:3});
  assert.equal(value.textContent,'5');
  assert.equal((svg.innerHTML.match(/data-orb-part="diamond"/g)||[]).length,3);
  paintStaminaOrb(orb,{stamina:2,maxStamina:3,mana:1,maxMana:3});
  assert.equal(value.textContent,'2');
  assert.equal((svg.innerHTML.match(/data-orb-part="spent"/g)||[]).length,2);
  assert.match(attrs['aria-label'], /Stamina 2 of 3. Mana 1 of 3/);
  assert.match(svg.innerHTML, /data-orb-part="label"/);
  assert.match(svg.innerHTML, /data-orb-part="number"/);
});
