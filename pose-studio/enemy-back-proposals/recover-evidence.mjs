import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out='docs/preview/features/enemy-back-sprites',record=JSON.parse(await readFile(out+'/capture-record.json','utf8'));
assert.equal(record.sourceCommit,'a017ef6b78f7a60101065871778693d0358e5383');assert.equal(record.evidenceKind,'exact-artifact-browser-capture');assert.equal(record.records.length,4);
for(const row of record.records){const bytes=await readFile(out+'/'+row.name+'.png');assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),row.width);assert.equal(bytes.readUInt32BE(20),row.height);}
const url=record.playableUrl,version=record.version,stamp={digest:record.digest},source=record.sourceCommit,artifactUrl=record.artifactUrl,readme=await readFile('README.md','utf8');
const block='<!-- feature-preview:start -->\n## Feature preview — Enemy rear designs\n\n[Open the public feature preview]('+url+') — final source publication is pending; screenshots below verify the exact downloadable artifact.\n\nOpen **Rear designs** to compare 130 neutral rear-view design drafts. v01 remains provisional; stance and motion coverage is labelled separately. Artifact build '+version+' ('+stamp.digest+'), source '+source.slice(0,12)+'. The final public payload has not been verified yet.\n\n[Download this review build]('+artifactUrl+') · [Capture record]('+out+'/capture-record.json)\n\n| Mobile | Desktop | Wide | Tablet |\n| --- | --- | --- | --- |\n| ![Mobile: Wyrm Aspirant rear proposals]('+out+'/mobile.png) | ![Desktop: Court Duelist rear proposals]('+out+'/desktop.png) | ![Wide: Wyrm Lord rear proposals]('+out+'/wide.png) | ![Tablet: Fell Warden rear proposals]('+out+'/tablet.png) |\n<!-- feature-preview:end -->';
const cleaned=readme.replace(/<!-- feature-preview:start -->[\s\S]*?<!-- feature-preview:end -->\s*/,'');
await writeFile('README.md',cleaned.replace(/^(# [^\r\n]+\r?\n)/,'$1\n'+block+'\n\n'));

execFileSync(process.execPath,['tools/feature-preview.mjs','--check'],{stdio:'inherit'});
const box=JSON.parse(await readFile('buildordinal.json','utf8')),changelog=await readFile('CHANGELOG.md','utf8');
const receipt='- **Rear enemy designs have a feature-only review gallery** ([#2071](https://github.com/cehinds/AshenSpire/pull/2071), `'+box.release+'.'+box.ordinal+'`). Compare 130 rear design drafts, original identity references, and three elite pilot sets with nine held poses, attack and evade clips, and static hurt and defeated reactions. Missing clips stay explicit. This draft review is not promoted: runtime alignment, playable unlocks, other motion sets, and external art publication remain pending.\n\n';
if(!changelog.includes('/pull/2071)'))await writeFile('CHANGELOG.md',changelog.replace('## 2026-10-17\n\n','## 2026-10-17\n\n'+receipt));
execFileSync(process.execPath,['tools/receipts.mjs','--check','--pr','2071'],{stdio:'inherit'});
console.log(JSON.stringify(record));
