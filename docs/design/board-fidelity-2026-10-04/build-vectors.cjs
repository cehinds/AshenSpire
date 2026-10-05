// Editable native SVG geometry, transcribed from the original concept boards.
// Does not write the existing component collection or any game files.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = __dirname;
const boards = '../player-polish-2026-10-01/';
const boardNames = {
  '01':'01-arrival-and-identity.png','02':'02-story-and-choices.png','03':'03-world-and-routes.png',
  '04':'04-cities-and-dungeons.png','05':'05-combat-and-threats.png','06':'06-armoury-and-inventory.png',
  '07':'07-cards-and-relics.png','08':'08-merchant-and-forge.png','09':'09-rest-and-rewards.png',
  '10':'10-growth-and-discovery.png','11':'11-company-and-history.png','12':'12-preferences-and-run-setup.png',
};
const assets = [];
const sourceBoardFiles = Object.fromEntries(Object.entries(boardNames).map(([id,file]) => {
  const portable=path.join(root,'references',file);
  return [id,fs.existsSync(portable)?portable:path.join(root,boards,file)];
}));
const sourceBoardHashes = {};
const boardDimensions = Object.fromEntries(Object.entries(boardNames).map(([id,file]) => {
  const png=fs.readFileSync(sourceBoardFiles[id]);
  sourceBoardHashes[id]=crypto.createHash('sha256').update(png).digest('hex');
  return [id,[png.readUInt32BE(16),png.readUInt32BE(20)]];
}));
const C = { black:'#11110f', line:'#6c5a3c', gold:'#b59b68', bright:'#efc966', ivory:'#eadbc0', blue:'#315771', red:'#a43c30', green:'#78975e' };
const R = (x,y,w,h,fill='none',stroke='none',sw=1,rx=3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const P = (d,stroke=C.gold,sw=1.3,fill='none') => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (x,y,r,fill='none',stroke=C.gold,sw=1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const defs = id => `<defs><linearGradient id="${id}-rail" x2="0" y2="1"><stop stop-color="#a58b59"/><stop offset=".08" stop-color="#ead29c"/><stop offset=".19" stop-color="#a78e5e"/><stop offset=".45" stop-color="#625239"/><stop offset=".72" stop-color="#b99c65"/><stop offset=".88" stop-color="#776449"/><stop offset="1" stop-color="#cfb27b"/></linearGradient><linearGradient id="${id}-soot" x2="0" y2="1"><stop stop-color="#27231b"/><stop offset=".5" stop-color="#171610"/><stop offset="1" stop-color="#0c0d0b"/></linearGradient><radialGradient id="${id}-light"><stop stop-color="#f3c85d" stop-opacity=".2"/><stop offset="1" stop-color="#f3c85d" stop-opacity="0"/></radialGradient><radialGradient id="${id}-orb" cx=".35" cy=".28" r=".7"><stop stop-color="#82b2ca"/><stop offset=".35" stop-color="#3a6c8b"/><stop offset="1" stop-color="#162d41"/></radialGradient><filter id="${id}-charcoal" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="17" result="grain"/><feColorMatrix in="grain" type="saturate" values="0" result="grey"/><feComponentTransfer in="grey" result="faint"><feFuncR type="linear" slope=".13" intercept=".87"/><feFuncG type="linear" slope=".13" intercept=".87"/><feFuncB type="linear" slope=".13" intercept=".87"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer><feBlend in="SourceGraphic" in2="faint" mode="multiply" result="mottle"/><feComposite in="mottle" in2="SourceGraphic" operator="in"/></filter><filter id="${id}-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".12" numOctaves="3" seed="11" result="grain"/><feColorMatrix in="grain" type="saturate" values="0" result="grey"/><feComponentTransfer in="grey" result="faint"><feFuncR type="linear" slope=".08" intercept=".92"/><feFuncG type="linear" slope=".08" intercept=".92"/><feFuncB type="linear" slope=".08" intercept=".92"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer><feBlend in="SourceGraphic" in2="faint" mode="multiply" result="paper"/><feComposite in="paper" in2="SourceGraphic" operator="in"/></filter></defs>`;
const rail = (id,x,y,w,h,selected=false,rx=3) => R(x,y,w,h,`url(#${id}-soot)`,selected?C.bright:`url(#${id}-rail)`,selected?2:1,rx)+R(x+3,y+3,w-6,h-6,'none',selected?'#9d772d':'#3e3425',.6,Math.max(0,rx-1));
const line = (x,y,x2,y2,color=C.line) => P(`M${x} ${y}H${x2}`.replace(`H${x2}`, y===y2?`H${x2}`:`L${x2} ${y2}`),color,.8);
const diamond = (x,y,r,color=C.gold,fill='none') => P(`M${x} ${y-r}L${x+r} ${y}L${x} ${y+r}L${x-r} ${y}Z`,color,1,fill);
const smallCorners = (w,h) => P(`M8 19V8H19M${w-19} 8H${w-8}V19M8 ${h-19}V${h-8}H19M${w-19} ${h-8}H${w-8}V${h-19}`, '#7a6746', .65);
function add(id,w,h,body,board,pixels,options={}) {
  const folder=options.kind==='icon'?'icons':'components';
  const file=`assets/${folder}/${id}.svg`;
  if(options.kind!=='icon') {
    body=body.replaceAll(`fill="${C.black}"`,`fill="${C.black}" filter="url(#${id}-charcoal)"`)
      .replaceAll(`fill="url(#${id}-soot)"`,`fill="url(#${id}-soot)" filter="url(#${id}-charcoal)"`)
      .replaceAll('fill="#d1bea0"',`fill="#d1bea0" filter="url(#${id}-paper)"`)
      .replaceAll('fill="#d4c5aa"',`fill="#d4c5aa" filter="url(#${id}-paper)"`)
      .replaceAll('fill="#c8b697"',`fill="#c8b697" filter="url(#${id}-paper)"`)
      .replaceAll('fill="#315f7c"',`fill="url(#${id}-orb)"`);
    body=body.replaceAll(`stroke="${C.gold}"`,`stroke="url(#${id}-rail)"`);
    if(id.includes('card')||id.includes('deck-tile'))for(const tone of ['#9a8865','#988263','#9c8868','#958466'])
      body=body.replaceAll(`stroke="${tone}"`,`stroke="url(#${id}-rail)"`);
    if(id.includes('card')||id.includes('deck-tile'))body+=P(`M11 ${h-23}V${h-11}H23M${w-23} ${h-11}H${w-11}V${h-23}`,'#baa376',.55)
      +P(`M12 30V34M${w-12} ${h-42}V${h-38}M33 ${h-10}H37`,'#e3cb97',.6);
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" color="${C.ivory}"><title>${options.label || id.replaceAll('-',' ')}</title>${defs(id)}${body}</svg>\n`;
  fs.mkdirSync(path.join(root,'assets',folder),{recursive:true});
  fs.writeFileSync(path.join(root,file),svg);
  assets.push({id,file,width:w,height:h,kind:options.kind||'skin',sourceBoard:'references/'+boardNames[board],
    sourceRegion:{pixels,normalized:pixels.map((v,i)=>+(v/boardDimensions[board][i%2]).toFixed(5)),boardDimensions:boardDimensions[board],method:'visually inspected approximate board rectangle; not a responsive specification'},
    sliceInsets:options.slice||null,minimumSize:options.min||[w,h],apertures:options.apertures||{},liveText:options.text||{},
    textureLayers:(options.textures||[]).map(layer=>({...layer,source:layer.source.replace('../player-components-2026-10-03/assets/materials/','assets/materials/')})),scale:options.scale||'Keep aspect ratio; do not nine-slice',
    sha256:crypto.createHash('sha256').update(svg).digest('hex')});
}

// Five separate families. Transparent art apertures accept separately authored
// illustrations; skins carry no invented titles, costs, effects or ownership.
for(const state of ['normal','selected']) {
  const selected=state==='selected';
  for(const type of ['attack','skill']) {
    const id=`hand-card-${type}-${state}`,w=160,h=232;
    let b=R(5,5,150,222,C.black,selected?C.bright:C.gold,selected?2:1.2,5)
      +R(8,8,144,216,'none','#5c4c31',.7,3);
    // Art aperture is punched through the black body, never a painted proxy.
    b=`<path d="M10 10H150V222H10Z M18 43V140H142V43Z" fill="${C.black}" fill-rule="evenodd"/>`+b.replace(`fill="${C.black}"`,`fill="none"`)
      +R(18,43,124,97,'none','#786b50',1,1)
      +R(17,144,126,22,type==='attack'?'#432019':'#283640','none',0,1)
      +line(19,168,141,168,'#675435')+circle(16,16,14,'#12120f',selected?C.bright:'#c2a353',1.8)
      +circle(16,16,11,'none','#5b4d31',.7);
    if(selected)b+=R(2,2,156,228,'none','#f3d582',1,7);
    add(id,w,h,b,'05',[498,431,123,142],{apertures:{art:[18,43,124,97]},text:{cost:[3,3,26,26],title:[31,13,114,23],type:[20,145,120,20],body:[18,178,124,42]},min:[104,151]});
  }
  {
    const id=`deck-tile-${state}`,w=180,h=250;
    let b=R(3,3,174,244,'none',selected?C.bright:'#9a8865',selected?2:1.3,7)
      +R(7,7,166,236,'none','#5b4d39',.7,4)+R(10,10,160,166,'none','#6b5c40',.9,2)
      +R(9,178,162,61,'#d1bea0','#9a8865',.8,2)+line(13,181,167,181,'#b49a72')
      +P('M27 8L42 17V38L27 47L12 38V17Z','#dfd1ac',1.3,'#25323b')
      +P('M27 12L38 19V36L27 42L16 36V19Z','#71858c',.6);
    add(id,w,h,b,'07',[416,198,97,137],{apertures:{art:[10,10,160,166]},text:{cost:[16,15,23,27],title:[15,184,150,29],type:[16,216,148,19]},textures:[{source:'../player-components-2026-10-03/assets/materials/weathered-parchment.webp',box:[9,178,162,61],mode:'clip under live text; replace flat fallback',opacity:.8}],min:[96,133]});
  }
  {
    const id=`draft-card-${state}`,w=210,h=330;
    let b=`<path d="M7 7H203V323H7Z M13 14V151H197V14Z" fill="${C.black}" fill-rule="evenodd"/>`
      +R(4,4,202,322,'none',selected?C.bright:'#988263',selected?2.5:1.2,10)
      +R(9,9,192,312,'none','#67573d',.65,7)+R(13,14,184,137,'none','#847257',.9,2)
      +line(18,187,192,187,'#a18a52')+line(25,196,185,196,'#54452c')
      +circle(25,25,17,'#203f56','#c3d6df',1.4)+circle(25,25,13,'#315f7c','#7297ad',.8)
      +P('M15 17Q20 10 29 13','#9cbdcf',1.1);
    if(selected)b+=R(1.5,1.5,207,327,'none','#ffe19b',1,11);
    add(id,w,h,b,'12',[729,720,145,226],{apertures:{art:[13,14,184,137]},text:{cost:[12,11,26,28],title:[17,157,176,29],type:[25,188,160,16],body:[23,216,164,50],flavor:[23,283,164,32]},min:[138,217]});
  }
  {
    const id=`reward-card-${state}`,w=210,h=266;
    let b=`<path d="M8 8H202V258H8Z M14 37V151H196V37Z" fill="${C.black}" fill-rule="evenodd"/>`
      +R(4,4,202,258,'none',selected?C.bright:'#9c8868',selected?2.3:1.1,7)
      +R(9,9,192,248,'none','#705e41',.7,4)
      +R(11,10,188,26,'#d4c5aa','#8c7855',.7,2)+R(14,37,182,114,'none','#816d48',.9,1)
      +line(15,165,195,165,'#b29865')+smallCorners(w,h)
      +diamond(19,19,19,'#dcc593','#26373c')+diamond(19,19,15,'#7a8b8e');
    if(selected)b+=R(1,1,208,264,'none','#f3d480',1,8);
    add(id,w,h,b,'09',[524,721,151,180],{apertures:{art:[14,37,182,114]},text:{cost:[7,4,24,28],title:[42,12,151,21],type:[20,151,170,13],body:[20,180,170,49],flavor:[20,235,170,18]},textures:[{source:'../player-components-2026-10-03/assets/materials/weathered-parchment.webp',box:[39,10,160,26],mode:'clip under live title; preserve overlaid cost diamond at upper left',opacity:.8}],min:[136,172]});
  }
  {
    const id=`smith-inspector-card-${state}`,w=180,h=304;
    let b=`<path d="M8 8H172V296H8Z M16 66V171H164V66Z" fill="${C.black}" fill-rule="evenodd"/>`
      +R(4,4,172,296,'none',selected?C.bright:'#958466',selected?2:1.1,3)
      +R(8,8,164,288,'none','#62543b',.65,2)+smallCorners(w,h)
      +R(15,17,33,40,'#202c33','#b39a61',1,2)+R(19,21,25,32,'none','#85979c',.7,1)
      +R(16,66,148,105,'none','#84a7b1',1.2,1)+line(18,235,162,235,'#635037')
      +P('M10 21Q21 21 21 10M159 10Q159 21 170 21M10 283Q21 283 21 294M159 294Q159 283 170 283','#9b8557',.65);
    add(id,w,h,b,'08',[694,751,144,232],{apertures:{art:[16,66,148,105],mount:[20,22,23,30]},text:{title:[55,18,109,24],type:[55,43,109,14],body:[18,185,144,41],flavor:[18,247,144,33]},min:[132,223]});
  }
}

// Mobile draft is a wide featured choice with two smaller alternatives, not
// a uniformly scaled desktop portrait card. The board changes its composition.
for(const selected of [false,true]) {
  const state=selected?'selected':'normal';
  const id=`draft-card-mobile-${state}`,w=320,h=208;
  const b=`<path d="M7 7H313V201H7Z M12 12V108H308V12Z" fill="${C.black}" fill-rule="evenodd"/>`
    +R(3,3,314,202,'none',selected?C.bright:'#988263',selected?2.2:1.2,9)
    +R(7,7,306,194,'none','#725c3d',.7,6)+R(12,12,296,96,'none','#8d7957',.8,2)
    +circle(24,24,16,'#315f7c','#c3d6df',1.4)+circle(24,24,12,'none','#7297ad',.8)
    +line(20,145,300,145,'#9c8150');
  add(id,w,h,b,'12',[1168,801,196,123],{apertures:{art:[12,12,296,96]},text:{cost:[11,10,26,28],title:[20,114,280,27],body:[20,151,280,29],flavor:[20,182,280,17]},min:[240,156]});
  const thumb=`draft-thumbnail-mobile-${state}`;
  add(thumb,160,88,R(3,3,154,82,'none',selected?C.bright:'#8c8068',selected?1.8:1,5)+R(7,7,146,49,'none','#7b715b',.6,1)
    +R(7,57,146,24,'#131510','none',0,1)+circle(18,18,12,'#315f7c','#c3d6df',1.1),'12',[1165,929,97,60],{apertures:{art:[7,7,146,49]},text:{cost:[9,8,18,20],title:[9,59,142,20]},min:[112,62]});
  const nav=`top-navigation-tab-${state}`;
  add(nav,180,48,R(1,1,178,46,'#11120e','none',0,0)+line(3,47,177,47,'#403826')
    +(selected?line(14,45,166,45,C.bright):''),'06',[291,109,134,40],{slice:[6,6,6,6],min:[96,40],scale:'Nine-slice horizontally; preserve underline thickness',text:{icon:[12,10,27,27],label:[45,9,119,29]}});
}
add('inspection-row-mobile',340,140,rail('inspection-row-mobile',2,2,336,136,false,3)+R(10,10,92,120,'none','#8b7550',.8,1)
  +line(115,49,327,49)+line(115,89,327,89),'07',[1150,420,230,87],{slice:[8,8,8,8],min:[260,107],scale:'Nine-slice outer backing; fixed portrait crop and live column layout',apertures:{art:[11,11,90,118]},text:{title:[115,11,212,31],type:[115,50,212,20],body:[115,73,212,39],source:[115,113,212,18]}});
for(const state of ['ready','not-ready','reconnecting']) {
  const id=`lobby-portrait-${state}`,color=state==='ready'?'#91b85e':state==='reconnecting'?'#d9b456':'#a99c7f';
  add(id,220,230,R(3,3,214,224,'none','#b59b68',1.1,4)+R(7,7,206,167,'none','#675638',.6,1)
    +R(7,176,206,46,'#131610','none',0,1)+circle(48,206,7,'#141710',color,1)
    +(state==='ready'?P('M44 206L47 209L53 201',color,1.4):state==='reconnecting'?P('M48 201V206L52 209',color,1.2):''),'11',[290,161,157,159],{apertures:{portrait:[7,7,206,167]},text:{player:[20,10,180,21],name:[20,177,180,24],status:[62,197,138,19]},min:[146,153]});
}
add('progression-connector',144,180,P('M72 2V65L22 65V113L72 113V178','#625d4e',1.2)+diamond(72,90,3,'#625d4e','#625d4e'),
  '10',[417,274,109,175],{min:[72,90],scale:'Redraw polyline from live node anchors; fixed stroke/marker size'});

for(const selected of [false,true]){
  const id=`forge-service-tab-${selected?'selected':'normal'}`;
  add(id,300,56,P('M3 4H278L296 52H3Z',selected?'#e4bd5a':'#685a40',selected?1.8:1,selected?'#302a1c':'#191914')
    +P('M7 9H275L289 48H7Z','#695a3d',.6)+(selected?P('M7 52H295','#e4bd5a',1.4):''),'08',[443,664,237,46],{apertures:{icon:[26,14,26,26]},text:{label:[65,12,197,30]},min:[160,36],scale:'Preserve shouldered silhouette; extend straight edges for live width'});
}
for(const state of ['normal','selected','green','red','disabled']) {
  const id=`button-${state}`,w=320,h=56;
  const colors={normal:['#211e17','#736145'],selected:['#332a16','#e2bc5c'],green:['#24401d','#80a55e'],red:['#3f211b','#bc4b36'],disabled:['#33322e','#7b7568']};
  const [fill,stroke]=colors[state];
  add(id,w,h,R(2,2,w-4,h-4,fill,stroke,1.2,5)+R(5,5,w-10,h-10,'none',stroke,.5,3)
    +(state==='disabled'?'':R(7,7,w-14,h-14,`url(#${id}-light)`,'none',0,2))+line(11,6,w-11,6,state==='green'?'#b8c796':state==='red'?'#d17c5d':'#b6a17b'),
    '12',[914,569,157,31],{slice:[9,9,9,9],min:[112,40],scale:'Nine-slice; fixed physical border and corner radii',text:{icon:[15,12,32,32],label:[53,10,244,36]}});
}
for(const selected of [false,true]) {
  const id=`filter-tab-${selected?'selected':'normal'}`,w=160,h=36;
  add(id,w,h,rail(id,2,2,156,32,selected,3)+(selected?R(6,5,148,27,`url(#${id}-light)`,'none',0,2):''),'07',[416,158,129,27],{slice:[7,7,7,7],min:[68,30],scale:'Nine-slice horizontally; preserve height',text:{label:[12,6,136,24]}});
  const nav=`navigation-row-${selected?'selected':'normal'}`;
  add(nav,300,52,rail(nav,2,2,296,48,selected,4),'12',[392,205,145,35],{slice:[8,8,8,8],min:[180,44],scale:'Nine-slice horizontally',text:{icon:[15,10,32,32],label:[59,8,213,36]}});
  const inventory=`inventory-slot-${selected?'selected':'normal'}`;
  add(inventory,112,112,rail(inventory,3,3,106,106,selected,5),'06',[361,695,117,97],{apertures:{art:[11,10,90,72]},text:{label:[8,85,96,19]},min:[80,80]});
  const desktopSlot=`inventory-slot-desktop-${selected?'selected':'normal'}`;
  add(desktopSlot,144,120,rail(desktopSlot,3,3,138,114,selected,5),'06',[361,695,117,97],{apertures:{art:[11,10,122,80]},text:{label:[8,94,128,19]},min:[112,93]});
  const classRow=`class-choice-row-${selected?'selected':'normal'}`;
  add(classRow,350,120,rail(classRow,3,3,344,114,selected,5)+R(8,8,98,104,'none','#6f5f43',.6,2),'01',[80,675,232,85],{slice:[9,9,9,9],apertures:{portrait:[8,8,98,104]},text:{title:[124,16,208,30],detail:[124,52,208,51]},min:[270,93],scale:'Nine-slice backing horizontally; fixed portrait and live copy column'});
  const classTile=`class-choice-tile-${selected?'selected':'normal'}`;
  add(classTile,92,106,R(3,3,86,100,'none',selected?C.bright:'#9a8a6e',selected?1.8:1,5)+R(7,81,78,18,'#11120e','none',0,1),'01',[1156,768,56,54],{apertures:{portrait:[7,7,78,72]},text:{title:[7,82,78,16]},min:[64,74]});
  const room=`dungeon-room-${selected?'current':'normal'}`;
  add(room,96,96,R(4,4,88,88,'none',selected?C.bright:'#8b8a7c',selected?2:1,6)+R(8,8,80,80,'none','#443d30',.6,3),'04',[484,759,63,65],{apertures:{art:[8,8,80,80]},text:{status:[32,61,32,25]},min:[60,60]});
}
for(const [id,w,h,board,box,rows] of [
  ['inspection-panel',360,530,'07',[848,105,244,420],[308,364,429,478]],
  ['service-window',600,410,'08',[440,704,563,301],[76,244,314]],
  ['mobile-detail-tray',340,230,'06',[1117,857,231,119],[38,121,175]],
  ['menu-backing',360,560,'12',[541,168,531,394],[62,120,178,236,294,352,410,468]],
  ['parchment-progression-backing',600,700,'10',[358,96,355,463],[90]],
]) {
  let b=rail(id,2,2,w-4,h-4,false,3);
  // Small losses and softened uneven edges follow the board's aged sheet.
  // This is a native material mask, never a modification of the raster paper.
  const paperOutline='M15 10L39 7L64 10L96 8L121 11L152 7L181 9L207 6L232 10L268 7L301 10L337 8L362 12L399 7L424 10L458 8L485 12L519 8L550 11L580 8L590 16L586 43L592 70L588 100L593 136L590 172L594 207L589 232L592 269L588 301L592 333L589 368L594 401L589 431L592 467L588 499L592 529L587 561L592 596L588 630L591 660L585 684L560 691L531 687L506 692L476 688L445 693L411 687L379 691L345 688L316 693L283 689L251 694L223 688L194 691L164 687L138 692L106 688L79 692L48 688L21 691L9 680L12 653L7 624L11 591L6 559L10 531L7 499L12 464L6 430L10 399L7 367L11 334L6 302L11 272L7 237L11 203L6 174L10 143L7 112L11 79L6 47L12 24Z';
  if(id==='parchment-progression-backing')b=P(paperOutline,'#796648',.7,'#c8b697');
  else for(const y of rows)b+=line(18,y,w-18,y,'#453d2d');
  if(id==='service-window')b+=line(244,26,244,h-22)+line(445,26,445,h-22);
  add(id,w,h,b,board,box,{slice:id==='parchment-progression-backing'?null:[12,12,12,12],min:[220,160],scale:id==='parchment-progression-backing'?'Keep aspect ratio; clip raster material to the recorded native irregular outline. Do not nine-slice torn edges.':'Nine-slice outer backing; redraw divider lines from layout, do not stretch them',
    apertures:id==='inspection-panel'?{art:[18,18,324,238]}:{},text:{content:[18,18,w-36,h-36]},
    textures:id==='parchment-progression-backing'?[{source:'../player-components-2026-10-03/assets/materials/weathered-parchment.webp',box:[3,3,w-6,h-6],clipPath:{viewBox:[0,0,w,h],path:paperOutline},mode:'clip to native irregular outline behind content; replace grain fallback without changing raster bytes',opacity:1}]:[]});
}
for(const state of ['off','on']) {
  const id=`toggle-${state}`,on=state==='on';
  add(id,64,32,R(2,3,60,26,on?'#314a29':'#12130f',on?'#93a672':'#b6a994',1,13)
    +circle(on?48:16,16,9,'#d7d1bc','#eee6cb',.8),'12',[1324,544,40,22],{min:[56,28],text:{},scale:'Keep aspect ratio; attach separate live state label'});
}
add('search-field',360,40,rail('search-field',2,2,356,36,false,4),'12',[820,122,254,27],{slice:[8,8,8,8],min:[160,36],scale:'Nine-slice horizontally',text:{icon:[12,10,20,20],query:[42,7,305,26]}});
for(const state of ['normal','selected']) {
  const id=`choice-row-${state}`;
  add(id,480,76,rail(id,2,2,476,72,state==='selected',5),'02',[694,833,384,54],{slice:[10,10,10,10],min:[228,62],scale:'Nine-slice horizontally; live copy can increase height',text:{icon:[20,18,40,40],title:[84,14,344,24],detail:[84,41,344,22],chevron:[443,27,16,20]}});
}
add('reward-accordion',420,104,rail('reward-accordion',2,2,416,100,false,3)+line(12,30,408,30),'09',[1154,831,230,45],{slice:[9,9,9,9],min:[220,84],scale:'Nine-slice backing; place divider at header boundary',text:{heading:[38,7,340,22],art:[20,43,51,51],detail:[82,43,265,46],state:[366,52,26,26],chevron:[389,9,18,18]}});
add('history-row',420,78,rail('history-row',2,2,416,74,false,3)+R(7,8,108,61,'none','#887554',.8,2),'11',[70,701,290,55],{slice:[8,8,8,8],min:[248,68],scale:'Nine-slice horizontally',apertures:{art:[8,9,106,59]},text:{title:[132,10,232,23],details:[132,36,232,30],statusIcon:[375,14,28,28],status:[359,45,51,22]}});
for(const state of ['ready','not-ready','reconnecting']) {
  const id=`lobby-${state}`,color=state==='ready'?'#91b85e':state==='reconnecting'?'#d9b456':'#a99c7f';
  add(id,320,72,rail(id,2,2,316,68,false,4)+R(7,7,63,58,'none','#6d5c43',.8,2)
    +circle(120,49,7,'#15170f',color,1)+(state==='ready'?P('M116 49L119 52L125 45',color,1.4):state==='reconnecting'?P('M120 44V49L124 51',color,1.1):''),
    '11',[1165,141,224,66],{slice:[9,9,9,9],min:[260,58],scale:'Nine-slice horizontally; portrait and state circle remain fixed',apertures:{portrait:[8,8,61,56]},text:{player:[112,5,154,14],name:[112,19,173,22],status:[134,39,152,20],menu:[289,7,20,20]}});
}
for(const state of ['normal','selected','locked','completed']) {
  const id=`progression-node-${state}`,selected=state==='selected';
  let b=circle(40,40,32,'#26261f',selected?'#ffcd5d':state==='locked'?'#827f70':'#bba66f',selected?2.3:1.4)
    +circle(40,40,27,'#151713',state==='locked'?'#615e52':'#887850',.8);
  if(selected)b=circle(40,40,38,'none','#dab561',.8)+b+P('M40 1V7M40 73V79M1 40H7M73 40H79','#f3cc74',1.4);
  if(state==='locked')b+=R(31,38,18,17,'#8a8776','none',0,2)+P('M34 38V31a6 6 0 0 1 12 0V38','#8a8776',2)+circle(40,45,2,'#22231d','none',0)+P('M40 46V50','#22231d',1.5);
  if(state==='completed')b+=P('M27 41L36 50L54 29','#a9c581',2.4);
  add(id,80,80,b,'10',[501,291,65,59],{apertures:state==='normal'||selected?{icon:[20,20,40,40]}:{},min:[48,48]});
}
for(const state of ['normal','selected','visited','unknown','boss']) {
  const id=`map-node-${state}`,color=state==='selected'?C.bright:state==='visited'?'#9dac76':state==='boss'?'#da684a':'#a3997e';
  let b=circle(32,32,23,'#181b16',color,state==='selected'?2:1.4)+circle(32,32,19,'none','#625941',.7);
  if(state==='selected')b=circle(32,32,29,'none','#ac8136',.8)+b;
  if(state==='visited')b+=P('M22 32L29 39L43 23',color,2);
  if(state==='unknown')b+=P('M27 24a6 6 0 1 1 8 7q-4 1-4 6',color,2)+circle(31,42,1.1,color,'none',0);
  add(id,64,64,b,'03',[449,839,50,45],{apertures:['normal','selected','boss'].includes(state)?{icon:[18,18,28,28]}:{},min:[44,44]});
}
add('route-connector',200,24,line(4,12,196,12,'#d5c29e')+diamond(100,12,3,'#d5c29e','#d5c29e'),'03',[435,785,47,40],{min:[24,16],scale:'Stretch horizontal line only; redraw diamonds at fixed size'});
add('dungeon-connection',160,24,line(3,12,157,12,'#a69b80')+diamond(42,12,3,'#c4b28d','#c4b28d')+diamond(80,12,3,'#c4b28d','#c4b28d')+diamond(118,12,3,'#c4b28d','#c4b28d'),'04',[548,785,74,15],{min:[44,16],scale:'Stretch line only; keep diamond markers at fixed physical size'});
add('service-pin',64,88,diamond(32,27,18,C.bright,'#24231b')+line(32,45,32,76,C.bright)+diamond(32,79,3,C.bright,C.bright),'04',[413,355,25,53],{apertures:{icon:[23,18,18,18]},min:[40,55]});
add('intent-badge',112,48,R(2,2,108,44,'#131512','#9e4937',1.6,7)+line(10,5,102,5,'#5c3028'),'05',[885,227,70,25],{slice:[10,10,10,10],min:[54,32],scale:'Nine-slice horizontally; runtime height has a touch minimum',text:{icon:[11,10,28,28],value:[45,9,56,30]}});
add('poise-square',12,10,R(1,1,10,8,'#605d4d','#aca48b',.7,1)+R(2,2,8,2,'#bbb399','none',0,0),'05',[650,375,7,7],{min:[6,5]});
add('resource-track',240,20,R(1,1,238,18,'#0d100e','#837755',.9,4)+R(4,4,232,12,'#191c16','#3e3b2b',.6,2),'05',[646,351,122,17],{slice:[6,6,6,6],min:[52,14],scale:'Nine-slice horizontally',apertures:{fill:[5,5,230,10]},text:{value:[8,2,224,16]}});
for(const [resource,color] of [['health','#b54d3e'],['mana','#3a85ac'],['stamina','#8da864'],['progress','#d8b458']])
  add(`resource-fill-${resource}`,230,10,R(0,0,230,10,color,'none',0,2)+R(2,1,226,2,resource==='health'?'#da7760':resource==='mana'?'#68abc8':resource==='stamina'?'#b0c78b':'#f0d27c','none',0,1),'10',[954,173,89,9],{min:[1,6],scale:'Clip to current live ratio inside resource-track; do not bake a value'});
add('energy-circle',80,80,circle(40,40,36,'#11130f','#d9b05b',2)+circle(40,40,32,'none','#5e4f2c',.8),'05',[47,516,61,57],{min:[48,48],text:{value:[15,24,50,32]}});

// Simple shapes are deliberately the icon grammar seen in the boards. These
// are symbols only, never substitutes for painted ability illustrations.
const icons = {
  deck:P('M8 27L3 8L12 5L16 26Z M13 27L9 4L20 3L23 25Z M18 27L20 5L29 8L24 28Z','currentColor',1.4)+P('M8 10L11 22M14 7L17 22M24 10L23 23','currentColor',.7),
  book:P('M16 7Q9 2 3 5V27Q10 24 16 28Q22 24 29 27V5Q22 2 16 7Z M16 7V28 M6 8L12 7M6 12L12 11M6 16L12 15M20 7L26 8M20 11L26 12M20 15L26 16','currentColor',1.2),
  'journey-spire':P('M2 28L8 12L12 21L17 3L22 18L26 12L31 28M12 21L17 12L19 20M8 12L8 20M26 12L26 21','currentColor',1.2,'#b89a55'),
  'relic-spire':P('M16 2L12 10L15 17L11 28L16 24L21 28L17 17L20 10Z M16 3V24 M12 11L5 27L11 25M20 11L27 27L21 25M11 18L8 30M21 18L24 30','currentColor',1.1),
  gear:P('M13 3H19L20 7L23 9L27 8L30 13L27 16V19L29 22L26 27L22 26L19 28L18 31H12L11 27L8 25L4 26L1 21L4 18V15L2 12L5 7L9 8L12 6Z','currentColor',.8,'currentColor')+circle(15.5,17,6,'#171711','none',0),
  display:R(3,5,26,18,'none','currentColor',1.7,1)+P('M16 23V28M10 28H22','currentColor',1.7),
  audio:P('M4 12H9L17 6V26L9 20H4Z','currentColor',1.1,'currentColor')+P('M21 10Q26 16 21 22M25 6Q33 16 25 26','currentColor',1.5),
  controls:P('M12 3H20V12H29V20H20V29H12V20H3V12H12Z','currentColor',1.2)+R(13,13,6,6,'currentColor','none',0,1),
  accessibility:circle(16,5,3,'currentColor','none',0)+P('M4 11L16 13L28 11M16 13V20L10 29M16 20L22 29','currentColor',3),
  search:circle(13,13,8,'none','currentColor',1.6)+P('M19 19L28 28','currentColor',1.8),
  back:P('M28 16H5M13 8L5 16L13 24','currentColor',1.7),
  chevron:P('M12 7L21 16L12 25','currentColor',1.5),
  collapse:P('M7 20L16 11L25 20','currentColor',1.5),
  heart:P('M16 29C13 25 3 19 3 11C3 3 12 2 16 8C20 2 29 3 29 11C29 19 19 25 16 29Z','#b54e3e',.8,'#c65343'),
  teardrop:P('M16 2C14 8 5 18 5 23C5 33 27 33 27 23C27 18 18 8 16 2Z','#558fba',.8,'#3c86ad')+P('M10 21Q9 26 13 27','#8dc1d5',1),
  'stamina-boot':P('M15 3H27L25 20L18 23L14 29H3V24L12 19Z','#81a154',1,'#8ba962')+P('M16 8H23M15 12H22M14 16H21M5 26H13','#c2ca93',.9),
  'crossed-swords':P('M4 2L7 3L23 19L20 22L4 6Z M28 2L25 3L9 19L12 22L28 6Z','currentColor',.7,'currentColor')+P('M18 25L26 17M6 17L14 25M22 23L28 29M10 23L4 29','currentColor',1.6),
  shield:P('M16 3L28 7V16Q27 26 16 31Q5 26 4 16V7Z M16 7L24 10V17Q23 24 16 27Q9 24 8 17V10Z M16 7V27','currentColor',1.2),
  lock:R(7,14,18,16,'currentColor','none',0,2)+P('M10 14V9a6 6 0 0 1 12 0V14','currentColor',2.2)+circle(16,20,2,'#171711','none',0)+P('M16 21V25','#171711',1.8),
  chain:P('M13 19L10 22a5 5 0 0 1-7-7l8-8a5 5 0 0 1 7 0M19 13L22 10a5 5 0 0 1 7 7l-8 8a5 5 0 0 1-7 0M10 22L22 10','currentColor',2),
  sword:P('M27 3L23 12L10 25L7 22L20 9Z M10 19L15 24M4 29L10 23','currentColor',1.4),
  axe:P('M8 29L25 5M19 5Q24 9 29 7L26 17Q19 19 14 13Z','currentColor',1.3),
  spear:P('M5 29L22 8M21 9L23 2L29 3L25 10Z','currentColor',1.3),
  hammer:P('M7 29L20 11M13 5L20 2L28 8L24 15L17 10Z','currentColor',1.3,'currentColor'),
  flask:P('M12 3H20V9L23 15Q27 21 23 28H9Q5 21 9 15L12 9Z M12 7H20M10 19H22','currentColor',1.2),
  ring:circle(16,20,9,'none','currentColor',2)+P('M11 11L13 4H19L22 11M13 4L16 9L19 4','currentColor',1.2),
  star:P('M16 2L19 12L30 13L21 20L24 30L16 24L8 30L11 20L2 13L13 12Z','currentColor',1.2),
  'compass-star':P('M16 1L18 13L31 16L18 18L16 31L14 18L1 16L14 13Z M6 6L13 14M26 6L19 14M6 26L13 19M26 26L19 19','currentColor',1.1),
  check:P('M5 16L13 24L28 7','currentColor',2.1),
  close:P('M7 7L25 25M25 7L7 25','currentColor',1.8),
  menu:P('M6 9H26M6 16H26M6 23H26','currentColor',1.7),
  campfire:P('M16 2Q17 12 22 16Q26 23 21 27Q24 19 18 17Q18 25 12 27Q5 23 10 16Q14 12 16 2Z M6 29L25 25M7 25L26 29','currentColor',1.4),
  skull:P('M16 3C1 3 1 20 9 23V28H23V23C31 20 31 3 16 3Z','currentColor',1,'currentColor')+circle(10,15,3,'#171711','none',0)+circle(22,15,3,'#171711','none',0)+P('M16 18L14 22H18Z M13 24V29M19 24V29','#171711',1),
  coin:circle(16,16,12,'none','currentColor',1.5)+circle(16,16,9,'none','currentColor',.8)+P('M13 8L10 21L16 18L21 25L23 12Z','currentColor',1),
  dice:P('M16 2L29 9V24L16 31L3 24V9Z M3 9L16 17L29 9M16 17V31','currentColor',1.2)+circle(16,9,1.2,'currentColor','none',0)+circle(9,19,1.2,'currentColor','none',0)+circle(23,19,1.2,'currentColor','none',0),
  reset:P('M6 8A12 12 0 1 1 4 20M6 8V2M6 8H13','currentColor',1.8),
  clock:circle(16,16,12,'none','currentColor',1.5)+P('M16 6V16L23 21','currentColor',1.7),
  party:circle(16,6,3,'currentColor','none',0)+circle(6,10,2.5,'currentColor','none',0)+circle(26,10,2.5,'currentColor','none',0)+P('M12 12H20L22 25H10Z M3 15H8L9 28H1Z M24 15H29L31 28H23Z','currentColor',1,'currentColor'),
  energy:P('M7 4L21 3L23 25L9 28Z M10 6L24 6L28 26L15 30Z','currentColor',1.1),
  'walking-pilgrim':circle(18,4,2.5,'currentColor','none',0)+P('M16 9L11 18L7 28M15 16L20 28M16 9L22 17M14 11L8 16','currentColor',2.4),
};
Object.assign(icons,{
  'class-reaver':P('M16 1V31M12 6L8 27L16 23L24 27L20 6M10 12H22M11 20H21M12 6L16 10L20 6M5 28L8 16M27 28L24 16','currentColor',1.15),
  'class-rogue':P('M16 1L13 11L16 31L19 11Z M10 6L5 12L11 18L13 25M22 6L27 12L21 18L19 25M7 11L11 10M25 11L21 10','currentColor',1.25),
  'class-starseer':circle(16,16,6,'none','currentColor',1.2)+circle(16,16,2,'currentColor','none',0)+P('M16 1V8M16 24V31M1 16H8M24 16H31M5 5L11 11M21 21L27 27M5 27L11 21M21 11L27 5M10 1L12 7M22 1L20 7M1 10L7 12M1 22L7 20M25 12L31 10M25 20L31 22M12 25L10 31M20 25L22 31','currentColor',1.1),
  'class-herald':P('M16 1V31M10 8L6 3L3 10L7 16V27M22 8L26 3L29 10L25 16V27M7 16L10 11L13 17M25 16L22 11L19 17M13 7L16 3L19 7','currentColor',1.4),
  'horned-elite':P('M9 12L2 3L4 15L10 19M23 12L30 3L28 15L22 19M9 12Q16 7 23 12L24 22L19 29H13L8 22Z','currentColor',1.2)+P('M11 18L14 20M21 18L18 20M14 25H18','currentColor',1.6),
  pouch:P('M10 3H22L19 10Q29 16 27 25Q26 30 16 30Q6 30 5 25Q3 16 13 10Z M10 11H22M12 6L16 10L20 6','currentColor',1.4),
  inn:P('M3 14L16 3L29 14M6 13V29H26V13M13 29V19H19V29M9 15H11M22 15H24M10 21H11M22 21H24M20 6V2H24V9','currentColor',1.3),
  anvil:P('M3 10H21L29 7V12L23 16H20V22L24 26H8L12 22V16H7Z M8 28H25','currentColor',1.3),
  market:P('M4 12L7 4H25L28 12M4 12Q7 17 10 12Q13 17 16 12Q19 17 22 12Q25 17 28 12M7 15V28H25V15M11 28V21H21V28M11 4L10 12M16 4V12M21 4L22 12','currentColor',1.3),
  gate:P('M4 29V7L8 3L12 7V29M20 29V7L24 3L28 7V29M12 12Q16 7 20 12M12 15Q16 10 20 15M14 29V17M18 29V17M4 10H12M20 10H28','currentColor',1.2),
  cathedral:P('M2 30H30M5 30V14L9 5L13 14V30M19 30V14L23 5L27 14V30M13 16L16 3L19 16M14 30V22a2 2 0 0 1 4 0V30M8 17V23M24 17V23M9 1V5M23 1V5M16 1V7','currentColor',1.1),
  'triple-slash':P('M5 27L18 4L15 17Z M10 29L26 3L22 18Z M17 29L30 7L27 20Z','currentColor',.8,'currentColor'),
  'host-crown':P('M4 8L11 15L16 4L21 15L28 8L25 25H7Z M8 29H24','currentColor',1.2,'currentColor'),
  'history-ledger':R(6,4,22,25,'none','currentColor',1.3,1)+P('M10 4V29M3 8H8M3 14H8M3 20H8M3 26H8M14 10H24M14 16H24M14 22H21','currentColor',1.15),
  'changelog-document':P('M7 3H21L27 9V29H7Z M21 3V9H27M11 14H23M11 19H23M11 24H20','currentColor',1.3),
  'bleed-droplet':P('M16 3C13 10 6 17 6 23C6 32 26 32 26 23C26 17 19 10 16 3Z','#bd5b49',.9,'#a94135')+P('M11 22Q10 26 14 27','#df8b71',1),
  'flask-drop-health-filled':P('M16 3C13 10 6 17 6 23C6 32 26 32 26 23C26 17 19 10 16 3Z','#c16852',1,'#b34b3f'),
  'flask-drop-health-empty':circle(16,17,11,'none','#9b8260',1.2),
  'flask-drop-mana-filled':P('M16 3C13 10 6 17 6 23C6 32 26 32 26 23C26 17 19 10 16 3Z','#75a4bd',1,'#4889ab'),
  'flask-drop-mana-empty':circle(16,17,11,'none','#9b8260',1.2),
  'favorite-filled':P('M16 2L19 12L30 13L21 20L24 30L16 24L8 30L11 20L2 13L13 12Z','#d6b566',.8,'#d6b566'),
  'rarity-diamond':diamond(16,16,8,'#a7997e'),
  'rarity-diamond-filled':diamond(16,16,8,'#8ca8b8','#8ca8b8'),
  ellipsis:circle(7,16,2,'currentColor','none',0)+circle(16,16,2,'currentColor','none',0)+circle(25,16,2,'currentColor','none',0),
  'notification-dot':circle(16,16,5,'#bc4b3d','none',0),
  'reset-dot':circle(16,16,5,'#bc4b3d','none',0),
  'forge-tools':P('M6 28L23 7M18 3L24 3L28 9L23 13L17 8Z M27 28L8 7M5 4Q10 3 15 8L12 15Q6 13 4 8Z','#d8c499',1.2),
});
const iconSources={
  heart:['05',[53,109,20,24]],teardrop:['05',[52,139,20,23]],'stamina-boot':['05',[53,162,21,24]],
  'crossed-swords':['05',[885,536,33,29]],shield:['06',[97,355,36,47]],energy:['01',[587,897,24,24]],
  book:['07',[93,316,29,24]],deck:['07',[87,232,40,27]],'journey-spire':['01',[476,317,34,29]],
  'relic-spire':['07',[93,793,24,29]],campfire:['09',[419,454,46,43]],party:['11',[73,99,39,38]],
  'walking-pilgrim':['02',[714,905,43,47]],gear:['12',[403,174,25,25]],display:['12',[403,209,24,24]],
  audio:['12',[403,245,25,24]],controls:['12',[403,280,26,28]],accessibility:['12',[403,315,25,32]],
  search:['12',[827,124,21,21]],back:['12',[1158,99,29,31]],chevron:['12',[1049,476,14,25]],
  collapse:['09',[1358,686,19,22]],lock:['06',[1131,474,27,30]],chain:['07',[935,425,29,23]],
  sword:['06',[91,664,53,49]],axe:['06',[98,725,30,35]],spear:['10',[958,423,32,37]],
  hammer:['08',[493,675,33,29]],flask:['07',[1165,851,41,59]],ring:['09',[498,938,59,39]],
  star:['10',[1350,873,25,31]],'compass-star':['03',[87,152,42,39]],check:['09',[404,944,24,22]],
  close:['12',[1155,572,25,26]],menu:['05',[1374,103,22,22]],skull:['11',[323,710,23,28]],
  coin:['07',[530,733,44,55]],dice:['12',[364,758,23,26]],reset:['12',[1344,705,27,25]],
  clock:['11',[1258,319,25,23]],
};
Object.assign(iconSources,{
  'class-reaver':['01',[173,696,43,48]],'class-rogue':['01',[173,785,43,43]],'class-starseer':['01',[173,873,43,40]],'class-herald':['01',[173,960,43,42]],
  'horned-elite':['03',[172,744,21,25]],pouch:['03',[171,800,24,22]],inn:['04',[1180,524,30,34]],anvil:['04',[1301,524,30,34]],market:['04',[1241,524,30,34]],gate:['04',[1360,524,30,34]],cathedral:['04',[1241,174,28,31]],
  'triple-slash':['10',[515,297,42,40]],'host-crown':['11',[303,274,24,21]],'history-ledger':['01',[501,368,23,22]],'changelog-document':['12',[406,401,23,23]],
  'bleed-droplet':['05',[861,757,23,28]],'flask-drop-health-filled':['07',[914,884,22,22]],'flask-drop-health-empty':['07',[959,884,22,22]],'flask-drop-mana-filled':['07',[914,964,22,22]],'flask-drop-mana-empty':['07',[959,964,22,22]],
  'favorite-filled':['10',[1346,870,29,28]],'rarity-diamond':['10',[496,824,13,14]],'rarity-diamond-filled':['10',[328,824,13,14]],ellipsis:['11',[418,182,18,16]],'notification-dot':['12',[499,401,16,16]],'reset-dot':['12',[1054,577,15,15]],'forge-tools':['08',[699,749,27,36]],
});
for(const [id,b] of Object.entries(icons)) {
  const [board,box]=iconSources[id];
  add(`icon-${id}`,32,32,b,board,box,{kind:'icon',min:[16,16],scale:'Keep aspect ratio; currentColor for monochrome icons, explicit color for vital resources'});
}
const manifest={schemaVersion:1,title:'AshenSpire / board-specific native geometry',source:'Twelve original October1 concept boards; visually transcribed native vectors, October4',
  boundary:'Design/reference assets only. Board prose, values, deck rules and red EndTurn are not canonical gameplay. Runtime text/state comes from game models.',
  sourceBoardDimensions:boardDimensions,sourceBoardHashes,inlineSvg:'IDs are namespaced per asset; repeated inline instances need a per-instance prefix. External <img> references are scoped independently.',
  resources:{'icon-heart':'HP','icon-teardrop':'Mana','icon-stamina-boot':'Stamina','icon-energy':'Energy','icon-shield':'Defence / Poise context; runtime label decides'},
  boardColorException:'Red buttons are exit/destructive states only. EndTurn keeps the game canonical color rule.',assets};
fs.writeFileSync(path.join(root,'vector-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Wrote ${assets.length} native SVG assets and vector-manifest.json.`);
