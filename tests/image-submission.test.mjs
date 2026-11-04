import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const source = ts.transpileModule(fs.readFileSync('src/lib/image-submission.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(source, context);
const { prepareImageSubmission: prepare, restoreImageSubmission: restore } = context.exports;
const input = { prompt: 'Original character', aspectRatio: '3:4', referenceImageId: 'reference-id' };
const oldJob = { jobId: 'old', status: 'succeeded' };
test('lost variation POST response reuses key and immutable inputs despite old completed job', () => {
  const attempt = prepare(null, input, oldJob, () => 'first');
  const retry = prepare(attempt, { prompt: 'Edited', aspectRatio: '1:1' }, oldJob, () => 'WRONG');
  assert.equal(retry.key, 'first');
  assert.equal(retry.signature, JSON.stringify(input));
  const reloaded = restore(JSON.stringify(retry));
  assert.equal(prepare(reloaded, input, oldJob, () => 'WRONG').key, 'first');
  assert.deepEqual(JSON.parse(reloaded.signature), input);
});
test('confirmed POST followed by lost GET response reuses key until matching job terminal', () => {
  const attempt = { ...prepare(null, input, oldJob, () => 'first'), jobId: 'new' };
  assert.equal(prepare(attempt, input, oldJob, () => 'WRONG').key, 'first');
  assert.equal(prepare(restore(JSON.stringify(attempt)), input, { jobId: 'old', status: 'failed' }, () => 'WRONG').key, 'first');
  assert.equal(prepare(attempt, input, { jobId: 'new', status: 'processing' }, () => 'WRONG').key, 'first');
  assert.equal(prepare(attempt, input, { jobId: 'new', status: 'succeeded' }, () => 'second').key, 'second');
  assert.equal(prepare(attempt, input, { jobId: 'new', status: 'failed' }, () => 'retry-failed').key, 'retry-failed');
});
test('malformed persisted payload cannot be submitted', () => {
  assert.equal(restore('{bad'), null);
  assert.equal(restore(JSON.stringify({ key: 'key', signature: '{}' })), null);
});
test('tag edits after an ambiguous submission retain all original billed options across reload', () => {
  const original = { ...input, visualStyle: 'anime', mood: 'warm', designFormat: 'full_body' };
  const attempt = prepare(null, original, null, () => 'tags-first');
  const restored = restore(JSON.stringify(attempt));
  const retry = prepare(restored, { ...original, visualStyle: 'clay', mood: 'serious', designFormat: 'turnaround' }, null, () => 'WRONG');
  assert.equal(retry.key, 'tags-first');
  assert.deepEqual(JSON.parse(retry.signature), original);
  const next = prepare({ ...attempt, jobId: 'tags-job' }, { ...original, visualStyle: 'clay' }, { jobId: 'tags-job', status: 'succeeded' }, () => 'tags-next');
  assert.equal(next.key, 'tags-next');
  assert.equal(JSON.parse(next.signature).visualStyle, 'clay');
});
test('legacy pending payload and unknown future fields are retained without adding new defaults', () => {
  const legacy = { ...prepare(null, input, null, () => 'legacy'), futureMetadata: { schema: 2 } };
  const restored = restore(JSON.stringify(legacy));
  assert.equal(restored.signature, JSON.stringify(input));
  assert.equal(restored.futureMetadata.schema, 2);
  const futureInput = { ...input, visualStyle: 'future_style', futureSetting: true };
  const future = prepare(null, futureInput, null, () => 'future');
  assert.deepEqual(JSON.parse(restore(JSON.stringify(future)).signature), futureInput);
});

test('ambiguous product request freezes category and product options across reload and mode edits', () => {
 const product={prompt:'Glass bottle',aspectRatio:'1:1',category:'product',visualStyle:'cinematic_realistic',mood:'confident'};
 const attempt=prepare(null,product,null,()=> 'product-key');
 const retry=prepare(restore(JSON.stringify(attempt)),{...product,category:'character',designFormat:'portrait',mood:'serious'},null,()=> 'WRONG');
 assert.equal(retry.key,'product-key');assert.deepEqual(JSON.parse(retry.signature),product);
 assert.equal(restore(JSON.stringify({...attempt,signature:JSON.stringify({...product,designFormat:'portrait'})})),null);
 assert.equal(restore(JSON.stringify({...attempt,signature:JSON.stringify({...product,category:'unknown'})})),null);
});

test('stale capabilities allow legacy character but block product including an immutable pending product under a character toggle',()=>{
 const {imageSubmissionCategory, imageCategoryAvailable}=context.exports;
 assert.equal(imageCategoryAvailable('character',undefined),true);
 assert.equal(imageCategoryAvailable('product',undefined),false);
 assert.equal(imageCategoryAvailable('product',['character']),false);
 assert.equal(imageCategoryAvailable('product',['character','product']),true);
 const product={prompt:'Bottle',aspectRatio:'1:1',category:'product'};
 const pending=prepare(null,product,oldJob,()=> 'frozen-product');
 assert.equal(imageSubmissionCategory(pending,'character',oldJob),'product');
 assert.equal(imageCategoryAvailable(imageSubmissionCategory(pending,'character',oldJob),undefined),false);
 assert.equal(imageSubmissionCategory({...pending,jobId:'done'},'character',{jobId:'done',status:'succeeded'}),'character');
});
