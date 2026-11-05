import assert from 'node:assert/strict';
import { mapPoint, nodeX, nodeY } from '../src/model/map/mapview.js';

const regular = { col: 3, floor: 5, type: 'monster' };
assert.deepEqual(mapPoint(regular, 1024), { x: nodeX(3), y: nodeY(5, 1024) });
console.log('PASS native camera retains regular grid geometry');
