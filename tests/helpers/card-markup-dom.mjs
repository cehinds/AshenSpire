import {rewardDom} from './reward-dom.mjs';

// Record renderer-authored markup while allowing the appearance pass to query
// and decorate real fixture nodes. This does not serialize later DOM mutations
// or make layout claims; browser QA covers the resulting painted card.
export function cardMarkupDom(){
  const dom=rewardDom(),create=dom.document.createElement;
  dom.document.createElement=tag=>{
    const el=create(tag),parse=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'innerHTML').set;
    let markup='';
    Object.defineProperty(el,'innerHTML',{get:()=>markup,set(value){markup=value;parse.call(this,value);}});
    el.insertAdjacentHTML=(_where,value)=>{el.innerHTML+=value;};
    return el;
  };
  return dom;
}
