import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
import { createRenderIntentProjection } from '../src/ui/models/RenderIntentProjectionModel.js';
import { combatIntentPresentation } from '../src/ui/models/CombatIntentModel.js';

function fixture() {
  const profile=resolveGameProfile('ashen.core@1.0.0');
  const registries=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
  const combat=createCombat({registries,rng:createRng(71),gameProfile:profile,combatExpansionVersion:2,
    enemyIds:['wanderingSoldier'],player:{classId:'reaver',hp:100,maxHp:100,maxMana:5,mana:5,maxStamina:5,stamina:5,energyMax:5,drawPerTurn:1,deck:[]}});
  const enemy=combat.enemies[0];
  enemy.intent={kind:'attack',moveId:'slash',damage:8,hits:3,combatProfile:{camp:'physical',maneuver:'attack',range:'melee',damageType:'slashing'}};
  enemy.intentRevealed=true;enemy.proposalIntentRevealedUntil=99;
  combat.player.block=4;delete combat.player.persistentPoise;delete combat.player.persistentWard;delete combat.player.combatStance;
  let calls=0;
  const memo=createRenderIntentProjection({combat,project:(...args)=>{calls++;return projectCombatIntent(...args);}});
  return {combat,enemy,memo,calls:()=>calls,read:()=>memo.project(combat,enemy.id)};
}
const snapshot=combat=>JSON.stringify({player:combat.player,enemies:combat.enemies,queue:combat.queue,eventLog:combat.eventLog,rng:combat.rng.getCounters()});

test('one render shares actual intent among four consumers without mutating fight or RNG',()=>{
  const f=fixture(),before=snapshot(f.combat);
  let shown;
  f.memo.render(()=>{
    shown=f.read();
    for(let i=0;i<3;i++)assert.equal(f.read(),shown);
    const prior=JSON.stringify(shown);
    combatIntentPresentation(shown);
    assert.equal(JSON.stringify(shown),prior,'presentation consumes shared data without changing it');
  });
  assert.equal(f.calls(),1);
  assert.deepEqual(shown,projectCombatIntent(f.combat,f.enemy.id));
  assert.equal(snapshot(f.combat),before);
  assert.notEqual(f.read(),shown,'snapshot/inspector calls outside rendering are not retained');
  assert.notEqual(f.read(),shown);assert.equal(f.calls(),3);
});

test('each render recomputes actual projections after HP, defenses, stance, statuses, moves, profile or visibility change',()=>{
  const f=fixture();
  const changes=[()=>{},()=>{f.combat.player.hp=3;},()=>{f.combat.player.block=30;},
    ()=>{f.combat.player.combatStance={camp:'physical',maneuver:'evade'};},
    ()=>{f.combat.player.statuses.evade={stacks:2,duration:1};},
    ()=>{f.enemy.intent={...f.enemy.intent,damage:15,hits:1};},
    ()=>{f.combat.gameProfile=structuredClone(f.combat.gameProfile);delete f.combat.gameProfile.modules.stances.defenseMitigation;},
    ()=>{delete f.combat.enemyKnowledge;f.enemy.intentRevealed=false;f.enemy.actorIntentRevealed=false;f.enemy.proposalIntentRevealedUntil=0;}];
  let previous;
  for(const change of changes){
    change();const before=snapshot(f.combat),calls=f.calls();
    f.memo.render(()=>{
      const actual=f.read();assert.notEqual(actual,previous);previous=actual;
      assert.deepEqual(actual,projectCombatIntent(f.combat,f.enemy.id));assert.equal(f.read(),actual);
    });
    assert.equal(f.calls(),calls+1);assert.equal(snapshot(f.combat),before);
  }
  assert.equal(previous.hidden,true);assert.equal(previous.projectedDamage,undefined,'old visible damage never survives the visibility gate');
});

test('nested and refused mutations invalidate suspended frames and bypass reads while state changes',()=>{
  const f=fixture();
  f.memo.render(()=>{
    const first=f.read();
    f.memo.render(()=>{
      assert.notEqual(f.read(),first,'nested render owns its own transaction');
      assert.throws(()=>f.memo.mutate(()=>{
        f.combat.player.block=30;
        const during=f.read();assert.deepEqual(during,projectCombatIntent(f.combat,f.enemy.id));
        assert.notEqual(f.read(),during,'no result is retained during mutation');
        f.memo.mutate(()=>{f.combat.player.combatStance={camp:'physical',maneuver:'evade'};});
        dispatch(f.combat,{type:'playCard',cardInstanceId:'does-not-exist'});
      }));
      assert.deepEqual(f.read(),projectCombatIntent(f.combat,f.enemy.id));
    });
    const after=f.read();assert.notEqual(after,first,'outer render cannot resurrect a projection from before dispatch');
    assert.deepEqual(after,projectCombatIntent(f.combat,f.enemy.id));assert.equal(f.read(),after);
  });
});

test('throwing or nested renders release their scope and restore the outer one',()=>{
  const f=fixture();
  f.memo.render(()=>{
    const outer=f.read();assert.throws(()=>f.memo.render(()=>{assert.notEqual(f.read(),outer);throw Error('render refused');}));
    assert.equal(f.read(),outer,'nested scope restoration retains the unchanged outer value');
  });
  assert.throws(()=>f.memo.render(()=>{f.read();throw Error('outer refused');}));
  const calls=f.calls();f.read();f.read();assert.equal(f.calls(),calls+2,'throw did not leave a cache active');
});

test('paced intent snapshot stays distinct from the live post-dispatch projection',()=>{
  const f=fixture(),paced=f.read();
  f.memo.mutate(()=>{f.combat.player.block=100;});
  f.memo.render(()=>{
    const disp={ents:{[f.enemy.id]:{intentPreview:paced}}};
    const displayed=disp.ents[f.enemy.id].intentPreview||f.read();
    assert.equal(displayed,paced);assert.equal(f.calls(),1,'paced snapshot wins without requesting live post-state');
    assert.notDeepEqual(displayed.projectedDamage,f.read().projectedDamage);
  });
});

test('foreign combats and failed projections never enter the transaction cache',()=>{
  const combat={},other={};let calls=0;
  const memo=createRenderIntentProjection({combat,project(){calls++;if(calls===1)throw Error('not ready');return {calls};}});
  memo.render(()=>{
    assert.throws(()=>memo.project(combat,'e1'));
    const shown=memo.project(combat,'e1');assert.equal(memo.project(combat,'e1'),shown);
    assert.notEqual(memo.project(other,'e1'),memo.project(other,'e1'));
    assert.notEqual(memo.project(combat,'e2'),shown);
  });
  assert.equal(calls,5);
});

test('screen gates rendering and every dispatch/direct normalization through the scoped model',()=>{
  const source=readFileSync(new URL('../src/ui/screens/combat.js',import.meta.url),'utf8');
  assert.match(source,/function render\(\) \{\s*return intentProjection.render\(renderBoard\);/);
  assert.match(source,/const dispatch = \(target, intent\) => intentProjection.mutate\(\(\) => memoDispatch\(target, intent\)\)/);
  assert.equal((source.match(/intentProjection.mutate\(\(\) => normalizeClassicPlayerFormationCell\(combat, readSettings\(\)\)\)/g)||[]).length,2);
  assert.doesNotMatch(source,/[^.\w]projectCombatIntent\(combat,/,'UI consumers use the scoped projection wrapper');
  assert.match(source,/disp\?\.ents\[enemy.id\]\?\.intentPreview \|\| intentProjection.project\(combat, enemy.id\)/);
});

test('accepted engine dispatch clears projections within the same render',()=>{
  const f=fixture();
  f.memo.render(()=>{
    const before=f.read();
    f.memo.mutate(()=>dispatch(f.combat,{type:'setReactions',enabled:false}));
    assert.equal(f.combat.player.reactionsEnabled,false);
    const after=f.read();assert.notEqual(after,before);
    assert.deepEqual(after,projectCombatIntent(f.combat,f.enemy.id));assert.equal(f.read(),after);
  });
});

test('a reentrant mutation cannot install the projection that started before it',()=>{
  const combat={value:1};let first=true,memo;
  memo=createRenderIntentProjection({combat,project:()=>{
    const shown={value:combat.value};
    if(first){first=false;memo.mutate(()=>{combat.value=2;});}
    return shown;
  }});
  memo.render(()=>{
    assert.equal(memo.project(combat,'e1').value,1);
    assert.equal(memo.project(combat,'e1').value,2,'pre-mutation result was never installed into the active frame');
  });
});
