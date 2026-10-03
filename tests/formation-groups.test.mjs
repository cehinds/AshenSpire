import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { formationGroups, FORMATION_GROUPS_KEY, snapFormationTranslation, formationGroupOptions, positioningConfiguration, FORMATION_SNAP_STEP } from '../src/model/formationGroups.js';
import { presentationConfig } from '../src/model/advancedConfig.js';

const layout = (groups = [], width = 1200, height = 420) => combatFormation({ width, height,
  friends: ['p1','p2','p3','p4','p5','p6'], enemies: ['e1','e2','e3','e4','e5','e6'],
  presentation: { formationColumns: 2, formationRows: 3, formationGroups: JSON.stringify(groups) } });
const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-7, `${a} != ${b}`);
test('a column translates every row and its actors, leaving other columns alone', () => {
  const base = layout(), moved = layout([{ id: 'player-column-0', x: 3, y: -5 }]);
  for (const [i, cell] of moved.cells.entries()) {
    const affected = cell.side === 'player' && cell.column === 0;
    near(cell.x-base.cells[i].x, affected ? 36 : 0);
    near(cell.ground-base.cells[i].ground, affected ? -21 : 0);
  }
  for (const slot of moved.slots) assert.deepEqual({ ...slot, id: '' }, { ...moved.cells.find(c => c.cell === slot.cell), id: '' });
});
test('entire sections and the field translate rigidly and resize proportionally', () => {
  for (const id of ['player', 'enemy', 'all']) for (const width of [390, 1200]) {
    const base = layout([], width), moved = layout([{ id, x: 2, y: -5 }], width);
    for (const [i,c] of moved.cells.entries()) {
      const affected = id === 'all' || c.side === id;
      near(c.x-base.cells[i].x, affected ? width*.02 : 0);
      near(c.ground-base.cells[i].ground, affected ? -21 : 0);
    }
  }
});
test('edge clamping preserves spacing across a whole group', () => {
  const base = layout(), moved = layout([{ id: 'all', x: 100, y: 100 }]);
  const dx = moved.cells[0].x-base.cells[0].x, dy = moved.cells[0].ground-base.cells[0].ground;
  for (const [i,c] of moved.cells.entries()) {
    near(c.x-base.cells[i].x, dx); near(c.ground-base.cells[i].ground, dy);
    assert.ok(c.x >= 0 && c.x <= 1200 && c.ground >= 0 && c.ground <= 420);
  }
});
test('custom groups address stable side, row and local column members', () => {
  const base = layout(), moved = layout([{ id:'custom-one', members:['player:2:0','enemy:2:0'], x:1,y:-1 }]);
  for (const [i,c] of moved.cells.entries()) {
    near(c.x-base.cells[i].x, c.row===2 && c.column===0 ? 12 : 0);
  }
});
test('saved settings round-trip group membership and offsets into the shared layout', () => {
  const groups = [{ id:'custom-team', name:'Bottom pair', members:['player:2:0','player:2:1'], x:3,y:-4 }];
  const presentation = presentationConfig({ [FORMATION_GROUPS_KEY]: JSON.stringify(groups) });
  assert.deepEqual(formationGroups(presentation.formationGroups), groups);
});
test('malformed saved groups fall back safely', () => {
  assert.deepEqual(formationGroups('{broken'), []);
  assert.deepEqual(formationGroups(null), []);
  const [group] = formationGroups([{id:'player',x:Infinity,y:200,members:['invalid','player:1:0']}]);
  assert.equal(group.x,0); assert.equal(group.y,100); assert.deepEqual(group.members,['player:1:0']);
});
test('parent movement retains child offsets regardless of edit order', () => {
  const child = {id:'player-column-0',x:3,y:-5}, parent = {id:'player',x:2,y:-2};
  assert.deepEqual(layout([parent,child]),layout([child,parent]));
  const before=layout([child]), after=layout([parent,child]);
  for(const [i,c] of after.cells.entries()) {
    near(c.x-before.cells[i].x,c.side==='player'?24:0);
    near(c.ground-before.cells[i].ground,c.side==='player'?-8.4:0);
  }
});
test('snapping aligns the group anchor and preserves the spacing of its members', () => {
  const cells = layout().cells.filter(c => c.side==='player');
  for (const step of [5,10,25]) {
    const {dx,dy} = snapFormationTranslation(cells,17,-13,step);
    near((cells[0].x+dx)/step, Math.round((cells[0].x+17)/step));
    near((cells[0].ground+dy)/step, Math.round((cells[0].ground-13)/step));
    for (const c of cells) {
      near((c.x+dx)-(cells[0].x+dx), c.x-cells[0].x);
      near((c.ground+dy)-(cells[0].ground+dy), c.ground-cells[0].ground);
    }
  }
});
test('disabled snapping preserves free movement', () => {
  assert.deepEqual(snapFormationTranslation(layout().cells,3.25,-4.5,0),{dx:3.25,dy:-4.5});
});
test('row controls move only their selected row and individual scaling leaves anchors fixed', () => {
  const base=layout(), moved=layout([{id:'player-row-1',x:2,y:-3},{id:'cell-enemy:2:0',scale:1.5}]);
  for(const [i,c] of moved.cells.entries()) {
    const affected=c.side==='player' && c.row===1;
    near(c.x-base.cells[i].x,affected?24:0);
    near(c.ground-base.cells[i].ground,affected?-12.6:0);
    near(c.characterScale||1,c.side==='enemy'&&c.row===2&&c.column===0?1.5:1);
  }
});
test('test grid presets retain bottom-outside spawn order and expose matching rows', () => {
  for(const [columns,rows] of [[1,1],[2,2],[2,3]]) {
    const count=columns*rows, plan=combatFormation({width:1200,height:500,presentation:{formationColumns:columns,formationRows:rows},friends:Array.from({length:count},(_,i)=>`p${i}`),enemies:Array.from({length:count},(_,i)=>`e${i}`)});
    assert.equal(plan.cells.length,2*count);
    assert.equal(plan.slots[0].cell,`${'ABC'[rows-1]}1`);
    assert.equal(plan.slots[count].cell,`${'ABC'[rows-1]}${columns*2}`);
    assert.equal(formationGroupOptions(columns,[],rows).filter(g=>g.id.startsWith('row-')).length,rows);
  }
});
test('JSON output round trips the positioning settings and defaults to a 50 px grid', () => {
  const groups=[{id:'player-row-1',name:'Player middle row',members:[],x:3,y:-4,scale:1.5}], presentation=presentationConfig({[FORMATION_GROUPS_KEY]:JSON.stringify(groups)}), plan=layout(groups);
  const exported=JSON.parse(JSON.stringify(positioningConfiguration(presentation,{plan,width:1200,height:420,spawnTest:{layout:'2x3'}})));
  assert.equal(FORMATION_SNAP_STEP,50); assert.equal(exported.snapping.stepPx,50);
  assert.deepEqual(presentationConfig(exported.settings),presentation);
  assert.deepEqual(exported.presentation.formationGroups,groups);
  assert.equal(exported.anchors.length,12);assert.equal(exported.spawnTest.layout,'2x3');
});
