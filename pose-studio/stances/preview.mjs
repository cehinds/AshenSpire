import { alternativeStances as catalog } from '../../src/content/alternativeStances.js';
import { createAlternativeStanceStage } from '../../src/ui/alternativeStanceStage.js';
import { createStanceLedger, stanceForCard, stanceForPublicIntent } from '../../src/model/alternativeStance.js';
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { concealIntent } from '../../src/model/combatIntentVisibility.js';

const $ = id => document.getElementById(id), rootUrl = new URL('../../', location.href);
const url = path => new URL(path,rootUrl).href;
const registry = createRegistries(contentBundle), ledger = createStanceLedger();
let stage = null, stance = 'offensive';
const row = () => catalog.coverage.find(r => r.id === $('actor').value);
const familyNames = {offensive:'Offensive',defensive:'Defensive',casting:'Casting'};
for (const kind of ['player','enemy']) {
  const group = document.createElement('optgroup'); group.label = kind === 'player' ? 'Canonical class / armour' : 'Enemies';
  for(const r of catalog.coverage.filter(r=>r.kind===kind)) { const option = document.createElement('option'); option.value=r.id; option.textContent=r.name; group.append(option); }
  $('actor').append(group);
}
for (const family of catalog.stances) {
  const button = document.createElement('button'); button.textContent=familyNames[family]; button.dataset.stance=family;
  button.addEventListener('click',()=>selectStance(family)); $('families').append(button);
}
function selectStance(next) {
  stance=next; stage?.setStance(next);
  $('families').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stance===next)));
  const r=row(); $('stage-label').textContent=`${r.name} · ${next || 'no card this turn'}`;
  const project=catalog.actors[r.id]?.rig;
  $('workshop').href=project?url(project):'#';$('workshop').setAttribute('aria-disabled',String(!project));
  const supported=catalog.actors[r.id]?.poseStudioSupported;
  $('pose-project').href=project && next && supported?url(`pose-studio/stances/projects/${catalog.actors[r.id].equivalentTo || r.id}/${next}.pose.json`):'#';
  $('pose-project').setAttribute('aria-disabled',String(!project || !next || !supported));
  $('pose-project').textContent=supported?'Download Pose Studio project ↓':'Enemy projects open in Sprite Workshop';
  if(stage)stage.ready.then(ok=>{if(!ok&&next)$('message').textContent='Artwork could not load. The coverage report remains explicit.';});
}
function selectActor() {
  stage?.dispose(); $('figure').replaceChildren(); const r=row();
  stage=createAlternativeStanceStage(r.id,{resolveUrl:url,lite:$('quality').value==='lite'});
  if(stage)$('figure').append(stage.el);
  else { const pending=document.createElement('div');pending.className='pending';pending.textContent='Three stance poses unpainted for this armour';$('figure').append(pending); }
  $('coverage').textContent=r.status==='unpainted'?'UNPAINTED · this canonical cell has no stance export':r.status==='painted-draft'?'NEW PAINTED DRAFT · anatomical review pending':r.status==='explicit-same-class-equivalence'?`SAME-CLASS EQUIVALENCE · ${r.stanceSource}`:'EXISTING PAINTED POSE ADAPTATION · held attack / guard / buff';
  const enemy=r.kind==='enemy';
  for(const id of ['seat-label','card-label','confirm','new-turn','seats'])$(id).hidden=enemy;
  for(const id of ['intent-label','hidden-label'])$(id).hidden=!enemy;
  $('simulation-title').textContent=enemy?'Read only the public committed intent.':'The last card owns the stance.';
  if(!enemy){
    $('card').replaceChildren();
    const cards=registry.cards.all().filter(c=>stanceForCard(c));
    const groups=new Map(catalog.stances.map(s=>[s,document.createElement('optgroup')]));
    for(const [s,group] of groups)group.label=familyNames[s];
    for(const c of cards){const option=document.createElement('option');option.value=c.id;option.textContent=c.name+' · '+c.id;groups.get(stanceForCard(c)).append(option);}
    $('card').append(...groups.values());
  }
  selectStance(stance || 'offensive'); if(enemy)updateIntent();
}
function updateIntent() {
  const broad=$('intent').value;
  const profile={camp:broad==='casting'?'spell':'physical',maneuver:({attacking:'attack',smashing:'smash',sweeping:'sweep',ranged:'ranged',defending:'defend',countering:'counter'})[broad] || null};
  // Only the model projection is supplied to the renderer. Exact private fields
  // in this test fixture cannot affect selection or reach the DOM.
  const privateIntent={kind:'attack',stance:broad,moveId:'private-fixture',damage:999,profile};
  const publicIntent=$('hidden').checked?concealIntent(privateIntent,profile):{...privateIntent,hidden:false,revealed:true};
  selectStance(stanceForPublicIntent(publicIntent));
  $('receipt').textContent=`Public stance: ${broad} · ${$('hidden').checked?'exact move hidden':'intent read'} · family: ${stance || 'neutral'}`;
}
function seatStatus(){ $('seats').textContent=`Seat A: ${ledger.get('seat-a') || 'neutral'} · Seat B: ${ledger.get('seat-b') || 'neutral'}`; }
$('confirm').addEventListener('click',()=>{
  const card=registry.cards.get($('card').value), actorId=$('seat').value;
  ledger.accept({type:'cardPlayed',playerId:actorId,cardId:card.id},card);
  selectStance(ledger.get(actorId));$('receipt').textContent=`Confirmed ${card.name} → ${stance}. Held until this seat plays another card or starts its next turn.`;seatStatus();
});
$('new-turn').addEventListener('click',()=>{ledger.accept({type:'playerTurnStart',playerId:$('seat').value});selectStance(null);$('receipt').textContent='New turn · last-card stance cleared for this seat.';seatStatus();});
$('seat').addEventListener('change',()=>{selectStance(ledger.get($('seat').value));seatStatus();});
$('actor').addEventListener('change',selectActor);
$('quality').addEventListener('change',()=>stage?.setLite($('quality').value==='lite'));
$('intent').addEventListener('change',updateIntent);$('hidden').addEventListener('change',updateIntent);
$('reduced').addEventListener('change',()=>{$('stage').dataset.reducedMotion=String($('reduced').checked);$('message').textContent='Static stance retained. This layer has no animation travel, flashes or pacing delay.';});
function atlas(){
  $('atlas').replaceChildren();
  for(const r of catalog.coverage.filter(r=>$('filter').value==='all'||r.kind===$('filter').value||($('filter').value==='unpainted'&&r.status==='unpainted'))){
    const tile=document.createElement('article');tile.className='tile';tile.dataset.actor=r.id;
    const heading=document.createElement('h3');heading.textContent=r.name;tile.append(heading);
    const poses=document.createElement('div');poses.className='poses';
    for(const s of catalog.stances){const figure=document.createElement('figure'),frame=catalog.actors[r.id]?.frames[s];
      if(frame){const image=new Image();image.src=url(frame.lite);image.alt=`${r.name} ${s}`;image.loading='lazy';figure.append(image);}
      else {const pending=document.createElement('div');pending.className='pending';pending.textContent='UNPAINTED';figure.append(pending);}
      const caption=document.createElement('figcaption');caption.textContent=familyNames[s];figure.append(caption);poses.append(figure);}
    tile.append(poses);const status=document.createElement('p');status.textContent=`${r.canonicalId} · ${r.status}`;tile.append(status);$('atlas').append(tile);
  }
}
$('filter').addEventListener('change',atlas);
const c=catalog.counts;
$('counts').textContent=`${c.canonicalPlayers} armour cells. ${c.canonicalEnemies} enemies.`;
$('counts-note').textContent=`${c.newPlayerAppearances} newly painted base appearances · ${c.explicitEquivalences} explicit same-class equivalents · ${c.reusedEnemyAppearances} reused painted enemy families · ${c.unpaintedCanonicalCells} armour cells pending. ${c.availableStanceCells}/${c.requiredStanceCells} stance cells have exports.`;
selectActor();atlas();seatStatus();$('message').textContent='Preview ready. Draft pose anatomy and pending armour are visible in the production board.';
window.stancePreview={catalog,ledger,get stance(){return stance;}};
