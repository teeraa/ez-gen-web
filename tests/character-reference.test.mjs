import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const source = ts.transpileModule(fs.readFileSync('src/lib/character-reference.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} }; vm.runInNewContext(source, context);
const { validateReferenceFile: validate, maxReferenceBytes: max } = context.exports;
test('reference validation accepts supported formats within limit and rejects empty, oversized and unsupported files', () => {
 for (const type of ['image/png','image/jpeg','image/webp']) assert.equal(validate({type,size:max}), null);
 for (const input of [{type:'image/gif',size:100}, {type:'image/png',size:0}, {type:'image/png',size:max+1}]) assert.equal(typeof validate(input), 'string');
});
