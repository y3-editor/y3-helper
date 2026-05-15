/**
 * OpenTelemetry stub（Y3 无实际实现）
 *
 * Y3 不需要 OTEL tracing 功能，此文件完全替代 `@opentelemetry/api` 模块，
 * 为 subagent 代码提供类型 + 运行时 noop 实现，避免引入外部依赖。
 *
 * 对外暴露两套接口：
 *  1. Y3 自有的 SafeSpan / startSubagentTaskSpan 等封装
 *  2. 兼容 `@opentelemetry/api` 的 trace / context / Span / Context / SpanStatusCode
 *     （仅 subagent 用到的子集）
 */

// ============================================================
// OTEL 兼容层（子集）
// ============================================================

export interface Span {
  spanContext(): { traceId: string; spanId: string };
  setAttribute(key: string, value: unknown): Span;
  setAttributes(attrs: Record<string, unknown>): Span;
  setStatus(status: { code: number; message?: string } | number, message?: string): Span;
  updateName(name: string): Span;
  addEvent(name: string, attrs?: Record<string, unknown>): Span;
  recordException(err: unknown): Span;
  end(endTime?: number): void;
  isRecording(): boolean;
}

export type Context = unknown;

export const SpanStatusCode = {
  UNSET: 0,
  OK: 1,
  ERROR: 2,
} as const;
export type SpanStatusCode = (typeof SpanStatusCode)[keyof typeof SpanStatusCode];

const createNoopOtelSpan = (): Span => {
  const span: Span = {
    spanContext: () => ({ traceId: '', spanId: '' }),
    setAttribute: () => span,
    setAttributes: () => span,
    setStatus: () => span,
    updateName: () => span,
    addEvent: () => span,
    recordException: () => span,
    end: () => undefined,
    isRecording: () => false,
  };
  return span;
};

const noopTracer = {
  startSpan: (_name: string, _options?: unknown, _ctx?: unknown): Span =>
    createNoopOtelSpan(),
  startActiveSpan: (..._args: unknown[]): unknown => undefined,
};

export const trace = {
  getTracer: (_name?: string, _version?: string) => noopTracer,
  setSpan: (_ctx: Context, _span: Span): Context => undefined,
  getSpan: (_ctx: Context): Span | undefined => undefined,
  getActiveSpan: (): Span | undefined => undefined,
};

export const context = {
  active: (): Context => undefined,
  with: <T>(_ctx: Context, fn: () => T): T => fn(),
};

// ============================================================
// Y3 自有封装
// ============================================================

export interface SafeSpan {
  span: Span;
  setAttribute: (key: string, value: unknown) => void;
  setStatus: (code: number, message?: string) => void;
  end: () => void;
  recordException?: (err: unknown) => void;
}

export interface AssociationProperties {
  [key: string]: unknown;
}

export interface ConversationRoundState {
  submitContext?: unknown;
  association?: AssociationProperties;
}

const createNoopSafeSpan = (): SafeSpan => ({
  span: createNoopOtelSpan(),
  setAttribute: () => undefined,
  setStatus: () => undefined,
  end: () => undefined,
  recordException: () => undefined,
});

export function startSubagentTaskSpan(
  _agentName: string,
  _parentContext: unknown,
  _association?: AssociationProperties,
): SafeSpan {
  return createNoopSafeSpan();
}

export function startToolCallSpan(_options: {
  toolName?: string;
  toolCallId?: string;
  parentContext?: unknown;
  association?: AssociationProperties;
  [key: string]: unknown;
}): SafeSpan {
  return createNoopSafeSpan();
}

export function stopToolCallSpan(
  _span: SafeSpan | undefined,
  _options?: { isError?: boolean; errorMessage?: string; [key: string]: unknown },
): void {
  return undefined;
}

export function startChatSpan(_name: string, _options?: unknown): Span {
  return createNoopOtelSpan();
}

export function stopChatSpan(
  _span: Span | SafeSpan | null | undefined,
  _options?: unknown,
): void {
  return undefined;
}

export function startSpan(
  _name: string,
  _options?: unknown,
  _round?: unknown,
): Span {
  return createNoopOtelSpan();
}

export function applyAssociationAttributes(
  _span: unknown,
  _association?: AssociationProperties,
): void {
  return undefined;
}
