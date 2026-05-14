import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
process.env.AI_REQUEST_TIMEOUT_MS = '600000';
process.env.AI_MAX_OUTPUT_TOKENS = '16384';

const { streamChatCompletion } = await import('./ai-provider.mjs');

const UPSTREAM_DELAY_MS = 65_000;
let upstreamAborted = false;
let upstreamBody = '';

const upstream = http.createServer((req, res) => {
  req.setEncoding('utf8');
  req.on('data', chunk => { upstreamBody += chunk; });
  req.on('aborted', () => { upstreamAborted = true; });
  req.on('end', () => {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"ok"},"index":0}]}' + '\n\n');
      res.write('data: [DONE]' + '\n\n');
      res.end();
    }, UPSTREAM_DELAY_MS);
  });
});

upstream.listen(0, '127.0.0.1');
await once(upstream, 'listening');
const { port } = upstream.address();

const chunks = [];
let ended = false;
const done = new Promise(resolve => {
  const fakeRes = {
    headersSent: false,
    writableEnded: false,
    writeHead() {
      this.headersSent = true;
    },
    write(chunk) {
      chunks.push(String(chunk));
    },
    end(chunk) {
      if (chunk) chunks.push(String(chunk));
      this.writableEnded = true;
      ended = true;
      resolve();
    },
  };

  const started = Date.now();
  streamChatCompletion({
    api_key: 'test-key',
    base_url: `http://127.0.0.1:${port}/v1`,
    model: 'kimi-k2.6',
    messages: [{ role: 'user', content: 'wait longer than sixty seconds' }],
    max_tokens: 32768,
  }, fakeRes).catch(error => {
    chunks.push(String(error?.stack || error));
    resolve();
  });

  fakeRes._started = started;
});

const started = Date.now();
await done;
const elapsed = Date.now() - started;
upstream.close();
await once(upstream, 'close');

assert.equal(ended, true);
assert.equal(upstreamAborted, false, 'client aborted the upstream request before the delayed response');
assert.ok(elapsed >= UPSTREAM_DELAY_MS, `expected to wait for delayed upstream response, elapsed=${elapsed}`);
assert.ok(chunks.join('').includes('[DONE]'));
const parsed = JSON.parse(upstreamBody);
assert.equal(parsed.stream, true);
assert.equal(parsed.max_tokens, 16384);
console.log(`ai-provider timeout test passed after ${elapsed}ms`);
