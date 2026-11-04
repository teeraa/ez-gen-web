import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{},Intl};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/dialogue-timing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const warn=context.exports.mayExceedThaiDialogueDuration;

test('a short greeting fits while a clearly long Thai script benefits from a longer video',()=>{
 assert.equal(warn('สวัสดีค่ะ ยินดีต้อนรับค่ะ',5),false);
 const long='วันนี้เราจะพาคุณมารู้จักผลิตภัณฑ์ใหม่ที่ออกแบบมาเพื่อทุกคน พร้อมเล่ารายละเอียดวิธีใช้งานและคุณสมบัติที่น่าสนใจ';
 assert.equal(warn(long,5),true);
 assert.equal(warn(long,15),false);
});
test('combining tone marks and display punctuation do not manufacture extra speaking units',()=>{
 const base='ก'.repeat(35),marked='ก้'.repeat(35);
 assert.equal(warn(base,5),false);assert.equal(warn(marked,5),false);
 const dense='ก้'.repeat(64);
 assert.equal(warn(dense,5),true);
 assert.equal(warn(`“${dense}”\n\n!!!`,5),true);
 assert.equal(warn(`“${marked}”\n\n!!!`,5),false);
});
test('mixed Latin speech counts with Thai while English-only input remains unchanged',()=>{
 const words='new product launch details benefits instructions features today '.repeat(3);
 assert.equal(warn(words,5),false);
 assert.equal(warn(`สวัสดี ${words}`,5),true);
 assert.equal(warn(`สวัสดี ${words}`,15),false);
});
test('empty, punctuation-only and unsupported duration values never warn',()=>{
 for(const text of ['', '  \n ', '“”?!', '123456789', '\u0e48\u0e49'])assert.equal(warn(text,5),false);
 for(const duration of [0,-1,NaN,Infinity])assert.equal(warn('ก'.repeat(100),duration),false);
});
