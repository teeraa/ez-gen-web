import test from 'node:test';
import assert from 'node:assert/strict';
import {PROMPT_TEMPLATES, firstPlaceholder} from '../src/components/ai-chat/prompt-templates.ts';

test('chat prompt templates are fill-in instructions',()=>{
  assert.ok(PROMPT_TEMPLATES.length>=4);
  assert.equal(new Set(PROMPT_TEMPLATES.map(item=>item.id)).size,PROMPT_TEMPLATES.length,'unique ids');
  for(const item of PROMPT_TEMPLATES){
    assert.ok(item.label&&item.hint,item.id);
    assert.ok(item.prompt.length<=2000,`${item.id} fits the message limit`);
    const range=firstPlaceholder(item.prompt);
    assert.ok(range,`${item.id} has a [placeholder]`);
    assert.match(item.prompt.slice(...range),/^\[[^\]]+\]$/);
  }
  assert.equal(firstPlaceholder('no placeholder'),null);
  assert.deepEqual(firstPlaceholder('ยาว [30] วิ'),[4,8]);
});
