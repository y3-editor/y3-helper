function getRandomId() {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

/**
 * 随机生成新的 span 上下文
 * @returns
 */
export function createSpanContext() {
  const randomId = getRandomId();
  return {
    traceId: randomId,
    spanId: randomId,
    parentSpanId: '0',
    flags: '1',
  };
}

export function generateTraceId() {
  const spanContext = createSpanContext();
  return `${spanContext.traceId}:${spanContext.spanId}:${spanContext.parentSpanId}:${spanContext.flags}`;
}
