// Herald dark grade + ash/ember overlay. Deterministic (seeded PRNG).
const sharp = require('sharp');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const root = '/home/user/AshenSpire';
const out = path.join(root, 'art/prologue-herald-burning-refinement');
function rng(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
function overlaySvg(w,h,seed,variant){
  const r=rng(seed); let el='';
  // vignette
  el+=`<defs><radialGradient id="v" cx="50%" cy="55%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.62"/></radialGradient>
  <linearGradient id="haze" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a3430" stop-opacity="0.0"/><stop offset="1" stop-color="#4a423a" stop-opacity="0.28"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="${Math.round(w/640)}"/></filter>
  <filter id="glow"><feGaussianBlur stdDeviation="${Math.round(w/320)}"/></filter></defs>`;
  el+=`<rect width="${w}" height="${h}" fill="url(#v)"/>`;
  // smoky haze band drifting toward upper right (the Burning pulls ash toward the tower)
  el+=`<rect width="${w}" height="${h}" fill="url(#haze)"/>`;
  // ash streaks: grey, pulled toward the upper right
  const n=Math.round(w*h/3400);
  const ang=-0.35; // radians, toward upper right
  el+='<g filter="url(#blur)">';
  for(let i=0;i<n;i++){
    const x=r()*w, y=r()*h, len=(3+r()*28)*(w/1280), a=0.08+r()*0.28, t=0.5+r()*1.6;
    const aa=ang+(r()-0.5)*0.9; const dx=Math.cos(aa)*len, dy=Math.sin(aa)*len;
    const g=Math.round(150+r()*70);
    el+=`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+dx).toFixed(1)}" y2="${(y+dy).toFixed(1)}" stroke="rgb(${g},${g-4},${g-8})" stroke-opacity="${a.toFixed(2)}" stroke-width="${t.toFixed(2)}" stroke-linecap="round"/>`;
  }
  el+='</g>';
  // ember sparks: concentrated around hearth (left) and novice chest (centre)
  const hot = variant==='desktop' ? [[0.22,0.50,0.22],[0.58,0.40,0.14]] : [[0.30,0.52,0.20],[0.56,0.46,0.14]];
  const ch = variant==='desktop' ? [0.585,0.40,0.075] : [0.575,0.455,0.06];
  el+=`<defs><radialGradient id="cg"><stop offset="0" stop-color="#ff7a1a" stop-opacity="0.55"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient></defs><circle cx="${ch[0]*w}" cy="${ch[1]*h}" r="${ch[2]*w}" fill="url(#cg)"/>`;
  el+='<g filter="url(#glow)">';
  for(const [cx,cy,rad] of hot){
    const m=Math.round(w*h/9000);
    for(let i=0;i<m;i++){
      const d=Math.sqrt(r())*rad*Math.max(w,h), th=r()*Math.PI*2;
      const x=cx*w+Math.cos(th)*d+ r()*w*0.08, y=cy*h+Math.sin(th)*d - r()*h*0.12;
      const s=(1.0+r()*2.6)*(w/1280), a=0.5+r()*0.5;
      const col = r()<0.7 ? '#ff8a2a' : '#ffd08a';
      el+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(2)}" fill="${col}" fill-opacity="${a.toFixed(2)}"/>`;
    }
  }
  el+='</g>';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${el}</svg>`);
}
(async()=>{
  fs.mkdirSync(path.join(out,'masters'),{recursive:true}); fs.mkdirSync(path.join(out,'inspection'),{recursive:true});
  const manifest=[];
  for(const variant of ['desktop','mobile']){
    const src=path.join(root,'assets/prologue',`carry-herald-${variant}.webp`);
    const {width:w,height:h}=await sharp(src).metadata();
    // 1. keep source as "before" master
    const before=path.join(out,'masters',`carry-herald-${variant}-before.png`);
    await sharp(src).png().toFile(before);
    // 2. exposure down ~2/3 stop, contrast up, muted umber grade, slight desaturation
    const graded=await sharp(src)
      .linear([0.66,0.62,0.58],[0,0,-4])           // darker, cool channel pushed further down -> umber cast
      .gamma(1.15)                                  // lift deep shadow detail a touch so it is not crushed
      .modulate({saturation:0.9})
      .toBuffer();
    // 3. ember protection: bring back the warm highlights of the original (screen with masked original)
    const warm=await sharp(src).linear([0.55,0.30,0.10],[0,0,0]).toBuffer(); // isolates hot orange
    const withEmbers=await sharp(graded).composite([{input:warm,blend:'screen'}]).toBuffer();
    // 4. ash + sparks + vignette overlay
    const finalBuf=await sharp(withEmbers).composite([{input:overlaySvg(w,h,variant==='desktop'?9190:9191,variant),blend:'over'}]).png().toBuffer();
    const master=path.join(out,'masters',`carry-herald-${variant}.png`);
    fs.writeFileSync(master,finalBuf);
    const webp=path.join(root,'assets/prologue',`carry-herald-${variant}.webp`);
    await sharp(master).webp({quality:88,effort:6,smartSubsample:true}).toFile(webp);
    const m=await sharp(webp).metadata(); if(m.width!==w||m.height!==h) throw new Error('dim mismatch');
    await sharp(webp).resize({width:variant==='desktop'?960:390}).png().toFile(path.join(out,'inspection',`carry-herald-${variant}-preview.png`));
    const pb=fs.statSync(master).size, wb=fs.statSync(webp).size;
    manifest.push({variant,width:w,height:h,master:path.relative(root,master),deliverable:path.relative(root,webp),png_bytes:pb,webp_bytes:wb,sha256:crypto.createHash('sha256').update(fs.readFileSync(webp)).digest('hex'),webp_encoding:{quality:88,effort:6,smartSubsample:true}});
  }
  fs.writeFileSync(path.join(out,'asset-manifest.json'),JSON.stringify({scope:'Scene 4 Herald class memory only',method:'Deterministic programmatic dark grade and ash/ember overlay (grade.cjs); no image generation',assets:manifest},null,2)+'\n');
  console.log(JSON.stringify(manifest,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
