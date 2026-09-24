// The balance simulators grant relics as play does: a relic that grows the
// flask (SPEC flask growth chain, model/flaskgrowth.js) binds the moment it
// is held, so every relic grant in a simulator is followed by syncFlaskGrowth
// — the reward screen, the shop and the event door already do (#1287).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const GRANT = /run\.relics\.push\(|autoTakeChest\(REG/;

for (const tool of ['tools/runsim.mjs', 'tools/measure-classes.mjs']) {
  test(`${tool} syncs flask growth after every relic grant`, () => {
    const lines = readFileSync(new URL(`../${tool}`, import.meta.url), 'utf8').split('\n');
    assert.match(lines.join('\n'), /import \{ syncFlaskGrowth \} from '\.\.\/src\/model\/flaskgrowth\.js'/);
    const grants = lines.map((line, i) => [line, i]).filter(([line]) => GRANT.test(line) && !/^\s*(\/\/|\*|import)/.test(line));
    assert.ok(grants.length >= 3, 'the chest, the boss relic and the treasure relic');
    for (const [line, i] of grants) {
      const after = lines.slice(i, i + 2).join('\n').slice(line.search(GRANT));
      assert.match(after, /syncFlaskGrowth\(REG, run\)/, `${tool}:${i + 1} grants a relic without syncFlaskGrowth: ${line.trim()}`);
    }
  });
}
