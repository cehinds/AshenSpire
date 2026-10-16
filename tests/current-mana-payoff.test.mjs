import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
const registries = createRegistries(contentBundle);
// Frozen former resolved prices plus the shared one-Mana minimum. Stronger
// effects must not silently buy another SP/MP through the budget formula.
const costs = {
  "cometFragment": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      2,
      2
    ],
    [
      2,
      3
    ],
    [
      2,
      3
    ]
  ],
  "ashenMote": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      2,
      2
    ],
    [
      2,
      3
    ],
    [
      2,
      3
    ]
  ],
  "forceNudge": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "holySpark": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "progression-cinder-orbit": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      1,
      2
    ],
    [
      1,
      3
    ],
    [
      1,
      3
    ]
  ],
  "progression-blood-censer": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      1,
      2
    ],
    [
      1,
      3
    ],
    [
      1,
      3
    ]
  ],
  "emberVigil": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      1,
      2
    ],
    [
      1,
      3
    ]
  ],
  "progression-lunar-aegis": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      1,
      2
    ]
  ],
  "progression-ash-benediction": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      1,
      2
    ]
  ],
  "readTheAsh": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      1,
      2
    ],
    [
      1,
      3
    ]
  ],
  "attune": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "emberCommunion": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "transfusion": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "warmLitany": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "cinderSigil": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      2,
      3
    ],
    [
      2,
      3
    ],
    [
      2,
      4
    ]
  ],
  "starPath": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      1,
      2
    ],
    [
      1,
      3
    ]
  ],
  "shieldBash": [
    [
      2,
      1
    ],
    [
      1,
      1
    ],
    [
      2,
      1
    ],
    [
      2,
      1
    ],
    [
      2,
      1
    ],
    [
      3,
      1
    ]
  ],
  "quickstep": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "scholarsInsight": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      1,
      2
    ],
    [
      1,
      3
    ]
  ],
  "blightTouch": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      1,
      3
    ],
    [
      1,
      3
    ],
    [
      2,
      4
    ]
  ],
  "penance": [
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      1
    ],
    [
      1,
      2
    ],
    [
      2,
      2
    ]
  ],
  "urgentHeal": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "rimeNeedle": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "staticNeedle": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "drowsingMote": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ],
  "rotMote": [
    [
      1,
      1
    ],
    [
      1,
      1
    ]
  ]
};
const minimum = {
  "cometFragment": [
    "damage",
    8
  ],
  "ashenMote": [
    "damage",
    8
  ],
  "forceNudge": [
    "damage",
    8
  ],
  "holySpark": [
    "damage",
    8
  ],
  "progression-cinder-orbit": [
    "damage",
    8
  ],
  "progression-blood-censer": [
    "damage",
    8
  ],
  "emberVigil": [
    "block",
    8
  ],
  "progression-lunar-aegis": [
    "block",
    8
  ],
  "progression-ash-benediction": [
    "block",
    8
  ],
  "readTheAsh": [
    "draw",
    2
  ],
  "attune": [
    "restoreMana",
    2
  ],
  "emberCommunion": [
    "restoreMana",
    2
  ],
  "transfusion": [
    "heal",
    8
  ],
  "warmLitany": [
    "heal",
    5
  ],
  "cinderSigil": [
    "damage",
    8
  ],
  "starPath": [
    "draw",
    2
  ],
  "shieldBash": [
    "damage",
    8
  ],
  "quickstep": [
    "block",
    8
  ],
  "scholarsInsight": [
    "draw",
    2
  ],
  "blightTouch": [
    "damage",
    8
  ],
  "penance": [
    "block",
    8
  ],
  "urgentHeal": [
    "heal",
    8
  ],
  "rimeNeedle": [
    "damage",
    6
  ],
  "staticNeedle": [
    "damage",
    6
  ],
  "drowsingMote": [
    "damage",
    5
  ],
  "rotMote": [
    "damage",
    6
  ]
};
test('current paid entry cards keep their resource prices and provide their promised payoff', () => {
 for (const [id, prices] of Object.entries(costs)) {
  const definition = registries.cards.get(id);
  let previous = 0;
  for (const [rank, price] of prices.entries()) {
   const ref = definition.gradeProfiles ? {cardId:id, abilityRank:rank} : {cardId:id, upgraded:rank===1};
   const card = resolveCard(registries, ref);
   assert.deepEqual([card.cost, card.manaCost], price, id+'/'+rank);
   const [op, floor] = minimum[id];
   const payoff = card.effects.find(e=>e.op===op)?.amount;
   assert.ok(payoff >= floor, id+'/'+rank+' payoff');
   assert.ok(payoff >= previous, id+'/'+rank+' never weakens its prior grade');
   previous = payoff;
  }
 }
});

test('recovery and setup keep their distinct extra effects', () => {
 const communion=resolveCard(registries,{cardId:'emberCommunion'});
 assert.equal(communion.effects.find(e=>e.op==='heal').amount,5);
 const litany=resolveCard(registries,{cardId:'warmLitany'});
 assert.equal(litany.effects.find(e=>e.op==='block').amount,5);
 for (const id of ['rimeNeedle','staticNeedle','drowsingMote','rotMote']) {
  const card=resolveCard(registries,{cardId:id});
  assert.ok(card.effects.some(e=>e.op==='buildup' && e.amount===3 && e.chance===50),id+' preserves setup pressure');
  assert.equal(card.upcast.damagePerRank,1,id+' keeps existing upcast growth');
 }
});
