// Landmark poses authored against the shipped painted sprites. Coordinates are
// retargeted to this rig's proportions; these are pose guides, not pixel traces.
const reaverAttack=[
 {t:0,label:'Sword rest',sprite:'idle',root:[300,335],spine:0,wrist:[40,-65],angle:90,front:365,rear:230},
 {t:.22,label:'Low advance',sprite:'attack1',root:[307,408],spine:40,wrist:[53,5],angle:145,front:398,rear:230},
 {t:.34,label:'Lift clearance',sprite:'attack1',root:[302,365],spine:12,wrist:[80,-120],angle:165,front:398,rear:230},
 {t:.46,label:'Overhead windup',sprite:'attack2',root:[302,350],spine:-7,wrist:[20,-235],angle:190,front:398,rear:230},
 {t:.56,label:'Swing clearance',sprite:'attack2',root:[310,365],spine:8,wrist:[110,-137],angle:300,front:398,rear:230},
 {t:.69,label:'Downward cleave',sprite:'attack3',root:[316,403],spine:38,wrist:[94,-18],angle:405,front:416,rear:230},
 {t:.86,label:'Recovery',sprite:'attack4',root:[308,359],spine:12,wrist:[60,-33],angle:435,front:393,rear:230},
 {t:1,label:'Sword rest',sprite:'idle',root:[300,335],spine:0,wrist:[40,-65],angle:450,front:365,rear:230},
];
const cast=[
 {t:0,label:'Casting guard',sprite:'idle',root:[300,346],spine:12,wrist:[55,-60],angle:-70,front:365,rear:230},
 {t:.22,label:'Gather',sprite:'attack1',root:[294,380],spine:25,wrist:[62,-123],angle:-170,front:384,rear:230},
 {t:.46,label:'Extend',sprite:'attack2',root:[312,384],spine:20,wrist:[135,-70],angle:0,front:400,rear:230},
 {t:.69,label:'Release',sprite:'attack3',root:[320,389],spine:28,wrist:[142,-70],angle:0,front:408,rear:230},
 {t:.86,label:'Recover',sprite:'attack4',root:[305,360],spine:15,wrist:[75,-62],angle:-35,front:385,rear:230},
 {t:1,label:'Casting guard',sprite:'idle',root:[300,346],spine:12,wrist:[55,-60],angle:-70,front:365,rear:230},
];
const guard=[
 {t:0,label:'Ready',sprite:'guard',root:[300,342],spine:5,wrist:[53,-48],angle:-65,front:365,rear:230},
 {t:.22,label:'Brace',sprite:'guard',root:[296,364],spine:12,wrist:[48,-73],angle:-75,front:377,rear:230},
 {t:.46,label:'Absorb',sprite:'guard',root:[290,374],spine:5,wrist:[49,-77],angle:-78,front:377,rear:230},
 {t:.69,label:'Push back',sprite:'guard',root:[310,363],spine:16,wrist:[66,-77],angle:-55,front:377,rear:230},
 {t:.86,label:'Recover',sprite:'guard',root:[304,350],spine:8,wrist:[58,-62],angle:-60,front:372,rear:230},
 {t:1,label:'Ready',sprite:'guard',root:[300,342],spine:5,wrist:[53,-48],angle:-65,front:365,rear:230},
];
export function referenceKeys(classId,family,action){
 const source=action==='guard'?guard:action==='cast'||family==='focus'?cast:reaverAttack;
 return source.map(k=>({...k,root:[...k.root],wrist:[...k.wrist],referenceClass:source===cast?'starseer':'reaver',referencePose:k.sprite}));
}
export const KEY_TIMES=[0,.22,.46,.69,.86,1];



