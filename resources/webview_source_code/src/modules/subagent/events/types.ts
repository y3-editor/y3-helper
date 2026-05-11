/**
 * TaskEventBus - Subagent 任务事件类型定义
 *
 * 定义了 subagent 任务生命周期中的所有事件类型，
 * 用于事件驱动的完成通知机制。
 *
 * @module subagent/events/types
 */

import type { TaskResult } from '../types';

// =====================
// Event Types
// =====================

/** Task 注册事件 - 当 task tool call 被识别时触发 */
export interface TaskRegisteredEvent {
  type: 'TASK_REGISTERED';
  sessionId: string;
  toolCallId: string;
  agentName: string;
  description?: string;
  timestamp: number;
}

/** Task 开始执行事件 - 当 subagent 开始运行时触发 */
export interface TaskStartedEvent {
  type: 'TASK_STARTED';
  sessionId: string;
  toolCallId: string;
  taskId: string;
  agentName: string;
  timestamp: number;
}

/** Task 完成事件 - 当 subagent 成功完成时触发 */
export interface TaskCompletedEvent {
  type: 'TASK_COMPLETED';
  sessionId: string;
  toolCallId: string;
  taskId: string;
  result: TaskResult;
  timestamp: number;
}

/** Task 失败事件 - 当 subagent 执行失败时触发 */
export interface TaskFailedEvent {
  type: 'TASK_FAILED';
  sessionId: string;
  toolCallId: string;
  taskId?: string;
  error: string;
  timestamp: number;
}

/** Task 超时事件 - 当 task 执行超时时触发 */
export interface TaskTimeoutEvent {
  type: 'TASK_TIMEOUT';
  sessionId: string;
  toolCallId: string;
  taskId?: string;
  elapsed: number;
  timestamp: number;
}

/** Task 取消事件 - 当用户取消 task 时触发 */
export interface TaskCancelledEvent {
  type: 'TASK_CANCELLED';
  sessionId: string;
  toolCallId: string;
  taskId?: string;
  reason?: string;
  timestamp: number;
}

/** Session 内所有 Task 完成事件 */
export interface SessionAllTasksCompleteEvent {
  type: 'SESSION_ALL_TASKS_COMPLETE';
  sessionId: string;
  results: Record<string, TaskResult | { error: string } | { timeout: true }>;
  timestamp: number;
}

/** 所有 Task 事件的联合类型 */
export type TaskEvent =
  | TaskRegisteredEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskTimeoutEvent
  | TaskCancelledEvent
  | SessionAllTasksCompleteEvent;

/** Task 事件类型字符串 */
export type TaskEventType = TaskEvent['type'];

// =====================
// Event Handlers
// =====================

/** 通用事件处理器类型 */
export type TaskEventHandler<T extends TaskEvent = TaskEvent> = (
  event: T,
) => void | Promise<void>;

/** 事件处理器映射 */
export interface TaskEventHandlerMap {
  TASK_REGISTERED?: TaskEventHandler<TaskRegisteredEvent>;
  TASK_STARTED?: TaskEventHandler<TaskStartedEvent>;
  TASK_COMPLETED?: TaskEventHandler<TaskCompletedEvent>;
  TASK_FAILED?: TaskEventHandler<TaskFailedEvent>;
  TASK_TIMEOUT?: TaskEventHandler<TaskTimeoutEvent>;
  TASK_CANCELLED?: TaskEventHandler<TaskCancelledEvent>;
  SESSION_ALL_TASKS_COMPLETE?: TaskEventHandler<SessionAllTasksCompleteEvent>;
  '*'?: TaskEventHandler; // 通配符，接收所有事件
}

// =====================
// Helper Functions
// =====================

/**
 * 创建 TaskRegisteredEvent
 */
export function createTaskRegisteredEvent(
  sessionId: string,
  toolCallId: string,
  agentName: string,
  description?: string,
): TaskRegisteredEvent {
  return {
    type: 'TASK_REGISTERED',
    sessionId,
    toolCallId,
    agentName,
    description,
    timestamp: Date.now(),
  };
}

/**
 * 创建 TaskStartedEvent
 */
export function createTaskStartedEvent(
  sessionId: string,
  toolCallId: string,
  taskId: string,
  agentName: string,
): TaskStartedEvent {
  return {
    type: 'TASK_STARTED',
    sessionId,
    toolCallId,
    taskId,
    agentName,
    timestamp: Date.now(),
  };
}

/**
 * 创建 TaskCompletedEvent
 */
export function createTaskCompletedEvent(
  sessionId: string,
  toolCallId: string,
  taskId: string,
  result: TaskResult,
): TaskCompletedEvent {
  return {
    type: 'TASK_COMPLETED',
    sessionId,
    toolCallId,
    taskId,
    result,
    timestamp: Date.now(),
  };
}

/**
 * 创建 TaskFailedEvent
 */
export function createTaskFailedEvent(
  sessionId: string,
  toolCallId: string,
  error: string,
  taskId?: string,
): TaskFailedEvent {
  return {
    type: 'TASK_FAILED',
    sessionId,
    toolCallId,
    taskId,
    error,
    timestamp: Date.now(),
  };
}

/**
 * 创建 TaskTimeoutEvent
 */
export function createTaskTimeoutEvent(
  sessionId: string,
  toolCallId: string,
  elapsed: number,
  taskId?: string,
): TaskTimeoutEvent {
  return {
    type: 'TASK_TIMEOUT',
    sessionId,
    toolCallId,
    taskId,
    elapsed,
    timestamp: Date.now(),
  };
}

/**
 * 创建 TaskCancelledEvent
 */
export function createTaskCancelledEvent(
  sessionId: string,
  toolCallId: string,
  reason?: string,
  taskId?: string,
): TaskCancelledEvent {
  return {
    type: 'TASK_CANCELLED',
    sessionId,
    toolCallId,
    taskId,
    reason,
    timestamp: Date.now(),
  };
}

/**
 * 创建 SessionAllTasksCompleteEvent
 */
export function createSessionAllTasksCompleteEvent(
  sessionId: string,
  results: Record<string, TaskResult | { error: string } | { timeout: true }>,
): SessionAllTasksCompleteEvent {
  return {
    type: 'SESSION_ALL_TASKS_COMPLETE',
    sessionId,
    results,
    timestamp: Date.now(),
  };
}