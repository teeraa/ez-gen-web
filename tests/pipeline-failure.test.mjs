import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/pipeline-failure.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const copy=context.exports.pipelineFailureMessage;
test('confirmed output-policy rejection explains provider check without guessing a specific violation',()=>{
 const text=copy({status:'failed',failureCode:'PROVIDER_OUTPUT_REJECTED'});assert(text.includes('ปฏิเสธวิดีโอที่สร้างจากการตรวจนโยบายเนื้อหา'));assert(text.includes('ปรับคำอธิบายหรือภาพอ้างอิง'));for(const speculation of ['ลิขสิทธิ์','ใบหน้า','กฎหมาย'])assert(!text.includes(speculation));
});
test('confirmed terminal generation failure differs from uncertain submitted outcome',()=>{
 const failed=copy({status:'failed',failureCode:'PROVIDER_GENERATION_FAILED'}),uncertain=copy({status:'needs_attention',failureCode:'PROVIDER_ERROR'});assert(failed.includes('ยืนยันว่าสร้างวิดีโอไม่สำเร็จ'));assert(uncertain.includes('ยังยืนยันผลการสร้างไม่ได้'));assert(uncertain.includes('ตรวจสอบงานและการใช้งาน'));assert.notEqual(failed,uncertain);
 assert.equal(copy({status:'needs_attention',failureCode:'PROVIDER_OUTPUT_REJECTED'}),uncertain);
});
test('unknown codes and raw provider messages never become visible failure copy',()=>{
 const raw='https://fixture.invalid/private?token=secret <img onerror=alert(1)>';
 const generic=copy({status:'failed',failureCode:null});assert.equal(copy({status:'failed',failureCode:raw,failureMessage:raw}),generic);
 for(const status of ['failed','needs_attention','processing'])for(const failureCode of ['PROVIDER_OUTPUT_REJECTED','PROVIDER_GENERATION_FAILED',raw])assert(!copy({status,failureCode,failureMessage:raw}).includes('token=secret'));
});
