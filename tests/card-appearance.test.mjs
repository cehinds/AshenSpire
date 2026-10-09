import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCardAppearance} from '../src/model/cardAppearance.js';
import {cardLayoutDocumentWithChanges} from '../src/model/cardLayoutDocument.js';
const master=JSON.parse(readFileSync(new URL('../src/content/card-layout.json',import.meta.url),'utf8'));
test('master visual definitions validate and survive an editor layout save',()=>{
 assert.equal(validateCardAppearance(master),master);
 const input={...master,layouts:{shared:{...master.layouts.shared,panel:master.referenceRects.panel}},components:{...master.components,'panel-trim':{href:'assets/card-components/custom.png',fit:'fill'}}};
 const saved=cardLayoutDocumentWithChanges(master,input);assert.equal(saved.components['panel-trim'].href,'assets/card-components/custom.png');assert.deepEqual(saved.symbols,master.symbols);assert.deepEqual(saved.layers,master.layers);
});
test('visual data cannot inject executable markup or escape the asset directory',()=>{
 for(const href of ['https://example.com/a.png','assets/../secret.png','javascript:alert(1)'])assert.throws(()=>validateCardAppearance({components:{panel:{href}}}));
 for(const body of ['<script>alert(1)</script>','<path onload="alert(1)" d="M0 0"/>','<foreignObject/>','<path fill="url(https://example.com)" d="M0 0"/>'])assert.throws(()=>validateCardAppearance({symbols:{actions:{smash:{svg:{viewBox:'0 0 32 32',body}}}}}));
 assert.throws(()=>validateCardAppearance({components:{title:{href:'assets/title.png'}}}),/supplied by the card/);
});
