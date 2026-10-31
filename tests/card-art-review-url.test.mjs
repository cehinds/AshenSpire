import test from 'node:test';
import assert from 'node:assert/strict';
import {gameRootURL} from '../src/ui/tools/cardArtReviewUrl.js';

test('the review tool resolves assets at the game root, keeping a deployment prefix',()=>{
  assert.equal(gameRootURL('http://localhost/src/ui/tools/cardArtReview.js').href,'http://localhost/');
  assert.equal(gameRootURL('https://x/AshenSpire/src/ui/tools/cardArtReview.js').href,'https://x/AshenSpire/');
});
