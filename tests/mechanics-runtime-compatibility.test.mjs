import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectMechanicsRuntimeArtifacts,loadGameProfileCatalog,MECHANIC_RUNTIME_PATH} from '../tools/game-config.mjs';
import {gameDigest,resolveGameAuthor,validateResolvedGameProfile} from '../engine/kernel/gameConfig.js';

const repo=fileURLToPath(new URL('..',import.meta.url));
const mechanic='defense.wardProtection';
function fixture() {
  const root=mkdtempSync(join(tmpdir(),'ashen mechanic compatibility '));
  const copy=file=>{mkdirSync(dirname(join(root,file)),{recursive:true});cpSync(join(repo,file),join(root,file),{recursive:true});};
  for(const file of ['content/source/fixCoreMechanics.json','src/model/mechanicsKernel.js','src/model/formulas.js','src/model/fixCoreMechanics.js',`engine/mechanics/${mechanic}`])copy(file);
  const index='engine/mechanics/index.json';
  writeFileSync(join(root,index),JSON.stringify({format:'ashen.mechanics-index@1',mechanics:[{id:mechanic,tag:'defense:wardProtection',family:'defense',portability:'portable',modules:['effects']}]}));
  return root;
}
function editJSON(root,path,mutate) {
  const file=join(root,path),value=JSON.parse(readFileSync(file,'utf8'));mutate(value);writeFileSync(file,JSON.stringify(value,null,2)+'\n');
}
const baseline=loadGameProfileCatalog();
function pin(root) {
  const runtimeArtifacts=baseline.runtimeArtifacts.map(row=>row.id==='ashen.mechanics-runtime'
    ? {...row,hash:gameDigest(collectMechanicsRuntimeArtifacts(root))}:row);
  return {runtimeArtifacts,runtimeHash:gameDigest(runtimeArtifacts)};
}
const changes=[
  ['canonical JSON-only multiplier',root=>editJSON(root,'content/source/fixCoreMechanics.json',rules=>{rules.stance.discount+=1;})],
  ['registered parameter default',root=>editJSON(root,`engine/mechanics/${mechanic}/mechanic.json`,manifest=>{manifest.parameters.properties.multiplier.default=0.6;})],
  ['registered service expression',root=>editJSON(root,`engine/mechanics/${mechanic}/service.json`,service=>{service.modifiers[0].value=0.6;})],
  ['class attachment eligibility',root=>editJSON(root,`engine/mechanics/${mechanic}/mechanic.json`,manifest=>{manifest.attaches=manifest.attaches.filter(kind=>kind!=='character');})],
  ['status attachment eligibility',root=>editJSON(root,`engine/mechanics/${mechanic}/mechanic.json`,manifest=>{manifest.attaches=manifest.attaches.filter(kind=>kind!=='status');})],
  ['behavior tag registration',root=>editJSON(root,'engine/mechanics/index.json',index=>{index.mechanics[0].tag='defense:renamedProtection';})],
  ...['mechanicsKernel','formulas','fixCoreMechanics'].map(name=>[`live ${name} evaluator`,root=>{
    const file=join(root,`src/model/${name}.js`);writeFileSync(file,readFileSync(file,'utf8')+'\nexport const compatibilityProbe = 1;\n');
  }]),
];
for(const [label,change] of changes)test(`${label} changes runtimeHash and rejects a save pinned to old rules`,()=>{
  const root=fixture();
  try {
    const before=pin(root),oldCatalog={...baseline,...before};
    const saved=resolveGameAuthor({formatVersion:1,core:'ashen.core@1.0.0',modules:{}},oldCatalog);
    assert.equal(saved.lock.runtimeHash,before.runtimeHash);
    change(root);const after=pin(root);
    assert.notEqual(after.runtimeHash,before.runtimeHash);
    assert.throws(()=>validateResolvedGameProfile(saved,after.runtimeHash),/unsupported runtime artifact/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('guides, mechanic cases, unrelated source and JSON whitespace do not invalidate runtimeHash',()=>{
  const root=fixture();
  try {
    const before=pin(root).runtimeHash;
    writeFileSync(join(root,`engine/mechanics/${mechanic}/guide.md`),'# Updated designer guide\n');
    writeFileSync(join(root,`engine/mechanics/${mechanic}/cases.json`),'[]\n');
    writeFileSync(join(root,'src/model/authorNotes.md'),'# Authoring notes\n');
    writeFileSync(join(root,'src/model/unrelatedPresentation.js'),'export const label = "UI only";\n');
    const file=join(root,'content/source/fixCoreMechanics.json');writeFileSync(file,JSON.stringify(JSON.parse(readFileSync(file,'utf8'))));
    assert.equal(pin(root).runtimeHash,before);
    const actual=baseline.runtimeArtifacts.find(row=>row.id==='ashen.mechanics-runtime');
    assert.equal(actual.path,MECHANIC_RUNTIME_PATH);
    const artifacts=collectMechanicsRuntimeArtifacts();
    assert.ok(artifacts.some(row=>row.path==='engine/mechanics/combat.statuses/service.json'));
    assert.ok(artifacts.some(row=>row.path==='src/model/mechanicsKernel.js'));
    assert.ok(artifacts.every(row=>!row.path.endsWith('guide.md')&&!row.path.endsWith('cases.json')));
  } finally {rmSync(root,{recursive:true,force:true});}
});
