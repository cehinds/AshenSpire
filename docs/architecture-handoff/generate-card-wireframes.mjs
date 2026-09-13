import { configurablePseudocode } from './pseudocode-configuration.mjs';
import { positioning } from './wireframe-positioning.mjs';
// Generates handoff documents only. No runtime code/content modification.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const cards=[];
function card(id,parent,name,tags,fields,action,extra){cards.push({id,parent,name,tags,fields,action,extra});}
card('WC0',null,'Master card',['presentable:card'],['{Registered content slots}','{Availability / reason}'],'Inspect via (i)','Master preview selection reveals only the shared info control; no Select or Eligible target demo buttons. All structural and optional components are resolved by validated tag rules. No label-based construction.');
card('WC1','WC0','Playing card',['card-kind:playing'],['Targeting','Effects / rules'],'Select / Play','Inherits card identity/art/tags; adds a compact left-edge cost stack below the header inside the art containing every projected action/stamina/MP cost, followed by targeting and effect components. Costs come from playingCardModel.costs in src/model/playingCard.js; renderer does not calculate or invent costs.');
card('WC1a','WC1','Attack card',['ability:attack'],['Damage / affected stat','Target and effect preview'],'Select / Play','Use engine damage preview, including current modifiers; never calculate damage in renderer.');
card('WC1b','WC1','Skill card',['ability:skill'],['Defense / utility effects','Target / requirements'],'Select / Play','The effect list is projected from the existing opcode/formula engine.');
card('WC1c','WC1','Power card',['ability:power'],['Persistent effect','Trigger / duration'],'Select / Play','Persistent rules shown through registered trigger/duration components.');
card('WC1d','WC1','Curse card',['ability:curse'],['Penalty / consequence','Playability / removal rule'],'Inspect','Do not assume all curses are unplayable; preserve the domain rule and context-specific action.');
card('WC1e','WC1','Status card',['ability:status'],['Status effect / duration','Playability / removal rule'],'Inspect','This is a playing-card subtype, distinct from a combat status indicator.');
card('WC2','WC0','Possession card',['card-kind:possession'],['Ownership / quantity','Capabilities / requirements'],'Inspect','Common item identity, ownership and instance state; tags add supported operations.');
card('WC2a','WC2','Equipment card',['item-kind:equipment'],['Slot / requirements','Equipped comparison'],'Equip','The equipment base does not decide whether the item is weapon or armor by hard-coded ID.');
card('WC2a1','WC2a','Weapon card',['equipment-kind:weapon'],['Damage / scaling','Hand / requirements','Granted card package'],'Equip','Weapon-specific rows attach by tags; values come from loadout/equipment projections.');
card('WC2a2','WC2a','Armor card',['equipment-kind:armor'],['Defense / resistance','Weight / requirements','Granted modifiers'],'Equip','Armor shares equipment slots and actions; only supported defense/modifier components differ.');
card('WC2b','WC2','Relic card',['item-kind:relic'],['Relic effect','Acquisition / equip state'],'Inspect','Relic actions vary by context; do not add Equip where the domain treats possession as activation.');
card('WC2b1','WC2b','Passive relic',['effect-mode:passive'],['Passive modifiers','Affected resources / stats'],'Inspect','Show existing passive definitions and current applied state.');
card('WC2b2','WC2b','Triggered relic',['effect-mode:triggered'],['Trigger condition','Effect / limit / cooldown'],'Inspect','Multiple effect modes may coexist through components; do not force a false exclusive category.');
card('WC2c','WC2','Consumable card',['item-kind:consumable'],['Charges / quantity','Use effect / eligibility'],'Use','Model depleted vs unavailable separately; inventory state remains authoritative.');
card('WC2c1','WC2c','Healing consumable',['effect-purpose:healing'],['Healing preview','Charges / availability'],'Use','Bind existing heal preview/cap rules.');
card('WC2c2','WC2c','Resource consumable',['effect-purpose:resource'],['Resource restoration','Charges / availability'],'Use','Resource identity selects its registered semantic color, not primary green.');
card('WC2c3','WC2c','Utility consumable',['effect-purpose:utility'],['Utility effect / target','Quantity / availability'],'Use','Targeted use follows existing targeting/confirmation command flow.');
card('WC3','WC0','Character-choice card',['card-kind:creationChoice'],['Choice summary','Current selection / eligibility'],'Choose','Draft choice only; never commits a new run directly.');
card('WC3a','WC3','Class card',['choice-kind:class'],['Class identity / role','Starting stats / abilities'],'Choose class','Selecting updates the draft preview through existing character-creation rules.');
card('WC3b','WC3','Starting-kit card',['choice-kind:startingKit'],['Starting equipment','Granted playing cards'],'Choose kit','Preserve class eligibility and existing kit definitions; do not duplicate grants into the card model source.');

card('WC4','WC0','Combatant card',['card-kind:combatant'],['Health / defense','Intent / status'],'Inspect','Borderless combatant presentation: sprite remaining (85% with HP only), resource bars 5% each, statuses 10% of component height; overrides WC0 item-card bands. Three sizes are host presentation variants, never different combatant models.');
card('WC4a','WC4','Compact combatant',['card-kind:combatant'],['Health / intent','Status summary'],'Inspect','Compact: clamp(10rem, 14vw, 12rem) width; height = width × 8/5. Supplementary full details through inspection.');
card('WC4b','WC4','Standard combatant',['card-kind:combatant'],['Health / defense','Intent / status'],'Inspect','Standard: clamp(12rem, 18vw, 16rem) width; height = width × 8/5.');
card('WC4c','WC4','Expanded combatant',['card-kind:combatant'],['Health / defense','Intent / status','Relevant combat facts'],'Inspect','Expanded: clamp(16rem, 24vw, 20rem) width; height = width × 8/5. No new gameplay facts implied.');

function frame(c,mode){
 if(c.id.startsWith('WC4'))return `             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]`;

 const width={wide:30,compact:26,portrait:24}[mode];const out=[' '.repeat(Math.floor((width+4-3)/2))+'(i)'+' '.repeat(Math.ceil((width+4-3)/2)), '┌'+'─'.repeat(width+2)+'┐'];
 const emit=text=>{let s=text;while(s.length>width){let i=s.lastIndexOf(' ',width);if(i<1)i=width;out.push('│ '+s.slice(0,i).padEnd(width)+' │');s=s.slice(i).trimStart();}out.push('│ '+s.padEnd(width)+' │');};
 const playing=c.id.startsWith('WC1');
 emit('{Name}');out.push('├'+'─'.repeat(width+2)+'┤');
 emit(playing?'◆ x   [Art / portrait]':'[Art / portrait]');emit(playing?'ϟ x   optional stamina':'');if(playing)emit('♢ x   optional MP');emit('{Meaningful tag badges}');out.push('├'+'─'.repeat(width+2)+'┤');
 c.fields.forEach(emit);emit('{Blocker if needed}');out.push('├'+'─'.repeat(width+2)+'┤');
 let label='Rarity       Owned: n';const spaces=width-2-label.length;
 if(spaces<0)throw new Error('Action too long');emit('['+' '.repeat(Math.floor(spaces/2))+label+' '.repeat(Math.ceil(spaces/2))+']');
 out.push('└'+'─'.repeat(width+2)+'┘');return out.join('\n');
}
function sizes(c,mode){
 if(c.id.startsWith('WC4')){
 const width={WC4:16,WC4a:12,WC4b:16,WC4c:20}[c.id];
 return '| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |\n|---|---|---|---|---|---|---|---|---|\n'+[
 ['frame',width+'rem max; host-clamped','derived from shared combatant envelope','battlefield slot','bottom-center','center / end','normal flow','shared stage baseline','transparent; no border or item-card furniture'],
 ['name','100% component','auto; readable line','frame','sprite bottom-center, above HP','center / center','inside sprite bottom; reserve text room','0.2rem gap','entity display name; reserve host headroom'],
 ['intent','content-fit','readable line','frame','above sprite, below info','center / center','leading slot','shared gap','existing announced intent; tooltip; player hidden/enemy visible by configurable default'],
 ['aura','sprite bounds','sprite bounds','sprite','center','center / center','behind sprite layer','0','decorative, no pointer capture'],
 ['buffLayer','sprite width minus shared horizontal inset','100% sprite height','sprite','center','center / center','foreground effect layer','0','decorative; semantic buff remains in status model'],
 ['defense','3.5rem minimum','3.5rem minimum','sprite','player upper-right at 12%; enemy lower-left at 88% sprite height','center / center','badge overlay','0.5rem outside sprite; side follows facing','current block/defense model'],
 ['sprite','100% component','H minus bars and statuses','frame','top-center','center / end','row 1','0','contain sprite; preserve intrinsic art ratio'],
 ['resources','100% component','HP height + 0.5 × HP height per extra resource','frame','below sprite','center / center','row 2; stacked meters','shared bar gap included','HP always; applicable extra resources from model'],
 ['resources.bar','100% component','HP: base height; other resources: half HP height','resources','next row','center / center','normal flow','shared gap','label + current/max; semantic color; never color-only'],
 ['status','100% component','content-fit; sprite yields space','frame','below resources','center / start','row 3','0.2rem shared gap','contains buildup, stance, icons in this order'],
 ['buildup','100% component','0.5 × HP bar height','status','top','stretch / center','rows first','config.combatant.stackGapRem','threshold progress; semantic color and text'],
 ['statusIcons','100% component','1.575rem; exactly one icon row','status','below stance','center / center','last row; final +N opens inspector','config.combatant.stackGapRem','uniform 1.575rem square tiles; icon only; details in tooltip/inspector'],
 ['stance','100% component','1 × HP bar height','status','below buildup','center / center','before status icons','config.combatant.stackGapRem','uniform badge dimensions across all stances'],
 ['info','minimum input target','minimum input target','frame','above top-center','center / center','overlay','above intent with shared gap','outside H; selection delay inherited']
 ].map(row=>'| '+c.id+'.'+row.join(' | ')+' |').join('\n')+'\n\nH is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, at12% sprite height for player and88% for enemy. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.\n\n';
 }

 // Card-local dimensions preserve one ratio in every viewport; vw/vh are host inputs only.
 const rows=[['frame','clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum)','resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth','Uniform card envelope'],['header','100% card width','config.cards.geometry.bands.header% of card height','Name left; state right'],['header.title','remaining header width','100% header height','Top-left'],['header.state','content-fit','100% header height','Top-right if applicable'],['art','100% card width','config.cards.geometry.bands.art% of card height','Contain artwork; never stretch'],['art.tags','available art width minus shared inset','content-fit within art band','Meaningful tags bottom-left'],['body','100% card width','config.cards.geometry.bands.body% of card height','Shared fact rows; scroll only when required'],['footer','100% card width','config.cards.geometry.bands.footer% of card height','Metadata only'],['footer.metadata','available footer width minus shared inset','100% usable footer height','Rarity left; owned count right']];
 if(c.id.startsWith('WC1'))rows.push(['costs','config.cards.costs.railWidthRem','content-fit from active projected costs','Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand']);
 c.fields.forEach((field,i)=>rows.push(['body.detail'+(i+1),'100% usable body width','content-fit within body band',field]));
 rows.push(['body.blocker','100% usable body width','content-fit within body band','Omit when absent'],['selection.outline','100% card width','100% card height','Shared owner selection glow'],['selection.info','config.components.target.minRem','config.components.target.minRem','Centered above owner; outside ratio envelope']);
 return '| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |\n|---|---|---|---|---|---|---|---|---|\n'+rows.map(([slot,width,height,note])=>'| '+c.id+'.'+slot+' | '+width+' | '+height+' | '+positioning(c.id,slot,mode,note).map(value=>value.replace(/[0-9.]+vw/g,'shared inset token')).join(' | ')+' | '+note+' |').join('\n')+'\n\n';
}
function pseudo(c){
 if(c.id.startsWith('WC4'))return `INPUT: combatant snapshot, player knowledge, role, presentation config, host size
PARENT: WC4 (WC4 inherits WC0 identity and interactions, NOT item-card geometry)
ResolveSizeVariant(${c.id}); derive height from clamped width, preserve art ratio
intentVisible = domain.intentActive AND config.intentVisibleForRole(role)
// Defaults: player=false, enemy=true; explicit presentation override permitted.
blockVisible = domain.blockActive
resourceRows = ProjectActiveResourceProviders(snapshot)
buildupRows = ProjectActiveBuildupProviders(snapshot)
stance = ProjectActiveStanceOrAbsent(snapshot)
statusIcons = ProjectActiveStatusIcons(snapshot)
ProjectSelectionVisibility(config.visibility.unselectedHiddenSelectors, owner.selected) // Retain HP, block, intent, icons, aura and buffs while unselected.\nReserveHP(); remainingRows = 5 - HP - present(stance) - present(statusIcons OR buildupRows)
ChooseOptionalBarsByConfiguredPriority(resourceRows, buildupRows, remainingRows)
ConvertExcessBuildupToProgressIcons(); retain stable IDs
ComposeActiveRowsInOrder(HP, resources, buildup, stance, icons)
CollapseAbsentRowsAndGaps(); sprite receives remaining height
SetOtherResourceAndBuildupHeight(0.5 * hpHeight); SetStanceHeight(hpHeight)
UseFullBarWidthForStance(); UseSharedGap(0.2rem)
FitSquareIcons(1.575rem); reserve last tile for +N hidden icons if overflow
AnchorNameAboveHP(); IntentAboveSprite(); InfoAboveIntentOrSprite()
AnchorDefenseAtSpriteRatio(config.combatant.defenseAnchorByRole[role], gap=config.combatant.defenseGapRem, player=right, enemy=left)
MirrorArtworkForFacingOnly(); auraBehindAndBuffAboveSpanFullSpriteHeight()
On selected: glow whole visible assembly; reveal info after 1000ms
ApplyRowPresentation(config.combatantFocus.rowBase, config.combatantFocus.selectedGrowth) // Share unselected category fit across factions; selection details never shrink it.
AnchorScaledSpriteAtGroundShadow(); RaiseSelectedTo(config.combatantFocus.focusZ) // Keep foot contact stable and bring selected assembly forward.
On hover/focus/tap tag: schedule shared tooltip after 1000ms; cancel stale timer
On +N or info: open W1w; preview ONLY sprite/name/HP
Inspector title = entity name
Inspector detail providers: HP/intent/defense, active current state,
 previous actions, known abilities, known traits, lore; apply knowledge filter
Reuse one model across orientations and sizes; no duplicate domain facts
Dispose timers/observers and restore focus on close.`;

 if(c.id==='WC0')return `INPUT: entityRef, instanceSnapshot, context, validatedTagRegistry
OUTPUT: immutable CardViewModel + semantic action intents

FUNCTION ConstructCard(input):
    definition = registries.requireEntity(entityRef)
    authoredTags = tagService.tagsForValidatedIdentity(entityRef)
    stateFacts = domainQueries.projectCurrentFacts(instanceSnapshot, context)
    effectiveTags = registeredTagRules.derive(authoredTags, stateFacts)
    matchedRules = MatchAllAnyExcludedTagRelations(effectiveTags, context)
    ancestry = ResolveDeclaredCardFamilyFromMatchedRules()
    REQUIRE ancestry terminates at WC0; reject cycles/unknown families
    components = ResolveSlotRulesByPriorityAndExplicitCompatibility(matchedRules)
    REQUIRE required identity slots exist
    REQUIRE no unresolved exclusive-slot collision
    providers = ResolveAllowlistedProviders(components)
    model = ProjectImmutableValues(providers, definition, stateFacts)
    // Read the authoritative cost projection; variable action cost uses the configured X label.
    model.costs = ProjectRegisteredCostProfile(stateFacts, definition)
    costRows = FilterAndOrderProjectedCosts(model.costs, config.cards.costs.order, config.cards.costs.providers)
    RenderCompactLeftCostRail(costRows, config.cards.costs, top=ResolveHeaderBandHeight(config.cards.geometry) + ResolveInset(config.cards.costs.insetRem)) // Anchor below header inside art; render outlined icon and number only, no box/background.
    model.actions = DomainAvailableCommands(context, entityRef) // owning host only
    RETURN model with named slots and semantic actions

FUNCTION RenderCard(model):
    ResolveInheritedCardTokensAndHostSize(model, mode)
    FOR each ordered slot IN model.components:
        RenderRegisteredComponent(slot.componentId, slot.displayData)
    BindSelectionSeparateFromExplicitPlayUseEquipCommands()
    ApplyCardRelativeBands(header=10%, art=40%, body=40%, footer=10%)
    // Visible badges are inside art; outline and info are outside band budget.
    ApplySharedPaletteFocusSelectionAndDisabledStates()
    RenderFooterMetadataOnly(); owningHost.RendersAvailableActionOutsideCard()
    // No Use/Play/Equip command belongs inside the card footer.

ON action:
    EmitIntentToOwningPresenter(); domain command revalidates current state
ON selectionChanged(selected):
    CancelPendingInfoTimerAndFade(); generation = NextSelectionGeneration()
    IF selected:
        ApplySharedSelectionOutline(); LiftVisuallyWithoutReflow()
        IF cardKind is not combatant: owningHost.ShowApplicableContextAction(); HighlightDomainEligibleTargets()
        DisableCommitUntilRequiredTargetIsSelected()
        After(config.infoDelayMs = 1000):
            IF stillSelected AND mounted AND generationIsCurrent:
                FadeInInfoButton(config.infoFadeMs); EnableInfoInput()
    ELSE: RemoveLiftOutlineAndInfo(); RestoreNormalStackOrder()
        owningHost.ClearContextActionAndTargetHighlights()
ON infoActivated:
    StopPropagation(); CancelPendingInfoTimerAndFade()
    OpenW1wCardInspector(entityRef, context, returnFocusTarget)
    // Never play/use/equip the card from this event.
ON inspectShortcut: OpenW1wCardInspectorImmediately()
ON inspectorClosed: RestoreSelectionAndFocusIfEntityStillExists()
ON inspect:
    OpenW1wCardInspectorWithoutMutatingEntity()
ON update/dispose:
    PreserveStableIdentityAndFocus(); release listeners/tooltips
Never branch on entity names or inject executable markup from tags.`;
 return `INPUT: entityRef, instanceSnapshot, context
PARENT: ${c.parent}
REQUIRED PROPOSED TAGS: ${c.tags.join(', ')}
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes ${c.id}
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
${c.fields.map((f,i)=>'    '+c.id+'.body.detail'+(i+1)+' ← registered provider for '+f).join('\n')}
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("${c.action}") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
${c.extra}
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.`;
}

const combatantDescription='Borderless combatant renderer. Inherits WC0 identity, tag providers, inspection and shared selection effects; overrides item-card bands. Name sits above HP. Intent is above sprite, hidden for player by configurable default; info appears above it after1s. Defense anchors at12% sprite height on player upper-right and88% on enemy lower-left, outside the sprite with0.5rem gap. Aura/buff fill sprite height. Filter active components before stacking HP/resources/buildup/stance/icons; max5 rows, no empty gaps. Extra resource and buildup bars are half HP height; stance matches HP width/height. Icons are1.575rem squares, icon-only; final +N opens the complete inspector. Shared0.2rem stack gap and whole-assembly selected glow. Tooltip delay1s. Inspector uses entity-name title; left sprite/name/HP only; right summary, current state, previous actions, known abilities/traits, lore. Facts are knowledge-filtered and data-driven. Formation fit is shared across factions and measured from unselected geometry. Configured row factors preserve upper/middle/lower depth; selected growth raises the assembly without changing its floor anchor. See CURRENT-SPECIFICATION.md.';
for(const c of cards)if(c.id.startsWith('WC4'))c.extra+=' '+combatantDescription;

let out='# Card wireframes — WC0, child cards, and child-of-child cards\n\n';
out+='**WC0 shared geometry:** header 10%, art 40%, body 40%, footer 10% of card height (not viewport height). Art includes meaningful tag badges; body includes rules and blocker. All drawings show selected state: outline follows the lifted card; (i) is centered above it and fades in after 1000ms of continuous selection. Info opens W1w. Card footer contains supplementary metadata; commands belong to the owning host. All cards share aspect ratio 5:8 (proposed token), with clamped width and derived height; viewport equivalents use labeled reference viewports. See CARD-SELECTION-CONTRACT.md.\n\n';
out+='Every card inherits WC0 bones/effects and adds components through validated tag rules. This is a design/specification artifact, not implemented game code. Proposed tag IDs below are illustrative vocabulary to map against the existing tag registry in the specification task; they are not claimed to exist. Read CARD-CONSTRUCTION-CONTRACT.md before implementation.\n\n';
out+='Names use `WCid.region.component`; named detail rows include their semantic sub-name in the size table. Width/height values are nominal **vh/vw of the visible game viewport**, not percentages of the card. Reference viewports: wide 1600×1000, compact 1000×800, portrait 400×800; actual runtime height is width / aspectRatio, never independently clamped. Children subdivide their card envelope; do not add their heights to the envelope. Actual cards are hosted in hands/grids/pickers: use container allocation, readable minimums, and explicit overflow/paging rather than shrinking content. See COMPONENT-SIZING.md.\n\n';
for(const c of cards){
 out+=`${c.parent?'###':'##'} Wireframe ${c.id}: ${c.name}\n\n**Parent: ${c.parent||'none — master card'}.** ${c.extra}\n\n**Construction tags (proposed):** ${c.tags.map(t=>'`'+t+'`').join(', ')}. Inherit ancestor tag requirements; compatible feature tags attach additional components.\n\n`;
 for(const mode of ['wide','compact','portrait'])out+=`**${mode==='wide'?'Wide':mode==='compact'?'Compact':'Vertical / Mobile'}**\n\n\`\`\`text\n${frame(c,mode)}\n\`\`\`\n\n`+sizes(c,mode);
 out+='**Language-agnostic pseudocode**\n\n```text\n'+configurablePseudocode(pseudo(c))+'\n```\n\n';
}
out+='## Verification\n\nValidate all three modes, inherited construction, multi-tag combinations, missing/unknown tags, optional components, state transitions, scoped entity IDs, readable artwork/text, inline actions and minimum targets. Adding a supported item/class/relic variation should require only normalized data/tag rows, with no new renderer branch. New behavior requires a registered tested primitive first.\n';
writeFileSync(join(root,'card-wireframes.md'),out);
writeFileSync(join(root,'card-wireframe-catalog.json'),JSON.stringify(cards.map(({id,parent,name,tags})=>({id,parent,name,proposedTags:tags,orientations:['wide','compact','portrait']})),null,2)+'\n');
console.log(`Generated ${cards.length} card wireframes with ${cards.length*3} ASCII views, size tables, and pseudocode.`);
