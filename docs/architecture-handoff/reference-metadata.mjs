import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hudConfig,hudSources} from './hud-reference.mjs';
import {progressionConfig,progressionSamples,progressionSourceReferences} from './progression-reference.mjs';
import {screenMetadata} from './screen-reference.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(root,'../..');
const sourceArgument=process.argv.indexOf('--source-root');
const ownerRepo=path.resolve(sourceArgument>=0?process.argv[sourceArgument+1]:process.env.ASHENSPIRE_REFERENCE_SOURCE||repo);
const ownerRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:ownerRepo,encoding:'utf8'}).trim();
const revision=execFileSync('git',['rev-parse','origin/dev'],{cwd:repo,encoding:'utf8'}).trim();
export function resolveSources(values){return values.map(value=>{
 const supplied=typeof value==='string'?{file:value.split('#')[0],symbol:value.split('#')[1]}:value;
 if(!supplied.file||supplied.file.startsWith('PROPOSED'))return {description:supplied.file,status:'Proposed; no existing production implementation'};
 const inOwner=fs.existsSync(path.resolve(ownerRepo,supplied.file));const snapshot=inOwner?ownerRevision:revision;const full=path.resolve(inOwner?ownerRepo:repo,supplied.file);
 if(!fs.existsSync(full)){if(fs.existsSync(path.resolve(root,supplied.file)))return {...supplied,url:supplied.file,status:'Proposed reference specification'};throw Error('Missing source reference '+supplied.file)}
 const lines=fs.readFileSync(full,'utf8').split(/\r?\n/);const index=supplied.symbol?lines.findIndex(line=>line.includes(supplied.symbol)):-1;
 const line=index>=0?index+1:1;
 return {...supplied,line,symbol:index>=0?supplied.symbol:undefined,url:`https://github.com/cehinds/AshenSpire/blob/${snapshot}/${supplied.file}#L${line}`,excerpt:lines.slice(Math.max(0,line-1),line+30).join('\n'),revision:snapshot,sourceSnapshot:inOwner?'Current owner checkout (including inspected local edits)':'Documentation dev baseline'};
})}
export function baseReferenceMetadata(entry){
 let result=screenMetadata(entry.id);
 if(/^WGH/.test(entry.id))result={defaults:hudConfig,model:hudConfig.sample,references:hudSources[entry.id]||hudSources.WGH4,children:({WGH0:['WGH4'],WGH1:['WCM1','WCM2'],WGH2:['WCB2','W1e'],WGH3:['WCB2','W1a'],WGH4:['WGH7','WGH1','WGH2','WGH3','WGH6','WGH5'],WGH5:['WCM2'],WGH6:['WC2b'],WGH7:['WCI1'],WGH8:['WCB2','W1q'],WGH9:['WCB2']})[entry.id],implementation:{renderer:'hudPlayground',source:['hud-reference-client.js','hud-reference.mjs'],styles:['hud-reference-client.js#hudStyleSheet']}};
 else if(entry.id.startsWith('W1x')||entry.id.startsWith('WGP'))result={defaults:progressionConfig,model:progressionSamples,references:[...progressionSourceReferences.existing,progressionSourceReferences.proposal],children:entry.id.startsWith('W1x')||entry.id==='WGP0'?['WGP1','WGP2','WGP3','WGP4','WCB4','WCB5']:({WGP1:['WCI1','WGP2'],WGP2:['WCM2'],WGP3:['WCF4'],WGP4:['WCF4']})[entry.id],implementation:{renderer:'renderProgression',source:['progression-reference-client.js','progression-reference.mjs'],styles:['progression-reference.css']},referenceStatus:progressionSourceReferences.description};
 else if(/^WC\d/.test(entry.id))result={defaults:{geometry:{aspectRatio:'5 / 8',bands:{header:10,art:40,body:40,footer:10}},selection:{delayMs:1000},tooltip:{delayMs:1000}},model:{id:entry.id,tags:entry.proposedTags||[],ownerState:{selected:false}},references:entry.id.startsWith('WC4')?['src/ui/components/combatantFrame.js','src/ui/components/combatantOverhead.js','src/ui/models/CombatantInspectorModel.js']:['src/ui/components/card.js','src/ui/components/equipmentCard.js','src/ui/components/collectibleCard.js','src/ui/components/cardSelection.js'],children:entry.id.startsWith('WC4')?['WCI1','WCI2','WCM1','WCM2','WCM3','WCM4','WCM5','WCM6','WCO1','WCO2','WCO3','WCO4','WCB1','WCF3','W1w']:['WCI1','WCI2','WCI3','WCB1','WCB2','WCF3','W1w'],implementation:{renderer:'card',source:['wireframe-gallery-template.html'],styles:['wireframe-gallery-template.html#style']}};
 result.implementation ||= {renderer:'renderScreenReference',source:['screen-reference-client.js','screen-reference.mjs','button-widths.mjs'],styles:['screen-reference.css']};
 result.referenceStatus ||= 'Current source anchors inform this proposed reference. Sample records are illustrative; this page does not execute game commands.';
 result.references=resolveSources(result.references);
 return result;
}
