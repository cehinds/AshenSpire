"""Shrink physical scythe scepters around their pommels; preserve projection pose."""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parent
data=json.loads((ROOT/'cutout-manifest.json').read_text())
changed=[]
for c in data['compositions'].values():
 if c['category']!='Y' or c['effectDigit'] not in (2,7):continue
 if c.get('designRevision')==10:continue
 layers={l['id']:l for l in c['layers']};parent=layers['object'];child=layers['foreground'];t=parent['overrides'];stone=data['assets'][parent['assetId']]['anchors']['stoneHead']
 factor=.7;old=t['width'];new=old*factor;r=math.radians(t['rotationDeg']);pommel={'x':.15,'y':.86}
 dx=(pommel['x']-.5)*(old-new);dy=(pommel['y']-.5)*(old-new)
 t.update(x=t['x']+math.cos(r)*dx-math.sin(r)*dy,y=t['y']+math.sin(r)*dx+math.cos(r)*dy,width=new,height=new)
 child['attachment'].update(referenceParentSize=new,offset={'x':(stone['x']-pommel['x'])*(old-new),'y':(stone['y']-pommel['y'])*(old-new)})
 c['designRevision']=10;changed.append(c['code'])
data['revision']=10;data['references']['meleeRevision']='revision-v10.json'
for c in data['categories']:
 if c['letter']=='Y':c['revision']=10
(ROOT/'cutout-manifest.json').write_text(json.dumps(data,indent=2)+'\n')
(ROOT/'cutouts-data.js').write_text('window.CARD_CUTOUT_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
if changed:
 (ROOT/'revision-v10.json').write_text(json.dumps({'revision':10,'request':'Make the physical scepter smaller in the enlarged scythe compositions.','changedCompositions':changed,'scepterSizeFactor':.7,'changedPngs':[],'unchangedPngCount':362,'placement':'Shrink the physical scepter 30% around its pommel. Compensate the stone attachment offset and referenceParentSize to preserve the enlarged spectral scythe position and scale.','resetSavedPlacement':True},indent=2)+'\n')
print('Physical scythe scepters reduced 30%; spectral projections retain their pose.')
