"""Enlarge scythe compositions through JSON transforms; preserve every PNG."""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parent
data=json.loads((ROOT/'cutout-manifest.json').read_text())
for i in (2,7):
 data['assets'][f'Y.effect.{i}']['anchors']['emissionRoot']={'x':.583,'y':.35752}
changed=[]
for c in data['compositions'].values():
 if c['category']!='Y' or c['effectDigit'] not in (2,7):continue
 layers={l['id']:l for l in c['layers']};parent=layers['object'];a=data['assets'][parent['assetId']];p=a['anchors']['stoneHead'];r=math.radians(-75);dx=(p['x']-.5)*437;dy=(p['y']-.5)*437
 parent['overrides'].update(x=round(304-math.cos(r)*dx+math.sin(r)*dy,3),y=round(190-math.sin(r)*dx-math.cos(r)*dy,3))
 layers['foreground']['overrides'].update(scaleX=1.2,scaleY=1.35)
 c['designRevision']=9;changed.append(c['code'])
data['revision']=9
data['references']['meleeRevision']='revision-v9.json'
data['scope'].update(latestBatchRevisedEffectCount=0,latestBatchRevisedCompositionCount=20)
for c in data['categories']:
 if c['letter']=='Y':c['revision']=9
(ROOT/'cutout-manifest.json').write_text(json.dumps(data,indent=2)+'\n')
(ROOT/'cutouts-data.js').write_text('window.CARD_CUTOUT_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
(ROOT/'cutouts/Y/assets.json').write_text(json.dumps({k:a for k,a in data['assets'].items() if a['category']=='Y'},indent=2)+'\n')
(ROOT/'revision-v9.json').write_text(json.dumps({'revision':9,'sourceCommit':'ade2a282ab71f29fe66f2f04bf8f91d67c69e41b','request':'Make the ethereal scythe much bigger, following the marked silhouette.','approvedStyleReference':'Y00','changedCompositions':changed,'changedPngs':[],'unchangedPngCount':362,'scytheScale':{'x':1.2,'y':1.35},'placement':'Move scythe/scepter assembly right to retain the enlarged blade inside the art crop; move the emission anchor along the spectral shaft so it reaches the physical pommel.','resetSavedPlacement':True},indent=2)+'\n')
print('Enlarged 20 scythe compositions: 20% wider, 35% taller; all 362 PNGs preserved.')
