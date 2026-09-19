"""Write the initial authored reference component from the reviewed asset manifest."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[2]
pack=Path(__file__).resolve().parent
current=root/'content/config/ui/presentation/equipmentAnimations.json'
if current.exists() and json.loads(current.read_text()).get('components',{}).get('motionProfiles'):
    raise SystemExit('Shared outfit profiles already exist. Use art/greatsword-outfits-2026-09-19/export.py --bind; this initial-sample exporter must not replace them.')
coverage=json.loads((pack/'coverage.json').read_text())
order=json.loads((pack/'sequences.json').read_text())['reaver__greatsword-twoHand']
frames={}
for p in sorted((root/'assets/animations/reaver/greatsword-v2').glob('*.webp')):
    box=Image.open(p).getchannel('A').getbbox()
    frames[p.stem]={'file':p.relative_to(root).as_posix(),'box':dict(zip(['x0','y0','x1','y1'],[round(box[0]*1.25),round(box[1]*1.25),round(box[2]*1.25)-1,round(box[3]*1.25)-1]))}
clips={name:{'frames':[frame],'frameMs':260,'impactIndex':0} for name,frame in {
 'ready':'STANCE-READY','defend':'DEFEND','hurt':'HURT','cast':'CAST','buff':'BUFF',
 'aggressive':'STANCE-AGGRESSIVE','defensive':'STANCE-DEFENSIVE','portrait':'PORTRAIT'}.items()}
clips['greatswordAttack']={'frames':order,'frameMs':100,'impactIndex':5}
clips['enterStance']={'frames':['BUFF'],'frameMs':180,'impactIndex':0}
clips['leaveStance']={'frames':['STANCE-READY'],'frameMs':180,'impactIndex':0}
roles={'idle':'ready','attack':'greatswordAttack','defend':'defend','buff':'buff','hurt':'hurt','cast':'cast','stanceActivate':'enterStance','stanceDeactivate':'leaveStance','aggressiveStance':'aggressive','defensiveStance':'defensive','conversation':'ready','portrait':'portrait','menu':'ready','detail':'portrait','dodge':None,'victory':None,'defeat':None,'revive':None}
aliases={'idle':'idle','stand':'menu','attack':'attack',**{f'attack{i}':'attack' for i in range(1,5)},'guard':'defend','shieldGuard':'defend','shieldGuard3':'defend','parry':'defend','shieldBash':'attack','hit':'hurt','power':'buff','cast':'cast','gorefire':'aggressiveStance','bulwark':'defensiveStance','prepared':'defensiveStance','starstoneCharge':'defensiveStance','bloodRite':'buff','prototypeGuardStance':'defensiveStance','prototypeFocusStance':'defensiveStance','defeated':'defeat'}
groups={x['id']:x['members'] for x in coverage['weapons']}
for family,items in {'polearm':['frostSpear'],'axe':['cinderAxe'],'sceptre':['duskChime']}.items():
    groups[family].extend(items)
config={'components':{'weaponGroups':groups,'bindings':[{'classId':'reaver','armourId':'default','rightGroup':'greatsword','leftGroup':'empty','setId':'reaverGreatsword'}],'sets':{'reaverGreatsword':{'normalLungeMs':260,'frames':frames,'clips':clips,'references':roles,'poseRoles':aliases}}}}
(root/'content/config/ui/presentation/equipmentAnimations.json').write_text(json.dumps(config,indent=2)+'\n')
