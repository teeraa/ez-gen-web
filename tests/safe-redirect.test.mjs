import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.createSourceFile('session.ts', fs.readFileSync('src/lib/auth/session.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'safeRedirectPath');
assert.ok(declaration, 'test the actual exported session redirect guard');
const emitted = ts.transpileModule(ts.createPrinter().printNode(ts.EmitHint.Unspecified, declaration, source), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const context = { exports: {} };
vm.runInNewContext(emitted, context);
const safe = context.exports.safeRedirectPath;
test('rejects redirects normalized to external authorities and ASCII control whitespace', () => {
  for (const value of ['//evil.test', '/\t/evil.test', '/\n/evil.test', '/\r/evil.test', '/\\evil.test', '/ /evil.test', '/path\u007f', '/path\u0000']) assert.equal(safe(value), '/studio');
});
test('preserves normal same-origin path and query strings', () => {
  for (const value of ['/studio', '/studio/library?page=2', '/studio?name=%20hello', '/studio#result']) assert.equal(safe(value), value);
  assert.equal(safe(null), '/studio');
});
