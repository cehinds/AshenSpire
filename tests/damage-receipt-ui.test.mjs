import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { damageReceiptLines, damageReceiptHtml, cardDamageReceipt } from '../src/ui/components/damageReceipt.js';

const first = { incoming: 20, hpLoss: 12, wardReduced: 5, blocked: 3,
  sources: [{id:'base',label:'Ember base',amount:16,stage:'base'}, {id:'ring',label:'Ash Ring',amount:4},
    {id:'ward',label:'Active Ward',multiplier:.75,amount:-5,stage:'mitigation'}] };
const decode = text => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity]);
const visibleText = html => decode(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const topics = html => [...html.matchAll(/<span class="tooltip-keyword"([^>]*)>([^<]+)<\/span>/g)].map(([, attributes, label]) => ({
  label, text: decode(attributes.match(/data-tip="([^"]*)"/)[1]), attributes,
}));
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
  assert.equal(damageReceiptHtml({ hits: [], totalDamage: 0 }), '');
  assert.equal(damageReceiptHtml({ totalDamage: 20 }), '');
});

test('main tooltip is a short receipt result with at most three accessible detail keywords', () => {
  const receipt = { targetId: 'foe', hits: [first, { incoming: 20, hpLoss: 20, sources: [] }], totalDamage: 32 };
  const html = damageReceiptHtml(receipt, { targetName: 'Bell Keeper' });
  const visible = visibleText(html);
  assert.match(visible, /Damage calculation 32 HP damage · 2 hits/);
  assert.match(visible, /Against Bell Keeper; on successful hits/);
  assert.doesNotMatch(visible, /Ash Ring|incoming|Final HP|Ward −|Ember base/);
  assert.ok(visible.length < 150, visible);
  const details = topics(html);
  assert.deepEqual(details.map(row => row.label), ['Hits', 'Sources', 'Defenses']);
  for (const row of details) {
    assert.match(row.attributes, /tabindex="0"/);
    assert.match(row.attributes, /role="button"/);
    assert.match(row.attributes, /aria-label="Inspect [^"]+"/);
  }
  assert.match(details[0].text, /Hit 1: 20 incoming → 12 HP damage/);
  assert.match(details[0].text, /Hit 2: 20 incoming → 20 HP damage/);
  assert.match(details[1].text, /Ash Ring: \+4/);
  assert.match(details[1].text, /Active Ward: ×0.75/);
  assert.doesNotMatch(details[1].text, /\(base\)|\(mitigation\)/);
  assert.match(details[2].text, /Hit 1: Ward −5; Hit 1: Block −3/);
});

test('identical rows are shared across hits while repeated contributions within a hit remain distinct', () => {
  const twice = { hits: [first, structuredClone(first)], totalDamage: 24 };
  const details = topics(damageReceiptHtml(twice));
  assert.equal(details[0].text, 'Hits 1, 2: 20 incoming → 12 HP damage');
  assert.equal(details[1].text.match(/Ash Ring/g).length, 1);
  assert.equal(details[1].text, 'Hits 1, 2: Ember base: +16; Ash Ring: +4; Active Ward: ×0.75');
  assert.match(details[2].text, /Hits 1, 2: Ward −5/);
  const repeatedSource = { ...first, sources: [first.sources[1], first.sources[1]] };
  const repeated = topics(damageReceiptHtml({ hits: [repeatedSource, repeatedSource], totalDamage: 24 }));
  assert.equal(repeated[1].text, 'Hits 1, 2: Ash Ring: +4; Ash Ring: +4');
  assert.equal(damageReceiptLines(twice).filter(line => line === 'Ash Ring: +4').length, 2, 'full log keeps its original per-hit rows');
});

test('source details retain interleaved duplicate operations within one hit', () => {
  const sources = [
    { label: 'Base', operation: 'set', amount: 10 },
    { label: 'Bonus', amount: 2 },
    { label: 'Scale', operation: 'multiply', amount: 2 },
    { label: 'Bonus', amount: 2 },
  ];
  const html = damageReceiptHtml({ hits: [{ incoming: 26, hpLoss: 26, sources }], totalDamage: 26 });
  assert.equal(topics(html).find(row => row.label === 'Sources').text,
    'Hit 1: Base: =10; Bonus: +2; Scale: ×2; Bonus: +2');
});

test('only complete identical source sequences share hit attribution', () => {
  const base = { label: 'Base', operation: 'set', amount: 10 };
  const bonus = { label: 'Bonus', amount: 2 };
  const scale = { label: 'Scale', operation: 'multiply', amount: 2 };
  const first = { incoming: 24, hpLoss: 24, sources: [base, bonus, scale] };
  const second = { incoming: 22, hpLoss: 22, sources: [base, scale, bonus] };
  const html = damageReceiptHtml({ hits: [first, second, structuredClone(first)], totalDamage: 70 });
  assert.equal(topics(html).find(row => row.label === 'Sources').text,
    'Hits 1, 3: Base: =10; Bonus: +2; Scale: ×2; Hit 2: Base: =10; Scale: ×2; Bonus: +2');
});

test('unequal mixed hits keep exact receipt numbers, reductions, operations and rounding in details', () => {
  const mixed = { ...first, physical: 12.5, magical: 7.5 };
  const other = { incoming: 30.1234567, physical: 18.1234567, magical: 12, hpLoss: 9.1234567,
    wardReduced: 2, poiseReduced: 7, blocked: 12, rounding: 'floor final HP',
    sources: [{ id: 'base', label: 'Offensive damage', operation: 'set', amount: 30.1234567, stage: 'offense' },
      { id: 'scale', label: 'Damage scale', operation: 'multiply', amount: .75 },
      { id: 'rounding', label: 'Final rounding', amount: -.8765433, stage: 'rounding' }] };
  const html = damageReceiptHtml({ hits: [mixed, other], totalDamage: 21.1234567 });
  const details = topics(html);
  assert.match(visibleText(html), /21.1234567 HP damage · 2 hits/);
  assert.match(details[0].text, /Hit 1: 20 incoming \(12.5 physical \+ 7.5 magical\) → 12 HP damage/);
  assert.match(details[0].text, /Hit 2: 30.1234567 incoming \(18.1234567 physical \+ 12 magical\) → 9.1234567 HP damage; rounding: floor final HP/);
  assert.match(details[1].text, /Offensive damage: =30.1234567/);
  assert.match(details[1].text, /Damage scale: ×0.75/);
  assert.match(details[1].text, /Final rounding: −0.8765433/);
  assert.doesNotMatch(details[1].text, /\(offense\)|\(rounding\)/);
  assert.match(details[2].text, /Hit 1: Ward −5/);
  assert.match(details[2].text, /Hit 2: Ward −2/);
  assert.match(details[2].text, /Hit 2: Poise absorbed 7/);
  assert.match(details[2].text, /Hit 2: Block −12/);
});

test('empty topics are omitted and missing receipt values stay unknown', () => {
  const html = damageReceiptHtml({ hits: [{ hpLoss: 8, physical: 8, sources: [] }] });
  assert.match(visibleText(html), /\? HP damage · 1 hit/);
  assert.deepEqual(topics(html).map(row => row.label), ['Hits']);
  assert.equal(topics(html)[0].text, 'Hit 1: ? incoming (8 physical + ? magical) → 8 HP damage');
});

test('Poise pressure remains inspectable when the hit absorbed no HP damage', () => {
  const hit = { incoming: 12, hpLoss: 12, blocked: 0, wardReduced: 0, poiseReduced: 0, poiseDamage: 3.125, sources: [] };
  const receipt = { hits: [hit], totalDamage: 12 };
  const html = damageReceiptHtml(receipt);
  assert.match(visibleText(html), /12 HP damage · 1 hit/);
  assert.deepEqual(topics(html).map(row => row.label), ['Hits', 'Defenses']);
  assert.equal(topics(html)[1].text, 'Hit 1: Poise damage 3.125');
  assert.doesNotMatch(topics(html)[1].text, /absorbed|−/);
  assert.ok(damageReceiptLines(receipt).includes('Poise damage 3.125'));
});

test('nested detail text is escaped once for its attribute and never becomes markup', () => {
  const label = `Ember "Ring" <img src=x> & literal &lt; 'source'`;
  const html = damageReceiptHtml({ targetId: 'foe', hits: [{ ...first, rounding: label,
    sources: [{ label, amount: 4 }] }], totalDamage: 12 }, { targetName: '<Foe>' });
  const details = topics(html);
  assert.match(html, /Against &lt;Foe&gt;/);
  assert.doesNotMatch(html, /<img|<Foe>|<span[^>]*<span/);
  assert.equal(details[1].text, `Hit 1: ${label}: +4`);
  assert.match(details[1].attributes, /&quot;Ring&quot; &lt;img src=x&gt; &amp; literal &amp;lt; 'source'/);
  assert.equal(details[0].text, `Hit 1: 20 incoming → 12 HP damage; rounding: ${label}`);
});

test('explicit card Information retains the full per-hit receipt and unchanged log formatter', () => {
  const receipt = { targetId: 'foe', hits: [first], totalDamage: 12 };
  assert.deepEqual(damageReceiptLines(receipt), [
    'Hit 1: 20 incoming → 12 HP damage', 'Ember base: +16 (base)', 'Ash Ring: +4',
    'Active Ward: ×0.75 (mitigation)', 'Ward −5; Block −3', 'Final HP damage: 12', '1 hit · 12 total HP damage',
  ]);
  const html = damageReceiptHtml(receipt, { expanded: true });
  for (const line of damageReceiptLines(receipt)) assert.ok(visibleText(html).includes(line), line);
  assert.deepEqual(topics(html), []);
  const card = readFileSync(new URL('../src/ui/components/card.js', import.meta.url), 'utf8');
  assert.match(card, /damageReceiptHtml\(receipt, \{ targetName: opts\.preview\.targetName, expanded: true \}\)/);
});

test('hand hit lanes route the displayed damage number at pointer/touch coordinates', async () => {
  const {damageNumberUnderLane} = await import('../src/ui/components/damageReceipt.js');
  const number = {getBoundingClientRect:()=>({left:10,right:30,top:50,bottom:70})};
  const lane = {parentElement:{querySelectorAll:()=>[number]}};
  const target = {closest:selector=>selector==='.hand-hit-lane'?lane:null};
  assert.equal(damageNumberUnderLane({target,clientX:20,clientY:60,pointerType:'touch'}),number);
  assert.equal(damageNumberUnderLane({target,clientX:31,clientY:60}),null);
  assert.equal(damageNumberUnderLane({target:{closest:()=>null},clientX:20,clientY:60}),null);
});
