import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { smithUiFixture, matchesSmithRows, matchesCommittedCards, smithTextFits, matchesSmithCommit, smithWordsFit } from '../tools/lib/smith-ui-fixture.mjs';

const fixture = smithUiFixture();
const rows = () => fixture.selected.affectedRows.map(row => ({
  title: row.name, open: false, role: `${row.role} · ${row.used ? `${row.activeCopies} active` : 'not in active deck'}`,
  unused: !row.used, opacity: row.used ? 1 : .5,
  values: row.values.map(value => ({ label: ({damage:'DAMAGE',block:'GUARD'})[value.op], before: String(value.before), after: String(value.after) })),
}));
const cards = () => fixture.cards.map(row => ({ ...row, values: row.values.map(value => ({kind: value.op === 'block' ? 'gain' : value.op, values: [String(value.value)]})) }));

test('current-profile Smith fixture pins the actual authored gear and committed cards', () => {
  const item = fixture.selected;
  assert.deepEqual(item.intrinsicStats, { attackRating: 2, defenseRating: 2, weight: 1, weaponArtManaCost: 1, uniqueSkillStaminaCost: 0 });
  assert.deepEqual(item.requirements.map(row => [row.label, row.currentRequired, row.nextRequired, row.actual]), [['STR',2,1,3]]);
  assert.deepEqual(item.affectedRows.map(row => [row.name,row.used,row.activeCopies,row.values.map(value=>[value.op,value.before,value.after])]), [
    ['Slashing Strike',true,2,[['damage',5,8]]], ['Weapon Guard',true,1,[['block',2,5]]], ['Weapon Technique',false,0,[['block',3,5]]],
  ]);
  assert.equal(fixture.receipt.cost, 1);
  assert.equal(fixture.receipt.stoneBalanceAfter, 0);
  assert.equal(fixture.receipt.afterLevel, 1);
  assert.equal(fixture.cards.length, 3);
  assert.deepEqual(fixture.cards.map(card=>card.values.map(value=>value.value)), [[8],[5],[8]]);
});

test('closed Smith row checks reject wrong deltas, wrong ownership, hidden unused state and missing rows', () => {
  assert.ok(matchesSmithRows(rows(), fixture.selected.affectedRows));
  for (const mutate of [
    value => value[0].values[0].after = '10',
    value => value[1].role = 'guard · not in active deck',
    value => value[2].unused = false,
    value => value[2].opacity = 1,
    value => value[0].open = true,
    value => value.pop(),
  ]) {
    const bad = rows(); mutate(bad); assert.equal(matchesSmithRows(bad, fixture.selected.affectedRows), false);
  }
});

test('Armoury proof requires every real committed instance and improved damage or Block', () => {
  assert.ok(matchesCommittedCards(cards(), fixture.cards));
  for (const mutate of [value => value[0].values[0].values=['5'], value => value[1].values[0].values=['2'],
    value => value[1].values[0].kind='damage', value => value[2].instanceId='wrong-copy', value => value.pop()]) {
    const bad = cards(); mutate(bad); assert.equal(matchesCommittedCards(bad,fixture.cards), false);
  }
});

test('text fit checks reject clipped numeric descendants even when the parent row fits', () => {
  const number = { text:'8',left:250,right:260,width:10,height:16,clipLeft:20,clipRight:280 };
  assert.ok(smithTextFits([number]));
  assert.equal(smithTextFits([{...number,right:310}]), false);
  assert.equal(smithTextFits([{...number,left:10}]), false);
  assert.equal(smithTextFits([{...number,width:0}]), false);
  assert.equal(smithTextFits([]), false);
});

test('Smith browser gate preserves real pointer/hold deadlines and uses production navigation/state', () => {
  const source = readFileSync(new URL('../tools/armament-smithing-ui.mjs',import.meta.url),'utf8');
  assert.match(source, /timeout = 15000/);
  assert.match(source, /await wait\(700\)/);
  assert.match(source, /document\.elementFromPoint\(x,y\)/);
  assert.match(source, /target\.width >= 44 && target\.height >= 44 && target\.centreHit/);
  assert.match(source, /await click\('#shrine-leave'\)/);
  assert.match(source, /window\.__restStateForShot\(\)/);
  assert.match(source, /smithTextFits\(zero\.textGeometry\)/);
  for (const width of [1200,390,375,320]) assert.match(source, new RegExp(`width: ${width},`));
  assert.doesNotMatch(source, /details\.armoury-card-row/);
});


test('hold proof rejects wrong payment, tier, missing copies and altered saved upgraded instances', () => {
  const state = () => {
    const live={smithingStones:0,itemUpgradeLevels:{'armament/straightSword':1},deck:fixture.cards.map(row=>({instanceId:row.instanceId,cardId:row.cardId,smithingLevel:1}))};
    live.deck.push({instanceId:'shot1',cardId:'bashingBlow'});
    const saved=structuredClone(live);Object.assign(saved.deck.at(-1),{damageSchool:'physical',exposureBuildupPerHit:0});
    return {live,saved};
  };
  assert.ok(matchesSmithCommit(state(),fixture,state()),'unrelated shot-card schema defaults do not hide the committed equipment');
  for(const mutate of [value=>value.saved.smithingStones=1,value=>value.saved.itemUpgradeLevels['armament/straightSword']=0,
    value=>value.saved.deck[0].smithingLevel=0,value=>value.saved.deck[1].cardId='strike',value=>value.saved.deck.splice(2,1),
    value=>value.saved.deck[0].sourceArmamentId='wrong',value=>value.saved.deck.at(-1).damageSchool='fire']) {
    const bad=state();mutate(bad);assert.equal(matchesSmithCommit(bad,fixture,state()),false);
  }
});


test('Smith label geometry rejects mid-word wrapping and ellipsis clipping', () => {
  const word={text:'TECHNIQUE',lineCount:1,left:20,right:120,width:100,height:16,clipLeft:20,clipRight:240};
  assert.ok(smithWordsFit([word]));
  assert.equal(smithWordsFit([{...word,lineCount:2,height:32}]),false,'splitting a word over two visible lines is not a fit');
  assert.equal(smithWordsFit([{...word,clipRight:70}]),false,'an ellipsized name does not pass because its parent box fits');
  assert.equal(smithWordsFit([]),false);
});
