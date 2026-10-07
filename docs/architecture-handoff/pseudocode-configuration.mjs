import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
export function configurablePseudocode(source){
 let s=source;
 const replacements=[
 [/remainingRows = 5/g,'remainingRows = config.combatant.maxStackRows'],
 [/0\.5 \* hpHeight/g,'config.combatant.extraBarHeightRatio * hpHeight'],
 [/UseSharedGap\(0\.2rem\)/g,'UseSharedGap(config.combatant.stackGapRem)'],
 [/FitSquareIcons\(1\.575rem\)/g,'FitSquareIcons(config.combatant.iconSizeRem)'],
 [/AnchorDefenseAtSprite50PercentHeight\(gap=0\.5rem/g,'AnchorDefenseAtSpriteRatio(config.combatant.defenseOffsetRatio, gap=config.combatant.defenseGapRem'],
 [/after 1000ms/g,'after config.interaction.inspectDelayMs'],
 [/tooltip after config.interaction.inspectDelayMs/g,'tooltip after config.interaction.tooltipDelayMs'],
 [/\[topHUD:0\.10, map:0\.60, details:0\.20, footer:0\.10\]/g,'config.map.regionFractions'],
 [/model.mapInlineFraction = 0\.95/g,'model.mapInlineFraction = config.map.inlineFraction'],
 [/wideOrCompact34PercentOrPortrait32Percent/g,'config.inspector.previewFractionForMode'],
 [/gap=2vw/g,'gap=config.inspector.gapVw'],[/maxWidth=14rem/g,'maxWidth=config.inspector.maxPreviewWidthRem'],
 [/10\/40\/35\/15/g,'config.combat.regionFractions'],
 [/header=10%, art=40%, body=40%, footer=10%/g,'config.card.bandFractions'],
 [/player=false, enemy=true/g,'player=config.combatant.playerIntentVisible, enemy=config.combatant.enemyIntentVisible'],
 [/generation = generation \+ 1/g,'generation = NextGenerationToken()'],
 [/actionsRemaining == 0/g,'NoActionsRemain(actionsRemaining)']
 ];for(const [pattern,value] of replacements)s=s.replace(pattern,value);
 // Remaining literal tuning values get explicit defaults, grouped in a shared registry.
 const config=JSON.parse(readFileSync(join(root,'pseudocode-config.json'),'utf8'));config.referenceTokens??={};
 s=s.replace(/(?<![A-Za-z0-9_.])\d+(?:\.\d+)?(?:rem|vw|vh|ms|%|s)?(?![A-Za-z0-9_])/g,token=>{
 const key='value_'+token.replaceAll('.','_').replace('%','Percent');
 config.referenceTokens[key]={value:parseFloat(token),unit:token.replace(/[\d.]/g,'')||'count'};
 return 'config.referenceTokens.'+key+'.value';
 });
 writeFileSync(join(root,'pseudocode-config.json'),JSON.stringify(config,null,2)+'\n');
 return '// Load and validate pseudocode-config.json once; inject config into this component.\n// Config entries carry units; convert through the shared layout adapter.\n// Wireframe IDs are identifiers. Domain facts come from the model, not config.\n'+s;
}
