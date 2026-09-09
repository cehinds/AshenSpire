import {SEQUENCES,PHASES,DURATIONS} from './sequences.mjs';
const $=id=>document.getElementById(id),base='art/combined-reference/transitions/';
const autoplay=new URLSearchParams(location.search).get('play')==='1';
let id=new URLSearchParams(location.search).get('class')||'reaver',frame=0,step=0,playing=false,timer;
if(!SEQUENCES[id])id='reaver';
const src=i=>`${base}frames/${id}/${i}.png`;
const order=()=>SEQUENCES[id].order||PHASES.map((_,i)=>i);
function advance(delta){const frames=order();step=(step+delta+frames.length)%frames.length;frame=frames[step]}
function stop(){playing=false;clearTimeout(timer);$('play').textContent='Play'}
function schedule(){clearTimeout(timer);if(playing)timer=setTimeout(()=>{advance(1);render();schedule()},DURATIONS[frame]/Number($('speed').value))}
function render(){
 $('current').src=src(frame);$('current').alt=`${SEQUENCES[id].title}, ${PHASES[frame]}`;$('previous').src=src(order()[(step+order().length-1)%order().length]);$('previous').style.display=$('onion').checked?'block':'none';
 $('status').textContent=`Step ${step+1} / ${order().length} · Sprite ${frame+1} · ${PHASES[frame]}${[2,4,6].includes(frame)?' · new bridge':''}`;
 for(const b of $('frames').children)b.setAttribute('aria-pressed',String(Number(b.dataset.frame)===frame));
 window.transitionReference={id,frame,step,order:order(),playing};
}
function choose(next){stop();id=next;step=0;frame=order()[0];$('title').textContent=SEQUENCES[id].title;$('note').textContent=SEQUENCES[id].note;$('keys').src=`${base}keys/${id}.png`;$('master').href=`${base}masters/${id}.png`;
 $('frames').replaceChildren(...PHASES.map((phase,i)=>{const b=document.createElement('button');b.type='button';b.dataset.frame=i;b.className=[2,4,6].includes(i)?'bridge':'';b.setAttribute('aria-label',`${i+1}. ${phase}`);const img=new Image();img.src=src(i);img.alt='';const t=document.createElement('span');t.textContent=`${i+1}. ${phase}`;b.append(img,t);b.onclick=()=>{stop();frame=i;step=order().indexOf(i);render()};return b}));
 for(const b of $('sequences').children)b.setAttribute('aria-pressed',String(b.dataset.id===id));history.replaceState(null,'',`?class=${id}`);render();
}
for(const[key,s]of Object.entries(SEQUENCES)){const b=document.createElement('button');b.type='button';b.dataset.id=key;b.textContent=s.title;b.onclick=()=>choose(key);$('sequences').append(b)}
$('play').onclick=()=>{if(playing)stop();else{playing=true;$('play').textContent='Pause';schedule()}render()};
for(const[k,d]of [['back',-1],['next',1]])$(k).onclick=()=>{stop();advance(d);render()};
$('speed').onchange=schedule;$('onion').onchange=render;
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();render()}});choose(id);if(autoplay)$('play').click();
