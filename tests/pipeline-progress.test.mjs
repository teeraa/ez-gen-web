import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const source = ts.transpileModule(fs.readFileSync('src/lib/pipeline-progress.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(source, context);
const { getPipelineProgress: progress } = context.exports;
const stages = ['image', 'save_character', 'video', 'save_video'];

test('queued stages have no fabricated active progress; processing advances only confirmed prior stages', () => {
 for (const [index, stage] of stages.entries()) {
  const queued = progress({ status: 'queued', stage });
  assert.equal(queued.completed, index);
  assert.equal(queued.stages[index].state, 'waiting');
  const processing = progress({ status: 'processing', stage });
  assert.equal(processing.completed, index);
  assert.equal(processing.percent, index * 25);
  assert.equal(processing.stages[index].state, 'active');
  assert.equal(processing.stages.filter(item => item.state === 'complete').length, index);
 }
});
test('failures and attention preserve prior completions and identify the interrupted step', () => {
 for (const status of ['failed', 'needs_attention']) for (const [index, stage] of stages.entries()) {
  const result = progress({status, stage});
  assert.equal(result.completed, index);
  assert.equal(result.stages[index].state, status);
  assert.ok(result.percent < 100);
 }
});
test('only succeeded done confirms all four steps; anomalous done and unknown states never imply success', () => {
 assert.equal(progress({status:'succeeded',stage:'done'}).percent, 100);
 for (const status of ['queued','processing','failed','needs_attention','unknown']) {
  assert.equal(progress({status,stage:'done'}).percent, 0);
  assert.equal(progress({status,stage:'unknown'}).percent, 0);
 }
 assert.equal(progress({status:'unknown',stage:'save_video'}).percent, 0);
});
test('persisted assets confirm completed creation steps without claiming final save success', () => {
 assert.equal(progress({status:'processing',stage:'save_character',characterAssetId:'character'}).completed, 2);
 assert.equal(progress({status:'failed',stage:'save_video',videoAssetId:'video'}).completed, 3);
 assert.equal(progress({status:'needs_attention',stage:'done',videoAssetId:'video'}).percent, 75);
});
