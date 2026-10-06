import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { alternativeArtCatalog as catalog } from '../src/ui/alternativeArtCatalog.js';

test('every runtime sprite/layer resolves to the bytes pinned in source identity',()=>{
  const entries=[...Object.values(catalog.sprites).map(s=>s.path),...Object.values(catalog.layers)];
  assert.equal(Object.values(catalog.sprites).filter(s=>s.family==='armor').length,19);
  assert.equal(Object.values(catalog.sprites).filter(s=>s.family==='enemy').length,33);
  for(const path of entries){
    const bytes=readFileSync(new URL('../'+path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),catalog.hashes[path.split('/').pop()],path);
  }
  for(const sprite of Object.values(catalog.sprites)){
    const [w,h]=sprite.size,[x0,y0,x1,y1]=sprite.bounds;
    assert(x0>=0 && y0>=0 && x1>x0 && y1>y0 && x1<=w && y1<=h,sprite.name);
  }
});
