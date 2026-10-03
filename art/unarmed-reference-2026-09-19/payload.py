"""Build the physical half of shared unarmed runtime configuration."""
from pathlib import Path
import json, shutil, sys

PACK=Path(__file__).resolve().parent
ROOT=PACK.parents[1]
art=json.loads((PACK/'manifest.json').read_text(encoding='utf-8'))
if '--runtime' in sys.argv: assert not art['coverage']['missing'], 'Refuse partial runtime coverage'
base=json.loads((ROOT/'content/config/ui/presentation/equipmentAnimations.json').read_text(encoding='utf-8'))['components']['motionProfiles']['greatswordTwoHand']
roles={
    'idle':'Ready','attack':'Attack','defend':'Defend','hurt':'Hurt','stanceActivate':'EnterStance',
    'stanceDeactivate':'LeaveStance','aggressiveStance':'Aggressive','defensiveStance':'Defensive',
    'conversation':'Conversation','portrait':'Portrait','menu':'Ready','detail':'Portrait',
    'dodge':None,'victory':None,'defeat':None,'revive':None}
poses={'Ready':['STANCE-READY'],'Attack':art['sequence'],'Defend':['DEFEND'],'Hurt':['HURT'],
       'Cast':['CAST'],'Buff':['BUFF'],'EnterStance':['BUFF'],'LeaveStance':['STANCE-READY'],
       'Aggressive':['STANCE-AGGRESSIVE'],'Defensive':['STANCE-DEFENSIVE'],
       'Portrait':['PORTRAIT'],'Conversation':['CONVERSATION']}
clips={'physical'+name:{'frames':frames,'frameMs':art['frameMs'] if name=='Attack' else 260,
                       'impactIndex':5 if name=='Attack' else 0} for name,frames in poses.items()}
sets={}
for group in art['groups']:
    frames={}
    for pose,record in group['frames'].items():
        file=f"assets/animations/unarmed/{group['id']}/{pose}.webp"
        x0,y0,x1,y1=record['bounds']
        frames[pose]={'file':file,'box':{'x0':round(x0*1.25),'y0':round(y0*1.25),'x1':round(x1*1.25)-1,'y1':round(y1*1.25)-1}}
        if '--runtime' in sys.argv:
            target=ROOT/file;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(PACK/record['file'],target)
    sets[group['id']+'Unarmed']={'frames':frames}
fragment={'schemaVersion':1,'motionProfile':'unarmed','ownedRoles':list(roles),
          'profileDefaults':{'normalLungeMs':260,'poseRoles':base['poseRoles']},'clips':clips,
          'references':{role:'physical'+name if name else None for role,name in roles.items()},
          'fallbackReferences':{'cast':'physicalCast','buff':'physicalBuff'},'sets':sets,
          'bindings':[{'classId':r['classId'],'armourId':r['armourId'],'rightGroup':'empty','leftGroup':'empty',
                       'setId':r['appearanceId']+'Unarmed'} for r in art['expansion'] if r['appearanceId']+'Unarmed' in sets]}
(PACK/'runtime-fragment.json').write_text(json.dumps(fragment,indent=2)+'\n',encoding='utf-8')
print(f"Physical payload: {len(sets)} appearances / {len(fragment['bindings'])} bindings")
