import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { seedAfterChange, SEED_KEY } from '../src/model/settingsDefaults.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=source.indexOf('async function persistSettingsChange(changed)');
const end=source.indexOf('\nconst quickMenuControls =',start);
const grid='gameConfig.presentation.showFormationGrid';

test('a thrown settings save restores live preference and cannot leak into a later successful write',async()=>{
  assert.ok(start>=0&&end>start);
  let stored={settings:{[grid]:true,[SEED_KEY]:{[grid]:true}}},fail=true;
  const painted=[];
  const context={structuredClone,seedAfterChange,SEED_KEY,run:null,xpCombat:null,
    activeMeta:null,activeSettings:null,app:{},
    STAT_ROWS_CHANGED_MEANING:/$^/,STAT_ROWS_MARKER:'unused',STAT_ROWS_VERSION:1,
    saves:{profileStatus:()=>({quarantined:false}),loadMeta:()=>structuredClone(stored),
      saveMeta:async meta=>{if(fail)throw new Error('storage interrupted');stored=structuredClone(meta);return{ok:true};}},
    applyDisplaySettings:settings=>painted.push(structuredClone(settings)),
    refreshHudQuickSettings(){},showSettingsNotice(){},QUARANTINE_NOTICE:'save refused',remountMapIfShowing(){},
  };
  const persist=runInNewContext(source.slice(start,end)+'\npersistSettingsChange;',context);
  const refused=await persist({[grid]:false});
  assert.equal(refused.ok,false);
  assert.equal(context.activeSettings[grid],true,'live state rolls back');
  assert.equal(painted.at(-1)[grid],true,'grid reflects the durable value');
  fail=false;
  await persist({musicEnabled:false});
  assert.equal(stored.settings[grid],true,'a later successful preference never saves the refused grid state');
  assert.equal(stored.settings.musicEnabled,false);
  await persist({[grid]:false});
  assert.equal(stored.settings[grid],false,'successful grid writes still persist');
});
