/**
 * OpenTelemetry attribute keys stub for Y3Helper.
 *
 * Y3 does NOT emit telemetry. All attribute constants are empty strings so
 * that span.setAttribute('', ...) calls become no-ops through the Span stub
 * in ./otel.ts (which also ignores setAttribute).
 *
 * These symbols exist only to keep upstream code compiling when it imports
 * attribute keys for OTel span enrichment.
 */

// ============ GenAI semantic attributes ============
export const GEN_AI_OPERATION_NAME = '';
export const GEN_AI_AGENT_NAME = '';
export const GEN_AI_CONVERSATION_ID = '';
export const GEN_AI_REQUEST_MODEL = '';

// ============ Subagent / Agent attributes ============
export const AGENT_TASK_ID = '';
export const AGENT_PARENT_SESSION_ID = '';
export const AGENT_MAX_STEPS = '';
export const AGENT_ACTUAL_STEPS = '';
export const AGENT_IS_TRUNCATED = '';
export const AGENT_CURRENT_STEP = '';
export const AGENT_RETRY_COUNT = '';
export const AGENT_RESULT_SYNCED_TO_PARENT = '';
export const AGENT_FINAL_STEPS = '';
export const AGENT_SYNC_STEP = '';
export const AGENT_SYNC_MESSAGE_COUNT = '';
export const AGENT_SYNC_IS_FINAL = '';
export const AGENT_SYNC_IS_ERROR_SYNC = '';
export const AGENT_BUILTIN = '';

// ============ Error attributes ============
export const ERROR_TYPE = '';

// ============ GenAI operation name enum ============
export const GenAiOperationName = {
  InvokeAgent: 'invoke_agent',
  Chat: 'chat',
  EmbedText: 'embed_text',
  ExecuteTool: 'execute_tool',
} as const;
export type GenAiOperationName =
  (typeof GenAiOperationName)[keyof typeof GenAiOperationName];
