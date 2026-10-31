import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as atlas from '../src/ui/screens/worldAtlas.js';

test('layered atlas illustrations retain a named image with escaped location and scene labels',()=>{
  assert.equal(typeof atlas.atlasLayeredPreviewHtml,'function');
  const html=atlas.atlasLayeredPreviewHtml('Crown "Market" & <Gate>',{id:'fixture',label:'Stone & "rain"',layers:[]});
  assert.match(html,/^<div class="atlas-layered-preview" role="img" aria-label="Crown &quot;Market&quot; &amp; &lt;Gate&gt; — Stone &amp; &quot;rain&quot;">/);
  assert.match(html,/aria-hidden="true"/,'individual decorative layers stay hidden under the named image');
});
test('both atlas illustration surfaces use the shared named wrapper',()=>{
  const source=readFileSync(new URL('../src/ui/screens/worldAtlas.js',import.meta.url),'utf8');
  assert.match(source,/atlasLayeredPreviewHtml\(n\.displayName, layeredScene\)/);
  assert.match(source,/atlasLayeredPreviewHtml\(point\.displayName, previewScene\)/);
});
