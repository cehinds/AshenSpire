// Attachment points measured on the shipped 640px pose canvases (floor 600).
// Rows: idle, attack1..4. Each point is [x, y, rotation in degrees].
// These belong to the painting, not the target or card. Re-measure when art changes.
export const COMBAT_EFFECT_ANCHORS = {
 reaver: {weapon:[[335,470,90],[290,535,150],[275,265,-165],[425,550,35],[480,390,-25]],cast:[[335,420],[385,480],[360,280],[390,485],[420,415]],shield:[[375,385],[520,375],[400,410]]},
 'reaver-vigil': {weapon:[[335,480,90],[245,545,155],[245,385,130],[420,550,35],[430,510,35]],cast:[[335,425],[380,475],[320,335],[355,485],[380,480]],shield:[[385,410],[520,405],[430,420]]},
 'reaver-oathsworn': {weapon:[[335,465,90],[260,545,150],[255,350,135],[410,550,40],[410,520,40]],cast:[[335,420],[380,475],[320,305],[355,490],[365,480]],shield:[[370,400],[505,390],[405,420]]},
 'reaver-warden': {weapon:[[335,465,90],[250,545,150],[255,380,135],[405,550,45],[245,555,130]],cast:[[335,420],[380,475],[320,325],[355,485],[285,510]],shield:[[365,385],[495,400],[430,415]]},
 rogue: {weapon:[[385,440,45],[285,345,-150],[570,450,5],[395,420,30],[525,500,10]],cast:[[360,415],[330,365],[520,445],[365,400],[480,490]],shield:[[320,400],[470,400],[395,425]]},
 'rogue-nightveil': {weapon:[[250,420,35],[470,525,65],[580,415,5],[380,470,45],[420,520,45]],cast:[[250,400],[465,500],[540,410],[340,425],[400,485]],shield:[[405,400],[515,395],[410,425]]},
 'rogue-duelist': {weapon:[[460,440,65],[565,430,5],[570,400,0],[490,425,25],[470,490,45]],cast:[[430,405],[525,425],[530,400],[445,405],[430,455]],shield:[[370,390],[505,380],[430,405]]},
 'rogue-shadow': {weapon:[[390,340,-70],[475,455,25],[455,465,25],[450,465,30],[455,480,45]],cast:[[385,385],[460,445],[445,455],[410,440],[430,450]],shield:[[350,400],[510,390],[395,410]]},
 starseer: {weapon:[[400,290,-85],[275,365,15],[515,460,0],[515,470,0],[525,470,0]],cast:[[400,290],[275,365],[515,460],[515,470],[525,470]],shield:[[400,445],[500,410],[405,450]]},
 'starseer-eclipse': {weapon:[[435,320,-70],[410,350,-30],[485,440,0],[435,430,0],[480,400,-20]],cast:[[435,320],[410,350],[485,440],[435,430],[480,400]],shield:[[345,410],[500,410],[380,460]]},
 'starseer-starlit': {weapon:[[425,305,-70],[440,325,-70],[470,390,0],[470,390,0],[490,345,-35]],cast:[[425,305],[440,325],[470,390],[470,390],[490,345]],shield:[[325,430],[510,405],[480,360]]},
 'starseer-astral': {weapon:[[435,310,-70],[290,240,-130],[520,415,0],[530,415,0],[535,380,-10]],cast:[[435,310],[290,240],[520,415],[530,415],[535,380]],shield:[[375,400],[480,415],[465,380]]},
 herald: {weapon:[[350,405,0],[455,400,0],[490,400,0],[490,400,0],[470,400,0]],cast:[[350,405],[455,400],[490,400],[490,400],[470,400]],shield:[[325,395],[500,370],[380,395]]},
 'herald-ossuary': {weapon:[[410,390,0],[450,450,0],[485,390,0],[470,400,0],[460,425,0]],cast:[[410,390],[450,450],[485,390],[470,400],[460,425]],shield:[[345,410],[505,390],[365,410]]},
 'herald-emberhabit': {weapon:[[425,395,0],[455,365,0],[480,385,0],[500,395,0],[485,415,0]],cast:[[425,395],[455,365],[480,385],[500,395],[485,415]],shield:[[355,405],[500,405],[385,430]]},
 'herald-pilgrim': {weapon:[[410,350,0],[460,390,0],[490,390,0],[445,400,0],[445,420,0]],cast:[[410,350],[460,390],[490,390],[445,400],[445,420]],shield:[[335,390],[470,400],[395,415]]},
};

export function combatPoseAttachment(actor, pose='idle', anchor='weapon') {
 const row=COMBAT_EFFECT_ANCHORS[actor];if(!row)return null;
 const attack=/^attack([1-4])$/.exec(pose),bash=/^shieldBash([1-3])$/.exec(pose);
 const point=anchor==='shield' ? row.shield[bash?Number(bash[1])-1:0] : row[anchor==='hand'?'cast':'weapon'][attack?Number(attack[1]):0];
 return {x:point[0],y:point[1],rotation:point[2]||0};
}

export function combatEffectAttachment(plan) {
 if(!plan||plan.projectile||plan.targetEvent!=='damageDealt')return null;
 if(plan.kind==='shieldBash')return 'shield';
 return ['slash','bloodSlash','crossSlash','whirlwind','thrust','riposte'].includes(plan.kind)?'weapon':null;
}

// Both halves share an origin. Complementary feathered masks split the trail
// around the actual pose silhouette without doubling the entire bright sprite.
export const COMBATANT_EFFECT_PLANES = [
 {plane:'behind',opacity:.62,mask:'linear-gradient(155deg,#000 35%,transparent 65%)'},
 {plane:'front',opacity:.82,mask:'linear-gradient(155deg,transparent 35%,#000 65%)'},
];
export const ATTACHMENT_SIZE = {weapon:260,shield:215,hand:150};
