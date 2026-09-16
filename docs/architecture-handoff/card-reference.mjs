// Immutable documentation fixtures. Values, art and names are illustrative.
const freeze=value=>{Object.values(value).forEach(child=>{if(child&&typeof child==='object')freeze(child)});return Object.freeze(value)};
export const cardReferenceConfig=freeze({
  geometry:{ratioWidth:5,ratioHeight:8,widthMinimum:'10rem',widthPreferred:'18vw',widthMaximum:'16rem',bands:{header:10,art:40,body:40,footer:10}},
  interaction:{inspectDelayMs:1000,tooltipDelayMs:1000},
  costs:{order:['action','stamina','mana'],showZero:false,railWidthRem:1.8,insetRem:0.15,gapRem:0.1,fontRem:0.75,iconSizeRem:0.8,outlineColor:'#120e09',variableLabel:'X',providers:{action:{label:'Actions',glyph:'◆',icon:'diamond',color:'#d1aa60'},stamina:{label:'Stamina',glyph:'ϟ',icon:'bolt',color:'#88b96d'},mana:{label:'MP',glyph:'♦',icon:'droplet',color:'#79bcec'}},sampleOverrides:{WC1b:{stamina:2},WC1c:{mana:3}}},
  metadata:{ownedLabel:'Owned',unknown:'Unknown',empty:'None'},
  body:{maximumPreviewFacts:2,showFlavor:false},
  components:{identity:'WCI1',art:'WCI2',footer:'WCI3',inspect:'WCB1',action:'WCB2',facts:'WCF4'},
  features:[
    {tag:'feature:rules',component:'rules',order:10},
    {tag:'feature:facts',component:'facts',order:20},
    {tag:'feature:availability',component:'availability',order:30}
  ],
  tags:{attack:{label:'Attack',description:'An attack card. Target and effect come from its projected rules.'},skill:{label:'Skill',description:'A skill card with a context-defined effect.'},power:{label:'Power',description:'A card whose projected effect can persist.'},curse:{label:'Curse',description:'An unfavorable card; this fixture cannot be played.'},status:{label:'Status',description:'A temporary deck condition in this fixture.'},weapon:{label:'Weapon',description:'Equipment with projected weapon facts and requirements.'},armor:{label:'Armor',description:'Equipment with projected protection and requirements.'},relic:{label:'Relic',description:'An owned object with authored passive or triggered effects.'},passive:{label:'Passive',description:'Applies while its domain activation condition is true.'},triggered:{label:'Triggered',description:'Applies when its registered trigger resolves.'},consumable:{label:'Consumable',description:'Using this object consumes its projected charge or quantity.'},healing:{label:'Healing',description:'Restores health, subject to projected limits.'},resource:{label:'Resource',description:'Changes the projected resource pool.'},utility:{label:'Utility',description:'Provides a situational effect.'},class:{label:'Class',description:'A character archetype and its known starting properties.'},kit:{label:'Starting kit',description:'A collection of initial equipment and cards.'},combatant:{label:'Combatant',description:'A borderless actor assembly using WC4 geometry.'}}
});
const playing='src/model/playingCard.js',equipment='src/model/equipmentCard.js',collectible='src/ui/components/collectibleCard.js';
// Family inheritance carries schema and feature tags. Child arrays replace the
// parent array, so a curse cannot accidentally retain the parent attack badge.
export const cardReferenceRegistry=freeze({
 WC0:{parent:null,name:'Reference card',kind:'card',glyph:'◇',headerState:'Known',rules:'A shared card face populated by its view model.',facts:[['Type','Reference']],rarity:'Common',owned:1,tags:[],construction:['feature:rules','feature:facts'],availability:null,flavor:'An illustrative card.',references:['src/ui/components/card.js','src/ui/components/cardInspection.js']},
 WC1:{parent:'WC0',name:'Measured Strike',kind:'playing',glyph:'⚔',headerState:'',costs:{action:1,stamina:0,mana:0,variable:false},rules:'Deal 8 damage to one eligible enemy.',facts:[['Target','One enemy']],tags:['attack'],construction:['feature:rules','feature:facts','feature:availability'],availability:'Playable when an eligible target exists.',references:[playing,'src/ui/components/card.js']},
 WC1a:{parent:'WC1',name:'Measured Strike'},
 WC1b:{parent:'WC1',name:'Brace',glyph:'⛨',rules:'Gain 6 defense.',facts:[['Target','Self']],tags:['skill'],availability:'Playable while the actor can act.'},
 WC1c:{parent:'WC1',name:'Ember Focus',glyph:'✦',rules:'Your next attack gains its projected bonus.',facts:[['Duration','Until consumed']],tags:['power'],availability:'Playable while the actor can act.'},
 WC1d:{parent:'WC1',name:'Lingering Doubt',glyph:'☾',headerState:'Unplayable',rules:'Carries an unfavorable authored effect.',facts:[['Playability','Cannot be played']],tags:['curse'],availability:'No play action.'},
 WC1e:{parent:'WC1',name:'Dazed',glyph:'⌁',headerState:'Unplayable',rules:'A temporary condition occupying a draw.',facts:[['Lifetime','Projected by the domain']],tags:['status'],availability:'No play action.'},
 WC2:{parent:'WC0',name:'Traveler’s Keepsake',kind:'item',glyph:'◆',rules:'An owned item with authored effects.',facts:[['Ownership','Carried']],tags:[],references:[equipment,'src/ui/components/equipmentCard.js']},
 WC2a:{parent:'WC2',name:'Iron Blade',kind:'equipment',glyph:'⚔',headerState:'Equipped',rules:'A balanced blade with a projected attack bonus.',facts:[['Attack','+2'],['Requirement','Strength 8']],tags:['weapon'],construction:['feature:rules','feature:facts','feature:availability'],availability:'Compatible with the selected weapon slot.'},
 WC2a1:{parent:'WC2a',name:'Iron Blade'},
 WC2a2:{parent:'WC2a',name:'Travel Armor',glyph:'⛨',rules:'Light protection for the road.',facts:[['Protection','+3'],['Requirement','Constitution 8']],tags:['armor'],availability:'Compatible with the selected armor slot.'},
 WC2b:{parent:'WC2',name:'Ashen Seal',kind:'relic',glyph:'✥',headerState:'Passive',rules:'Grants its authored benefit while active.',facts:[['Activation','While owned']],tags:['relic','passive'],references:[collectible,'src/ui/components/equipmentCard.js']},
 WC2b1:{parent:'WC2b',name:'Ashen Seal'},
 WC2b2:{parent:'WC2b',name:'Watchkeeper Bell',glyph:'♧',headerState:'Triggered',rules:'Grants its authored benefit when guard breaks.',facts:[['Trigger','Guard break'],['Cooldown','Once per encounter']],tags:['relic','triggered']},
 WC2c:{parent:'WC2',name:'Healing Draught',kind:'consumable',glyph:'⚗',headerState:'1 charge',rules:'Restore 20 health, limited by maximum health.',facts:[['Charges','1 / 1']],tags:['consumable','healing'],construction:['feature:rules','feature:facts','feature:availability'],availability:'Available when health is missing.',references:[collectible,'src/ui/components/flask.js'],flavor:'A little warmth against the ash.'},
 WC2c1:{parent:'WC2c',name:'Healing Draught'},
 WC2c2:{parent:'WC2c',name:'Azure Draught',rules:'Restore 2 resource, limited by its maximum.',tags:['consumable','resource'],availability:'Available when resource is missing.'},
 WC2c3:{parent:'WC2c',name:'Smoke Phial',glyph:'⚱',rules:'Apply the projected evasion effect.',tags:['consumable','utility'],availability:'Requires a valid combat context.'},
 WC3:{parent:'WC0',name:'Vanguard',kind:'character-choice',glyph:'♜',headerState:'Class',rules:'A defensive starting archetype.',facts:[['Starting focus','Guard'],['Resource','Resolve']],tags:['class'],rarity:'Archetype',owned:null,references:['src/ui/screens/customize.js','src/ui/components/statAllocationCard.js']},
 WC3a:{parent:'WC3',name:'Vanguard'},
 WC3b:{parent:'WC3',name:'Blade and Guard',glyph:'⚔',headerState:'Kit',rules:'Begin with a blade, armor and guard cards.',facts:[['Weapon','Iron blade'],['Cards','Strike · Brace']],tags:['kit'],rarity:'Starting kit'},
 WC4:{parent:'WC0',name:'Ashen Sentinel',kind:'combatant',glyph:'♟',headerState:'Enemy',rules:'An illustrative combatant.',facts:[['HP','32 / 40'],['Defense','8']],tags:['combatant'],references:['src/ui/components/combatantFrame.js','src/ui/components/combatantInspector.js'],geometry:'WC4 borderless sprite assembly; does not inherit WC0 item face'},
 WC4a:{parent:'WC4',size:'compact'},WC4b:{parent:'WC4',size:'standard'},WC4c:{parent:'WC4',size:'expanded'}
});
export const cardReferenceDescription='Illustrative executable documentation fixtures, not current game balance or generated production data. Current source references supply the model/render boundaries. Projected playingCardModel.costs supplies action, mana, stamina and variable costs (src/model/playingCard.js). All present costs use one compact left rail below the header inside the art, ordered by configurable providers, so overlapping hands expose them. Each row uses an outlined icon and number without a box or background. Optional stamina/MP fixture overrides are illustrative only. Proposed WC0 geometry and shared selection remain owner-requested design changes.';
