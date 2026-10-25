import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, gameProfileShopStock } from '../src/model/gameProfileRewards.js';

// Core 1 must stay exactly as it was before the Core 2 reward weighting: the module settings deep-merge with the
// defaults, so the bundle pins every default tag key to 1 and the uniform rng.pick path runs. Expected rows were
// captured from the commit this work branched from (dev): [combat offer, level offer, act1 shop stock, cardRewards, shop counters].
const DEV = { "1": [ "cutpursesCoin,warden,base.gain-resource", "base.scale-negative-status,base.paid-resource-variant,base.ethereal", "wondrousDraught,core.reaverSpecial,base.transmute", 18, 0 ], "2": [ "kindlingCharm,wondrousDraught,goldFigurine", "base.transmute,base.recover-exile,base.gain-resource", "restlessClasp,ivoryComb,parryDagger", 18, 0 ], "3": [ "oathsworn,crimsonFlask,boneSceptre", "base.shuffle-deck,base.retain-block,base.break-poise", "core.reaverSpecial,shortbow,emberlightSceptre", 18, 0 ], "4": [ "warden,kiteShield,vigil", "base.evade,base.generate-smash,base.drain-allies", "azureFlask,hollowedHorn,emberlightSceptre", 18, 0 ], "5": [ "base.mirrors,core.reaverSpecial,flaskOfStone", "base.extra-shield,base.charm,base.damage-per-use", "core.reaverSpecial,flaskOfStone,bloodUnction", 18, 0 ], "6": [ "oathsworn,base.reveal-opponent-hand,core.reaverSpecial", "base.damage-per-use,base.attack-then-defend,base.pay-x-targets", "core.evade,wondrousDraught,base.foresight", 18, 0 ], "7": [ "towerShield,base.scout,oathsworn", "base.immediate-stance-transition,base.multi-stance,base.reflect", "core.reaverSpecial,emberlightSceptre,whetstonePouch", 18, 0 ], "8": [ "core.reaverSpecial,emberlightSceptre,warden", "base.break-poise,base.hide-cards,base.reveal-opponent-hand", "blightCoating,base.damage-per-use,boneSceptre", 18, 0 ], "9": [ "base.immediate-stance-transition,azureFlask,nightweave", "base.buff-ally,base.status-card-paralyze,base.recover-exile", "riteVestments,core.reaverSpecial,base.generate-smash", 18, 0 ], "10": [ "azureFlask,vigil,crimsonFlask", "base.perception-untargetable,base.evade,base.draw", "core.reaverSpecial,base.paid-resource-variant,base.scout", 18, 0 ], "11": [ "warden,towerShield,base.extra-shield", "base.mirrors,base.conditional-damage-bonus,base.transmute", "warhorn,core.reaverSpecial,base.immediate-stance-transition", 18, 0 ], "12": [ "base.scout,flaskOfFerocity,bloodUnction", "base.force-stance,base.immediate-stance-transition,base.gain-resource", "emberlightSceptre,base.break-poise,buckler", 18, 0 ], "13": [ "emberFragment,riteVestments,gutterLeathers", "base.mirrors,base.recover-exile,base.current-stance-variant", "gutterLeathers,buckler,core.reaverSpecial", 18, 0 ], "14": [ "base.attack-then-defend,core.reaverSpecial,crimsonFlask", "base.foresight,base.recover-exile,base.extra-shield", "base.ethereal,base.modify-card-stance,azureFlask", 18, 0 ], "15": [ "base.scout,core.reaverSpecial,kiteShield", "base.status-card-paralyze,base.transmute,base.pay-x-targets", "base.hide-cards,base.one-use-scroll,kiteShield", 18, 0 ], "16": [ "shortbow,cutpursesCoin,wondrousDraught", "base.paid-resource-variant,base.gain-resource,base.perception-untargetable", "spikedShield,flaskOfFerocity,azureFlask", 18, 0 ], "17": [ "flaskOfFerocity,base.force-stance,crackedLantern", "base.scale-negative-status,base.conditional-damage-bonus,base.attack-then-defend", "core.reaverSpecial,straightSword,emberwickCharm", 18, 0 ], "18": [ "emberlightSceptre,flaskOfFerocity,wayfarerPlate", "base.growth-per-type,base.restrained,base.transmute", "flaskOfFerocity,wayfarersKnot,wondrousDraught", 18, 0 ], "19": [ "base.transmute,base.draw,base.extra-shield", "base.generate-smash,base.exhaust-choose,base.extra-weapon", "watchmansBadge,progression-cracked-war-anvil,core.reaverSpecial", 18, 0 ], "20": [ "warden,oathsworn,nightweave", "base.stat-buff,base.break-poise,base.conditional-damage-bonus", "kiteShield,emberlightSceptre,base.charm", 18, 0 ]
};
const p = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@1.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, p)), p);
test('Core 1 offers and shop stock over 20 seeds equal the pre-weighting output, with no per-offer price roll', () => {
  for (const [seed, expected] of Object.entries(DEV)) {
    const run = createRunState({ seed: Number(seed), classId: 'reaver', registries: reg });
    const rng = createRng(Number(seed));
    const combat = gameProfileRewardOffers(reg, run, rng, { offerId: 'c' });
    const level = gameProfileRewardOffers(reg, run, rng, { offerId: 'l', source: 'level' });
    const shop = gameProfileShopStock(reg, run, rng, { shopId: 'act1' });
    const counters = rng.getCounters();
    assert.deepEqual([combat.options.map(x => x.id).join(','), level.options.map(x => x.id).join(','), shop.options.map(x => x.id).join(','), counters.cardRewards, counters.shop], expected, `seed ${seed}`);
    assert.ok(shop.options.every(option => option.price === undefined), 'Core 1 shop offers carry no rolled price');
  }
});
