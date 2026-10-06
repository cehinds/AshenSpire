import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {contentBundle} from '../src/content/index.js';
import {BASIC_CARD_PROFILES} from '../src/content/equipment.js';
import {illustratedCardHtml,illustratedArtwork} from '../src/ui/components/illustratedCard.js';
import {playingCardArtwork,playingCardArt} from '../src/ui/cardArtwork.js';
import {validateSubjects,collectMasters,exportArtwork,checkArtwork,copyHighArtworkToArtRepo,checkPublishedArtwork,adoptPublishedArtwork} from '../tools/export-extended-card-art.mjs';
import {POLICY} from '../tools/mobileart-policy.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const subjects=[...contentBundle.cards.map(c=>({kind:'card',id:c.id,name:c.name,class:c.class})),...BASIC_CARD_PROFILES.map(c=>({kind:'profile',id:c.id,name:c.name||c.id}))];
const inventory={generationSubjects:subjects};
test('CLI export requires an explicit staging destination before reading authoring files',()=>{
 const result=spawnSync(process.execPath,[resolve(root,'tools/export-extended-card-art.mjs')],{encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/requires --root/);
});
function png(width,height){
 function crc(bytes){let v=0xffffffff;for(const byte of bytes){v^=byte;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}return(v^0xffffffff)>>>0;}
 function chunk(type,bytes){const name=Buffer.from(type),out=Buffer.alloc(bytes.length+12);out.writeUInt32BE(bytes.length);name.copy(out,4);bytes.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,bytes])),bytes.length+8);return out;}
 const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(Buffer.alloc((width*3+1)*height))),chunk('IEND',Buffer.alloc(0))]);
}
function fixture(t){mkdirSync(resolve(root,'scratch'),{recursive:true});const dir=mkdtempSync(resolve(root,'scratch/extended-art-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const library=resolve(dir,'library');for(const part of ['library/masters','library/receipts','src/ui'])mkdirSync(resolve(dir,part),{recursive:true});const subject=subjects[0],sourceMaster=`masters/card-${subject.id}.png`,bytes=png(256,384);writeFileSync(resolve(library,sourceMaster),bytes);writeFileSync(resolve(library,'receipts/card-'+subject.id+'.json'),JSON.stringify({...subject,sourceMaster,sha256:sha(bytes),width:256,height:384}));return{dir,library,subject,sourceMaster};}

test('art roster exactly covers every current card identity and equipment profile',()=>{
 assert.equal(validateSubjects(inventory).length,contentBundle.cards.length+BASIC_CARD_PROFILES.length);assert.throws(()=>validateSubjects({generationSubjects:subjects.slice(1)}),/current game roster/);assert.throws(()=>validateSubjects({generationSubjects:[...subjects,{kind:'card',id:'invented-card',name:'Invented'}]}),/current game roster/);
 const art={cards:Object.fromEntries(contentBundle.cards.map(c=>[c.id,'assets/cards/extended/card-'+c.id])),profiles:Object.fromEntries(BASIC_CARD_PROFILES.map(p=>[p.id,'assets/cards/extended/profile-'+p.id]))};
 for(const card of contentBundle.cards){const base={cardId:card.id},plain=playingCardArtwork(base,{extended:art});assert.ok(plain.endsWith(`card-${card.id}-512.webp`));assert.equal(playingCardArtwork({...base,upgraded:true},{extended:art}),plain,'upgrade shares '+card.id);}
 for(const profile of BASIC_CARD_PROFILES)assert.equal(playingCardArtwork({cardId:profile.baseCardId||'strike',profileId:profile.id},{extended:art,large:true}),`assets/cards/extended/profile-${profile.id}-1024.webp`);
 assert.equal(playingCardArtwork({cardId:'unknown'},{extended:art}),null);
 assert.equal(playingCardArtwork({cardId:'strike',profileId:'bladeAttack'},{extended:{cards:art.cards,profiles:{}}}),'assets/cards/slashing-strike-512.webp','existing profile beats new generic base during partial export');
});

test('receipts are required, hash checked and confined to portrait PNG masters',t=>{
 const f=fixture(t),first=collectMasters(subjects,f.library);assert.equal(first.found.length,1);assert.equal(first.missing.length,subjects.length-1);
 assert.throws(()=>exportArtwork({root:f.dir,library:f.library,inventory}),/incomplete/);
 writeFileSync(resolve(f.library,f.sourceMaster),png(257,384));assert.throws(()=>collectMasters(subjects,f.library),/hash mismatch/);
});

test('partial preview export generates desktop, mobile, portable editor bytes and high files for the canonical art release',t=>{
 const python=process.platform==='win32'?'python':'python3';
 const f=fixture(t),result=exportArtwork({root:f.dir,library:f.library,inventory,allowPartial:true,python});assert.equal(result.subjects,1);assert.equal(result.assets,2);assert.equal(result.complete,false);
 assert.throws(()=>checkArtwork({root:f.dir,library:f.library,inventory}),/coverage/);
 const staging=JSON.parse(readFileSync(resolve(f.dir,'asset-data/card-art/extended-manifest.json'))),ids=Object.keys(staging.assets);assert.equal(ids.length,2);
 const artRepo=resolve(f.dir,'art-repo');assert.equal(copyHighArtworkToArtRepo(f.dir,artRepo),2);
 for(const id of ids){const row=staging.assets[id];assert.equal(row.light.width,480);assert.equal(row.light.height,720);assert.equal(sha(readFileSync(resolve(artRepo,'hd',id))),row.high.sha256);}
 assert.throws(()=>checkPublishedArtwork({root:f.dir,inventory}),/ENOENT|current roster/);

 // Reuse must account for family-specific quality, even when global defaults,
 // dimensions, converter and every image hash remain unchanged.
 const manifestPath=resolve(f.dir,'asset-data/card-art/extended-manifest.json');
 const missingEncoder=resolve(f.dir,'missing-python');
 assert.equal(exportArtwork({root:f.dir,library:f.library,inventory,allowPartial:true,python:missingEncoder}).subjects,1,'unchanged policy reuses verified exports without encoding');
 const changedPolicy=structuredClone(staging);changedPolicy.policy.overrides[0].quality+=1;
 writeFileSync(manifestPath,JSON.stringify(changedPolicy));
 assert.throws(()=>exportArtwork({root:f.dir,library:f.library,inventory,allowPartial:true,python:missingEncoder}),/Artwork conversion failed/,'a changed family quality must invoke the encoder');
 delete changedPolicy.policy.overrides;
 writeFileSync(manifestPath,JSON.stringify(changedPolicy));
 assert.throws(()=>exportArtwork({root:f.dir,library:f.library,inventory,allowPartial:true,python:missingEncoder}),/Artwork conversion failed/,'legacy partial policy records must invoke the encoder');
 writeFileSync(manifestPath,JSON.stringify(staging));

 const path=resolve(f.dir,staging.assets[ids[0]].light.path);writeFileSync(path,Buffer.concat([readFileSync(path),Buffer.from('tampered')]));assert.throws(()=>checkArtwork({root:f.dir,library:f.library,inventory,requireComplete:false}),/changed/);
});


test('portrait artwork uses lower-action crop and enables previously hidden art without changing other layers',()=>{
 const ref={cardId:'gorefireSlash'},extended={cards:{gorefireSlash:'assets/cards/extended/card-gorefireSlash'},profiles:{}};
 const art=playingCardArt(ref,{extended});assert.equal(illustratedArtwork(ref,'gorefireSlash',{extended}).path,art.path,'generated artwork wins legacy per-card href');assert.equal(art.position,'50% 65%');assert.equal(art.extended,true);
 const model={id:'dodgeRoll',name:'Dodge Roll',costs:{action:1,mana:0,stamina:1},tags:[]};
 const html=illustratedCardHtml(model,{rules:'Roll.',painting:art.path,artworkKind:art.kind,artworkPosition:art.position,glyph:''});
 assert.match(html,/playing-card-art/);assert.match(html,/object-position:50% 65%;object-fit:cover/);
 assert.ok(html.includes('data-card-binding="rules"'));
});


test('release adoption preserves high records and adopts only complete canonical mobile metadata',t=>{
 const f=fixture(t),assets={};
 for(const subject of subjects)for(const width of [512,1024]){const id=`assets/cards/extended/${subject.kind}-${subject.id}-${width}.webp`;assets[id]={high:{path:id,bytes:2000,sha256:'a'.repeat(64),width,height:width*1.5},light:{path:id.replace('assets/','assets-mobile/'),bytes:500,sha256:'b'.repeat(64),width:480,height:720}};}
 mkdirSync(resolve(f.dir,'asset-data/card-art'),{recursive:true});
 const stagingPath=resolve(f.dir,'asset-data/card-art/extended-manifest.json'),releasePath=resolve(f.dir,'art-manifest.json');
 const staging={schema:1,encoder:{pillow:'test'},policy:POLICY,assets:structuredClone(assets)};
 const first=Object.keys(assets)[0];staging.assets[first].light.sha256='c'.repeat(64);
 writeFileSync(stagingPath,JSON.stringify(staging));
 writeFileSync(resolve(f.dir,'art-release.json'),JSON.stringify({schema:2,repo:'cehinds/AshenSpire-art',tag:'hd-assets-v13',packs:{light:{zip:'light-assets-v13.zip',sha256:'d'.repeat(64)}}}));
 const publish=()=>writeFileSync(releasePath,JSON.stringify({schema:2,assets}));publish();
 assert.throws(()=>checkPublishedArtwork({root:f.dir,inventory}),/Pinned mobile metadata differs/);
 const before=readFileSync(stagingPath,'utf8');
 assets[first].high.sha256='e'.repeat(64);publish();
 assert.throws(()=>adoptPublishedArtwork({root:f.dir,inventory}),/Pinned artwork differs/);
 assert.equal(readFileSync(stagingPath,'utf8'),before,'failed adoption must leave all metadata unchanged');
 assets[first].high.sha256='a'.repeat(64);const mobile=assets[first].light;delete assets[first].light;publish();
 assert.throws(()=>adoptPublishedArtwork({root:f.dir,inventory}),/Pinned mobile twin missing/);
 assert.equal(readFileSync(stagingPath,'utf8'),before);
 assets[first].light={...mobile,height:719};publish();
 assert.throws(()=>adoptPublishedArtwork({root:f.dir,inventory}),/incorrectly sized/);
 assets[first].light=mobile;publish();
 assert.equal(adoptPublishedArtwork({root:f.dir,inventory}).subjects,subjects.length);
 const adopted=JSON.parse(readFileSync(stagingPath));
 assert.deepEqual(adopted.assets,assets);assert.deepEqual(adopted.encoder,staging.encoder);assert.deepEqual(adopted.policy,POLICY);
 assert.equal(adopted.lightProvenance.encoder,'cwebp');assert.equal(adopted.lightProvenance.release.tag,'hd-assets-v13');
 assert.equal(adopted.lightProvenance.manifestSha256,sha(readFileSync(releasePath)));
 assert.equal(checkPublishedArtwork({root:f.dir,inventory}).subjects,subjects.length);
 assets[first].light.sha256='f'.repeat(64);publish();
 assert.throws(()=>checkPublishedArtwork({root:f.dir,inventory}),/Pinned mobile metadata differs/);
});
