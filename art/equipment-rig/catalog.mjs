export const WEAPONS = {
 straightSword: {name:'Straight Sword',family:'blade',grip:[116,401],tip:[490,20],scale:.45},
 greatsword: {name:'Greatsword',family:'heavy',grip:[147,365],support:[98,412],tip:[496,17],scale:.51},
 kiteShield: {name:'Kite Shield',family:'shield',grip:[255,230],tip:[255,5],scale:.40},
 starstoneStaff: {name:'Starstone Staff',family:'focus',grip:[241,275],support:[184,336],tip:[464,52],scale:.52},
 katana: {name:'Katana',family:'blade',grip:[129,369],tip:[490,20],scale:.48},
};
export const RIGS = {
 reaver:{name:'Reaver',upper:78,lower:74,near:[278,247],far:[318,249],torso:[298,286],head:[304,199],hip:[300,416],cloak:[265,368],headSize:[82,103],torsoSize:[126,156],hipSize:[215,234],cloakSize:[200,320],armWidth:62,foreWidth:48,handSize:36,color:'#f2c56c'},
 starseer:{name:'Starseer',upper:73,lower:72,near:[278,259],far:[310,254],torso:[296,294],head:[305,192],hip:[300,423],cloak:[264,376],headSize:[151,126],torsoSize:[113,155],hipSize:[213,234],cloakSize:[211,314],armWidth:64,foreWidth:56,handSize:32,color:'#91bbff'},
};
export const SETUPS = {
 sword:{name:'Sword · empty hand',main:'straightSword',off:null,grip:'one',action:'attack'},
 greatsword:{name:'Greatsword · two hands',main:'greatsword',off:null,grip:'two',action:'attack'},
 shield:{name:'Sword + shield',main:'straightSword',off:'kiteShield',grip:'one',action:'guard'},
 focus:{name:'Focus · free-hand cast',main:'starstoneStaff',off:null,grip:'one',action:'cast'},
 mixed:{name:'Sword + casting focus',main:'straightSword',off:'starstoneStaff',grip:'one',action:'cast'},
 dualCast:{name:'Dual casting focus',main:'starstoneStaff',off:'starstoneStaff',grip:'one',action:'cast'},
 dual:{name:'Sword + katana',main:'straightSword',off:'katana',grip:'one',action:'attack'},
 newWeapon:{name:'Katana · same blade motion',main:'katana',off:null,grip:'one',action:'attack'},
};
