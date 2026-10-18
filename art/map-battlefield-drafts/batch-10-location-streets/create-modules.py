"""Initialize editable scene JSON from the brief; rerunning replaces module edits."""
import os
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=Path(os.environ.get('ASHENSPIRE_DIR', ROOT.parents[3]/'AshenSpire')).resolve()
read=lambda p:json.loads(p.read_text())
def write(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,indent=2)+'\n')
brief=read(ROOT/'brief.json');settings=brief['settings']
def ref(setting,role):
 target=settings[setting].get('reuse',{}).get(role)
 return (target if target else setting+'/'+role)+'.png'
index={'formatVersion':1,'assetBase':'..','styleFamilyId':'ashen-spire-painted-v1','status':'draft-close-location-art','productionBinding':None,'sceneFiles':[f'locations/{s}.json' for s in settings],'introMap':'intro-map.json','canvas':{'width':1672,'height':941},'cameras':[{'id':'native','x':0,'y':0,'width':1672,'height':941},{'id':'landscape','x':356,'y':200,'width':960,'height':540},{'id':'portrait','x':611,'y':70,'width':450,'height':800},{'id':'ultrawide','x':196,'y':200,'width':1280,'height':540}],'framingPolicy':{'sideProps':'Large near left/right pieces may intentionally extend beyond the viewport. Original source silhouettes remain intact. Keep the inner40% open except explicit rear focal props above the ground.','layerOrder':['backdrop','prop','ground','filter','particles'],'groundContact':'Use measured center horizon; prop base overlaps ground by declared pixels.','overscan':'Review static crops only; arbitrary camera motion needs expanded source edges.'}}
for setting,spec in settings.items():
 layers=[{'role':'backdrop','asset':ref(setting,'backdrop')}]
 for side in ['left','right']:
  role='prop-'+side;override=spec.get('placementOverrides',{}).get(role,{})
  placement={'mode':'side-framing','side':side,'innerEdgeU':.28 if side=='left' else .72,'heightFraction':1.02,'baseOcclusionPixels':14,'intentionalViewportCrop':True}
  if override.get('mode')=='rear-focal':placement={'mode':'rear-focal','anchorU':override['anchorU'],'visibleWidthFraction':override['visibleWidthFraction'],'heightFraction':override['heightFraction'],'baseOcclusionPixels':12,'intentionalViewportCrop':False}
  elif 'heightFraction' in override:placement['heightFraction']=override['heightFraction']
  layers.append({'id':role,'role':'prop','asset':ref(setting,role),'placement':placement})
 layers.append({'role':'ground','asset':ref(setting,'ground')})
 scene={'id':setting,'label':spec['label'],'condition':spec['condition'],'interior':spec['condition']=='interior','tags':{'location':[setting],'lighting':[spec['condition']],'camera':['player-height','close-location']},'productionBinding':None,'layers':layers,'reuse':spec.get('reuse',{})}
 if not scene['interior']:
  time='night' if scene['condition']=='night' else 'day'
  time_layer=dict(read(ROOT/'modules/time-of-day.json')['items'][time]);time_layer.pop('editableSource',None);scene['layers'].append(time_layer)
 scene['backdropType']='room-shell' if scene['interior'] else 'sky-and-distance'
 if setting=='castle-throne-room':
  next(l for l in scene['layers'] if l['role']=='ground')['asset']='dungeon-corridor/ground.png'
  scene['reuse']['ground']='dungeon-corridor/ground'
  scene['layers'].append(read(ROOT/'modules/locations/castle-throne-room.json')['layers'][-1])
 write(ROOT/'modules/locations'/f'{setting}.json',scene)
# A damp/overcast preview of the city base, with weather separate and explicit grading.
rain=read(ROOT/'modules/locations/city-street.json');rain.update(id='city-street-rain',label='Crownfall city street in rain',condition='rain');rain['tags']['lighting']=['overcast'];rain['tags']['weather']=['rain']
for layer in rain['layers']:
 if layer['role'] in ['prop','backdrop','ground']:layer['previewAmbientGrade']={'brightness':.8,'saturation':.85}
rain['layers'] += [{'role':'filter','purpose':'weather','asset':'../batch-04-atmosphere/filters/filter-rain.png','opacity':.65},{'role':'particles','asset':'../batch-04-atmosphere/particles/rain.png','opacity':.3,'repeat':True}]
write(ROOT/'modules/locations/city-street-rain.json',rain);index['sceneFiles'].append('locations/city-street-rain.json')
atlas_path=REPO/'content/source/worldAtlas.json';atlas=read(atlas_path);nodes={n['nodeId']:n for n in atlas['nodes']};local=[n for n in atlas['local_map_nodes'] if n['mapId']=='local:crownfall']
choices={'crownfall':'city-street','crownfall/forge':'intro-forge','crownfall/market':'city-street','crownfall/inn':'city-street-night','crownfall/chapel':'intro-chapel','crownfall/archive':'intro-archive','crownfall/warden':'fortress-gate'}
items=[]
for node_id in ['crownfall']+[n['nodeId'] for n in local]:
 n=nodes[node_id];point=next((p for p in local if p['nodeId']==node_id),None)
 row={'nodeId':node_id,'displayName':n['displayName'],'nodeTypeId':n['nodeTypeId'],'sceneId':choices.get(node_id,'fortress-gate'),'position':{'x':point['x'],'y':point['y']} if point else None,'tags':{'origin':['intro-map','crownfall'],'location':[n['nodeTypeId']]},'productionBinding':None,'additionalProps':[]}
 if node_id=='crownfall/market':row['additionalProps']=[{'role':'prop','asset':'../batch-05-regions/ashen-crown/prop-market-stall.png','placement':{'mode':'side-framing','side':'left','innerEdgeU':.36,'heightFraction':.42,'baseOcclusionPixels':14,'intentionalViewportCrop':True}}]
 if node_id.startswith('crownfall/gate:'):row['destinationRegionId']=node_id.split(':',1)[1]
 items.append(row)
write(ROOT/'modules/intro-map.json',{'formatVersion':1,'status':'candidate-art-mapping','mapId':'local:crownfall','ownerNodeId':'crownfall','sourceAtlas':'../../../content/source/worldAtlas.json','sourceSha256':hashlib.sha256(atlas_path.read_bytes()).hexdigest(),'mapAsset':'../../../assets-mobile/environments/crownfall-local.webp','prologueArtReferences':['../../../assets-mobile/prologue/road-desktop.webp','../../../assets-mobile/prologue/step-crownfall-desktop.webp'],'bindingPolicy':'Candidate art references only; does not alter the intro, atlas nodes or live presentation bindings. Regional gates remain in Crownfall; destination tags do not move them into another biome.','items':items})
index['timeOfDayFilters']='time-of-day.json'
index['componentSlots']=read(ROOT/'modules/index.json')['componentSlots']
index['framingPolicy']['layerOrder']=read(ROOT/'modules/index.json')['framingPolicy']['layerOrder']
write(ROOT/'modules/index.json',index)
print(f'Initialized {len(index["sceneFiles"])} editable scenes and {len(items)} Crownfall mappings.')
