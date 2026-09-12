// Documentation-only generator. Does not modify game code or game configuration.
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pseudocode } from './wireframe-pseudocode.mjs';
import { componentDimensions } from './wireframe-dimensions.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const sections = [];
function frame(rows, width) {
  const out = ['┌' + '─'.repeat(width + 2) + '┐'];
  const wrap = (text, limit) => {
    const result=[]; let rest=text;
    while(rest.length>limit){let at=rest.lastIndexOf(' ',limit);if(at<1)at=limit;result.push(rest.slice(0,at));rest=rest.slice(at).trimStart();}
    result.push(rest);return result;
  };
  const line = value => { if(value.length>width)throw new Error('Overflow: '+value);out.push('│ '+value.padEnd(width)+' │'); };
  for (let index=0;index<rows.length;index++) {
    let raw=rows[index];
    // Semantic anchoring replaces whitespace-based positioning in all drawings.
    if(typeof raw==='string') {
      if(raw.trim().endsWith('[×]')) raw={left:raw.slice(0,raw.lastIndexOf('[×]')).trim(),right:'[×]',header:true};
      else if(raw.trim().endsWith('[Menu]')) raw={left:raw.slice(0,raw.lastIndexOf('[Menu]')).trim(),right:'[Menu]',header:true};
      else if(raw.includes('(A)[D][END TURN][E](P)')) raw={center:'(A)[D][END TURN][E](P)'};
      else if(raw.trim().endsWith('[Voice Ⅱ]'))raw={left:raw.slice(0,raw.lastIndexOf('[Voice Ⅱ]')).trim(),right:'[Voice Ⅱ]'};
      else if(raw.includes('[Player portrait]'))raw={left:'[Player]',center:'[Scene]',right:'[NPC]'};
      else if(raw.includes('[Player]')&&raw.includes('[NPC]'))raw={left:'[Player]',right:'[NPC]'};
      else if(/^Player name\s+NPC name$/.test(raw.trim()))raw={left:'Player name',right:'NPC name'};
      else if(index===rows.length-1 && raw.trim().startsWith('[')) {
        const buttons=raw.match(/\[[^\]]+\]/g)||[];
        if(buttons.length>=2)raw={left:buttons[0],center:buttons.length===3?buttons[1].replace('[Skip speech]','[Skip]'):'',right:buttons.at(-1)};
        else if(buttons.length===1)raw=/^\[(Back|Close|Leave)/.test(buttons[0])?{left:buttons[0],right:''}:{left:'',right:buttons[0]};
      }
    }
    if (raw && typeof raw === 'object' && raw.divider) {
      const rail=raw.rail??13;
      out.push('├' + '─'.repeat(rail+1) + raw.divider + '─'.repeat(width-rail) + '┤');
      continue;
    }
    if (raw === '---') { out.push('├' + '─'.repeat(width + 2) + '┤'); continue; }
    if(index===rows.length-1 && raw && typeof raw==='object' && !raw.center && !raw.divider && raw.railText===undefined) {
      const action=(raw.left&&!raw.right)?raw.left:((raw.right&&!raw.left)?raw.right:null);
      if(action && /^\[[^\]]+\]$/.test(action)) {
        const label=action.slice(1,-1);
        if(label.length>width-2)throw new Error('Full-width action label too long: '+label);
        const remaining=width-2-label.length;
        line('['+' '.repeat(Math.floor(remaining/2))+label+' '.repeat(Math.ceil(remaining/2))+']');
        continue;
      }
    }
    if(raw && typeof raw==='object' && raw.railText!==undefined) {
      const rail=raw.rail??13;
      const body=wrap(raw.body,width-rail-2), labels=wrap(raw.railText,rail);
      for(let i=0;i<Math.max(body.length,labels.length);i++)line((labels[i]||'').padEnd(rail)+'│ '+(body[i]||''));
      continue;
    }
    if(raw && typeof raw==='object') {
      let left=raw.left||'',right=raw.right||'',center=raw.center||'';
      const footer=index===rows.length-1 && (left.startsWith('[')||right.startsWith('['));
      if(footer && left.length+right.length+center.length+(center?2:1)>width) {
        const concise={ '[Applicable action]':'[Action]', '[Equip if available]':'[Equip]', '[Selected action]':'[Action]', '[Continue when allowed]':'[Continue]', '[Back / secondary]':'[Back]' };
        left=concise[left]||left;right=concise[right]||right;center=concise[center]||center;
      }
      if(footer && left.length+right.length+center.length+(center?2:1)>width)throw new Error('Footer must remain inline: '+left+' '+center+' '+right);
      if(center && !left && !right){line(' '.repeat(Math.floor((width-center.length)/2))+center);continue;}
      const required=left.length+right.length+center.length+(center?2:1);
      if(required<=width){
        if(center){const pos=Math.max(left.length+1,Math.floor((width-center.length)/2));line(left.padEnd(pos)+center+' '.repeat(width-pos-center.length-right.length)+right);}
        else line(left+' '.repeat(width-left.length-right.length)+right);
      } else if(raw.header || right==='[×]') {
        const lines=wrap(left,width-right.length-1);
        line(lines[0]+' '.repeat(width-lines[0].length-right.length)+right);
        lines.slice(1).forEach(line);
      } else {
        if(left)wrap(left,width).forEach(line);
        if(center)line(' '.repeat(Math.floor((width-center.length)/2))+center);
        if(right){if(right.length>width)throw new Error('Action label too long: '+right);line(' '.repeat(width-right.length)+right);}
      }
      continue;
    }
    wrap(raw||'',width).forEach(line);
  }
  out.push('└' + '─'.repeat(width + 2) + '┘');
  return out;
}
function drawings(wide, compact, mobile) {
  const a = frame(wide, 46), b = frame(compact, 32), c = frame(mobile, 25);
  return '**Wide**\n\n```text\n' + a.join('\n') + '\n```\n\n**Compact**\n\n```text\n' + b.join('\n') + '\n```\n\n**Vertical / Mobile**\n\n```text\n' + c.join('\n') + '\n```\n';
}
function add(id, name, parent, views, note) { sections.push({ id, name, parent, views, note }); }
function workspace(title, categories, content, footer, small) {
  const rows = Array.from({ length: Math.max(categories.length, content.length) }, (_, i) => ({railText:categories[i]||'',body:content[i]||''}));
  const foot = footer.match(/^(\[[^\]]+\])\s+(.*)$/);
  const actions = foot ? { left: foot[1], right: foot[2] } : (/^\[(Back|Close|Leave)/.test(footer)?{left:footer,right:''}:{left:'',right:footer});
  const mobileActions = foot ? { left: foot[1].replace('[Back / secondary]', '[Back]'), right: foot[2] } : actions;
  return [
    [{left:title,right:'[×]'}, {divider:'┬'}, ...rows, {divider:'┴'}, actions],
    [{left:title,right:'[×]'}, '[Category ▾]', '---', ...(small || content), '---', actions],
    [{left:title,right:'[×]'}, '[Category ▾]', '---', ...(small || content), '---', mobileActions],
  ];
}
function select(title, choices, detail, action) {
  return [
    [title + '                            [×]', {divider:'┬',rail:17}, ...Array.from({length:Math.max(choices.length,detail.length)},(_,i)=>({railText:choices[i]||'',body:detail[i]||'',rail:17})), {divider:'┴',rail:17}, '[Back]                         ['+action+']'],
    [title+' [×]', '[Selection ▾]', ...detail, '---', '[Back] ['+action+']'],
    [title+' [×]', '[Selection ▾]', '', ...detail, '', '---', '[Back] ['+action+']'],
  ];
}
function inspect(title, facts, action = '[Applicable action]') {
  return [[title+' [×]','---','[Art, if present] │ '+facts[0],...facts.slice(1),'---',action], [title+' [×]','[Small art, if present]',...facts,'---',action], [title+' [×]','[Art, if present]','',...facts,'','---',action]];
}
function confirm(title, facts, action) {
  return [[title+' [×]','',...facts,'','[Back]                       ['+action+']'],[title+' [×]',...facts,'[Back] ['+action+']'],[title+' [×]','',...facts,'','[Back] ['+action+']']];
}
function choices(title, content, action) {
  return [[title+'                       {Status}','',...content,'','---',action], [title+' · {Status}',...content,'---',action], [title,'{Status}','',...content,'','---',action]];
}
const inherited = 'Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.';

add('W1','Base workspace / modal',null,workspace('{Title}',['Category A','Category B','Category C'],['{Active body model}','{Control / choice}','{Useful feedback}'],'[Back / secondary] [Primary]'), 'Default base modal: one header, category rail, active pane, footer. Compact/mobile moves category navigation above content. Single-category variants may omit the rail. W2/W3/W5 bodies compose inside this frame; do not nest whole modal shells.');
add('W1a','Settings','W1',workspace('Settings',['Display ●','Audio','Accessibility','Advanced'],['Text size          [control]','UI scale           [control]','Necessary help, if needed'],'[Applicable action]'),inherited);
add('W1b','Town','W1',workspace('Town · Resources',['Smith ●','Merchant','Rest','Quest NPC'],['[Small NPC portrait] NPC','Active service choices','[Option] [Option]','Cost / availability'],'[Leave] [Talk / Open]'),inherited+' No separate scene/HUD band above the workspace.');
add('W1c','Character creation','W1',workspace('Create character [Face]',['Class','Starting kit','Attributes ●','Review'],['Attributes       Remaining:3','Stat [−]8[+]   Stat [−]8[+]','Stat [−]8[+]   Stat [−]8[+]','Derived effects / blocker'],'[Back] [Next / Begin]',['Attributes     Remaining:3','Stat            [−]8[+]','Stat            [−]8[+]','Stat            [−]8[+]','Derived effects / blocker']),inherited+' Show only the active category. Small portrait, compact choices, explicit paging for long collections, persistent footer; avoid page scrolling. Allow one active-pane scroll at extreme text sizes instead of clipping or shrinking controls.');
add('W1d','Shop','W1',workspace('Merchant · Cinders',['Cards ●','Relics','Flasks','Services','Sell'],['[Offer] [Offer]','Price with each offer','Availability / reason','Selected offer detail'],'[Leave] [Selected action]'),inherited+' Offers use a W5d body.');
add('W1e','Armoury','W1',workspace('Armoury',['Character','Inventory ●','Hybrid'],['[Item choices]','[Selected item / portrait]','Stats / requirements','Equipment effects'],'[Back] [Equip if available]'),inherited+' Preserve saved category IDs; detailed selection uses W2f.');
add('W1f','Compendium','W1',workspace('Compendium',['Cards ●','Items','Enemies'],['[Entry list]','Selected entry','Known facts / description'],'[Back]'),inherited+' Categories are illustrative; use actual registered groups and discovery rules.');
add('W1g','Profile','W1',workspace('Profile',['{Category A} ●','{Category B}'],['Current profile identity','Selected category records','Applicable status / actions'],'[Back] [Applicable action]'),inherited+' Bind only supported profile categories. Do not conflate profile deletion with run deletion.');
add('W1h','Discard / Exhaust viewer','W1',workspace('Card piles',['Discard ●','Exhaust'],['[Card] [Card] [Card]','Selected card detail','Count / empty state'],'[Close]'),inherited+' One combined pile control opens this workspace.');

add('W2','Selection/detail body',null,select('{Selection title}',['○ Choice A','● Choice B','○ Choice C'],['{Selected identity}','{Art / detail}','{Cost / requirements}','{Blocker if needed}'],'Confirm'),'Reusable body inside W1 base chrome (rail omitted when not needed). Selection/preview is reversible; binding commits use registered commands.');
add('W2a','Smith upgrade','W2',select('Upgrade equipment',['○ Item A','● Item B'],['Selected item','Current → Proposed','Stat changes / requirements','Cost / available stones'],'Upgrade'),inherited);
add('W2b','Extract card','W2',select('Extract card',['○ Item A','● Item B'],['Selected item','[Mount selector]','Card / fallback preview','Cost / available stones'],'Extract'),inherited+' A registered mount-selector slot supplies the extra step.');
add('W2c','Install card','W2',select('Install card',['○ Item A','● Item B'],['Selected item','[Mount selector]','[Compatible card selector]','Cost / available stones'],'Install'),inherited+' Clear dependent mount/card selections when the parent changes.');
for (const [id,title,action] of [['W2d','New game','Create character'],['W2e','Load game','Load']]) {
  const body=['● Slot 1 · Identity / location','○ Slot 2 · Identity / location','○ Slot 3 · Empty','[Delete selected, if offered]'];
  add(id,title+' slot selection','W2',[[title+' [×]','',...body,'---','[Back] ['+action+']'],[title+' [×]',...body,'---','[Back] ['+action+']'],[title+' [×]','',...body,'','---','[Back] ['+action+']']],inherited+' Same SaveSlotSelectionViewModel with a mode; New permits empty slots, Load does not. Selecting does not overwrite storage.');
}
add('W2f','Inventory selection','W2',select('Inventory',['○ Item A','● Item B'],['Selected item','Stats / requirements','Compared with equipped','Eligibility / blocker'],'Equip'),inherited+' This body can live inside W1e; render one shell, not two.');

add('W3','Inspection/status body',null,inspect('{Subject}',['{Type / state}','{Relevant facts}','{Useful detail}']),'Optional art and applicable-action slots. Shared W1 shell without a category rail; read-only views need no invented primary action.');
add('W3a','Item inspection','W3',inspect('Item name',['Type · tags','Stats / requirements','Effects'], '[Applicable item action]'),inherited);
add('W3b','Combatant inspection','W3',inspect('Combatant name',['HP / resources','Status / intentions','Known combat facts'],'[Close]'),inherited);
add('W3c','Potion inspection','W3',inspect('Potion name',['Charges / capacity','Effect','Use eligibility'],'[Use if legal]'),inherited);
const save=['Character · Location','Destination: active slot','Last saved: …','[Saved status / error]'];
add('W3d','Save status','W3',[['Save game [×]','',...save,'---','[Back] [Save]'],['Save game [×]',...save,'---','[Back] [Save]'],['Save game [×]','',...save,'','---','[Back] [Save]']],inherited+' No art slot. Retry saves storage; it never repeats a gameplay transaction.');

add('W4','Confirmation variant',null,confirm('{Concrete question}',['{Target identity}','{Exact consequence}'],'Action'),'Compact decision shell sharing W1 primitives/lifecycle. Safe focus, cancellation, shielding, and emphasis are centrally implemented policies.');
add('W4a','Service confirmation','W4',confirm('Apply this service?',['Item / target','Exact cost and changes'],'Confirm'),inherited);
add('W4b','Delete save','W4',confirm('Delete this save?',['Slot · Character','Actual loss / retention policy'],'Delete'),inherited);
add('W4c','Replace save','W4',confirm('Replace this save?',['Slot · Existing character','Replacement: new character','Exact replacement consequence'],'Replace'),inherited);
add('W4d','Load over active run','W4',confirm('Load this save?',['Destination slot · Character','Current progress consequence'],'Load'),inherited);
add('W4e','Quit confirmation','W4',confirm('Leave this run?',['Current run identity','Exact save / loss consequence'],'Continue'),inherited+' Labels reflect the actual selected quit operation.');

add('W5','Choices/progression body',null,choices('{Title}',['{Necessary prose}','[Choice] [Choice]','{Cost / consequence with choice}'],'[Continue / Leave]'),'Choice list/grid and meaningful prose inside shared chrome. Required event pages can use nonmodal presentation; do not invent an escape route.');
add('W5a','Rest','W5',choices('Rest',['[Recover] [Service]','Recovery values / service cost','Availability / reason'],'[Continue]'),inherited);
add('W5b','Rewards','W5',choices('Rewards',['[Reward] [Reward]','Claimed / available state','Required choice, if any'],'[Continue]'),inherited);
add('W5c','Event','W5',choices('Event name',['Necessary authored narrative','[Response] [Response]','Cost / consequence'],'[Continue when allowed]'),inherited+' Preserve story text and legal mandatory choices.');
add('W5d','Shop offers','W5',choices('Selected shop category',['[Offer + price] [Offer + price]','Availability with each offer','Selected offer detail'],'[Selected offer action]'),inherited+' Body only inside W1d; category name need not be repeated when navigation labels it clearly.');

function menu(preview=false, generic=false) {
  const title='ASHEN SPIRE';
  const entries=['Continue','New game','Load game','Multiplayer','Settings','Quit'];
  const wide=[{left:'',right:'[Profile] [×]'},{center:title},'',...entries.map((e,i)=>preview?(i===0?'[Continue]       [Save preview]':e+(i===1?'         [Character / world]':'')):{center:e})];
  const small=[{left:'',right:'[Profile] [×]'},{center:title},'',...entries.map(e=>({center:e}))];
  const mobile=[{left:'',right:'[Profile] [×]'},{center:title},'',...entries.map(e=>({center:e}))];
  for(const list of [wide,small,mobile]) { if(preview)list.push('','[Matching save identity/location]'); list.push('',{center:'[Build stamp]'}); }
  if(preview) { small.splice(small.length-4,0,'[Small save preview]'); mobile.splice(mobile.length-4,0,'[Saved character / world]'); }
  if(generic) return [[{left:'',right:'[Profile] [×]'},{center:'{Title}'},'', '{Centered menu OR menu + preview}','',{center:'{Build stamp}'}],[{left:'',right:'[Profile] [×]'},{center:'{Title}'},'{Menu}','{Conditional preview below}',{center:'{Build stamp}'}],[{left:'',right:'[Profile] [×]'},{center:'{Title}'},'', '{Menu}','','{Conditional preview}', '',{center:'{Build stamp}'}]];
  return [wide,small,mobile];
}
add('W6','Main-menu composition',null,menu(false,true),'One title/menu renderer. Title remains screen-centered and Profile top-right. Menu/preview state comes from one view model; keep focus and avoid hover oscillation.');
add('W6a','Main menu — centered, no preview','W6',menu(false),inherited+' Continue is not highlighted. No empty preview placeholder. Existing supported destinations are verified before exposure.');
add('W6b','Main menu — Continue highlighted','W6',menu(true),inherited+' Available Continue reveals the exact save preview. Only menu/body layout moves; title stays screen-centered. Compact/mobile preview appears below the centered menu.');

add('W7','Gameplay / encounter regions',null,[['{Shared HUD}','','{Primary scene region}','','{Context / hand / dialogue body}','','{Bottom actions}'],['{Compact HUD}','','{Primary scene}','','{Context body}','','{Bottom actions}'],['{Compact HUD}','','{Primary scene}','','','','{Context body}','','{Bottom actions}']],'Shared region host, spacing, safe areas, visual states and transitions. Child view models specify region proportions and registered bodies. Combat, map, and dialogue have distinct domain intents; never copy a command or effect merely because the container is shared.');
add('W7a','Combat — tightly packed footer','W7',[
 ['Identity · Resources                    [Menu]','','Battlefield + intentions','','Hand','','          (A)[D][END TURN][E](P)'],
 ['Compact HUD               [Menu]','','Battlefield + intentions','','Hand','','    (A)[D][END TURN][E](P)'],
 ['Compact HUD        [Menu]','','Battlefield + intentions','','','','Hand','','(A)[D][END TURN][E](P)'],
],inherited+' A/End Turn/P are largest and raised; pile buttons smaller; gaps minimal in every mode. No space-between. Empty resources/piles fade; End Turn does not and turns green when legal with zero actions. Proposed 10% HUD / 40% battlefield / 35% hand / 15% footer is the latest discussed starting allocation, subject to readability/playability verification.');
add('W7b','Map — 10 / 60 / 20 / 10','W7',[
 ['HUD · [Region ▾]                 [Menu] 10%','---','┌────── Map ≈95% viewport width ──────┐','│            MAP / NODES             │','│                               60% │','└───────────────────────────────────┘','---','Selected node · Known facts         20%','Relevant detail / risk / blocker','---','[Recenter]                 [Enter]  10%'],
 ['HUD · [Region ▾] [Menu]      10%','---','[MAP / NODES]','Width ≈95%                  60%','---','Node · Facts · Blocker      20%','---','[Recenter] [Enter]          10%'],
 ['HUD [Region ▾][Menu]  10%','---','[MAP / NODES]','','Width ≈95%','','                     60%','','---','Selected node','Known facts / blocker 20%','---','[Recenter] [Enter]    10%'],
],inherited+' Normal height budget is 10/60/20/10, with spacing inside the bands and viewport/zoom conversion centralized. Preserve minimum readable/control sizes; map yields only where required. No combat footer.');
add('W7c','Quest dialogue — player left, NPC right','W7',[
 ['HUD · Resources                        [Menu]','','[Player portrait]  [Scene]      [NPC portrait]','Player name                          NPC name','','Speaker                             [Voice Ⅱ]','One short caption beat.','[Responses only when required]','','[Back]      [Skip speech]         [Continue]'],
 ['Compact HUD               [Menu]','[Player]                   [NPC]','Player name             NPC name','Speaker                [Voice Ⅱ]','One short caption beat.','[Required responses]','[Back] [Skip] [Continue]'],
 ['Compact HUD        [Menu]','','[Player]            [NPC]','Player name      NPC name','','Speaker         [Voice Ⅱ]','One short caption beat.','','[Required responses]','','[Back] [Skip] [Continue]'],
],inherited+' Portraits remain left/right even on mobile. Dialogue replaces the hand. Audio may advance linear speech only; Back/Skip never commit choices or repeat effects. Captions/manual navigation work without playable audio.');

// Four actual parent structures. Selection, inspection, and choices are body
// variants of the workspace, not additional top-level wireframes.
const idMap = { W1:'W1', W2:'selection body', W3:'inspection body', W4:'W2', W5:'choice body', W6:'W3', W7:'W4' };
for(let i=0;i<8;i++) idMap['W1'+String.fromCharCode(97+i)]='W1'+String.fromCharCode(97+i);
for(let i=0;i<6;i++) idMap['W2'+String.fromCharCode(97+i)]='W1'+String.fromCharCode(105+i);
for(let i=0;i<4;i++) idMap['W3'+String.fromCharCode(97+i)]='W1'+String.fromCharCode(111+i);
for(let i=0;i<4;i++) idMap['W5'+String.fromCharCode(97+i)]='W1'+String.fromCharCode(115+i);
for(let i=0;i<5;i++) idMap['W4'+String.fromCharCode(97+i)]='W2'+String.fromCharCode(97+i);
for(let i=0;i<2;i++) idMap['W6'+String.fromCharCode(97+i)]='W3'+String.fromCharCode(97+i);
for(let i=0;i<3;i++) idMap['W7'+String.fromCharCode(97+i)]='W4'+String.fromCharCode(97+i);
for(let i=sections.length-1;i>=0;i--) {
  const s=sections[i];
  if(!s.parent && ['W2','W3','W5'].includes(s.id)) { sections.splice(i,1); continue; }
  const oldParent=s.parent;
  s.id=idMap[s.id];
  s.parent=oldParent ? (['W2','W3','W5'].includes(oldParent)?'W1':idMap[oldParent]) : null;
  s.note=s.note.replace(/\bW[1-7][a-z]?\b/g,id=>idMap[id]||id);
}
for(const s of sections)if(!s.parent)s.parent='W0';
add('W0','Master shell',null,[
 [{left:'{Title}',right:'[×]'},'---','','{Body supplied by W1–W4}','','','---',{left:'[Close / Back]',right:'[Primary]'}],
 [{left:'{Title}',right:'[×]'},'---','{Body from parent variant}','','---',{left:'[Close / Back]',right:'[Primary]'}],
 [{left:'{Title}',right:'[×]'},'---','','{Body from parent}','','','','---',{left:'[Close / Back]',right:'[Primary]'}],
],'Placement anchors: TITLE top-left; EXIT (×) top-right; CLOSE/BACK bottom-left; INTERACTION/CONFIRMATION bottom-right. All anchors use the same shared inset/padding, never label-dependent offsets. Header/body/footer have reserved layout space; content cannot displace or cover the controls. With exactly ONE footer button, that button spans the full usable footer width with a centered label. With two, retain left/right roles and consistent sizing/padding. With zero, omit the footer. Unneeded components may be omitted by explicit capability, without shifting remaining anchors. All four families and their children inherit this positioning, effects and lifecycle.');
add('W1w','Entity inspector','W1',[
 [{left:'{Combatant name}',right:'[×]'},'---','Sprite      │ HP | Intent | Defense','            │ Current state','            │ Stance / resources / effects','            │ Previous actions','            │ Known abilities','            │ Known traits','Name        │ Lore','[HP bar]    │ Details scroll independently','---',{left:'[Back]',right:''}],
 [{left:'{Name}',right:'[×]'},'---','Sprite  │ HP / Intent / Defense','        │ Current state','        │ Previous actions','        │ Known abilities','        │ Known traits','Name    │ Lore','[HP]    │ Scroll details','---',{left:'[Back]',right:''}],
 [{left:'{Name}',right:'[×]'},'---','Sprite │ HP Intent Defense','       │ Current state','       │ Previous actions','       │ Known abilities','       │ Known traits','Name   │ Lore','[HP]   │ Details scroll','---',{left:'[Back]',right:''}]
], 'Inherits W1/W0. Combatant context: entity name is the modal title. Left is sprite, name and HP only; no intent/defense/effect overlays. Right starts with HP/Intent/Defense in one row, followed by Current state (stance, resources, statuses, buildup in matching label/value rows), Previous actions newest-first, Known abilities, Known traits (weaknesses/resistances), then Lore. Use shared left-aligned label/value columns throughout. Only right details scroll; header/footer stay anchored. No placeholder action: Back fills footer width. Actual contextual commands may use inherited inline two-action footer. Other entities retain their registered detail model. Source facts come from one knowledge-filtered snapshot; examples are illustrative.');
sections.sort((a,b)=>a.id.localeCompare(b.id,'en'));
sections.find(s=>s.id==='W1').note += ' Selection/detail, inspection/status, and choice/progression are body variants of this same frame. A child without categories omits the rail. Its body differences do not create a new parent renderer.';
let text = '# W0 master shell → four parent wireframes → children\n\n';
text += 'Each parent defines the shared bones and effects. Children supply view-model data and small declared variations, not duplicate layout/lifecycle code. The exact order is: parent description → Wide ASCII → Compact ASCII → Vertical/Mobile ASCII → child a with all three views → child b, and so on. Drawings are schematic, not fixed pixel sizes.\n\n';
text += '**W0: Master shell** — title top-left, exit top-right, Back bottom-left, Primary bottom-right; shared body host and effects.\n\n**W1: Workspace/modal** — Settings, Town, Creation, service selection, inspection, save flows, and choice bodies.\n\n**W2: Confirmation** — short decisions with shared focus, cancellation, and confirmation behavior.\n\n**W3: Main menu** — one screen-centered title and contextual menu/preview state.\n\n**W4: Gameplay/encounter** — shared HUD, scene, context region, and bottom controls; combat, map, and dialogue use registered body variants.\n\n';
text += '**Inherited placement:** title top-left, exit top-right, Close/Back bottom-left, interaction/confirmation bottom-right, all with shared consistent inset/padding. A single footer button spans the full usable footer width; its label is centered. Two footer buttons keep their left/right roles. No footer buttons means no empty footer. W1–W4 and all children inherit this; omitted components do not shift remaining anchors. Explicit owner variants remain W3’s screen-centered title/Profile header slot and W4a’s tightly centered combat group. Capabilities omit inapplicable actions without inventing navigation or duplicating a primary command.\n\n';
text += '**Footer is always inline:** one horizontal row in Wide, Compact, and Vertical/Mobile. Never stack footer buttons or wrap their labels. Use concise meaningful labels and shared responsive sizing while preserving minimum input targets. One button fills the row; multiple controls keep their declared positions.\n\n';
text += '**Inherited palette/state effects:** see COLOR-INTERACTION-CONTRACT.md. Five configurable groups drive surfaces, text, gold accents, positive green, and exit/danger red. Close/Back/Exit highlights red; ordinary ready/selected primary actions highlight green; neutral/unready controls use dark brown/gold. Disabled/busy wins. Destructive confirmations and the earlier End Turn guidance rule are named exceptions, as are semantic resource/tag/rarity/target colors and media. These are inherited state mappings, not child-specific hex colors. Keep related content single-row where readable; state effects never move anchors.\n\n';
text += 'Parent effects include spacing, elevation, focus/hover, opening/closing transitions, reduced motion, and input ownership where applicable. Domain effects remain explicit registered commands. Orientation is a presentation variant, never another child. W1 is the default modal; W2 shares its primitives for compact decisions. These document IDs do not rename existing saved/semantic layout IDs. A = actions, D = draw pile, E = discard/exhaust, P = potions; real controls have full accessible labels and valid targets.\n\n';
text += '**Component dimensions:** every view has a companion table naming each structural slot and its nominal viewport-relative allocation. See COMPONENT-SIZING.md for units, parent-relative conversion, optional slots, padding, and minimum-size overrides. These are proposed layout targets, not measured game geometry.\n\n';
text+='**Current specification:** [CURRENT-SPECIFICATION.md](CURRENT-SPECIFICATION.md) is authoritative over earlier nominal/iteration notes.\n\n';
let detailedText=text.replace('# W0 master shell → four parent wireframes → children','# wireframe.md — W0 hierarchy, ASCII, component sizes and pseudocode');
for (const s of sections) {
  const heading=`${s.id==='W0'||s.parent==='W0'?'##':'###'} Wireframe ${s.id}: ${s.name}\n\n`;
  const description=(s.parent?`**Parent: ${s.parent}.** `:'**Base wireframe.** ')+s.note+'\n\n';
  let visual='';
  for(const [i,mode] of ['wide','compact','portrait'].entries()){
    visual+=`**${['Wide','Compact','Vertical / Mobile'][i]}**\n\n\`\`\`text\n${frame(s.views[i],[46,32,25][i]).join('\n')}\n\`\`\`\n\n`;
    visual+=componentDimensions(s,mode)+'\n';
  }
  if(!pseudocode[s.id])throw new Error('Missing pseudocode '+s.id);
  text+=heading+description+visual;
  detailedText+=heading+description+visual+'**Language-agnostic pseudocode**\n\n```text\n'+pseudocode[s.id]+'\n```\n\n';
}
const verification='## Verification\n\nVerify every parent and child in all three views, at supported text/UI scales, with keyboard/controller/touch, long copy, empty/blocked states, active modal and preserved selection across rotation. Portrait is an explicit target: audit the existing upright/orientation gate before implementation. Do not shrink hit targets or clip required text to claim a no-scroll layout. This is a documentation specification; it does not claim implemented or browser-verified UI.\n';
text+=verification;detailedText+=verification;
writeFileSync(join(root,'RESPONSIVE-WIREFRAMES.md'),text);
const cardDocument=readFileSync(join(root,'card-wireframes.md'),'utf8').replace(/^# Card wireframes[^\n]*\n/,'## Card hierarchy — WC0 and descendants\n');
writeFileSync(join(root,'wireframe.md'),detailedText+'\n'+cardDocument+'\n'+readFileSync(join(root,'tooltip-wireframes.md'),'utf8')+'\n'+readFileSync(join(root,'component-wireframes.md'),'utf8'));
writeFileSync(join(root,'wireframe-catalog.json'),JSON.stringify(sections.map(({id,name,parent})=>({id,name,parent,orientations:['wide','compact','portrait']})),null,2)+'\n');
console.log(`Generated W0, ${sections.filter(s=>s.parent==='W0').length} parents and ${sections.filter(s=>s.parent&&s.parent!=='W0').length} children; ${sections.length*3} ASCII views.`);
