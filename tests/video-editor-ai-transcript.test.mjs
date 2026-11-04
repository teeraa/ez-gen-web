import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../src/components/ai-editor/ai-transcript-panel.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('"react/jsx-runtime"',JSON.stringify(new URL(`file://${require.resolve('react/jsx-runtime')}`).href)).replace('import styles from "./ai-editor.module.css";','const styles={};');
const {AiTranscriptPanel}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const raw={assetId:'a',hasSpeech:true,text:'ต้นฉบับผิดเพี้ยน',segments:[{start:1,end:3,text:'ต้นฉบับผิดเพี้ยน',words:[]}]};
const render=job=>renderToStaticMarkup(createElement(AiTranscriptPanel,{job,assets:[{id:'a',name:'คลิปหนึ่ง'}]}));
test('refined speech is visible while concepts still processing and original stays in native disclosure',()=>{
 const html=render({stage:'visual_analysis',status:'processing',transcripts:[{...raw,refinement:{text:'บทพูดเรียบเรียง',segments:[{segmentIndex:0,text:'บทพูดเรียบเรียง',uncertain:false}]}}]});
 assert.match(html,/บทพูดที่ AI เรียบเรียง/);assert.match(html,/0:01.0–0:03.0/);assert.match(html,/เสียงต้นฉบับยังเหมือนเดิม/);
 assert(html.indexOf('บทพูดเรียบเรียง')<html.indexOf('<details'));
 assert.match(html,/<summary>ต้นฉบับจากการถอดเสียง<\/summary>/);assert.match(html,/ต้นฉบับผิดเพี้ยน/);
});
test('pending, legacy, empty, silence and uncertainty have truthful labels',()=>{
 assert.equal(render({stage:'transcribing',status:'processing',transcripts:[]}), '');
 const pending=render({stage:'transcribing',status:'processing',transcripts:[raw]});assert.match(pending,/กำลังเรียบเรียง/);assert.doesNotMatch(pending,/บทพูดที่ AI เรียบเรียง/);
 const legacy=render({stage:'review',status:'review',transcripts:[raw]});assert.match(legacy,/ยังไม่มีฉบับที่ AI เรียบเรียง/);
 assert.match(render({stage:'concepts',status:'processing',transcripts:[{...raw,hasSpeech:false,text:'',segments:[]}]}),/ไม่พบเสียงพูดในคลิปนี้/);
 assert.match(render({stage:'concepts',status:'processing',transcripts:[{...raw,refinement:{text:raw.text,segments:[{segmentIndex:0,text:raw.text,uncertain:true}]}}]}),/คำไม่ชัดเจน · คงข้อความต้นฉบับ/);
});
