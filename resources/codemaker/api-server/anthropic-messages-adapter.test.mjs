import assert from 'node:assert/strict';
import {
  buildAnthropicMessagesRequest,
  convertAnthropicMessageToOpenAI,
  convertAnthropicStreamEventToOpenAISSE,
  createAnthropicStreamState,
  normalizeProviderError,
} from './anthropic-messages-adapter.mjs';

function parseSSEJson(frame) {
  const line = frame.split('\n').find(line => line.startsWith('data: ') && line !== 'data: [DONE]');
  return JSON.parse(line.slice('data: '.length));
}

const request = buildAnthropicMessagesRequest({
  app_id: 'internal',
  app_key: 'secret',
  api_key: 'secret',
  base_url: 'https://api.example.com',
  api_base_url: 'https://api.example.com',
  backend: 'internal',
  session_id: 's1',
  prompt_construct: {},
  extra_body: {},
  model: 'kimi-for-coding',
  max_tokens: 123,
  temperature: 0.42,
  stop: 'END',
  messages: [
    { role: 'system', content: 'Be precise.' },
    { role: 'user', content: [
      { type: 'text', text: 'Look' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
    ]},
    { role: 'assistant', content: 'Calling', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{"q":"abc"}' } }] },
    { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true}' },
  ],
  tools: [{ type: 'function', function: { name: 'lookup', description: 'Find', parameters: { type: 'object', properties: { q: { type: 'string' } } } } }],
});

assert.equal(request.model, 'kimi-for-coding');
assert.equal(request.max_tokens, 123);
assert.equal(request.system, 'Be precise.');
assert.equal(request.messages[0].role, 'user');
assert.equal(request.messages[0].content[1].type, 'image');
assert.equal(request.messages[1].content[1].type, 'tool_use');
assert.deepEqual(request.messages[1].content[1].input, { q: 'abc' });
assert.equal(request.messages[2].content[0].type, 'tool_result');
assert.equal(request.tools[0].input_schema.properties.q.type, 'string');
assert.equal(request.app_id, undefined);
assert.equal(request.extra_body, undefined);
assert.deepEqual(request.stop_sequences, ['END']);

const state = createAnthropicStreamState();
assert.equal(convertAnthropicStreamEventToOpenAISSE({ type: 'message_start', message: { id: 'msg_1', model: 'm' } }, state), null);
const text = parseSSEJson(convertAnthropicStreamEventToOpenAISSE({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } }, state));
assert.equal(text.choices[0].delta.content, 'Hi');
const toolStart = parseSSEJson(convertAnthropicStreamEventToOpenAISSE({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_1', name: 'lookup', input: {} } }, state));
assert.equal(toolStart.choices[0].delta.tool_calls[0].id, 'toolu_1');
assert.equal(toolStart.choices[0].delta.tool_calls[0].function.arguments, '');
const toolArgs = parseSSEJson(convertAnthropicStreamEventToOpenAISSE({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"q"' } }, state));
assert.deepEqual(Object.keys(toolArgs.choices[0].delta.tool_calls[0]), ['index', 'function']);
assert.equal(toolArgs.choices[0].delta.tool_calls[0].function.arguments, '{"q"');
convertAnthropicStreamEventToOpenAISSE({ type: 'message_delta', delta: { stop_reason: 'tool_use' } }, state);
const stopFrame = convertAnthropicStreamEventToOpenAISSE({ type: 'message_stop' }, state);
assert.match(stopFrame, /"finish_reason":"tool_calls"/);
assert.match(stopFrame, /data: \[DONE\]/);

const completion = convertAnthropicMessageToOpenAI({ id: 'msg_2', model: 'm', stop_reason: 'tool_use', content: [{ type: 'text', text: 'Use' }, { type: 'tool_use', id: 'toolu_2', name: 'lookup', input: { q: 'x' } }], usage: { input_tokens: 1, output_tokens: 2 } });
assert.equal(completion.choices[0].message.tool_calls[0].function.arguments, '{"q":"x"}');
assert.equal(completion.choices[0].finish_reason, 'tool_calls');
assert.equal(completion.usage.total_tokens, 3);

const err = normalizeProviderError({ status: 403, message: 'access_terminated_error' }, { baseUrl: 'https://api.kimi.com/coding/' });
assert.equal(err.status, 403);
assert.match(err.message, /Kimi\/Anthropic-compatible provider access/);

console.log('anthropic adapter fixtures PASS');
