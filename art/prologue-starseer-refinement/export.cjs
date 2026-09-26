const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/suprbludude/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir = __dirname;
const root = path.resolve(dir, '../..');
const generation = JSON.parse(fs.readFileSync(path.join(dir, 'generation-prompts.json'), 'utf8'));
(async () => {
  fs.mkdirSync(path.join(dir, 'masters'), {recursive:true});
  fs.mkdirSync(path.join(root, 'assets/prologue'), {recursive:true});
  fs.mkdirSync(path.join(dir, 'inspection'), {recursive:true});
  const results=[];
  for(const asset of generation.assets){
    const name='carry-starseer-'+asset.variant;
    const master=path.join(dir,'masters',name+'.png');
    const webp=path.join(root,'assets/prologue',name+'.webp');
    fs.copyFileSync(asset.generated, master);
    await sharp(master).webp({quality:88,effort:6}).toFile(webp);
    const m=await sharp(master).metadata();
    const w=await sharp(webp).metadata();
    if(m.width!==w.width||m.height!==w.height) throw new Error('Dimension mismatch');
    const detail=asset.variant==='desktop'?{left:520,top:65,width:460,height:440}:{left:310,top:495,width:410,height:420};
    await sharp(webp).extract(detail).png().toFile(path.join(dir,'inspection',name+'-detail.png'));
    await sharp(webp).resize({width:asset.variant==='desktop'?960:390}).png().toFile(path.join(dir,'inspection',name+'-preview.png'));
    const a=fs.statSync(master).size,b=fs.statSync(webp).size;
    results.push({variant:asset.variant,width:m.width,height:m.height,master:path.relative(root,master).replaceAll('\\','/'),deliverable:path.relative(root,webp).replaceAll('\\','/'),png_bytes:a,webp_bytes:b,reduction_percent:+((1-b/a)*100).toFixed(2),sha256:crypto.createHash('sha256').update(fs.readFileSync(webp)).digest('hex'),webp_encoding:{quality:88,effort:6}});
  }
  fs.writeFileSync(path.join(dir,'asset-manifest.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
