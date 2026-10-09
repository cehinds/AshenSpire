const $=id=>document.getElementById(id);
const names={reaver:'Reaver',rogue:'Rogue',starseer:'Starseer',herald:'Herald'},families={attack:'Attack',defend:'Defend',casting:'Casting'};
const key='ashenspire.stance-options.20261008';
let selected={};try{selected=JSON.parse(localStorage.getItem(key)||'{}');if(!selected||Array.isArray(selected)||typeof selected!=='object')selected={};}catch{}
const [manifest,confirmed]=await Promise.all(['manifest.json','selections.json'].map(async path=>(await fetch(path)).json()));
const corrections={
 'reaver-defend':'Five distinct guards with two hands on the greatsword and the weapon covering the front.',
 'rogue-defend':'Both hands and daggers guard the space in front of the Rogue, toward the enemy.',
 'starseer-casting':'Book in front, with its pages turned toward Starseer; staff raised in the right hand.',
 'herald-casting':'Book in front, opened toward Herald so he can read it.'
};
const valid=new Set(manifest.boards.flatMap(b=>b.options.map(o=>o.id)));
for(const [board,id] of Object.entries(selected))if(!valid.has(id)||!manifest.boards.find(b=>b.id===board)?.options.some(o=>o.id===id))delete selected[board];
function label(b,o){return `${names[b.actor]} · ${families[b.stance]} · ${o.label}`;}
function lines(){return manifest.boards.filter(b=>selected[b.id]).map(b=>{const o=b.options.find(o=>o.id===selected[b.id]);return `${label(b,o)} — ${o.name}`;}).join('\n');}
function update(){
 try{localStorage.setItem(key,JSON.stringify(selected));}catch{}
 $('selected-count').textContent=`${Object.keys(selected).length} / 12`;$('choices').textContent=lines()||'No choices yet.';
 for(const card of document.querySelectorAll('.option')){const yes=selected[card.dataset.board]===card.dataset.option;card.classList.toggle('selected',yes);card.querySelector('.choose').setAttribute('aria-pressed',String(yes));card.querySelector('.choose').textContent=yes?'Selected ✓':'Choose '+card.dataset.label;}
}
function art(board,option){
 const button=document.createElement('button');button.className='art';button.type='button';button.setAttribute('aria-label','Enlarge '+label(board,option));
 const view=option.view||{x:option.column*512,y:option.row*512,width:512,height:512};
 const img=new Image();img.alt=label(board,option)+' — '+option.name;
 button.style.aspectRatio=`${view.width}/${view.height}`;
 img.style.width=`${(board.width||1536)/view.width*100}%`;img.style.height=`${(board.height||1024)/view.height*100}%`;img.style.left=`-${view.x/view.width*100}%`;img.style.top=`-${view.y/view.height*100}%`;img.src=board.path;
 const loading=document.createElement('span');loading.textContent='Painting loading…';button.append(img,loading);img.onload=()=>loading.remove();img.onerror=()=>{loading.textContent='Painting not yet available';button.disabled=true;};
 return button;
}
for(const actor of Object.keys(names))for(const stance of Object.keys(families)){
 const b=manifest.boards.find(b=>b.actor===actor&&b.stance===stance),section=document.createElement('section');section.className='board';section.id=b.id;section.dataset.actor=actor;section.dataset.stance=stance;
 const heading=document.createElement('div');heading.className='board-head';const title=document.createElement('h2');title.textContent=`${names[actor]} · ${families[stance]}`;const source=document.createElement('a');source.href=b.path;source.target='_blank';source.className='board-source';source.textContent='Open whole painting ↗';heading.append(title,source);section.append(heading);
 const note=document.createElement('p');note.className='board-note';note.textContent=corrections[b.id]||'Five different held readiness poses. Click a painting to inspect it larger.';section.append(note);
 const options=document.createElement('div');options.className='options';
 for(const o of b.options){
  const card=document.createElement('figure');card.className='option pending';Object.assign(card.dataset,{board:b.id,option:o.id,label:o.label});const image=art(b,o);
  image.querySelector('img').addEventListener('load',()=>{card.classList.remove('pending');card.querySelector('.choose').disabled=false;});
  image.onclick=()=>{const enlarged=art(b,o);enlarged.onclick=()=>{};$('large-art').replaceChildren(enlarged);$('large-label').textContent=label(b,o)+' — '+o.name;$('large').showModal();};
  const caption=document.createElement('figcaption'),id=document.createElement('div'),name=document.createElement('div'),choose=document.createElement('button');id.className='label';id.textContent=label(b,o);name.className='name';name.textContent=o.name;choose.className='choose';choose.type='button';choose.disabled=true;choose.setAttribute('aria-pressed','false');choose.setAttribute('aria-label','Choose '+label(b,o));choose.onclick=()=>{selected[b.id]=o.id;update();$('status').textContent='Selected '+label(b,o)+'. Copy your choices when ready.';};caption.append(id,name,choose);card.append(image,caption);options.append(card);
 }
 section.append(options);$('boards').append(section);
}
function filter(){for(const b of document.querySelectorAll('.board'))b.hidden=($('class').value!=='all'&&b.dataset.actor!==$('class').value)||($('stance').value!=='all'&&b.dataset.stance!==$('stance').value);}
$('class').onchange=filter;$('stance').onchange=filter;
$('copy').onclick=async()=>{const text=lines();if(!text){$('status').textContent='Choose at least one option first.';return;}try{await navigator.clipboard.writeText(text);$('status').textContent='Choices copied. Paste them in the chat.';}catch{$('selection').open=true;$('status').textContent='Select and copy the choices shown below.';}};
$('clear').onclick=()=>{selected={};update();$('status').textContent='Choices cleared.';};$('close').onclick=()=>$('large').close();
for(const actor of [...new Set(confirmed.choices.map(c=>c.actor))]){
 const group=document.createElement('section');group.className='confirmed-group';const heading=document.createElement('h3');heading.textContent=names[actor];const cards=document.createElement('div');cards.className='confirmed-cards';
 for(const choice of confirmed.choices.filter(c=>c.actor===actor)){
  const board={actor,stance:choice.stance,...choice.source},option={label:'Chosen',name:choice.name,view:choice.source.view};
  const card=document.createElement('figure');card.className='confirmed-option';card.dataset.source=choice.sourceOption;const picture=art(board,option);
  picture.onclick=()=>{$('large-art').replaceChildren(art(board,option));$('large-label').textContent=label(board,option)+' — '+choice.name;$('large').showModal();};
  const caption=document.createElement('figcaption'),title=document.createElement('div'),name=document.createElement('div');title.className='label';title.textContent=choice.stance==='casting'?'Preparing (casting)':families[choice.stance];name.className='name';name.textContent=choice.name;caption.append(title,name);card.append(picture,caption);cards.append(card);
 }
 group.append(heading,cards);$('confirmed-groups').append(group);
}
update();window.stanceOptions={manifest,confirmed,get selections(){return {...selected};},lines};
