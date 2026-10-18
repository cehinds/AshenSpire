"""Publish the accepted pale-mint color pass without further art iterations."""
import hashlib,json,subprocess
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parent;d=json.loads((R/'cutout-manifest.json').read_text());sources=json.loads((R/'generation-sources-v14.json').read_text())
assert d['revision']==13,'Apply once to revision 13.'
for i,name in enumerate(['sword','hammer','scythe','scimitar','shield'],5):
 a=d['assets'][f'Y.effect.{i}'];source=Path(sources[name]);out=R/a['src'];prior=a['sha256'];size=Image.open(source).size
 subprocess.run(['magick',str(source),'-resize','512x512!','-define','png:color-type=6','-define','png:exclude-chunk=date,time',str(out)],check=True)
 a['name']=a['name'].replace('Green','Pale mint');a['displayLabel']=a['displayLabel'].replace('Green','Pale mint');a['sha256']=hashlib.sha256(out.read_bytes()).hexdigest();a['alphaBounds']=list(Image.open(out).getchannel('A').getbbox());a['defaultTransform']['filter']='none';a['css']['filter']='none'
 a['references'].update(sourceFile=source.name,sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sourceCell={'x':0,'y':0,'width':size[0],'height':size[1]},extractionCrop={'x':0,'y':0,'width':size[0],'height':size[1]},colorEditReference={'commit':'b2e096f2a','src':a['src'],'sha256':prior},revisionIntent='Accepted pale pearl-white/icy mint color pass; 20% rendered opacity. Thinner outlines and a little more green are recorded as the next refinement, not part of this publication.')
for c in d['compositions'].values():
 if c['category']=='Y' and c['effectDigit']>=5:
  c['displayName']=c['displayName'].replace('Green','Pale mint');c['displayLabel']=c['displayLabel'].replace('Green','Pale mint');c['designRevision']=14
for c in d['categories']:
 if c['letter']=='Y':c['revision']=14
d['revision']=14;d['references']['meleeRevision']='revision-v14.json';d['scope']['latestBatchRevisedCompositionCount']=50
(R/'cutout-manifest.json').write_text(json.dumps(d,indent=2)+'\n');(R/'cutouts-data.js').write_text('window.CARD_CUTOUT_DATA = '+json.dumps(d,separators=(',',':'))+';\n');(R/'cutouts/Y/assets.json').write_text(json.dumps({k:a for k,a in d['assets'].items() if a['category']=='Y'},indent=2)+'\n')
(R/'revision-v14.json').write_text(json.dumps({'revision':14,'request':'Reduce the strong green toward an aetherial pale mint, then push the current pass as-is.','changedPngs':[f'Y.effect.{i}' for i in range(5,10)],'unchangedPngCount':357,'preserved':'Shared scepter sprite, identical small size, axis alignment, all layer transforms and existing rendered opacity.','mintOpacity':.2,'filter':'none','nextRefinement':'Slightly thinner, more transparent outlines with a little green restored. Deferred at user request to publish the current pass.'},indent=2)+'\n')
