import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const sourcePath = path.resolve('src/codemaker/utils/mcpToolArguments.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    strict: true,
  },
  fileName: sourcePath,
});

const sandbox = {
  exports: {},
  module: { exports: {} },
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(transpiled.outputText, sandbox, { filename: 'mcpToolArguments.js' });

const { normalizeMcpToolArguments } = sandbox.module.exports;

function expectOk(input, expected) {
  const result = normalizeMcpToolArguments(input);
  assert.equal(result.ok, true, `expected ok for ${String(input)}`);
  assert.deepEqual(JSON.parse(JSON.stringify(result.value)), expected);
}

function expectError(input, pattern) {
  const result = normalizeMcpToolArguments(input);
  assert.equal(result.ok, false, `expected error for ${String(input)}`);
  assert.match(result.message, pattern);
}

const objectInput = { foo: 1 };
expectOk(undefined, {});
expectOk(null, {});
expectOk('', {});
expectOk('   ', {});
expectOk(objectInput, objectInput);
assert.equal(normalizeMcpToolArguments(objectInput).value, objectInput);
expectOk('{"foo":1,"bar":{"baz":true}}', { foo: 1, bar: { baz: true } });

expectError('{not json}', /not valid JSON/);
expectError('[]', /array/);
expectError('[1,2]', /array/);
expectError('"plain"', /string/);
expectError('123', /number/);
expectError('true', /boolean/);
expectError([], /array/);
expectError(123, /number/);
expectError(true, /boolean/);

console.log('mcp tool arguments fixtures PASS');
