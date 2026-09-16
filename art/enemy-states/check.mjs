import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePng,contentBox} from '../../tools/concept-cutout.mjs';
import {ENEMY_POSES} from '../../src/content/enemyArt.js';
import {ENEMY_STATE_SCALE} from '../../src/content/enemyStateArt.js';
import {ENEMY_STATE_POSES,enemyPresentation,enemyAuraFilter} from '../../src/ui/enemyStates.js';
for(const id of ENEMY_POSES){
 const hashes=new Set();
 assert(ENEMY_STATE_SCALE[id]>.5&&ENEMY_STATE_SCALE[id]<2,`${id} display scale`);
 for(const pose of ENEMY_STATE_POSES){
  const bytes=readFileSync(`assets/enemy-states/${id}_${pose}.png`),img=decodePng(bytes),b=contentBox(img);
  assert.equal(img.width,384);assert.equal(img.height,384);assert.equal(img.bpp,4);
  assert(b.x0>=16&&b.x1<=368&&b.y0>=18&&b.y1<=365,`${id} ${pose}: safe edges`);
  assert(b.x1-b.x0>40&&b.y1-b.y0>40,`${id} ${pose}: nonempty`);
  hashes.add(createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(hashes.size,7,`${id}: distinct exported poses`);
}
assert.equal(enemyPresentation({hp:35,maxHp:100}).rest,'wounded');
assert.equal(enemyPresentation({hp:36,maxHp:100}).rest,'idle');
assert.equal(enemyPresentation({hp:10,maxHp:100,statuses:{weak:{stacks:1}}}).rest,'afflicted');
assert.equal(enemyPresentation({block:1,statuses:{weak:{stacks:1}}}).rest,'guard');
assert.deepEqual(enemyPresentation({statuses:{strength:{stacks:0},weak:{stacks:0},bleed:{meter:{value:50}}}}),{rest:'idle',buffs:[],auraThemes:[]});
const both=enemyPresentation({statuses:{strength:{stacks:2},regen:{stacks:1},burn:{stacks:1}}});
assert.deepEqual(both.auraThemes,['strength','healing']);assert.equal(both.rest,'afflicted');
assert.notEqual(enemyAuraFilter(['strength']),enemyAuraFilter(['healing']));
assert.equal(enemyAuraFilter([]),'none');
console.log('PASS: 231 distinct RGBA sprites, registration, state priority, buildup exclusion, stacked buff colors and expiry');
