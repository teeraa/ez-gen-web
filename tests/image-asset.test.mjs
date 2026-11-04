import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const source=ts.transpileModule(fs.readFileSync('src/lib/creative-api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{}};vm.runInNewContext(source,context);
const {imageAssetFromJob}=context.exports;
test('saving follows completed job category and raw prompt rather than current composer mode or compiled instructions',()=>{
 const product=imageAssetFromJob({jobId:'product-job',imageCategory:'product',rawPrompt:'Glass perfume bottle',compiledPrompt:'Internal '+ 'x'.repeat(6000)},' Bottle ');
 assert.equal(product.assetType,'prop');assert.equal(product.name,'Bottle');assert.equal(product.jobId,'product-job');assert.equal(product.prompt,'Glass perfume bottle');assert.equal(product.description,product.prompt);
 const legacy=imageAssetFromJob({jobId:'legacy-job',compiledPrompt:'x'.repeat(6000)},'Hero');
 assert.equal(legacy.assetType,'character');assert.equal(legacy.description.length,2000);
 const character=imageAssetFromJob({jobId:'character-job',imageCategory:'character',rawPrompt:'Hero'},'Hero','Product composer draft');
 assert.equal(character.assetType,'character');assert.equal(character.prompt,'Hero');
});
