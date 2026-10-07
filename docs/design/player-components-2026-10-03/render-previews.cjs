// Static review compositions of unchanged assets, not runtime atlases or edited masters.
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.ASHENSPIRE_SHARP_MODULE || 'sharp');
const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const data = async (file,w,h) => {
  if(file.endsWith('.svg'))return 'data:image/svg+xml;base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
  // librsvg does not reliably decode embedded WebP. PNG review thumbnails live
  // only in memory; neither source masters nor game exports are changed.
  return 'data:image/png;base64,'+(await sharp(path.join(root,file)).resize({width:w,height:h,fit:'inside',withoutEnlargement:true}).png().toBuffer()).toString('base64');
};
async function sheet(name, items, cols, cw, ch, title) {
  const w=cols*cw, h=100+Math.ceil(items.length/cols)*ch;
  let body=`<rect width="${w}" height="${h}" fill="#0b0c0a"/><text x="24" y="42" fill="#e4c788" font-family="serif" font-size="28">${esc(title)}</text><text x="24" y="72" fill="#b8b39e" font-family="sans-serif" font-size="14">Individual source files and layer recipes accompany this review sheet.</text>`;
  const previews=await Promise.all(items.map(a=>data(a.file,cw-36,ch-68)));
  items.forEach((a,i)=>{
    const x=i%cols*cw, y=100+Math.floor(i/cols)*ch;
    body+=`<rect x="${x+9}" y="${y+9}" width="${cw-18}" height="${ch-18}" fill="#171914" stroke="#4e4635"/>`;
    if(a.alphaRange) {
      body+=`<rect x="${x+18}" y="${y+18}" width="${cw-36}" height="${ch-68}" fill="#484c43"/>`;
      for(let sy=0;sy<ch-68;sy+=20)for(let sx=0;sx<cw-36;sx+=20)if((sx/20+sy/20)%2===0)body+=`<rect x="${x+18+sx}" y="${y+18+sy}" width="${Math.min(20,cw-36-sx)}" height="${Math.min(20,ch-68-sy)}" fill="#353930"/>`;
    }
    body+=`<image x="${x+18}" y="${y+18}" width="${cw-36}" height="${ch-68}" preserveAspectRatio="xMidYMid meet" href="${previews[i]}"/><text x="${x+20}" y="${y+ch-31}" fill="#eadfc3" font-family="sans-serif" font-size="13">${esc(a.id.replace('base:',''))}</text>`;
  });
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;
  fs.mkdirSync(path.join(root,'review'),{recursive:true});
  await sharp(Buffer.from(svg)).png().toFile(path.join(root,'review',name+'.png'));
}
async function main() {
  await sheet('new-art',manifest.assets.filter(a=>a.origin==='built-in-image-generation'),5,320,290,'Ashen Spire / new artwork components');
  await sheet('enemies',manifest.assets.filter(a=>a.kind==='enemies'),3,420,520,'Enemy perspectives / actual alpha cutouts');
  const parts=manifest.assets.filter(a=>a.kind==='component');
  for(let i=0;i<parts.length;i+=24)await sheet('boxes-menus-'+(1+i/24),parts.slice(i,i+24),4,300,220,'Boxes, menus and UI geometry / '+(1+i/24));
  await sheet('decorations',manifest.assets.filter(a=>a.kind==='decorations'),3,420,480,'Separate transparent foreground decorations');
  console.log('Rendered new art, enemy, decoration and '+Math.ceil(parts.length/24)+' component sheets.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
