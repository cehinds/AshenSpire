import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settingsRowHtml } from '../src/ui/screens/settings.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('settings retain small segmented choices and use selects before a fifth button can exist', () => {
  for (const count of [1, 2, 3, 4, 5, 8]) {
    const choices = Array.from({length:count},(_,i)=>'option'+i);
    const html = settingsRowHtml({fixture:choices.at(-1)}, {type:'choice',cat:'Combat',key:'fixture',label:'Fixture',choices,def:choices[0]}, {});
    if (count <= 3) {
      assert.equal((html.match(/class="choice(?: on)?"/g)||[]).length,count);
      assert.match(html,/aria-pressed="true"/);
      assert.doesNotMatch(html,/<select/);
    } else {
      assert.match(html,/class="set-choice-select"/);
      assert.equal((html.match(/<option /g)||[]).length,count);
      assert.match(html,new RegExp('value="'+choices.at(-1)+'" selected'));
      assert.doesNotMatch(html,/choice-group|class="choice/);
    }
  }
  const source = read('../src/ui/screens/settings.js');
  assert.equal((source.match(/class="as-seg choice-group"/g)||[]).length,1,'the production segmented-control creator remains singular');
  assert.doesNotMatch(read('../styles/ui.css'),/choice-group[^{}]*:has\([^{}]*button:nth-child\(5\)/,'unreachable large-segment rules must not invalidate every combat button');
});
