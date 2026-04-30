/**
 * Subagent Lifecycle Coordinator —— 子代理生命周期协调器
 *
 * 职责：
 * - 统一协调 RunnerManager 和 SubagentScheduler
 * - 处理完整的 abort 流程（运行中 + 排队中）
 * - 避免模块间循环依赖
 * - 支持批量操作以提升性能
 */

import { runnerManager } from './manager';
import { SubagentScheduler, subagentScheduler } from './scheduler';
import { MAX_CONCURRENT_RUNNERS, MAX_QUEUE_SIZE } from '../constants';

export interface AbortResult {
  sessionId: string;
  abortedRunningTasks: number;
  removedQueuedTasks: number;
  success: boolean;
  error?: string;
}

export interface BatchAbortResult {
  results: AbortResult[];
  totalAbortedRunning: number;
  totalRemovedQueued: number;
  successCount: number;
  errorCount: number;
}

export class SubagentCoordinator {
  /**
   * 按父会话 ID 终止所有关联的子代理（运行中 + 排队中）。
   *
   * 这是完整的 abort 流程，确保主 agent 停止后：
   * 1. 所有正在运行的子代理被 abort
   * 2. 所有排队中的子代理被移除并 reject
   *
   * @param parentSessionId 父会话 ID
   */
  abortBySession(parentSessionId: string): AbortResult {
    console.log(`[Subagent][Coordinator] Starting abort for parentSessionId: ${parentSessionId}`);

    try {
      // 1. 终止所有正在运行的子代理
      const runningTasksBefore = runnerManager.getActiveTaskIds().filter(taskId => {
        const runner = runnerManager.get(taskId);
        return runner?.parentSessionId === parentSessionId;
      }).length;

      runnerManager.abortBySession(parentSessionId);

      // 2. 从调度器队列中移除所有排队中的相关任务
      const removedQueuedCount = subagentScheduler.removeQueuedBySession(parentSessionId);

      const result: AbortResult = {
        sessionId: parentSessionId,
        abortedRunningTasks: runningTasksBefore,
        removedQueuedTasks: removedQueuedCount,
        success: true
      };

      console.log(
        `[Subagent][Coordinator] Completed abort for parentSessionId: ${parentSessionId}, ` +
        `aborted ${runningTasksBefore} running tasks, removed ${removedQueuedCount} queued tasks`
      );

      return result;
    } catch (error) {
      console.error(`[Subagent][Coordinator] Error aborting session ${parentSessionId}:`, error);
      return {
        sessionId: parentSessionId,
        abortedRunningTasks: 0,
        removedQueuedTasks: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 批量终止多个会话，提升性能
   *
   * @param parentSessionIds 父会话 ID 数组
   * @returns 批量操作结果
   */
  batchAbortBySessions(parentSessionIds: string[]): BatchAbortResult {
    console.log(`[Subagent][Coordinator] Starting batch abort for ${parentSessionIds.length} sessions`);

    const results: AbortResult[] = [];
    let totalAbortedRunning = 0;
    let totalRemovedQueued = 0;
    let successCount = 0;
    let errorCount = 0;

    // 批量收集需要 abort 的运行中任务
    const runningTasksToAbort = new Map<string, string[]>(); // sessionId -> taskIds[]
    parentSessionIds.forEach(sessionId => {
      const taskIds = runnerManager.getActiveTaskIds().filter(taskId => {
        const runner = runnerManager.get(taskId);
        return runner?.parentSessionId === sessionId;
      });
      if (taskIds.length > 0) {
        runningTasksToAbort.set(sessionId, taskIds);
      }
    });

    // 批量 abort 运行中任务
    parentSessionIds.forEach(sessionId => {
      runnerManager.abortBySession(sessionId);
    });

    // 批量处理排队任务
    parentSessionIds.forEach(sessionId => {
      try {
        const runningCount = runningTasksToAbort.get(sessionId)?.length || 0;
        const removedQueuedCount = subagentScheduler.removeQueuedBySession(sessionId);

        const result: AbortResult = {
          sessionId,
          abortedRunningTasks: runningCount,
          removedQueuedTasks: removedQueuedCount,
          success: true
        };

        results.push(result);
        totalAbortedRunning += runningCount;
        totalRemovedQueued += removedQueuedCount;
        successCount++;
      } catch (error) {
        const result: AbortResult = {
          sessionId,
          abortedRunningTasks: 0,
          removedQueuedTasks: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        results.push(result);
        errorCount++;
      }
    });

    const batchResult: BatchAbortResult = {
      results,
      totalAbortedRunning,
      totalRemovedQueued,
      successCount,
      errorCount
    };

    console.log(
      `[Subagent][Coordinator] Completed batch abort: ` +
      `${successCount}/${parentSessionIds.length} sessions processed, ` +
      `${totalAbortedRunning} running tasks aborted, ` +
      `${totalRemovedQueued} queued tasks removed`
    );

    return batchResult;
  }

  /**
   * 终止所有活跃的子代理（运行中 + 排队中）。
   */
  abortAll(): void {
    console.log(`[Subagent][Coordinator] Aborting all subagents`);

    // 1. 终止所有正在运行的子代理
    runnerManager.abortAll();

    // 2. 关闭调度器，这会 reject 所有排队的任务
    subagentScheduler.shutdown();

    console.log(`[Subagent][Coordinator] Completed abort all subagents`);
  }

  /**
   * 获取详细的系统性能指标
   */
  getDetailedSystemStatus() {
    const schedulerMetrics = subagentScheduler.getPerformanceMetrics();
    const runnerDiagnostics = runnerManager.getDiagnostics();

    return {
      // 基础状态
      runningTasks: schedulerMetrics.runningTasks,
      queuedTasks: schedulerMetrics.queuedTasks,
      queuedTasksList: subagentScheduler.getQueuedTasks(),

      // 性能指标
      performance: {
        concurrencyUtilization: `${(schedulerMetrics.utilization * 100).toFixed(1)}%`,
        queueUtilization: `${(schedulerMetrics.queueUtilization * 100).toFixed(1)}%`,
        avgQueueTime: schedulerMetrics.avgQueueTime ? `${schedulerMetrics.avgQueueTime.toFixed(0)}ms` : 'N/A',
        queueThroughput: `${schedulerMetrics.queueThroughput.toFixed(2)} tasks/sec`,
      },

      // 资源使用
      resources: {
        maxConcurrentRunners: MAX_CONCURRENT_RUNNERS,
        maxQueueSize: MAX_QUEUE_SIZE,
        memoryUsage: schedulerMetrics.memoryUsage,
      },

      // 诊断信息
      diagnostics: runnerDiagnostics,

      // 健康状态
      health: {
        isHealthy: schedulerMetrics.utilization < 0.9 && schedulerMetrics.queueUtilization < 0.8,
        warnings: this.getHealthWarnings(schedulerMetrics),
      }
    };
  }

  /**
   * 分析系统健康状况，返回警告信息
   */
  private getHealthWarnings(metrics: ReturnType<SubagentScheduler['getPerformanceMetrics']>): string[] {
    const warnings: string[] = [];

    if (metrics.utilization > 0.9) {
      warnings.push('High concurrency utilization (>90%), consider increasing MAX_CONCURRENT_RUNNERS');
    }

    if (metrics.queueUtilization > 0.8) {
      warnings.push('High queue utilization (>80%), tasks may be rejected');
    }

    if (metrics.avgQueueTime && metrics.avgQueueTime > 30000) {
      warnings.push('High average queue time (>30s), performance degradation detected');
    }

    if (metrics.memoryUsage.abortedSessions > 100) {
      warnings.push('Large number of aborted sessions in memory, cleanup may be needed');
    }

    return warnings;
  }

  /**
   * 获取系统状态摘要（兼容旧版本）
   */
  getSystemStatus() {
    return {
      runningTasks: runnerManager.getActiveTaskIds().length,
      queuedTasks: subagentScheduler.getQueueSize(),
      queuedTasksList: subagentScheduler.getQueuedTasks(),
      runnerDiagnostics: runnerManager.getDiagnostics()
    };
  }

  /**
   * 清理指定会话的资源
   * @param parentSessionId 父会话 ID
   */
  cleanupSession(parentSessionId: string): void {
    subagentScheduler.cleanupSession(parentSessionId);
    console.log(`[Subagent][Coordinator] Cleaned up session: ${parentSessionId}`);
  }
}

/** 全局单例 */
export const subagentCoordinator = new SubagentCoordinator();