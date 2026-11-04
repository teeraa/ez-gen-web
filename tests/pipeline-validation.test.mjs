import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const compiled=ts.transpileModule(fs.readFileSync('src/lib/pipeline-api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const input={characterPrompt:'ตัวละคร',scenePrompt:'ฉาก',visualStyle:'cinematic_realistic',aspectRatio:'9:16',durationSeconds:5,modelId:'violet-motion-2',quality:'standard',idempotencyKey:'fixed-key'};
async function failure(status,payload){
 const requests=[];const context={exports:{},fetch:async(url,options)=>{requests.push({url,options});return {ok:false,status,json:async()=>payload};}};vm.runInNewContext(compiled,context);
 try{await context.exports.pipelineApi.create(input);assert.fail('expected request rejection');}catch(error){assert(error instanceof context.exports.PipelineApiError);assert.equal(requests.length,1);assert.equal(requests[0].url,'/api/proxy/studio-pipelines');assert.deepEqual(JSON.parse(requests[0].options.body),input);return error;}
}
const detail={field:'scenePrompt',reason:'prompt_budget',message:'รายละเอียดฉากและบทพูดรวมกันยาวเกินขีดจำกัด กรุณาย่อฉากหรือบทพูดแล้วลองอีกครั้ง'};
test('actual API rejection carries recognized safe field details and fixed actionable Thai copy',async()=>{
 const error=await failure(400,{code:'VALIDATION_ERROR',message:'generic error',details:[detail]});assert.equal(error.status,400);assert.equal(error.details.length,1);assert.equal(error.details[0].field,'scenePrompt');assert.equal(error.details[0].reason,'prompt_budget');assert.equal(error.details[0].message,detail.message);
});
test('untrusted provider and HTML text never becomes visible error copy even inside recognized details',async()=>{
 const secret='<img onerror=alert(1)> provider account internal-secret';const error=await failure(400,{code:'VALIDATION_ERROR',message:secret,details:[{...detail,message:secret}]});assert.equal(error.details[0].message,detail.message);assert(!JSON.stringify(error).includes('internal-secret'));assert(!error.message.includes(secret));
});
test('malformed, unknown field/reason or oversized detail payloads fall back without raw messages',async()=>{
 for(const details of [null,{},[],[{...detail,field:'providerMessage'}],[{...detail,reason:'provider_error'}],[{...detail,field:'dialogue'}],[{...detail,message:42}],[{...detail,message:'x'.repeat(401)}],Array(9).fill(detail),[{...detail},null]]){
  const error=await failure(400,{code:'VALIDATION_ERROR',message:'private raw',details});assert.equal(error.details.length,0);assert.equal(error.message,'คำขอไม่สำเร็จ');
 }
});
test('recognized-looking details on 500 or other status/code never surface validation messages',async()=>{
 for(const [status,code] of [[500,'VALIDATION_ERROR'],[429,'VALIDATION_ERROR'],[401,'VALIDATION_ERROR'],[400,'INTERNAL_ERROR'],[422,'VALIDATION_ERROR']]){const error=await failure(status,{code,message:'private raw',details:[detail]});assert.equal(error.status,status);assert.equal(error.details.length,0);assert.equal(error.message,'คำขอไม่สำเร็จ');}
});

test('compiler invalid scene option is recognized without displaying backend internals',async()=>{
 const error=await failure(400,{code:'VALIDATION_ERROR',details:[{field:'scenePrompt',reason:'invalid_option',message:'internal compiler message'}]});assert.equal(error.details[0].message,'รายละเอียดฉากไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง');
});


test('finalization uses the proxy and sends only its immutable key',async()=>{
 const requests=[];const context={exports:{},fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({data:{id:'final'}})};}};vm.runInNewContext(compiled,context);
 const response=await context.exports.pipelineApi.finalize('draft/source','immutable-final-key');assert.equal(response.id,'final');assert.equal(requests[0].url,'/api/proxy/studio-pipelines/draft%2Fsource/finalize');assert.deepEqual(JSON.parse(requests[0].options.body),{idempotencyKey:'immutable-final-key'});
});


test('all create request fields report fixed actionable field errors without echoing submitted values',async()=>{
 const fields={
  referenceImageId:['ภาพอ้างอิง',['invalid_uuid','required','invalid_type']],
  characterAssetId:['ตัวละครจากคลัง',['invalid_uuid','required','invalid_type']],
  idempotencyKey:['รหัสคำขอ',['invalid_uuid','required','invalid_type']],
  characterPrompt:['ลักษณะตัวละคร',['required','too_long','invalid_type']],
  scenePrompt:['ฉากและการเคลื่อนไหว',['required','too_long','invalid_type']],
  dialogue:['บทพูด',['required','too_long','invalid_type']],
  visualStyle:['สไตล์ภาพ',['invalid_option','invalid_type']],
  aspectRatio:['สัดส่วนวิดีโอ',['invalid_option','invalid_type']],
  durationSeconds:['ความยาววิดีโอ',['out_of_range','invalid_type']],
  modelId:['โมเดลวิดีโอ',['invalid_option','invalid_type']],
  quality:['คุณภาพวิดีโอ',['invalid_option','invalid_type']],
  draft:['โหมดร่าง',['invalid_type']],
 };
 for(const [field,[label,reasons]] of Object.entries(fields))for(const reason of reasons){
  const error=await failure(400,{code:'VALIDATION_ERROR',message:'private submitted prompt',details:[{field,reason,message:'<script>private submitted prompt</script>'}]});
  assert.equal(error.details.length,1,`${field}/${reason}`);assert.equal(error.details[0].field,field);assert.equal(error.details[0].reason,reason);assert(error.details[0].message.includes(label));assert(!JSON.stringify(error).includes('private submitted prompt'));
 }
});
test('request type and range failures keep bounded fixed Thai recovery messages',async()=>{
 const error=await failure(400,{code:'VALIDATION_ERROR',details:[{field:'durationSeconds',reason:'out_of_range',message:'duration=-123 internal'}, {field:'modelId',reason:'invalid_option',message:'private-model'}, {field:'draft',reason:'invalid_type',message:'private-boolean'}]});
 assert.deepEqual(JSON.parse(JSON.stringify(error.details)),[
  {field:'durationSeconds',reason:'out_of_range',message:'ความยาววิดีโอต้องอยู่ระหว่าง 4 ถึง 15 วินาที'},
  {field:'modelId',reason:'invalid_option',message:'โมเดลวิดีโอไม่รองรับ กรุณาเลือกค่าที่รองรับ'},
  {field:'draft',reason:'invalid_type',message:'ชนิดข้อมูลของโหมดร่างไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง'},
 ]);
 const malformed=await failure(400,{code:'VALIDATION_ERROR',details:[{field:'body',reason:'malformed_json',message:'raw parser diagnostic private'}]});assert.equal(malformed.details[0].message,'รูปแบบคำขอไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง');assert(!JSON.stringify(malformed).includes('raw parser'));
});
test('new validation fields do not broaden unsupported pairs or permit oversized detail lists',async()=>{
 for(const value of [{field:'draft',reason:'invalid_option'}, {field:'durationSeconds',reason:'too_long'}, {field:'body',reason:'invalid_type'}, {field:'modelId',reason:'private_error'}, {field:'__proto__',reason:'invalid_type'}, {field:'constructor',reason:'invalid_type'}]){
  const error=await failure(400,{code:'VALIDATION_ERROR',details:[{...value,message:'private diagnostic'}]});assert.equal(error.details.length,0);
 }
 const valid={field:'draft',reason:'invalid_type',message:'private diagnostic'};
 assert.equal((await failure(400,{code:'VALIDATION_ERROR',details:Array(8).fill(valid)})).details.length,8);
 assert.equal((await failure(400,{code:'VALIDATION_ERROR',details:Array(9).fill(valid)})).details.length,0);
});
