const DEFAULT_REQUEST_TIMEOUT_MS = 60 * 1000;
const DEFAULT_LARGE_PAYLOAD_BYTES = 1024 * 1024;

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseOptionalPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function getRequestTimeoutMs(env = process.env) {
  const configured = env.AI_REQUEST_TIMEOUT_MS ?? env.AI_CHAT_COMPLETION_TIMEOUT_MS;
  return parsePositiveInteger(configured, DEFAULT_REQUEST_TIMEOUT_MS);
}

export function getRequestPolicy(env = process.env) {
  return {
    maxOutputTokens: parseOptionalPositiveInteger(env.AI_MAX_OUTPUT_TOKENS),
    contextWindowTokens: parseOptionalPositiveInteger(env.AI_CONTEXT_WINDOW_SIZE ?? env.AI_CONTEXT_WINDOW_TOKENS),
    largePayloadBytes: parsePositiveInteger(env.AI_LARGE_PAYLOAD_BYTES, DEFAULT_LARGE_PAYLOAD_BYTES),
  };
}

export function measureJsonPayload(body) {
  const json = JSON.stringify(body ?? {});
  const payloadBytes = Buffer.byteLength(json, 'utf8');
  return {
    json,
    payloadBytes,
    approxTokens: Math.ceil(payloadBytes / 4),
  };
}

export function applyOutputTokenPolicy(body, { maxTokenField = 'max_tokens', env = process.env } = {}) {
  const policy = getRequestPolicy(env);
  const nextBody = { ...(body ?? {}) };
  const rawRequested = nextBody[maxTokenField];
  const requested = Number(rawRequested);
  const hasValidRequested = Number.isFinite(requested) && requested > 0;
  const configuredMax = policy.maxOutputTokens;

  let appliedMaxTokens = hasValidRequested ? Math.floor(requested) : undefined;
  let cappedMaxTokens = false;
  let defaultedMaxTokens = false;

  if (configuredMax > 0) {
    if (hasValidRequested) {
      const normalized = Math.min(Math.floor(requested), configuredMax);
      nextBody[maxTokenField] = normalized;
      appliedMaxTokens = normalized;
      cappedMaxTokens = Math.floor(requested) !== normalized;
    } else {
      nextBody[maxTokenField] = configuredMax;
      appliedMaxTokens = configuredMax;
      defaultedMaxTokens = true;
    }
  }

  const after = measureJsonPayload(nextBody);
  return {
    body: nextBody,
    metrics: {
      payloadBytes: after.payloadBytes,
      approxTokens: after.approxTokens,
      largePayload: after.payloadBytes >= policy.largePayloadBytes,
      largePayloadBytes: policy.largePayloadBytes,
      maxTokenField,
      requestedMaxTokens: hasValidRequested ? Math.floor(requested) : undefined,
      appliedMaxTokens,
      configuredMaxOutputTokens: configuredMax || undefined,
      cappedMaxTokens,
      defaultedMaxTokens,
      changedMaxTokens: cappedMaxTokens || defaultedMaxTokens,
    },
  };
}

export function applyContextWindowPolicy(body, { env = process.env } = {}) {
  const policy = getRequestPolicy(env);
  const contextWindowTokens = policy.contextWindowTokens;
  const before = measureJsonPayload(body);

  if (contextWindowTokens <= 0 || !Array.isArray(body?.messages) || before.approxTokens <= contextWindowTokens) {
    return {
      body,
      metrics: {
        contextWindowTokens: contextWindowTokens || undefined,
        trimmedMessages: 0,
        payloadBytes: before.payloadBytes,
        approxTokens: before.approxTokens,
      },
    };
  }

  const nextBody = { ...body, messages: [...body.messages] };
  let trimmedMessages = 0;
  let current = before;

  while (current.approxTokens > contextWindowTokens && nextBody.messages.length > 1) {
    const lastIndex = nextBody.messages.length - 1;
    const removeIndex = nextBody.messages.findIndex((message, index) => index < lastIndex && message?.role !== 'system');
    if (removeIndex === -1) {
      break;
    }
    nextBody.messages.splice(removeIndex, 1);
    trimmedMessages += 1;
    current = measureJsonPayload(nextBody);
  }

  return {
    body: nextBody,
    metrics: {
      contextWindowTokens,
      trimmedMessages,
      payloadBytes: current.payloadBytes,
      approxTokens: current.approxTokens,
    },
  };
}

export function applyRequestPolicy(body, { maxTokenField = 'max_tokens', env = process.env } = {}) {
  const output = applyOutputTokenPolicy(body, { maxTokenField, env });
  const context = applyContextWindowPolicy(output.body, { env });
  return {
    body: context.body,
    metrics: {
      ...output.metrics,
      ...context.metrics,
      maxTokenField: output.metrics.maxTokenField,
      requestedMaxTokens: output.metrics.requestedMaxTokens,
      appliedMaxTokens: output.metrics.appliedMaxTokens,
      configuredMaxOutputTokens: output.metrics.configuredMaxOutputTokens,
      cappedMaxTokens: output.metrics.cappedMaxTokens,
      defaultedMaxTokens: output.metrics.defaultedMaxTokens,
      changedMaxTokens: output.metrics.changedMaxTokens,
      largePayload: context.metrics.payloadBytes >= output.metrics.largePayloadBytes,
      largePayloadBytes: output.metrics.largePayloadBytes,
    },
  };
}

export function formatRequestSummary({ model, timeoutMs, stream, metrics }) {
  const parts = [
    `model=${model || 'unknown'}`,
    `timeout=${timeoutMs}ms`,
    `stream=${Boolean(stream)}`,
    `payload=${metrics.payloadBytes} bytes`,
    `approx_tokens=${metrics.approxTokens}`,
    `${metrics.maxTokenField}=${metrics.appliedMaxTokens ?? 'unchanged'}`,
  ];
  if (metrics.configuredMaxOutputTokens) {
    parts.push(`max_output_config=${metrics.configuredMaxOutputTokens}`);
  }
  if (metrics.contextWindowTokens) {
    parts.push(`context_window=${metrics.contextWindowTokens}`);
  }
  if (metrics.trimmedMessages) {
    parts.push(`trimmed_messages=${metrics.trimmedMessages}`);
  }
  return parts.join(' ');
}
