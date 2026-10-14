import test from 'node:test';
import assert from 'node:assert/strict';
import {optionalClassSmashAudioProbe as optional,classSmashConsoleNotice as notice} from '../tools/lib/class-smash-qa-notices.mjs';
test('only exact optional sound404 probes are nonblocking; forbidden/server/unknown failures remain errors',()=>{
 const build='http://127.0.0.1:4402/dist/AshenSpire.html',url='http://127.0.0.1:4402/dist/assets/sfx/relic.ogg';
 assert.equal(optional(url,404,build),true);
 for(const status of [403,500,200])assert.equal(optional(url,status,build),false);
 for(const wrong of [url.replace('relic','unknown'),url.replace('/dist/','/wrong/'),url.replace('127.0.0.1','example.com'),url.replace('relic.ogg','relic.ogg/other')])assert.equal(optional(wrong,404,build),false);
 assert.equal(notice('Failed to load resource: the server responded with a status of 404 (File not found)'),'http404-console');
 assert.equal(notice('Failed to load resource: the server responded with a status of 500'),null);
 assert.equal(notice('TypeError: character art failed'),null);
});
