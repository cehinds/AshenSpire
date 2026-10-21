// Native canvas pixel contract: PLAYWRIGHT_MODULE=/path/to/playwright node tests/alternative-aura-translation.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
import { auraFilter } from '../src/ui/combatAura.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({root:process.cwd(),port:0,open:false,quiet:true});
const browser = await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
try {
  const page=await browser.newPage();
  await page.route('**/aura-fixture.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Aura pixel contract</title>'}));
  await page.goto(server.url+'aura-fixture.html');
  const filters=[auraFilter('power2','idle',['stamina','mana'],true),auraFilter('ready','counter',[],false),
    auraFilter('power3','idle',['hp','mana','stamina'],true)];
  const report=await page.evaluate(async({base,filters})=>{
    const {createAlternativeAuraRenderer}=await import(base+'src/ui/alternativeAuraRenderer.js');
    const paths=['assets-display/alternative/card-reaver-attack-contact.webp','assets-display/alternative/reaver-greatsword-pilot-sweep.webp'];
    const images=await Promise.all(paths.map(path=>new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=base+path;
    })));
    const results=[];
    for(const [width,height] of [[768,544],[932,625]]){
      let retained=0, peak=0;
      const retainedCanvases=[];
      const renderer=createAlternativeAuraRenderer({canvasWidth:width,canvasHeight:height,createCanvas(){
        const canvas=document.createElement('canvas');retainedCanvases.push(canvas);return canvas;
      }});
      const direct=createAlternativeAuraRenderer({canvasWidth:width,canvasHeight:height});
      const canvases=[0,1].map(()=>Object.assign(document.createElement('canvas'),{width,height}));
      for(const image of images)for(const filter of filters)for(const alpha of [1,0.65])for(const [x,y,size,drawHeight=size] of [
        [128,16,512],[149.375,16.125,512],[127.625,15.875,511.25,509.75],[-78,-95,768],[-53,-173,1024],
        [-450.875,12.625,512],[750.375,530.25,512],[128,16,512]]){
        const pixels=canvases.map((canvas,i)=>{
          const context=canvas.getContext('2d');context.clearRect(0,0,width,height);context.globalAlpha=alpha;
          [direct,renderer][i].draw(context,image,filter,x,y,size,drawHeight,{immutable:true,travel:i===1,materialize:true});
          return context.getImageData(0,0,width,height).data;
        });
        let max=0,sum=0,alphaMax=0;
        for(let p=0;p<pixels[0].length;p+=4){
          const alpha=Math.abs(pixels[0][p+3]-pixels[1][p+3]);let error=alpha;
          for(let c=0;c<3;c++)error=Math.max(error,Math.abs(
            pixels[0][p+c]*pixels[0][p+3]/255-pixels[1][p+c]*pixels[1][p+3]/255));
          max=Math.max(max,error);alphaMax=Math.max(alphaMax,alpha);sum+=error;
        }
        retained=retainedCanvases.slice(1).reduce((sum,canvas)=>sum+canvas.width*canvas.height,0);
        peak=Math.max(peak,retained);
        results.push({width,height,x,y,size,drawHeight,alpha,filter,max,alphaMax,mean:sum/(width*height),retainedPixels:retained});
      }
      renderer.dispose();direct.dispose();
      if(retainedCanvases.some(canvas=>canvas.width||canvas.height))throw Error('disposed aura canvases retain pixels');
      if(peak>4*1024*1024)throw Error('travel cache exceeded pixel budget');
    }
    return results;
  },{base:server.url,filters});
  // Fractional translation interpolates only the soft glow, never the body.
  // Allow at most 8/255 premultiplied channel error and 0.2 average per pixel.
  for(const row of report){assert.ok(row.max<=8,JSON.stringify(row));assert.ok(row.mean<=0.2,JSON.stringify(row));}
  console.log(JSON.stringify({comparisons:report.length,max:Math.max(...report.map(r=>r.max)),
    alphaMax:Math.max(...report.map(r=>r.alphaMax)),meanMax:Math.max(...report.map(r=>r.mean)),
    retainedPixelsMax:Math.max(...report.map(r=>r.retainedPixels))}));
} finally {await browser.close();await new Promise(resolve=>server.server.close(resolve));}
