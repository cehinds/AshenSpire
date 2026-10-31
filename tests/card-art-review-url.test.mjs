import test from 'node:test';
import assert from 'node:assert/strict';
import {gameRootURL} from '../src/ui/tools/cardArtReviewUrl.js';

test('the review tool resolves assets at the game root, keeping a deployment prefix',()=>{
  assert.equal(gameRootURL('http://localhost/src/ui/tools/cardArtReview.js').href,'http://localhost/');
  assert.equal(gameRootURL('https://x/AshenSpire/src/ui/tools/cardArtReview.js').href,'https://x/AshenSpire/');
});

import {containRect} from '../src/ui/tools/cardArtReviewGeometry.js';
test('PNG export draws a sprite contained in its edited box, not stretched',()=>{
  assert.deepEqual(containRect(200,100,100,100),{x:-50,y:-50,width:100,height:100});
  assert.deepEqual(containRect(100,200,200,100),{x:-50,y:-25,width:100,height:50});
  assert.deepEqual(containRect(80,60,40,30),{x:-40,y:-30,width:80,height:60});
});
