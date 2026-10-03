import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { relicArtAsset } from '../../src/model/relicArt.js';
import { renderCollectibleCard } from '../../src/ui/components/collectibleCard.js';
import { cardLevels, cardShapeCssProperties, cardLevelCssProperties } from '../../src/ui/models/CardSizeModel.js';

const registries = createRegistries(contentBundle);
for (const [key,value] of Object.entries({...cardShapeCssProperties(), ...cardLevelCssProperties()})) document.documentElement.style.setProperty(key,value);
const levels = cardLevels();
const groups = [
  {name:'Compact',level:'glance',width:levels.glance.variants.compact},
  {name:'Glance',level:'glance',width:levels.glance.widthPx},
  {name:'Focus',level:'focus',width:levels.focus.widthPx},
  {name:'Inspect',level:'inspect',width:levels.inspect.widthPx},
];
const notes = [
  {id:'ivoryComb',context:'An ordinary personal possession kept through the end. The catalog establishes the former owner’s care, but does not name that person or locate the comb in a particular region. Its ivory material and worn condition follow the item identity; the gold repair is an art interpretation.',sources:[['Catalog lore','src/content/relics.js']]},
  {id:'blessedDew',context:'A vial that gathers dew without a known source. The Field Flame is associated with healing and the turning seasons in the existing world lore, making that a thematic connection rather than a confirmed origin for this relic. Its maker, owner and the cause of the dew remain unknown.',sources:[['Catalog lore','src/content/relics.js'],['The Field Flame and the Hollow Weald','docs/LORE.md']]},
  {id:'gravetendersBell',context:'Direct quest connection: pay respects at the Grave of the Nameless, then accept the Keeper’s thanks. The Keeper presses a small, cold iron bell into your palm and asks for one toll for each name. The lore identifies the Keeper as a Forsaken who fell without being written into memory. This bell belongs to the Nameless quest, not the Bell Keeper boss’s cracked Bellfoundry bell.',sources:[['The Keeper’s gift and choice conditions','src/content/events.js'],['The Grave and the Keeper','docs/LORE.md'],['The Keeper’s cast entry','docs/LORE-CAST.md']]},
  {id:'wyrmHeart',context:'The relic’s own lore confirms that it still beats. The wider setting connects wyrms with the Cinder Reach, its deep heat and the Wyrm Aspirants’ efforts to keep the dragon asleep. No text identifies this relic as the Ashheart Dragon’s heart. That dragon is explicitly described as having no cinder in it; the painted warm fissure is a visual interpretation of heat, not a claim of an implanted cinder.',sources:[['Catalog lore','src/content/relics.js'],['Ashheart Dragon and its deep heat','docs/LORE-CAST.md'],['The Sleep and Wyrm Aspirants','docs/LORE-WORLD.md']]},
];
notes.push(
  {id:'forsakenMedallion',context:'The Reaver’s default starting relic. Its worn face and remembered gold are established by the catalog. The burgundy ribbon is an art interpretation; no named former owner is assigned.',sources:[['Catalog lore','src/content/relics.js'],['Class starting relics','src/content/classes.js']]},
  {id:'starstoneShard',context:'The Starseer’s default starting relic. The cast lore identifies the Hollow Astronomer’s orbital shards as starstone, the substance of the Ember. This shard’s catalog refers to another person’s genius but leaves that person unnamed; it is not assigned to the Astronomer.',sources:[['Catalog lore','src/content/relics.js'],['Class starting relics','src/content/classes.js'],['Starstone in the cast lore','docs/LORE-CAST.md']]},
  {id:'cutpursesCoin',context:'The Rogue’s default starting relic. Its two faces purchase silence and speed in the catalog lore. The closed-eye relief is a visual interpretation of silence, not an established faction emblem.',sources:[['Catalog lore','src/content/relics.js'],['Class starting relics','src/content/classes.js']]},
  {id:'goldFigurine',context:'The Herald’s default starting relic. The catalog establishes its small size, unusual weight and affection. Its protective pose is an art interpretation; no named saint or maker is established.',sources:[['Catalog lore','src/content/relics.js'],['Class starting relics','src/content/classes.js']]},
  {id:'goldenSprout',context:'The world lore explicitly links Golden Sprout, Goldleaf Charm and Goldbough Sapling to the old kingdom’s Goldbough name and gilded branch crest. The sleeping sapling in this relic connects directly to that established tradition.',sources:[['Catalog lore','src/content/relics.js'],['Goldbough name and crest','docs/LORE.md']]},
  {id:'crackedLantern',context:'The catalog establishes broken glass and a flame that persists. No existing item text assigns this lantern to the Bell Keeper, the Nameless Keeper or another named owner. Its stubborn light is kept as the relic’s own mystery.',sources:[['Catalog lore','src/content/relics.js']]},
  {id:'bloodstainedChalice',context:'The chalice fills as Bleed bursts occur, matching its catalog effect and uneasy flavor text. The text deliberately leaves its contents unexplained; no named ritual, saint or former owner is established.',sources:[['Catalog lore and effect','src/content/relics.js']]},
  {id:'crownOfStitches',context:'The Court’s surgeons stitched knights and courtiers back to their posts after the Court Flame failed. This provides a thematic connection for the crown’s stitches and costly strength, but the relic is in the shared boss pool and is not assigned specifically to the Stitched King.',sources:[['Catalog lore and boss rarity','src/content/relics.js'],['The Court and its surgeons','docs/LORE.md'],['Shared boss reward pool','src/engine/encounters.js']]},
);
const host = document.querySelector('#relic-cards');
const articles=[];
for (const relic of registries.relics.all()) {
  const note=notes.find(n=>n.id===relic.id) || {context:relic.flavor ? 'This is the existing catalog lore. No additional origin or named owner is asserted in this preview.' : 'No flavor text is currently authored for this relic in the catalog. The cards retain the game’s current fallback text; a dedicated lore entry remains to be written.',sources:[['Catalog lore and effect','src/content/relics.js']]};
  const painted=!!relicArtAsset(relic);
  const owners=registries.classes.all().filter(c=>c.startingRelic===relic.id||c.kitRelic===relic.id).map(c=>c.name);
  const acquisition=owners.length ? 'Class association: '+owners.join(', ')+'.' : relic.pool==='quest' ? 'Quest reward; excluded from generic relic rolls.' : relic.rarity==='boss' ? 'Shared boss reward pool; not assigned to a specific boss.' : 'Standard common/uncommon/rare reward pool; chance depends on the eligible unowned pool.';
  const article = document.createElement('article'); article.id = relic.id;
  article.dataset.artwork=painted?'painted':'glyph';
  const title=document.createElement('h2'); title.textContent=relic.name;
  const id=document.createElement('code'); id.textContent=relic.id+' · '+relic.rarity;
  const quote=document.createElement('blockquote'); quote.textContent=relic.flavor||'No catalog lore authored yet.';
  const context=document.createElement('p');context.className='lore-context';context.textContent=note.context+' '+acquisition;
  const artState=document.createElement('p');artState.className='lore-source';artState.textContent=painted?'Painted artwork available.':'Artwork pending — current game glyph shown.';
  const source=document.createElement('p');source.className='lore-source';source.append('Existing sources: ');
  note.sources.forEach(([name,path],i)=>{if(i)source.append(' · ');const a=document.createElement('a');a.href=path;a.textContent=name;source.append(a);});
  const row=document.createElement('div');row.className='card-comparison';row.tabIndex=0;row.setAttribute('role','region');row.setAttribute('aria-label',relic.name+' in four game sizes');
  for(const group of groups){
    const figure=document.createElement('figure');figure.className='card-size-group';figure.dataset.sizeGroup=group.name;figure.style.setProperty('--sample-width',group.width+'px');
    const label=document.createElement('figcaption');label.textContent=group.name;
    const measure=document.createElement('small');measure.textContent=group.width+' px wide · '+group.level;label.append(measure);
    const {card}=renderCollectibleCard(registries,relic,'Relic',{level:group.level,interactive:false,inspection:false,identity:relic.id+'-'+group.name});
    figure.append(label,card);row.append(figure);
  }
  article.append(title,id,quote,context,source,artState,row);host.append(article);
  articles.push({article,search:[relic.id,relic.name,relic.flavor,note.context,...owners].join(' ').toLowerCase(),painted});
}
function filter(){
  const query=document.querySelector('#relic-search').value.trim().toLowerCase();
  const mode=document.querySelector('#relic-filter').value;
  let count=0;
  for(const entry of articles){const show=entry.search.includes(query)&&(mode==='all'||(mode==='painted')===entry.painted);entry.article.hidden=!show;if(show)count++;}
  document.querySelector('#relic-count').textContent=count+' of '+articles.length+' relics · '+articles.filter(a=>a.painted).length+' painted · four card sizes each';
}
document.querySelector('#relic-search').addEventListener('input',filter);
document.querySelector('#relic-filter').addEventListener('change',filter);
filter();
document.body.dataset.previewReady='true';
