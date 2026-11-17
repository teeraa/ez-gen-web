import test from 'node:test';import assert from 'node:assert/strict';
import {parseSseFrames} from '../src/lib/ai-chat-sse.ts';
test('frames split on blank lines, keep the unfinished tail and skip junk',()=>{
 const first=parseSseFrames('event: status\ndata: {"type":"status","label":"อ่าน"}\n\nevent: message\ndata: {"type":"mess');
 assert.deepEqual(first.events,[{type:'status',label:'อ่าน'}]);
 const second=parseSseFrames(first.rest+'age","message":{"id":"1"}}\r\n\r\ndata: not json\n\ndata: {"no":"type"}\n\n');
 assert.deepEqual(second.events,[{type:'message',message:{id:'1'}}]);
 assert.equal(second.rest,'');
});
