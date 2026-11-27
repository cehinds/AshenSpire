// Configured Core rewards and shop stock use the character-level combat-power
// rank band. The legacy reward entry point still accepts an act tier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, gameProfileShopStock, gameProfileRewardPools } from '../src/model/gameProfileRewards.js';
import { productionBundle } from './helpers/production-bundle.mjs';
import { cardCombatPower } from '../src/content/generated/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';
import { FilterToRankBand, FilterToBand, RankBandForLevel } from '../src/model/levelLists.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = (seed, level = 1) => { const run = createRunState({ seed, classId: 'reaver', registries: reg, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } }); run.level.level = level; return run; };
const offer = (seed, level) => gameProfileRewardOffers(reg, fresh(seed, level), createRng(seed), { offerId: `t:${seed}:${level}`, source: 'combat', pool: 'normal' });
const cardsOf = (o) => o.options.filter(x => x.kind === 'combatCards').map(x => x.id);
const act1 = scoring.levelLists.tiers[0];
const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1);

function assertEligibleOffer(run, result, level) {
  let candidates=gameProfileRewardPools(reg,run).combatCards;
  for(const option of result.options){
    if(option.kind==='combatCards'){
      const possible=new Set([false,true].flatMap(rareBoost=>FilterToRankBand('cards',candidates,RankBandForLevel({level,rareBoost}))));
      assert.ok(possible.has(option.id),`${option.id} belongs to a current band or its empty-band fallback`);
    }
    candidates=candidates.filter(id=>id!==option.id);
  }
}

test('level-one rewards follow current eligible bands, including empty-band fallback', () => {
  for(const seed of SEEDS){const run=fresh(seed,1);const result=gameProfileRewardOffers(reg,run,createRng(seed),{offerId:`t:${seed}:1`,source:'combat',pool:'normal'});assertEligibleOffer(run,result,1);}
});

test('higher character bands admit higher ranks when those candidates exist', () => {
  const table = { cardCombatPower: { low: { rank: 1 }, high: { rank: 4 } }, itemCombatPower: {} };
  const ids = ['low', 'high'];
  assert.deepEqual(FilterToRankBand('cards', ids, { ...RankBandForLevel({ level: 1, maxRank: 5 }), table }), ['low']);
  assert.deepEqual(FilterToRankBand('cards', ids, { ...RankBandForLevel({ level: 5, maxRank: 5 }), table }), ids);
  assert.deepEqual(FilterToRankBand('cards', ['high'], { ...RankBandForLevel({ level: 1, maxRank: 5 }), table }), ['high'], 'empty band falls back to available content');
  assert.deepEqual(FilterToRankBand('cards', ['unknown', ...ids], { minRank: 0, maxRank: 1, table }), ['unknown', 'low'], 'unscored content remains available');
});

test('the same seed gives the same offer', () => {
  for (const seed of [3, 17, 91]) assert.deepEqual(offer(seed, 1).options, offer(seed, 1).options);
});

test('an empty tier falls back and the actual legacy door filters mixed pools through its tierId', () => {
  // Use known scored IDs so the production filter treats the controlled high
  // entries as out of band, rather than preserving them as unknown content.
  const ids = Array.from({length:8},(_,i)=>`fixture.band.${i}`), high = ids.slice(0, 4), low = ids.slice(4);
  const table = Object.fromEntries(ids.map((id,i)=>[id,{rank:i<4?4:1}]));
  const lists = { cards: { act1: low, act3: high }, items: {} };
  const bundled = productionBundle({ sourceOverrides: {
    'src/content/generated/combatPower.js': `export const cardCombatPower = ${JSON.stringify(table)};\nexport const itemCombatPower = {};`,
    'src/content/generated/levelLists.js': `export const levelLists = ${JSON.stringify(lists)};`,
  } });
  const { rollCardRewardIds } = bundled('src/engine/encounters.js');
  const { createRng } = bundled('src/engine/rng.js');
  const mk = ids => ({ balance: { rewards: { cardChoices: 3, rarityWeights: { normal: { common: 1 } } } }, classes: { get: () => ({ cardPool: ids }) }, cards: { get: id => ({ id, rarity: 'common' }), all: () => [] } });
  const draw = (pool, seed, tierId = 'act1') => Array.from(rollCardRewardIds(mk(pool), createRng(seed), { classId: 'x', pool: 'normal', tierId }));
  const fallback = draw(high, 5);
  assert.ok(fallback.length > 0); assert.ok(fallback.every(id => high.includes(id)), 'an empty tier keeps the original candidate pool');
  const mixed = draw([...high, ...low], 5);
  assert.ok(mixed.length > 0); assert.ok(mixed.every(id => low.includes(id)), 'the real tierId branch removes scored out-of-band candidates');
  const unfiltered = new Set();
  for (let seed = 1; seed <= 40; seed++) for (const id of draw([...high, ...low], seed, null)) unfiltered.add(id);
  assert.ok(high.some(id => unfiltered.has(id)), 'without tierId high candidates remain available');
  assert.deepEqual(draw([...high, ...low], 9), draw([...high, ...low], 9));
});

test('shop shelves apply current character bands to eligible authored candidates', () => {
  for(const seed of SEEDS)for(const level of [1,Math.min(5,scoring.rank.maxRank)]){
    const run=fresh(seed,level),stock=gameProfileShopStock(reg,run,createRng(seed),{shopId:'m'});
    assertEligibleOffer(run,stock,level);
  }
});
