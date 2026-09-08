// Authored painted references, traced in their normalized 640px image space.
// These coordinates are measured from the generated art, not sampled from the
// current interpolator. Near/far refers to camera depth. Obscured joints remain
// explicitly uncertain; neither an opaque pauldron nor robe reveals anatomy.
const names=['nearShoulder','nearElbow','nearWrist','farShoulder','farElbow','farWrist','pelvis','nearHip','nearKnee','nearAnkle','farHip','farKnee','farAnkle','weaponTip'];
const hidden=['farShoulder','pelvis','nearHip','farHip'];
const frame=(points,more=[])=>({joints:Object.fromEntries(names.map((n,i)=>[n,points[i]])),estimated:[...hidden,...more],kind:'intermediate',provenance:'authored-painted-strip'});
export const TRANSITION_JOINTS={
 reaver:{
  between1:frame([[300,365],[313,410],[338,448],[367,368],[375,411],[356,441],[319,459],[343,467],[390,501],[372,579],[294,468],[265,518],[221,583],[178,590]],['farElbow']),
  between2:frame([[280,334],[246,318],[279,273],[357,339],[331,319],[301,284],[303,426],[332,445],[387,489],[391,579],[279,445],[242,501],[192,583],[100,137]],['farElbow']),
  between3:frame([[297,332],[278,329],[284,286],[379,337],[351,316],[310,266],[330,434],[357,448],[398,491],[382,580],[301,450],[263,505],[207,582],[480,152]],['farElbow']),
  between4:frame([[263,341],[276,387],[311,429],[329,351],[329,398],[321,429],[286,435],[308,447],[341,490],[329,578],[259,447],[213,502],[169,581],[409,591]],['farElbow']),
  between5:frame([[173,345],[195,393],[257,415],[233,354],[245,391],[269,408],[209,439],[237,451],[276,495],[274,580],[185,453],[153,509],[109,582],[427,243]],['farElbow']),
 },
 starseer:{
  between1:frame([[321,411],[350,432],[392,416],[379,421],[391,453],[423,450],[340,479],[367,495],[392,530],[382,586],[312,494],[263,546],[216,590],[345,306]],['farElbow','farKnee']),
  between2:frame([[315,409],[331,430],[364,408],[374,418],[378,449],[411,441],[332,477],[358,490],[389,526],[374,586],[304,494],[253,547],[211,590],[461,340]],['farElbow','farKnee']),
  between3:frame([[300,424],[342,441],[393,433],[363,438],[369,461],[394,447],[318,491],[345,501],[380,532],[367,587],[291,504],[247,548],[198,591],[489,431]],['farElbow','farWrist','farKnee']),
  between4:frame([[302,421],[341,441],[389,435],[364,435],[368,459],[390,448],[321,488],[346,499],[376,532],[365,587],[294,501],[251,549],[203,591],[488,432]],['farElbow','farWrist','farKnee']),
  between5:frame([[305,417],[325,442],[363,435],[361,420],[379,437],[375,412],[325,481],[348,495],[371,532],[360,587],[299,499],[252,550],[212,591],[411,334]],['farElbow','farKnee']),
 },
};
export const TRANSITION_SEQUENCE=[
 {t:.11,pose:'between1',label:'Lower / gather',rootX:307,purpose:'Begin weight transfer while bringing the hands out of guard.'},
 {t:.34,pose:'between2',label:'Lift / turn forward',rootX:313,purpose:'Keep the bent arm near the chest while the weapon clears the face.'},
 {t:.575,pose:'between3',label:'Drive / aim',rootX:322,purpose:'Guide the forward sword sweep or staff aim before the committed action.'},
 {t:.775,pose:'between4',label:'Recoil / release tension',rootX:328,purpose:'Let the elbows and knees soften after impact or release.'},
 {t:.93,pose:'between5',label:'Settle into guard',rootX:307,purpose:'Bring the grip toward the guarded endpoint as the torso rises.'},
];
// Integration is separate from art availability. These five references survived
// the existing dense constraint checks; the others expose unresolved depth
// changes and remain visible for further rig authoring instead of being hidden.
export const SUPPORTED_TRANSITIONS={reaver:['between1','between5'],starseer:['between3','between4','between5']};
export const TRANSITION_LIMITATIONS={
 reaver:'Lift, forward drive and recoil need better arm depth and support-hand reconstruction before driving the rig.',
 starseer:'Gather and forward lift change the projected elbow side. Their arm depth transition still needs work.',
};
