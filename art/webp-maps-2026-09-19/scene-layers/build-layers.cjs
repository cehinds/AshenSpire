const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/suprbludude/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(root,'provenance.json'),'utf8'));
// Authored horizontal ground transitions inspected on each source painting.
const seams={'BS-ENV-01':.55,'BS-ENV-02':.52,'BS-ENV-03':.60,'BS-ENV-04':.55,'HM-ENV-01':.56,'HM-ENV-02':.52,'HM-ENV-03':.58,'HM-ENV-04':.54,'FC-ENV-01':.61,'FC-ENV-02':.56,'FC-ENV-03':.59,'FC-ENV-04':.55};
(async()=>{
 for(const scene of manifest.scenes){
  const input=path.join(root,'sources',scene.id+'.png');
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height}=info,cut=Math.round(height*seams[scene.id]),overlap=16;
  const floor=Buffer.from(data),background=Buffer.from(data);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const a=(y*width+x)*4+3;
   floor[a]=y<cut?0:255;
   background[a]=y<cut?255:y>=cut+overlap?0:Math.round(255*(1-(y-cut)/overlap));
  }
  const opts={raw:{width,height,channels:4}};
  // Lossless alpha plates preserve shared overlap pixels exactly, preventing
  // independently lossy encodes from showing a seam when stacked.
  const floorPath=`layers/${scene.id}-floor.webp`,bgPath=`layers/${scene.id}-background.webp`;
  await sharp(floor,opts).webp({lossless:true,effort:6}).toFile(path.join(root,floorPath));
  await sharp(background,opts).webp({lossless:true,effort:6}).toFile(path.join(root,bgPath));
  const result=await sharp(path.join(root,floorPath)).composite([{input:path.join(root,bgPath)}]).raw().toBuffer();
  let maxError=0;for(let i=0;i<data.length;i++)maxError=Math.max(maxError,Math.abs(data[i]-result[i]));
  if(maxError>1)throw Error(scene.id+' composition differs: '+maxError);
  for(const p of [floorPath,bgPath]){const m=await sharp(path.join(root,p)).metadata();if(!m.hasAlpha||m.width!==width||m.height!==height)throw Error('Invalid layer '+p)}
  await sharp(input).webp({quality:88,effort:6}).toFile(path.join(root,'previews',scene.id+'-composite.webp'));
  await sharp(input).resize(600,400).webp({quality:83,effort:6}).toFile(path.join(root,'previews',scene.id+'-thumb.webp'));
  Object.assign(scene,{width,height,floorStart:cut/height,overlapPixels:overlap,source:`sources/${scene.id}.png`,floor:floorPath,background:bgPath,preview:`previews/${scene.id}-composite.webp`,thumbnail:`previews/${scene.id}-thumb.webp`,drawOrder:['floor','background','actors','dialogue-or-combat-ui'],layerEncoding:'Lossless WebP with alpha',compositionMaxChannelError:maxError,boss:scene.id.endsWith('04')});
  console.log(scene.id+' | '+width+'x'+height+' | alpha verified | max composite error '+maxError);
 }
 manifest.layerContract='Aligned full-canvas plates: floor first, upper background second, actors above both. Horizontal scenery/floor division with 16px same-source overlap; not independent hidden-terrain or parallax reconstruction.';
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(root,'manifest.js'),'window.SCENES='+JSON.stringify(manifest)+';');
 const cells=[];
 for(let i=0;i<manifest.scenes.length;i++){
  const s=manifest.scenes[i],x=(i%4)*400,y=Math.floor(i/4)*308;
  cells.push({input:await sharp(path.join(root,s.source)).resize(392,261).toBuffer(),left:x+4,top:y+4});
  const label=`<svg width="392" height="39"><rect width="392" height="39" fill="#17191a"/><text x="8" y="17" fill="#dfc48b" font-family="Arial" font-size="14">${s.id}${s.boss?' · BOSS ARENA':''}</text><text x="8" y="34" fill="#ddd" font-family="Arial" font-size="12">${s.name.replace(' — Boss Arena','')}</text></svg>`;
  cells.push({input:Buffer.from(label),left:x+4,top:y+265});
 }
 await sharp({create:{width:1600,height:924,channels:3,background:'#17191a'}}).composite(cells).jpeg({quality:92}).toFile(path.join(root,'previews','all-scenes.jpg'));
})().catch(e=>{console.error(e);process.exit(1)});
