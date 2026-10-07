// Static comparison only. Crops are original-board evidence, not shippable art.
const fs=require('fs'),path=require('path');
const sharp=require(process.env.ASHENSPIRE_SHARP_MODULE||'sharp');
const {namespaceSvg}=require('./svg-utils.cjs');
const root=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(root,'vector-manifest.json'),'utf8'));
const output=path.join(root,'review');fs.mkdirSync(output,{recursive:true});
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const svg=(w,h,body)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const text=(x,y,label,size=17,color='#dfc590')=>`<text x="${x}" y="${y}" fill="${color}" font-family="Georgia,serif" font-size="${size}">${esc(label)}</text>`;
const bg=(w,h)=>`<rect width="${w}" height="${h}" fill="#10120f"/>`;
async function sheet(file,items,cols,cw,ch) {
  const w=cols*cw,h=70+Math.ceil(items.length/cols)*ch;
  const overlays=[];let base=bg(w,h)+text(18,29,file.replaceAll('-',' '),24)+text(18,53,'Editable blank SVGs / live copy and illustrations supplied separately',14,'#aaa18a');
  for(let i=0;i<items.length;i++) {
    const a=items[i],x=i%cols*cw,y=70+Math.floor(i/cols)*ch;
    const scale=Math.min((cw-32)/a.width,(ch-50)/a.height,1);
    const aw=Math.round(a.width*scale),ah=Math.round(a.height*scale);
    overlays.push({input:await sharp(path.join(root,a.file)).resize(aw,ah).png().toBuffer(),left:x+16,top:y+10});
    base+=text(x+16,y+ch-14,a.id,Math.min(15,cw/19),'#c5bba5');
  }
  await sharp(svg(w,h,base)).composite(overlays).png().toFile(path.join(output,file+'.png'));
}
async function comparisons() {
  const ids=['hand-card-attack-normal','deck-tile-selected','draft-card-selected','reward-card-selected','smith-inspector-card-normal'];
  const w=1350,h=570,cw=270,overlays=[];
  let body=bg(w,h)+text(20,30,'Five board-specific card families',26)+text(20,54,'Top: original board evidence. Bottom: editable skin. Source crop contains concept text; assets remain blank.',15,'#aaa18a');
  for(let i=0;i<ids.length;i++) {
    const a=manifest.assets.find(a=>a.id===ids[i]),[x,y,bw,bh]=a.sourceRegion.pixels;
    const portable=path.join(root,a.sourceBoard);
    const board=fs.existsSync(portable)?portable:path.join(root,'../player-polish-2026-10-01',path.basename(a.sourceBoard));
    const src=await sharp(board).extract({left:x,top:y,width:bw,height:bh}).resize({width:230,height:208,fit:'inside'}).png().toBuffer();
    const srcm=await sharp(src).metadata();
    overlays.push({input:src,left:i*cw+20,top:90});
    const skin=await sharp(path.join(root,a.file)).resize({width:230,height:220,fit:'inside'}).png().toBuffer();
    overlays.push({input:skin,left:i*cw+20,top:325});
    body+=text(i*cw+20,79,a.id.replace('-normal','').replace('-selected',''),14)+text(i*cw+20,315,'native geometry',14,'#aaa18a');
  }
  await sharp(svg(w,h,body)).composite(overlays).png().toFile(path.join(output,'card-family-comparison.png'));
}
async function main(){
  await comparisons();
  await sheet('control-skins',manifest.assets.filter(a=>a.kind==='skin'&&!a.id.includes('card')&&!a.id.includes('deck-tile')&&!a.id.includes('backing')&&!a.id.includes('panel')&&!a.id.includes('window')),4,360,170);
  await sheet('panels-and-five-families',manifest.assets.filter(a=>a.kind==='skin'&&(a.id.endsWith('-normal')&&a.id.includes('card')||a.id==='deck-tile-normal'||a.id.includes('backing')||a.id.includes('panel')||a.id.includes('window'))),4,260,310);
  await sheet('board-icon-library',manifest.assets.filter(a=>a.kind==='icon'),6,180,90);
  const records=[];
  for(const a of manifest.assets){
    const m=await sharp(path.join(root,a.file)).metadata();
    if(m.width!==a.width||m.height!==a.height)throw Error(a.id+' dimension mismatch');
    const s=fs.readFileSync(path.join(root,a.file),'utf8');
    const ids=[...s.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    if(new Set(ids).size!==ids.length)throw Error(a.id+' repeated id');
    if(/<text\b|<script\b|on\w+=/i.test(s))throw Error(a.id+' baked text or executable content');
    const inline=namespaceSvg(s,'first-'+a.id)+namespaceSvg(s,'second-'+a.id);
    const inlineIds=[...inline.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    if(new Set(inlineIds).size!==inlineIds.length)throw Error(a.id+' repeated inline instance id');
    let artAlpha=null;
    if(/^(hand-card|draft-card|draft-thumbnail|reward-card|smith-inspector-card|deck-tile)/.test(a.id)){
      const [x,y,w,h]=a.apertures.art;
      const rgba=await sharp(path.join(root,a.file)).ensureAlpha().raw().toBuffer();
      artAlpha=rgba[(Math.floor(y+h/2)*a.width+Math.floor(x+w/2))*4+3];
      if(artAlpha!==0)throw Error(a.id+' art aperture is opaque');
    }
    if(a.sliceInsets){const [t,r,b,l]=a.sliceInsets;if(t+b>=a.height||l+r>=a.width)throw Error(a.id+' invalid slice insets');}
    records.push({id:a.id,width:m.width,height:m.height,svgIds:ids.length,artApertureCenterAlpha:artAlpha});
  }
  fs.writeFileSync(path.join(output,'vector-validation.json'),JSON.stringify({assets:records.length,dimensions:'pass',withinFileUniqueIds:'pass',twoInlineInstancesUniqueIds:'pass',noBakedTextOrScripts:'pass',cardArtAperturesTransparent:'pass',sliceInsets:'pass',records},null,2)+'\n');
  console.log(`Rendered four static sheets and checked ${records.length} SVGs. No browser verification.`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
