// Manually inspected landmarks on the shipped 640×640 artwork. These are 2D
// projected joint centers, not anatomical measurements or a fixed-length rig.
// Near/far means camera depth, never screen-left/screen-right.
// The inspection closeups use crop (140,240,480,400) at 1.875×; convert once here.
const point=([x,y])=>[140+x/1.875,240+y/1.875];
const names=['nearShoulder','nearElbow','nearWrist','farShoulder','farElbow','farWrist','pelvis','nearHip','nearKnee','nearAnkle','farHip','farKnee','farAnkle','weaponTip'];
const frame=(points,estimated=[])=>({joints:Object.fromEntries(names.map((n,i)=>[n,point(points[i])])),estimated});
export const SOURCE_JOINTS={
 reaver:{
  guard:frame([[366,201],[413,275],[512,307],[447,219],[482,269],[539,300],[420,368],[449,383],[535,464],[522,615],[387,383],[318,505],[250,622],[794,89]],['farShoulder','farElbow','pelvis','nearHip','farHip']),
  attack1:frame([[550,283],[490,331],[463,400],[648,325],[614,385],[507,417],[505,443],[539,445],[646,494],[564,610],[470,452],[367,526],[227,626],[122,639]],['farShoulder','pelvis','nearHip','farHip']),
  attack2:frame([[338,250],[321,151],[356,86],[448,249],[473,150],[427,96],[407,395],[445,413],[550,499],[518,611],[375,419],[275,529],[160,623],[125,10]],['farShoulder','pelvis','nearHip','farHip']),
  attack3:frame([[152,331],[210,389],[270,431],[270,338],[292,388],[298,441],[163,471],[202,473],[278,510],[233,615],[125,479],[-40,551],[-74,623],[554,655]],['farShoulder','pelvis','nearHip','farHip']),
  attack4:frame([[414,279],[472,313],[519,329],[409,337],[452,366],[489,349],[363,404],[403,423],[506,509],[486,617],[332,427],[265,535],[169,625],[775,222]],['farShoulder','farElbow','pelvis','nearHip','farHip']),
 },
 starseer:{
  guard:frame([[354,332],[394,382],[463,384],[465,359],[503,383],[508,349],[397,455],[430,471],[493,529],[480,618],[365,476],[252,565],[178,633],[553,196]],['farShoulder','farElbow','pelvis','nearHip','farHip','farKnee']),
  attack1:frame([[384,308],[308,310],[332,270],[481,375],[493,427],[539,450],[405,425],[432,459],[510,515],[508,617],[373,470],[258,566],[170,632],[226,221]],['farShoulder','pelvis','nearHip','farHip','farKnee']),
  attack2:frame([[366,378],[431,403],[516,409],[462,411],[457,451],[517,423],[404,483],[439,501],[503,543],[479,624],[373,499],[280,570],[190,637],[699,411]],['farShoulder','farElbow','farWrist','pelvis','nearHip','farHip','farKnee']),
  attack3:frame([[355,412],[430,426],[500,429],[439,439],[444,464],[503,444],[387,493],[421,511],[483,562],[501,625],[357,507],[270,577],[187,635],[680,429]],['farShoulder','farElbow','farWrist','pelvis','nearHip','farHip','farKnee']),
  attack4:frame([[349,388],[423,416],[489,426],[431,426],[435,463],[492,441],[372,490],[410,512],[478,549],[456,626],[343,510],[272,583],[205,637],[732,426]],['farShoulder','farElbow','farWrist','pelvis','nearHip','farHip','farKnee']),
 },
};
export const SOURCE_SEQUENCE=[
 {t:0,pose:'guard',label:'Guard'},
 {t:.22,pose:'attack1',label:'Anticipation'},
 {t:.46,pose:'attack2',label:'Windup / extension'},
 {t:.69,pose:'attack3',label:'Strike / release'},
 {t:.86,pose:'attack4',label:'Follow-through'},
 {t:1,pose:'guard',label:'Return to guard'},
];
export const CHAINS=[
 ['nearShoulder','nearElbow','nearWrist'],['farShoulder','farElbow','farWrist'],
 ['nearHip','nearKnee','nearAnkle'],['farHip','farKnee','farAnkle'],
 ['nearShoulder','farShoulder'],['nearShoulder','pelvis'],['pelvis','nearHip'],['pelvis','farHip'],
];
export function sourceFrame(classId,t){
 const key=SOURCE_SEQUENCE.findLast(k=>k.t<=Math.max(0,Math.min(1,t)));
 return {...key,...SOURCE_JOINTS[classId][key.pose]};
}
