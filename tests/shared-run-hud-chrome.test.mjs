import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedRunHudHtml } from '../src/ui/components/hudmeta.js';
import { runHudViewModel } from '../src/ui/viewModels/RunHudViewModel.js';
import { withKitDom } from './helpers/kit-dom.mjs';
for (const place of ['map','combat','rest','shop','event']) test(`${place} mounts the canonical shared chrome without duplicating controls`,()=>withKitDom(()=>{
  const markup=sharedRunHudHtml(runHudViewModel({place,cinders:42,act:1,floor:1,identity:{className:'Reaver'},controls:{armouryId:'armoury',menuId:'menu',menuHint:'Escape'}}));
  assert.match(markup,/data-shared-chrome="true"/);
  assert.equal((markup.match(/class="hud-info-row hud-cinders-strip/g)||[]).length,1);
  assert.equal((markup.match(/id="armoury"/g)||[]).length,1);
  assert.equal((markup.match(/id="menu"/g)||[]).length,1);
}));
