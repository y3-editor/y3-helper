import assert from 'node:assert/strict';
import {
  applyContextWindowPolicy,
  applyOutputTokenPolicy,
  applyRequestPolicy,
  getRequestPolicy,
  getRequestTimeoutMs,
  measureJsonPayload,
} from './request-policy.mjs';

assert.equal(getRequestTimeoutMs({}), 60000);
assert.equal(getRequestTimeoutMs({ AI_REQUEST_TIMEOUT_MS: '600000' }), 600000);
assert.equal(getRequestTimeoutMs({ AI_CHAT_COMPLETION_TIMEOUT_MS: '450000' }), 450000);

assert.deepEqual(getRequestPolicy({}), {
  maxOutputTokens: 0,
  contextWindowTokens: 0,
  largePayloadBytes: 1048576,
});
assert.deepEqual(getRequestPolicy({ AI_MAX_OUTPUT_TOKENS: '16384', AI_CONTEXT_WINDOW_SIZE: '262144' }), {
  maxOutputTokens: 16384,
  contextWindowTokens: 262144,
  largePayloadBytes: 1048576,
});

{
  const original = { model: 'kimi-k2.6', messages: [{ role: 'user', content: 'hi' }], stream: true };
  const { body, metrics } = applyOutputTokenPolicy(original, { env: {} });
  assert.equal(body.max_tokens, undefined);
  assert.equal(metrics.appliedMaxTokens, undefined);
  assert.equal(metrics.defaultedMaxTokens, false);
  assert.equal(metrics.payloadBytes, measureJsonPayload(body).payloadBytes);
}

{
  const { body, metrics } = applyOutputTokenPolicy(
    { model: 'kimi-k2.6', messages: [], max_tokens: 32768, stream: true },
    { env: { AI_MAX_OUTPUT_TOKENS: '16384' } },
  );
  assert.equal(body.max_tokens, 16384);
  assert.equal(metrics.cappedMaxTokens, true);
}

{
  const { body, metrics } = applyOutputTokenPolicy(
    { model: 'kimi-k2.6', messages: [], stream: true },
    { env: { AI_MAX_OUTPUT_TOKENS: '8192' } },
  );
  assert.equal(body.max_tokens, 8192);
  assert.equal(metrics.defaultedMaxTokens, true);
}

{
  const largeText = 'x'.repeat(1024 * 1024);
  const { metrics } = applyOutputTokenPolicy({ model: 'kimi-k2.6', messages: [{ role: 'user', content: largeText }], stream: true }, { env: {} });
  assert.equal(metrics.largePayload, true);
  assert.ok(metrics.payloadBytes > 1024 * 1024);
}

{
  const { body } = applyOutputTokenPolicy(
    { model: 'resp', max_output_tokens: 32768, stream: true },
    { maxTokenField: 'max_output_tokens', env: { AI_MAX_OUTPUT_TOKENS: '12000' } },
  );
  assert.equal(body.max_output_tokens, 12000);
}

{
  const body = {
    model: 'kimi-k2.6',
    messages: [
      { role: 'system', content: 'keep system' },
      { role: 'user', content: 'old'.repeat(1000) },
      { role: 'assistant', content: 'old answer'.repeat(1000) },
      { role: 'user', content: 'latest' },
    ],
    stream: true,
  };
  const { body: trimmed, metrics } = applyContextWindowPolicy(body, { env: { AI_CONTEXT_WINDOW_SIZE: '100' } });
  assert.equal(trimmed.messages[0].role, 'system');
  assert.equal(trimmed.messages.at(-1).content, 'latest');
  assert.ok(metrics.trimmedMessages > 0);
  assert.ok(metrics.approxTokens <= 100);
}

{
  const { body } = applyRequestPolicy(
    { model: 'kimi-k2.6', messages: [{ role: 'user', content: 'hi' }], max_tokens: 32768, stream: true },
    { env: { AI_MAX_OUTPUT_TOKENS: '16384', AI_CONTEXT_WINDOW_SIZE: '262144' } },
  );
  assert.equal(body.max_tokens, 16384);
}

console.log('request-policy tests passed');
