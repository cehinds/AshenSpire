import {rewardProgress} from '../../model/rewardprogress.js';
import {orderedXpRows,xpFillDurations} from '../../model/rewardXpPresentation.js';
import {registriesForClassMastery} from '../../model/classMasteryRun.js';
import {t} from '../strings.js';
import {button as kitButton} from '../kit/index.js';

const clamp=value=>Math.max(0,Math.min(1,value));
const node=(tag,className,text)=>{const element=document.createElement(tag);element.className=className;if(text!==undefined)element.textContent=text;return element;};

/** A seat-owned presentation. Updates acknowledge host claims; this view never pays XP. */
export function mountCoopXpProgression(host,{registries,member,onClaim,onReadyChange=()=>{},settings={}}){
  const gains={level:0,tracks:{}},seen=new Set(),records=new Map();
  const panel=node('section','reward-progress coop-xp-progression');
  const list=node('ul','reward-progress-list'),message=node('p','reward-note');
  message.setAttribute('role','alert');message.hidden=true;
  host.classList.add('reward-door');panel.append(node('h3','as-eyebrow',t('reward.progress.heading')),list,message);host.append(panel);
  let disposed=false,ready=false,waiting=null,frame=0,queue=[],started=null,current=member;
  const reduced=()=>settings.reducedMotion===true||document.body.classList.contains('reduced-motion')||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const seconds=(key,fallback)=>Number.isFinite(settings[key])?Math.max(0,settings[key]):fallback;
  const pending=id=>(current.pendingLevels||[]).some(row=>row.skillId===id&&row.count>0);
  function setReady(value){if(ready===value)return;ready=value;onReadyChange(value);}
  function paint(record){
    const fraction=clamp(record.shown);record.under.style.width=record.over.style.width=`${fraction*100}%`;
    const full=fraction>=1;record.bar.classList.toggle('rp-bar-ready',full);
    record.bar.setAttribute('aria-valuenow',String(Math.round(fraction*(record.row.xpToNext||record.row.xp))));
  }
  function buttons(){
    for(const record of records.values()){
      if(!ready||waiting||typeof onClaim!=='function'||record.row.capped||!pending(record.row.id)){
        record.button?.remove();record.button=null;record.element.classList.remove('reward-level-ready');continue;
      }
      // Heartbeats may refresh the same ledger while a keyboard user focuses
      // a ready action. Keep its DOM identity until availability changes.
      if(record.button)continue;
      const button=kitButton({label:t('reward.level.button'),className:'reward-level-up',attrs:{'data-track':record.row.id,'aria-label':`${t('reward.level.button')} ${record.label}`}});
      button.addEventListener('click',()=>{
        if(!ready||waiting||!pending(record.row.id))return;
        waiting=record.row.id;message.hidden=true;setReady(false);buttons();
        try{const result=onClaim?.(record.row.id);if(result===false)rejectClaim();else if(result?.then)result.then(value=>{if(value===false)rejectClaim();},error=>rejectClaim(error?.message));}
        catch(error){rejectClaim(error.message);}
      });
      record.button=button;record.element.classList.add('reward-level-ready');record.element.append(button);
    }
  }
  function finish(){queue=[];started=null;frame=0;setReady(!waiting);buttons();}
  function tick(time){
    if(disposed)return;frame=0;if(started===null)started=time;
    while(queue.length){
      const job=queue[0],record=records.get(job.id),elapsed=time-started;
      if(job.duration>0&&elapsed<job.duration){record.shown=job.from+(job.to-job.from)*clamp(elapsed/job.duration);paint(record);break;}
      record.shown=job.to;paint(record);started+=job.duration;queue.shift();
    }
    if(queue.length)frame=requestAnimationFrame(tick);else finish();
  }
  function animate(jobs,refill){
    if(frame)cancelAnimationFrame(frame);frame=0;started=null;
    const fullMs=1000*seconds(refill?'levelUpRefillSeconds':'xpFillSeconds',refill ? 0.28 : 1.2);
    const durations=xpFillDurations(jobs,fullMs);
    queue=jobs.map((job,index)=>({...job,duration:durations[index]}));setReady(false);buttons();
    if(reduced()||!queue.some(job=>job.duration>0)){for(const job of queue){const record=records.get(job.id);record.shown=job.to;paint(record);}finish();}
    else frame=requestAnimationFrame(tick);
  }
  function makeRecord(row,from){
    const element=node('li','reward-progress-row');element.dataset.track=row.id;element.dataset.kind=row.kind;
    const name=node('span','rp-name'),level=node('span','rp-level'),next=node('span','rp-next'),gain=node('span','rp-gain');
    const under=node('span','rp-under'),over=node('span','rp-over'),text=node('span','rp-bar-text');
    const bar=node('div','rp-bar rp-layered-bar');bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.dataset.track=row.id;bar.append(under,over,text);
    element.append(name,level,bar,next,gain);
    return {row,element,name,level,next,gain,under,over,text,bar,shown:from,button:null};
  }
  function update(nextMember){
    if(disposed)return;current=nextMember;
    const receipt=current.xpProgression,previousPending=queue.map(job=>job.id);
    const receipts=[...(Array.isArray(receipt?.history)?receipt.history:[]),receipt].filter(item=>item?.id&&!seen.has(item.id));
    const newReceipt=receipts.length>0;
    for(const item of receipts){
      if(seen.has(item.id))continue;seen.add(item.id);gains.level+=Math.max(0,item.xpGains?.level||0);
      for(const[id,amount]of Object.entries(item.xpGains?.tracks||{}))if(amount>0)gains.tracks[id]=(gains.tracks[id]||0)+amount;
    }
    const run={...current,class:current.classId||current.class};
    const source=registriesForClassMastery(registries,run);
    let rows=orderedXpRows(rewardProgress(source,run,seen.size?gains:null));
    if(!seen.size)rows=rows.filter(row=>pending(row.id));
    const jobs=[];let refill=false;
    for(const row of rows){
      let record=records.get(row.id);const changedLevel=record&&record.row.level!==row.level;
      const before=row.id==='character'?receipt?.xpBefore?.character:receipt?.xpBefore?.tracks?.[row.id];
      if(!record){const from=!seen.size?row.fraction:before?.level===row.level&&row.xpToNext?clamp(before.xp/row.xpToNext):0;record=makeRecord(row,from);records.set(row.id,record);if(seen.size)jobs.push({id:row.id,from,to:row.fraction});}
      else if(changedLevel){record.shown=0;refill=true;jobs.push({id:row.id,from:0,to:row.fraction});if(waiting===row.id)waiting=null;}
      else if(record.row.xp!==row.xp||previousPending.includes(row.id))jobs.push({id:row.id,from:record.shown,to:row.fraction});
      record.row=row;record.label=row.kind==='character'?t('progression.tab.character'):row.kind==='class'?`Class · ${row.label}`:row.label;
      record.name.textContent=record.label;record.level.textContent=t('reward.progress.level',{level:row.level});record.next.textContent=row.capped?t('reward.progress.capped'):t('reward.progress.next',{level:row.level+1});
      record.gain.textContent=row.gained?t('reward.progress.gained',{xp:row.gained}):'';record.text.textContent=`${Math.min(row.xp,row.xpToNext||row.xp)} / ${row.xpToNext||row.xp}`;
      record.bar.setAttribute('aria-valuemax',String(row.xpToNext||row.xp));record.bar.setAttribute('aria-label',`${record.label}: ${row.xp} XP`);
      paint(record);list.append(record.element);
    }
    for(const[id,record]of records)if(!rows.some(row=>row.id===id)){record.element.remove();records.delete(id);}
    // Equivalent broadcasts must neither restart the current turn nor reveal
    // buttons early. Only changed ledgers and fresh receipt rows need a refill.
    const changed=refill||newReceipt||jobs.some(job=>!previousPending.includes(job.id));
    if(jobs.length&&changed)animate(jobs,refill);
    else if(!queue.length){setReady(!waiting);buttons();}
    panel.hidden=rows.length===0;
  }
  function rejectClaim(reason){if(disposed)return;waiting=null;if(reason){message.textContent=reason;message.hidden=false;}if(!queue.length){setReady(true);buttons();}}
  onReadyChange(false);update(member);
  return {update,rejectClaim,get ready(){return ready;},dispose(){disposed=true;if(frame)cancelAnimationFrame(frame);panel.remove();}};
}
