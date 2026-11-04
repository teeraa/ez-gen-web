import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const source = ts.transpileModule(fs.readFileSync('src/lib/character-design.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(source, context);
const { restoreCharacterDraft: restore } = context.exports;
test('public draft retains user brief, style, mood, format and ratio through sign-in', () => {
  const draft = { version: 1, prompt: 'ตัวละครทดสอบ', aspectRatio: '16:9', visualStyle: 'clay', mood: 'mysterious', designFormat: 'turnaround' };
  const result = restore(JSON.stringify(draft));
  for (const key of ['prompt', 'aspectRatio', 'visualStyle', 'mood', 'designFormat']) assert.equal(result[key], draft[key]);
});
test('legacy plain-text drafts remain readable and invalid enum values cannot become new options', () => {
  assert.equal(restore('นักสำรวจ').prompt, 'นักสำรวจ');
  assert.equal(restore(JSON.stringify({ version: 1, prompt: 'นักสำรวจ', mood: 'invalid' })).mood, 'neutral');
  assert.equal(restore(JSON.stringify({ version: 9, prompt: 'future' })), null);
});

test('reference draft restores only unexpired UUID metadata, never a preview URL', () => {
 const draft = { version: 1, prompt: 'hero', referenceImageId: '12345678-1234-1234-1234-123456789abc', referenceName: 'hero.png', referenceExpiresAt: '2099-01-01T00:00:00Z', referencePreview: 'blob:private' };
 const restored = restore(JSON.stringify(draft));
 assert.equal(restored.referenceImageId, draft.referenceImageId);
 assert.equal(restored.referenceName, draft.referenceName);
 assert.equal(restored.referencePreview, undefined);
 assert.equal(restore(JSON.stringify({...draft, referenceExpiresAt: '2000-01-01'})).referenceImageId, undefined);
 assert.equal(restore(JSON.stringify({...draft, referenceImageId: 'https://external/image'})).referenceImageId, undefined);
});

test('product guest draft survives reload without character-only format; legacy drafts default to character', () => {
 const product = restore(JSON.stringify({version:1,category:'product',prompt:'Glass perfume bottle',visualStyle:'cinematic_realistic',mood:'confident',designFormat:'turnaround'}));
 assert.equal(product.category,'product');assert.equal(product.mood,'confident');assert.equal(product.designFormat,undefined);
 assert.equal(restore(JSON.stringify({version:1,prompt:'Legacy hero'})).category,'character');
 const options=context.exports.imageDesignOptions('product',{visualStyle:'clay',mood:'warm',designFormat:'full_body'});
 assert.equal(Object.hasOwn(options,'designFormat'),false);assert.equal(options.category,'product');
 assert.equal(context.exports.imageDesignOptions('character',{designFormat:'portrait'}).designFormat,'portrait');
});
