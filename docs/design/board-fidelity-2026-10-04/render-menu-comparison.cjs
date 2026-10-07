// Component-only desktop/mobile assemblies. Every label is separate live-style
// review copy; original board crops are reference evidence, not reusable art.
const fs=require('fs'),path=require('path');
const sharp=require(process.env.ASHENSPIRE_SHARP_MODULE||'sharp');
const root=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(root,'vector-manifest.json'),'utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const svg=(w,h,b)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${b}</svg>`);
const text=(x,y,t,size=14,color='#e7d9bb',extra='')=>`<text x="${x}" y="${y}" fill="${color}" font-family="Georgia,serif" font-size="${size}" ${extra}>${esc(t)}</text>`;
const board=id=>{const f=Object.keys(manifest.sourceBoardHashes).includes(id)?manifest.assets.find(a=>a.sourceBoard.split('/')[1].startsWith(id+'-')).sourceBoard:null;const p=path.join(root,f);return fs.existsSync(p)?p:path.join(root,'../player-polish-2026-10-01',path.basename(f));};
function raster(group,id){const p=path.join(root,`assets/${group}/${id}.webp`);return fs.existsSync(p)?p:path.resolve(root,`../../../.codex/board-fidelity-20261004/masters/${group}/${id}.png`);}
async function assembly(kind,mobile){
  const w=mobile?310:620,h=380,layers=[];
  let labels='',b=`<rect width="${w}" height="${h}" fill="#14140f"/>`;
  const skin=async(id,x,y,ww,hh)=>layers.push({input:await sharp(path.join(root,manifest.assets.find(a=>a.id===id).file)).resize(ww,hh,{fit:'fill'}).png().toBuffer(),left:x,top:y});
  const icon=async(id,x,y,s=20)=>skin('icon-'+id,x,y,s,s);
  const art=async(group,id,x,y,ww,hh,fit='cover')=>layers.push({input:await sharp(raster(group,id)).resize(ww,hh,{fit,position:'attention',background:'#00000000'}).png().toBuffer(),left:x,top:y});
  const label=(x,y,t,s=14,c='#e7d9bb')=>labels+=text(x,y,t,s,c);
  const button=async(id,x,y,ww,title)=>{await skin(id,x,y,ww,40);labels+=text(x+ww/2,y+25,title,13,'#e7d9bb','text-anchor="middle"');};
  if(kind==='classes'){
    label(16,28,'CHOOSE YOUR PATH',18,'#d5b36c');
    const names=['Reaver','Rogue','Starseer','Herald'];
    if(mobile){
      await art('portraits','portrait-reaver',100,40,110,143);label(110,204,'REAVER',18);label(36,224,'Power through. Endure longer.',13);
      for(let i=0;i<4;i++){let x=9+i*75;await skin('class-choice-tile-'+(i?'normal':'selected'),x,243,69,80);await art('portraits','portrait-'+names[i].toLowerCase(),x+6,249,57,52);label(x+6,317,names[i],11);}
      await button('button-green',15,334,280,'BEGIN JOURNEY');
    }else{
      for(let i=0;i<4;i++){let y=47+i*77;await skin('class-choice-row-'+(i?'normal':'selected'),12,y,245,72);await art('portraits','portrait-'+names[i].toLowerCase(),18,y+5,63,61);await icon('class-'+names[i].toLowerCase(),90,y+20,25);label(126,y+27,names[i],16);label(126,y+48,['Endure longer.','Control the flow.','Turn the tide.','Protect what remains.'][i],11);}
      await art('portraits','portrait-reaver',274,41,150,241,'contain');label(446,77,'REAVER',19,'#d5b36c');label(445,110,'Starting attributes',12);for(const [i,id,name] of [[0,'heart','HP'],[1,'teardrop','Mana'],[2,'stamina-boot','Stamina'],[3,'energy','Energy']]){await icon(id,446,130+i*34,19);label(478,145+i*34,name,13);}
      await button('button-green',280,323,322,'BEGIN JOURNEY');
    }
  }else if(kind==='settings'){
    label(16,27,'SETTINGS',20,'#d5b36c');
    const rows=[['gear','General'],['display','Display'],['audio','Audio'],['controls','Controls'],['accessibility','Accessibility'],['gear','Advanced'],['changelog-document','Changelog']];
    for(let i=0;i<rows.length;i++){let y=44+i*(mobile?31:39);await skin('navigation-row-'+(i===1?'selected':'normal'),12,y,mobile?286:177,mobile?30:37);await icon(rows[i][0],23,y+6,18);label(54,y+22,rows[i][1],mobile?12:14);if(i===6)await icon('notification-dot',mobile?272:162,y+9,10);}
    if(mobile){label(18,286,'Reduced Motion',13);await skin('toggle-off',230,271,60,29);label(18,322,'Touch Controls Help',13);await skin('toggle-on',230,307,60,29);await button('button-red',12,337,286,'BACK');}
    else{
      label(211,63,'DISPLAY',17);await skin('search-field',415,17,185,27);await icon('search',423,22,17);label(448,36,'Find settings...',11);
      label(211,106,'Text Size',14);for(let i=0;i<3;i++){await skin('filter-tab-'+(i===2?'selected':'normal'),326+i*87,84,84,32);label(338+i*87,105,['Small','Medium','Large'][i],12);}
      label(211,156,'Art Quality',14);for(let i=0;i<3;i++){await skin('filter-tab-'+(i===1?'selected':'normal'),326+i*87,134,84,32);label(338+i*87,155,['Low','High','Epic'][i],12);}
      label(211,208,'Reduced Motion',14);await skin('toggle-off',539,185,60,29);label(211,252,'High Contrast Mode',14);await skin('toggle-on',539,231,60,29);label(211,302,'Profile & Archive',14);await icon('history-ledger',572,282,24);await button('button-red',401,329,198,'RESET TO DEFAULTS');
    }
  }else if(kind==='forge'){
    label(16,28,'THE FORGE',20,'#d5b36c');
    await skin('service-window',8,40,w-16,325);
    if(mobile){await icon('forge-tools',20,49,24);label(51,67,'Extract a Card',14);}
    else{await skin('forge-service-tab-selected',14,41,291,38);await skin('forge-service-tab-normal',306,41,294,38);await icon('hammer',28,47,23);await icon('energy',322,47,23);label(67,66,'Extract a Card',14);label(361,66,'Seat a Card',14);}
    if(mobile){await skin('inventory-slot-desktop-selected',20,88,111,93);await art('abilities','forge-guides-strike',27,95,97,70);label(148,115,"Guide's Strike",14);label(148,138,'Attack',12);label(22,209,'RECEIPT',12,'#c9ab6a');label(22,236,'Return selected card to your deck.',12);label(22,274,'Cost and eligibility come from live state.',10);await button('button-disabled',21,310,268,'EXTRACT CARD');}
    else{
      await skin('inventory-slot-desktop-selected',23,88,138,116);await art('objects','object-straight-sword',30,95,124,82,'contain');label(23,224,"Pilgrim's Blade",15);label(23,250,'Selected equipment mount',11);
      await skin('smith-inspector-card-normal',212,81,143,242);await art('abilities','forge-guides-strike',225,134,117,83);await icon('forge-tools',229,100,18);label(254,107,"Guide's Strike",11);label(229,247,'Live effect text.',12);label(229,290,'Live flavor text.',11);
      label(403,107,'RECEIPT',14,'#c9ab6a');label(403,147,'You will receive:',12);await icon('energy',409,164,25);label(445,183,"Guide's Strike",12);label(403,218,'Returned to your deck.',11);label(403,258,'Live cost / eligibility',11);await button('button-green',394,289,201,'EXTRACT CARD');
    }
  }else if(kind==='lobby'){
    label(16,28,'FORSAKEN TOGETHER',18,'#d5b36c');
    const names=['Reaver','Rogue','Starseer','Herald'],states=['ready','ready','not-ready','reconnecting'];
    for(let i=0;i<4;i++){
      const x=mobile?12:14+i*150,y=mobile?45+i*68:52,ww=mobile?286:142,hh=mobile?64:188;
      await skin('lobby-'+(mobile?'':'portrait-')+states[i],x,y,ww,hh);
      await art('portraits','portrait-'+names[i].toLowerCase(),x+6,y+7,mobile?57:130,mobile?48:137);
      await icon('class-'+names[i].toLowerCase(),mobile?x+78:x+8,mobile?y+10:y+16,mobile?23:20);
      label(mobile?x+112:x+45,mobile?y+27:y+159,names[i],14);
      label(mobile?x+125:x+53,mobile?y+48:y+180,['Ready','Ready','Not Ready','Reconnecting'][i],mobile?11:10,i<2?'#9fbe82':'#d5b36c');
      await icon('ellipsis',x+ww-24,y+7,18);if(!i)await icon('host-crown',mobile?x+244:x+10,mobile?y+31:y+139,18);
    }
    if(!mobile){label(22,283,'CHOOSE OUR ROUTE',14);await icon('journey-spire',23,301,27);label(63,320,'The Ashen Road',14);label(329,320,'The Blackwood',14);}
    await button('button-green',mobile?12:176,334,mobile?286:268,'START TOGETHER');
  }
  layers.push({input:svg(w,h,labels),left:0,top:0});return sharp(svg(w,h,b)).composite(layers).png().toBuffer();
}
async function main(){
  const rows=[['classes','01',[80,675,240,343]],['settings','12',[389,162,686,304]],['forge','08',[442,663,560,342]],['lobby','11',[291,162,645,158]]];
  const layers=[];let b=`<rect width="1210" height="1790" fill="#11130f"/>`+text(18,30,'Finished native components / desktop and mobile assemblies',24)+text(18,55,'Left: original board region. Centre/right: authored skins, paintings/cutouts and separate illustrative copy. Component-only; no runtime verification.',13,'#b7aa8c');
  for(let i=0;i<rows.length;i++){
    const [kind,id,[x,y,w,h]]=rows[i],top=96+i*420;b+=text(18,top-12,kind,18,'#d5b36c');
    layers.push({input:await sharp(board(id)).extract({left:x,top:y,width:w,height:h}).resize({width:225,height:380,fit:'inside'}).png().toBuffer(),left:10,top});
    layers.push({input:await assembly(kind,false),left:253,top});layers.push({input:await assembly(kind,true),left:889,top});
  }
  await sharp(svg(1210,1790,b)).composite(layers).png().toFile(path.join(root,'review/menu-comparison.png'));
  console.log('Rendered four native desktop/mobile menu comparisons with original source crops.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
