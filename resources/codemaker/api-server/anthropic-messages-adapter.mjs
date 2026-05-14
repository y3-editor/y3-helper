import Anthropic from '@anthropic-ai/sdk';

const INTERNAL_REQUEST_FIELDS = new Set([
  'app_id',
  'app_key',
  'api_key',
  'base_url',
  'api_base_url',
  'backend',
  'session_id',
  'codebase_chat_mode',
  'prompt_construct',
  'extra_body',
  'messages',
  'stream',
  'n',
  'logprobs',
  'top_logprobs',
  'response_format',
  'seed',
  'frequency_penalty',
  'presence_penalty',
  'tools',
  'tool_choice',
]);

const SAFE_PASSTHROUGH_FIELDS = new Set([
  'model',
  'metadata',
  'service_tier',
  'thinking',
  'top_k',
  'top_p',
]);

export function buildAnthropicClient({ apiKey, baseUrl, timeout } = {}) {
  return new Anthropic({
    apiKey,
    baseURL: normalizeAnthropicBaseUrl(baseUrl),
    timeout,
  });
}

export function normalizeAnthropicBaseUrl(baseUrl = '') {
  const normalized = String(baseUrl).replace(/\/+$/, '');
  if (normalized.endsWith('/v1/messages')) {
    return normalized.slice(0, -'/v1/messages'.length);
  }
  if (normalized.endsWith('/messages')) {
    return normalized.slice(0, -'/messages'.length);
  }
  if (normalized.endsWith('/v1')) {
    return normalized.slice(0, -'/v1'.length);
  }
  return normalized;
}

export function buildAnthropicMessagesRequest(requestBody = {}, { model, baseUrl } = {}) {
  const body = {};

  for (const [key, value] of Object.entries(requestBody)) {
    if (!INTERNAL_REQUEST_FIELDS.has(key) && SAFE_PASSTHROUGH_FIELDS.has(key) && value !== undefined) {
      body[key] = value;
    }
  }

  const { system, messages } = convertMessages(requestBody.messages || []);
  body.messages = messages;
  body.model = model || requestBody.model || defaultAnthropicModelForBaseUrl(baseUrl);
  body.max_tokens = normalizePositiveInteger(requestBody.max_tokens ?? requestBody.max_completion_tokens, 4096);

  if (system.length === 1) {
    body.system = system[0].text || '';
  } else if (system.length > 1) {
    body.system = system;
  }

  if (requestBody.temperature !== undefined) {
    const temperature = Number(requestBody.temperature);
    if (Number.isFinite(temperature)) {
      body.temperature = Math.max(0, Math.min(1, Number(temperature.toFixed(2))));
    }
  }

  if (requestBody.stop !== undefined) {
    body.stop_sequences = Array.isArray(requestBody.stop) ? requestBody.stop : [requestBody.stop];
  }

  const tools = convertTools(requestBody.tools);
  if (tools.length > 0) {
    body.tools = tools;
  }

  const toolChoice = convertToolChoice(requestBody.tool_choice);
  if (toolChoice) {
    body.tool_choice = toolChoice;
  }

  return body;
}

export function convertAnthropicMessageToOpenAI(message = {}) {
  const content = [];
  const toolCalls = [];

  for (const block of message.content || []) {
    if (block.type === 'text' && block.text) {
      content.push(block.text);
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name || '',
          arguments: JSON.stringify(block.input ?? {}),
        },
      });
    }
  }

  const choice = {
    index: 0,
    message: {
      role: 'assistant',
      content: content.join(''),
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    },
    finish_reason: message.stop_reason === 'tool_use' || toolCalls.length > 0 ? 'tool_calls' : 'stop',
  };

  return {
    id: message.id || 'anthropic-' + Date.now(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: message.model,
    choices: [choice],
    usage: convertUsage(message.usage),
  };
}

export function convertAnthropicStreamEventToOpenAISSE(event, state = createAnthropicStreamState()) {
  if (!event || !event.type) {
    return null;
  }

  switch (event.type) {
    case 'message_start':
      state.messageId = event.message?.id || state.messageId;
      state.model = event.message?.model || state.model;
      state.stopReason = event.message?.stop_reason || state.stopReason;
      return null;

    case 'content_block_start': {
      const block = event.content_block || {};
      state.blocks.set(event.index, block);
      if (block.type !== 'tool_use') {
        return null;
      }
      state.hasToolUse = true;
      const id = block.id || `tool-${event.index}`;
      state.toolIds.set(event.index, id);
      return sseData(state, {
        delta: {
          content: null,
          tool_calls: [{
            index: event.index || 0,
            id,
            type: 'function',
            function: {
              name: block.name || '',
              arguments: '',
            },
          }],
        },
        finish_reason: null,
      });
    }

    case 'content_block_delta': {
      const delta = event.delta || {};
      if (delta.type === 'text_delta') {
        return sseData(state, {
          delta: { content: delta.text || '', tool_calls: null },
          finish_reason: null,
        });
      }
      if (delta.type === 'input_json_delta') {
        state.hasToolUse = true;
        return sseData(state, {
          delta: {
            content: null,
            tool_calls: [{
              index: event.index || 0,
              function: { arguments: delta.partial_json || '' },
            }],
          },
          finish_reason: null,
        });
      }
      return null;
    }

    case 'message_delta':
      state.stopReason = event.delta?.stop_reason || state.stopReason;
      return null;

    case 'message_stop': {
      const finishReason = state.hasToolUse || state.stopReason === 'tool_use' ? 'tool_calls' : 'stop';
      return `${sseData(state, { delta: { content: '', tool_calls: null }, finish_reason: finishReason })}data: [DONE]\n\n`;
    }

    default:
      return null;
  }
}

export function createAnthropicStreamState() {
  return {
    messageId: 'anthropic-' + Date.now(),
    model: undefined,
    stopReason: undefined,
    hasToolUse: false,
    blocks: new Map(),
    toolIds: new Map(),
  };
}

export function normalizeProviderError(error, { status, baseUrl } = {}) {
  const responseStatus = status || error?.status || error?.response?.status || 500;
  const rawMessage = extractErrorMessage(error);
  const isKimiAccessError = responseStatus === 403 && /kimi|access_terminated_error|terminated|permission|forbidden/i.test(`${baseUrl || ''} ${rawMessage}`);
  const message = isKimiAccessError
    ? `Kimi/Anthropic-compatible provider access was rejected (${responseStatus}). ${rawMessage}`
    : rawMessage;

  return {
    status: responseStatus,
    message,
    raw: rawMessage,
  };
}


function defaultAnthropicModelForBaseUrl(baseUrl = '') {
  try {
    const url = new URL(String(baseUrl));
    if (url.hostname === 'api.kimi.com' && url.pathname.startsWith('/coding')) {
      return 'kimi-for-coding';
    }
  } catch {
    // Fall through to the generic Anthropic default.
  }
  return 'claude-3-5-sonnet-latest';
}

function convertMessages(messages) {
  const system = [];
  const converted = [];

  for (const msg of messages) {
    if (!msg) {
      continue;
    }

    if (msg.role === 'system') {
      const parts = convertContentParts(msg.content, { role: 'system' }).filter(part => part.type === 'text');
      system.push(...parts);
      continue;
    }

    if (msg.role === 'tool') {
      converted.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id || msg.id || 'tool-call',
          content: stringifyContent(msg.content),
          ...(msg.is_error ? { is_error: true } : {}),
        }],
      });
      continue;
    }

    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const content = [];
    const textParts = convertContentParts(msg.content, { role });
    content.push(...textParts);

    if (role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const toolCall of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id || `tool-${content.length}`,
          name: toolCall.function?.name || '',
          input: parseToolArguments(toolCall.function?.arguments),
        });
      }
    }

    converted.push({ role, content: simplifyContent(content) });
  }

  return { system, messages: converted };
}

function convertContentParts(content, { role } = {}) {
  if (content == null) {
    return [];
  }
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : [];
  }
  if (!Array.isArray(content)) {
    return [{ type: 'text', text: stringifyContent(content) }];
  }

  const parts = [];
  for (const part of content) {
    if (!part) {
      continue;
    }
    if (part.type === 'text' || part.type === 'input_text' || part.type === 'output_text') {
      parts.push({ type: 'text', text: part.text || '' });
    } else if (part.type === 'image_url' || part.type === 'input_image') {
      const url = part.image_url?.url || part.image_url || part.url;
      const image = convertImageUrl(url);
      if (image) {
        parts.push(image);
      }
    } else if (part.type === 'tool_use' && role === 'assistant') {
      parts.push({
        type: 'tool_use',
        id: part.id,
        name: part.name,
        input: part.input || {},
      });
    } else if (part.type === 'tool_result') {
      parts.push({
        type: 'tool_result',
        tool_use_id: part.tool_use_id,
        content: stringifyContent(part.content),
        ...(part.is_error ? { is_error: true } : {}),
      });
    }
  }
  return parts;
}

function convertImageUrl(url) {
  if (!url) {
    return null;
  }
  if (typeof url === 'string' && url.startsWith('data:')) {
    const match = url.match(/^data:([^;,]+);base64,(.+)$/);
    if (match) {
      return {
        type: 'image',
        source: { type: 'base64', media_type: match[1], data: match[2] },
      };
    }
  }
  return {
    type: 'image',
    source: { type: 'url', url: typeof url === 'string' ? url : String(url) },
  };
}

function simplifyContent(content) {
  if (content.length === 1 && content[0].type === 'text') {
    return content[0].text;
  }
  return content;
}

function convertTools(tools) {
  if (!Array.isArray(tools)) {
    return [];
  }

  return tools.map(tool => {
    if (tool?.type === 'function' && tool.function) {
      return {
        name: tool.function.name,
        description: tool.function.description || '',
        input_schema: tool.function.parameters || { type: 'object', properties: {} },
      };
    }
    if (tool?.name && tool?.input_schema) {
      return tool;
    }
    return null;
  }).filter(Boolean);
}

function convertToolChoice(toolChoice) {
  if (!toolChoice || toolChoice === 'auto') {
    return undefined;
  }
  if (toolChoice === 'none') {
    return { type: 'none' };
  }
  if (toolChoice === 'required') {
    return { type: 'any' };
  }
  if (toolChoice.type === 'function' && toolChoice.function?.name) {
    return { type: 'tool', name: toolChoice.function.name };
  }
  if (toolChoice.type && toolChoice.name) {
    return toolChoice;
  }
  return undefined;
}

function parseToolArguments(args) {
  if (args == null || args === '') {
    return {};
  }
  if (typeof args !== 'string') {
    return args;
  }
  try {
    return JSON.parse(args);
  } catch {
    return { _raw: args };
  }
}

function stringifyContent(content) {
  if (content == null) {
    return '';
  }
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sseData(state, choice) {
  const converted = {
    id: state.messageId || 'anthropic-' + Date.now(),
    choices: [{
      ...choice,
      index: 0,
    }],
  };
  return `data: ${JSON.stringify(converted)}\n\n`;
}

function convertUsage(usage) {
  if (!usage) {
    return undefined;
  }
  return {
    prompt_tokens: usage.input_tokens,
    completion_tokens: usage.output_tokens,
    total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
  };
}

function extractErrorMessage(error) {
  if (!error) {
    return 'Unknown provider error';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error.error?.message) {
    return error.error.message;
  }
  if (error.message) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
