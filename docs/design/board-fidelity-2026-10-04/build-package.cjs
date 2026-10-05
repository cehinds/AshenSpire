// Format/export and portable review assembly. This never redraws a PNG master.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require(process.env.ASHENSPIRE_SHARP_MODULE||'sharp');
const root=__dirname,repo=path.resolve(root,'../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v)};
const json=(p,v)=>save(p,JSON.stringify(v,null,2)+'\n');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const copy=(a,b)=>{fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b);if(hash(fs.readFileSync(a))!==hash(fs.readFileSync(b)))throw Error('Copy mismatch '+b)};
function source(r){
  const board=path.basename(typeof r.sourceBoard==='string'?r.sourceBoard:r.sourceBoard.path);
  let pixels=r.sourceRegionPixels;
  if(!pixels&&r.sourceBoard?.approximateArtWindowBounds){const [l,t,rr,b]=r.sourceBoard.approximateArtWindowBounds;pixels=[l,t,rr-l,b-t]}
  if(!pixels&&Array.isArray(r.sourceRegion))pixels=r.sourceRegion.map((n,i)=>Math.round(n*(i%2?1086:1448)));
  if(!pixels||pixels.some(n=>!Number.isFinite(n))||pixels[2]<=0||pixels[3]<=0)throw Error('Missing source rectangle '+r.id);
  return {board:'references/'+board,pixels,method:'Approximate visually transcribed source-art rectangle; source evidence only, not a game asset.'};
}
async function adopt(staging){
  const seen=new Set();
  for(const file of fs.readdirSync(path.join(staging,'records')).filter(f=>f.endsWith('.json')).sort()){
    const r=read(path.join(staging,'records',file));
    if(!r.id||!r.savedUnchanged||!r.file||!r.sha256)continue;
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.id)||seen.has(r.id))throw Error('Invalid or duplicate source ID '+r.id);
    seen.add(r.id);
    const group=r.id.startsWith('portrait-')?'portraits':r.id.startsWith('object-')?'objects':'abilities';
    const master='masters/'+group+'/'+r.id+'.png';
    const from=path.join(staging,r.file);
    const relative=path.relative(staging,path.resolve(from));
    if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Master outside staging '+r.id);
    if(hash(fs.readFileSync(from))!==r.sha256)throw Error('Master differs from generation receipt '+r.id);
    copy(from,path.join(root,master));
    r.file=master;
    if(r.previousVersionRecord){
      const name=path.basename(r.previousVersionRecord);
      const candidates=[path.join(staging,'records','versions',name),path.join(staging,'versions',name)];
      const previous=candidates.find(f=>fs.existsSync(f));
      if(!previous)throw Error('Missing prior receipt '+r.id);
      r.previousVersionRecord='provenance/versions/'+name;
      copy(previous,path.join(root,r.previousVersionRecord));
    }
    json(path.join(root,'provenance',r.id+'.json'),r);
  }
  const attempts=path.join(staging,'records','deck-tool-attempts.json');
  if(fs.existsSync(attempts))copy(attempts,path.join(root,'provenance/deck-tool-attempts.json'));
  const boards=path.join(repo,'docs/design/player-polish-2026-10-01');
  for(const f of fs.readdirSync(boards).filter(f=>/^\d\d-.+\.png$/.test(f)))copy(path.join(boards,f),path.join(root,'references',f));
  const prior=path.join(repo,'docs/design/player-components-2026-10-03');
  for(const f of ['assets/materials/weathered-parchment.webp','fonts/cinzel-400-normal.woff2','fonts/cormorant-garamond-500-normal.woff2','fonts/inter-400-normal.woff2','fonts/OFL.txt'])copy(path.join(prior,f),path.join(root,f));
}
async function rasterAssets(){
  const assets=[];
  const prior=fs.existsSync(path.join(root,'manifest.json'))?read(path.join(root,'manifest.json')).assets:[];
  for(const file of fs.readdirSync(path.join(root,'provenance')).filter(f=>f.endsWith('.json')).sort()){
    const r=read(path.join(root,'provenance',file));
    if(!r.id||!r.savedUnchanged)continue;
    const input=path.join(root,r.file),bytes=fs.readFileSync(input);
    if(hash(bytes)!==r.sha256)throw Error('Changed master '+r.id);
    const m=await sharp(bytes).metadata();
    const group=r.id.startsWith('portrait-')?'portraits':r.id.startsWith('object-')?'objects':'abilities';
    if(group!=='abilities'&&!m.hasAlpha)throw Error('Cutout has no alpha '+r.id);
    const dest='assets/'+group+'/'+r.id+'.webp',mobile='assets/mobile/'+group+'/'+r.id+'.webp';
    fs.mkdirSync(path.dirname(path.join(root,dest)),{recursive:true});fs.mkdirSync(path.dirname(path.join(root,mobile)),{recursive:true});
    const old=prior.find(a=>a.id===r.id&&a.masterSha256===r.sha256);
    const valid=(f,sha)=>sha&&fs.existsSync(path.join(root,f))&&hash(fs.readFileSync(path.join(root,f)))===sha;
    if(!old||!valid(dest,old.sha256)||!valid(mobile,old.mobileSha256)){
      await sharp(bytes).webp({quality:94,alphaQuality:100,lossless:m.hasAlpha,effort:6}).toFile(path.join(root,dest));
      await sharp(bytes).resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).webp({quality:92,alphaQuality:100,effort:6}).toFile(path.join(root,mobile));
    }
    console.log('Verified/exported '+r.id);
    const highImage=sharp(path.join(root,dest)),mobileImage=sharp(path.join(root,mobile));
    const highMeta=await highImage.metadata(),mobileMeta=await mobileImage.metadata();
    if(highMeta.width!==m.width||highMeta.height!==m.height||!!highMeta.hasAlpha!==!!m.hasAlpha)throw Error('Export metadata mismatch '+r.id);
    if(mobileMeta.width>640||mobileMeta.height>640||!!mobileMeta.hasAlpha!==!!m.hasAlpha)throw Error('Mobile metadata mismatch '+r.id);
    let alphaVerification=null;
    if(m.hasAlpha){
      const originalAlpha=await sharp(bytes).extractChannel('alpha').raw().toBuffer();
      const highAlpha=await sharp(path.join(root,dest)).extractChannel('alpha').raw().toBuffer();
      const ms=await sharp(path.join(root,mobile)).stats();
      if(!originalAlpha.equals(highAlpha)||ms.channels[3].min!==0||ms.channels[3].max===0)throw Error('Export alpha mismatch '+r.id);
      alphaVerification={fullSize:'pixel-identical alpha plane',mobileRange:[ms.channels[3].min,ms.channels[3].max]};
    }
    const src=source(r),candidate=r.status==='needs-review'||r.boardProvidedToTool===false;
    assets.push({id:r.id,name:r.name||r.id,kind:group,file:dest,mobileFile:mobile,master:r.file,provenance:'provenance/'+file,width:m.width,height:m.height,hasAlpha:!!m.hasAlpha,mobileDimensions:[mobileMeta.width,mobileMeta.height],alphaVerification,source:src,status:candidate?'needs-review':'reconstructed',review:r.review||r.reviewNotes||'',masterSha256:r.sha256,sha256:hash(fs.readFileSync(path.join(root,dest))),mobileSha256:hash(fs.readFileSync(path.join(root,mobile))),export:'Full-size WebP keeps original canvas; mobile fits within640px. Cutout full-size WebP lossless; PNG master byte-unchanged.'});
  }
  return assets;
}
async function comparisons(assets){
  const dir=path.join(root,'review');fs.mkdirSync(dir,{recursive:true});
  const groups=[['abilities',assets.filter(a=>a.kind==='abilities')],['portraits-and-objects',assets.filter(a=>a.kind!=='abilities')]];
  for(const [name,items]of groups){
    const cols=3,cw=440,ch=236,w=cols*cw,h=65+Math.ceil(items.length/cols)*ch;
    let body=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#171916"/><text x="18" y="29" fill="#dfc590" font-family="Georgia" font-size="23">${name}: board detail / reconstruction</text><text x="18" y="51" fill="#aaa18a" font-family="Arial" font-size="13">Original concept crops are evidence only. Each reconstruction has its own master and provenance.</text>`;
    const overlays=[];
    for(let i=0;i<items.length;i++){
      const a=items[i],x=i%cols*cw,y=65+Math.floor(i/cols)*ch,[l,t,bw,bh]=a.source.pixels;
      const board=sharp(path.join(root,a.source.board));const bm=await board.metadata();
      if(l<0||t<0||l+bw>bm.width||t+bh>bm.height)throw Error('Source rectangle outside board '+a.id);
      const ref=await board.extract({left:l,top:t,width:bw,height:bh}).resize({width:192,height:180,fit:'contain',background:'#22241f'}).png().toBuffer();
      const out=await sharp(path.join(root,a.file)).resize({width:208,height:180,fit:'contain',background:'#22241f'}).png().toBuffer();
      overlays.push({input:ref,left:x+12,top:y+28},{input:out,left:x+212,top:y+28});
      body+=`<text x="${x+12}" y="${y+18}" fill="${a.status==='needs-review'?'#f5a576':'#e4d5b7'}" font-family="Arial" font-size="14">${esc(a.id)}${a.status==='needs-review'?' — CANDIDATE':''}</text><text x="${x+12}" y="${y+226}" fill="#a59e8a" font-family="Arial" font-size="12">${esc(path.basename(a.source.board).slice(0,2))} / ${a.width}×${a.height} / ${a.hasAlpha?'alpha':'painting'}</text>`;
    }
    body+='</svg>';
    await sharp(Buffer.from(body)).composite(overlays).png().toFile(path.join(dir,name+'-source-comparison.png'));
  }
}
function gallery(assets,vectors){
  const cards=assets.map(a=>`<article data-search="${esc(a.id+' '+a.kind)}"><header><h3>${esc(a.name)}</h3><small>${esc(a.id)} · ${a.status}</small></header><div class="pair"><figure><svg class="reference" viewBox="${a.source.pixels.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Original board art detail"><image href="${a.source.board}" width="1448" height="1086"/></svg><figcaption>Board detail</figcaption></figure><figure><img loading="lazy" src="${a.file}" alt="${esc(a.name)} reconstruction"><figcaption>Reconstructed component</figcaption></figure></div><p>${esc(a.review)}</p><footer><a href="${a.master}" download>PNG master</a><a href="${a.file}" download>WebP</a><a href="${a.mobileFile}" download>Mobile</a><a href="${a.provenance}">Provenance</a></footer></article>`).join('');
  const vcards=vectors.map(a=>`<article data-search="${esc(a.id+' '+a.kind)}"><header><h3>${esc(a.id)}</h3><small>${a.width} × ${a.height} · ${esc(a.kind)}</small></header><img class="vector" loading="lazy" src="${a.file}" alt="${esc(a.id)}"><footer><a href="${a.file}" download>Editable SVG</a></footer></article>`).join('');
  save(path.join(root,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ashen Spire — Board fidelity components</title><style>@font-face{font-family:Cinzel;src:url(fonts/cinzel-400-normal.woff2)}@font-face{font-family:Inter;src:url(fonts/inter-400-normal.woff2)}*{box-sizing:border-box}body{margin:0;background:#111310;color:#e3dac8;font:14px/1.55 Inter,Arial,sans-serif}main{max-width:1500px;margin:auto;padding:28px}h1,h2{font-family:Cinzel,Georgia,serif;font-weight:400;color:#d9bd7d}h1{font-size:clamp(25px,4vw,42px);margin:0}h2{margin-top:38px}a{color:#efcb7e}nav,footer{display:flex;gap:16px;flex-wrap:wrap}nav{margin:22px 0}input{padding:14px;width:min(100%,650px);background:#22251e;color:#fff;border:1px solid #74613f;border-radius:5px;font:inherit}input:focus-visible,a:focus-visible{outline:2px solid #edc967;outline-offset:4px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,390px),1fr));gap:18px}article{background:#1b1e18;border:1px solid #4c4836;border-radius:7px;overflow:hidden}article header,article p,article footer{padding:14px;margin:0}h3{font-size:17px;margin:0 0 4px}small,figcaption{color:#ada896;font-size:12px}.pair{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:10px;padding:12px;background:#24271f}figure{margin:0;text-align:center}figure img{display:block;width:100%;height:190px;object-fit:contain}.reference{display:block;height:190px;width:100%}.vector{display:block;width:100%;height:190px;object-fit:contain;padding:18px;background:#171a15}.notice{border-left:3px solid #c89943;padding:10px 18px;background:#22251c;max-width:1000px}.preview{width:100%;height:auto}details{margin:16px 0}summary{cursor:pointer;color:#e9c989}article[hidden]{display:none}footer{border-top:1px solid #343a2b;font-size:13px}@media(max-width:600px){main{padding:18px}figure img{height:145px}.reference{height:145px}.pair{gap:8px;padding:8px}}</style><main><h1>Ashen Spire</h1><p>Components rebuilt against the original boards · October 4, 2026</p><p class="notice">${assets.length} separate paintings/cutouts and ${vectors.length} editable interface components. These are high-resolution reconstructions, not exact screenshot extractions. Iron Guard remains a clearly marked candidate. Gameplay copy stays live; this package has not been integrated into the game.</p><nav><a href="#paintings">Art and abilities</a><a href="#components">Cards, menus and icons</a><a href="vector-manifest.json">Skin geometry</a><a href="manifest.json">Asset manifest</a><a href="README.md">Integration notes</a><a href="COVERAGE.md">Coverage and remaining differences</a></nav><label for="search">Find a component</label><br><input id="search" type="search" placeholder="Try hand, deck, menu, icon, portrait, sword…"><details open><summary>Five card families — original and assembled comparison</summary><img class="preview" src="review/filled-five-family-comparison.png" alt="Card family source and assembled comparison"></details><details><summary>Desktop and mobile menu components</summary><img class="preview" src="review/menu-comparison.png" alt="Source and assembled class, settings, forge and lobby menu components"></details><details><summary>Mobile draft layout</summary><img class="preview" src="review/mobile-draft-filled.png" alt="Mobile draft source and layered card reconstruction"></details><h2 id="paintings">Individual artwork</h2><div class="grid">${cards}</div><h2 id="components">Cards, menus, states and icons</h2><div class="grid">${vcards}</div><p>Original references: ${Array.from({length:12},(_,i)=>{const f=fs.readdirSync(path.join(root,'references')).find(f=>f.startsWith(String(i+1).padStart(2,'0')+'-'));return '<a href="references/'+f+'">'+String(i+1).padStart(2,'0')+'</a>'}).join(' · ')}</p></main><script>document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('article[data-search]').forEach(a=>a.hidden=!a.dataset.search.toLowerCase().includes(q));});</script></html>`);
}
async function main(){
  const index=process.argv.indexOf('--adopt');if(index>=0){if(!process.argv[index+1])throw Error('--adopt needs staging directory');await adopt(path.resolve(process.argv[index+1]));}
  const assets=await rasterAssets();
  const vectors=read(path.join(root,'vector-manifest.json')).assets;
  if(new Set([...assets,...vectors].map(a=>a.id)).size!==assets.length+vectors.length)throw Error('Duplicate component IDs');
  for(const a of vectors){if(!fs.existsSync(path.join(root,a.file))||!fs.existsSync(path.join(root,a.sourceBoard)))throw Error('Missing vector/reference '+a.id)}
  json(path.join(root,'manifest.json'),{schemaVersion:1,title:'AshenSpire board fidelity correction kit',runtimeIntegrated:false,assets,vectorManifest:'vector-manifest.json',count:{raster:assets.length,abilities:assets.filter(a=>a.kind==='abilities').length,portraits:assets.filter(a=>a.kind==='portraits').length,objects:assets.filter(a=>a.kind==='objects').length,vectors:vectors.length},validationBoundary:'Master hashes, dimensions, alpha, portable references and static rendered visual comparison. No browser/device/runtime acceptance.'});
  await comparisons(assets);gallery(assets,vectors);
  console.log(JSON.stringify({raster:assets.length,vectors:vectors.length,candidates:assets.filter(a=>a.status==='needs-review').map(a=>a.id)}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
