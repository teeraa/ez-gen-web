// Test helper: the CommonJS build of src/lib/api-envelope.ts, for suites that load a lib
// file into a vm context and have to answer its require() calls themselves.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/api-envelope.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);

export const envelopeExports = context.exports;
const names = new Set(['./api-envelope.ts', './api-envelope', '@/lib/api-envelope']);

/** require() for a vm context; only the envelope module is available. */
export function requireEnvelope(name) {
  if (names.has(name)) return envelopeExports;
  throw new Error(`Unexpected module ${name}`);
}
