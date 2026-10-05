// Actual authored raster layers plus native skins, rendered only for review.
// Preview copy is deliberately illustrative; no gameplay value enters an asset.
const fs=require('fs'),path=require('path');
const sharp=require(process.env.ASHENSPIRE_SHARP_MODULE||'sharp');
const root=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(root,'vector-manifest.json'),'utf8'));
const out=path.join(root,'review');fs.mkdirSync(out,{recursive:true});
const staging=path.resolve(root,'../../../.codex/board-fidelity-20261004/masters/abilities');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const svg=(w,h,b)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${b}</svg>`);
const txt=(x,y,t,s=16,c='#e9ddc0',extra='')=>`<text x="${x}" y="${y}" fill="${c}" font-family="Georgia,serif" font-size="${s}" ${extra}>${esc(t)}</text>`;
function original(a){const f=path.join(root,a.sourceBoard);return fs.existsSync(f)?f:path.join(root,'../player-polish-2026-10-01',path.basename(a.sourceBoard));}
function artFile(id){const f=path.join(root,'assets/abilities',id+'.webp');return fs.existsSync(f)?f:path.join(staging,id+'.png');}
const parchmentFile=()=>{const p=path.join(root,'assets/materials/weathered-parchment.webp');return fs.existsSync(p)?p:path.join(root,'../player-components-2026-10-03/assets/materials/weathered-parchment.webp');};
async function card(skin,art,title,type,cost='1'){
  const a=manifest.assets.find(a=>a.id===skin),[x,y,w,h]=a.apertures.art,layers=[];
  layers.push({input:await sharp(artFile(art)).resize(w,h,{fit:'cover'}).png().toBuffer(),left:x,top:y});
  layers.push({input:await sharp(path.join(root,a.file)).png().toBuffer(),left:0,top:0});
  if(a.apertures.mount){
    const [mx,my,mw,mh]=a.apertures.mount;
    const size=Math.min(mw,mh)-4;
    layers.push({input:await sharp(path.join(root,'assets/icons/icon-forge-tools.svg')).resize(size,size).png().toBuffer(),left:mx+Math.floor((mw-size)/2),top:my+Math.floor((mh-size)/2)});
  }
  for(const material of a.textureLayers){
    const [mx,my,mw,mh]=material.box;
    layers.push({input:await sharp(parchmentFile()).resize(mw,mh,{fit:'cover'}).png().toBuffer(),left:mx,top:my});
  }
  let body='';
  const center=(box,label,size,color='#e9ddc0',offset=0)=>{const [tx,ty,tw,th]=box;size=Math.min(size,th*.85,tw/(label.length*.55));body+=txt(tx+tw/2,ty+th/2+size*.34+offset,label,size,color,'text-anchor="middle"');};
  const onPaper=skin.includes('deck-tile')||skin.includes('reward-card');
  if(a.liveText.cost)center(a.liveText.cost,cost,skin.includes('hand')?22:24);
  center(a.liveText.title,title,skin.includes('hand')?14:skin.includes('smith')?14:16,onPaper?'#201b12':'#e9ddc0');
  if(a.liveText.type)center(a.liveText.type,type.toUpperCase(),skin.includes('hand')?11:10,skin.includes('hand')?(type==='Attack'?'#d18a69':'#b1c0c7'):skin.includes('deck-tile')?'#201b12':'#bba16b');
  if(a.liveText.body){center(a.liveText.body,'Live effect text.',12,'#e9ddc0',-8);center(a.liveText.body,'Second effect line.',12,'#e9ddc0',8);}
  if(a.liveText.flavor)center(a.liveText.flavor,'Live flavor text.',11,'#bcaf94');
  layers.push({input:svg(a.width,a.height,body),left:0,top:0});
  return sharp({create:{width:a.width,height:a.height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
}
async function main(){
  const examples=[
    ['hand-card-attack-normal','hand-gorefire-slash','Gorefire Slash','Attack'],
    ['deck-tile-selected','deck-gorefire-slash','Gorefire Slash','Attack','1'],
    ['draft-card-selected','draft-kindle','Kindle','Skill','0'],
    ['reward-card-selected','reward-steadfast','Steadfast','Skill','2'],
    ['smith-inspector-card-normal','forge-guides-strike',"Guide's Strike",'Attack'],
  ];
  const overlays=[],w=1400,h=650,cw=280;
  let b=`<rect width="${w}" height="${h}" fill="#12130f"/>`+txt(20,30,'Original concepts / filled native families',25)+txt(20,57,'Above: board crops. Below: newly authored paintings, textured skins, illustrative live-style copy. No gameplay values are shipped here.',14,'#b8aa8c');
  for(let i=0;i<examples.length;i++){
    const a=manifest.assets.find(a=>a.id===examples[i][0]),[x,y,bw,bh]=a.sourceRegion.pixels;
    overlays.push({input:await sharp(original(a)).extract({left:x,top:y,width:bw,height:bh}).resize({width:230,height:228,fit:'inside'}).png().toBuffer(),left:i*cw+20,top:88});
    overlays.push({input:await sharp(await card(...examples[i])).resize({width:230,height:278,fit:'inside'}).png().toBuffer(),left:i*cw+20,top:345});
    b+=txt(i*cw+20,79,examples[i][0],13)+txt(i*cw+20,331,'new painting + native skin',14,'#b8aa8c');
  }
  await sharp(svg(w,h,b)).composite(overlays).png().toFile(path.join(out,'filled-five-family-comparison.png'));
  const mobile=[['draft-card-mobile-selected','draft-kindle','Kindle','Skill'],['draft-thumbnail-mobile-normal','draft-pilgrims-resolve',"Pilgrim's Resolve",'Skill']];
  const m=[];let mb=`<rect width="860" height="400" fill="#12130f"/>`+txt(20,30,'Mobile draft recomposition',24)+txt(20,55,'Wide featured choice and compact alternative: distinct geometry from the desktop portrait card.',14,'#b8aa8c');
  for(let i=0;i<mobile.length;i++){m.push({input:await card(...mobile[i]),left:i?520:40,top:100});mb+=txt(i?520:40,350,mobile[i][0],14);}
  await sharp(svg(860,400,mb)).composite(m).png().toFile(path.join(out,'mobile-draft-filled.png'));
  const p=[];let pb=`<rect width="1100" height="520" fill="#12130f"/>`+txt(20,30,'Existing parchment against the concept boards',24)+txt(20,55,'Unchanged weathered-parchment material; static clipping only. Grain is suitable, with a warmer hue than board07.',14,'#b8aa8c');
  for(const [i,id,label] of [[0,'deck-tile-normal','Deck footer'],[1,'reward-card-normal','Reward header'],[2,'parchment-progression-backing','Progression backing']]){
    const a=manifest.assets.find(a=>a.id===id),[x,y,bw,bh]=a.sourceRegion.pixels;
    p.push({input:await sharp(original(a)).extract({left:x,top:y,width:bw,height:bh}).resize({width:280,height:195,fit:'inside'}).png().toBuffer(),left:20+i*360,top:95});
    p.push({input:await sharp(parchmentFile()).resize(280,i===2?175:65,{fit:'cover'}).png().toBuffer(),left:20+i*360,top:330});
    pb+=txt(20+i*360,81,label,18)+txt(20+i*360,313,'existing material',15,'#b8aa8c');
  }
  await sharp(svg(1100,520,pb)).composite(p).png().toFile(path.join(out,'parchment-treatment-comparison.png'));
  console.log('Rendered filled five-family, mobile draft and existing-parchment comparisons. Reference only.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
