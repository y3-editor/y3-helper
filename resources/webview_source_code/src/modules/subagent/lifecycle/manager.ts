/**
 * RunnerManager —— Subagent 运行时生命周期管理器
 *
 * 职责：
 * - 管理活跃 Runner 的注册与移除
 * - 封装工具结果的 Promise 等待与分发
 * - 完全独立于 Zustand/Immer，避免 freeze 问题
 *
 * 设计决策：
 * - 使用原生 class + Map，不经过 Immer 代理
 * - waitForTool 和 resolveToolResult 在同一个类中闭环，
 *   消除了之前 store action 和 runner 文件之间的分散逻辑
 */

import { TOOL_TIMEOUT_MS } from '../constants';
import type { SubagentRunnerState, PendingToolCall } from '../types';

/** AcceptEdit 结果等待结构 */
interface PendingAcceptEdit {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  toolCallId: string;
  startTime: number;
  timeoutId: NodeJS.Timeout;
}

/** Terminal 命令工具名 */
const TERMINAL_CMD_FUNCTION = 'run_terminal_cmd';

/** Terminal 终态列表 —— 收到这些状态才可以 resolve */
const TERMINAL_FINAL_STATUSES = new Set(['Success', 'Failed', 'Abort']);

export class RunnerManager {
  private runners = new Map<string, SubagentRunnerState>();

  /** 等待 ACCEPT_EDIT_RESULT 的 pending map */
  private pendingAcceptResults = new Map<string, PendingAcceptEdit>();

  /**
   * 注册一个活跃的 Runner
   */
  register(taskId: string, state: SubagentRunnerState): void {
    this.runners.set(taskId, state);
  }

  /**
   * 移除已完成的 Runner
   */
  remove(taskId: string): void {
    this.runners.delete(taskId);
  }

  /**
   * 获取指定 Runner
   */
  get(taskId: string): SubagentRunnerState | undefined {
    return this.runners.get(taskId);
  }

  /**
   * 检查是否存在指定 Runner
   */
  has(taskId: string): boolean {
    return this.runners.has(taskId);
  }

  /**
   * 诊断工具：获取所有活跃 runner 的详细状态
   * 用于排查工具调用卡住问题
   */
  getDiagnostics(): {
    activeRunners: Array<{
      taskId: string;
      agentName: string;
      pendingToolsCount: number;
      pendingTools: Array<{
        toolId: string;
        toolName: string;
        startTime: number;
        waitingMs: number;
      }>;
    }>;
    pendingAcceptEditsCount: number;
  } {
    const activeRunners = Array.from(this.runners.entries()).map(([taskId, runner]) => ({
      taskId,
      agentName: runner.agentName,
      pendingToolsCount: runner.pendingToolResults.size,
      pendingTools: Array.from(runner.pendingToolResults.entries()).map(([toolId, pending]) => ({
        toolId,
        toolName: pending.toolName,
        startTime: pending.startTime,
        waitingMs: Date.now() - pending.startTime,
      })),
    }));

    return {
      activeRunners,
      pendingAcceptEditsCount: this.pendingAcceptResults.size,
    };
  }

  /**
   * 格式化单个 runner 的诊断信息
   */
  // public formatRunnerDiagnostic(runner: any, index: number): void {
  //   const hasStuckTools = runner.pendingTools.some((tool: any) => tool.waitingMs > 30000);
  //   const statusIcon = hasStuckTools ? '🔴' : '🟢';

  //   console.log(`${statusIcon} [Runner ${index + 1}] TaskId: ${runner.taskId} (${runner.agentName})`);
  //   runner.pendingTools.forEach((tool: any) => {
  //     const waitingSeconds = Math.floor(tool.waitingMs / 1000);
  //     const timeIcon = tool.waitingMs > 30000 ? '⚠️' : '⏱️';
  //     console.log(`    ${timeIcon} ${tool.toolId} (${tool.toolName}) - waiting ${waitingSeconds}s`);
  //   });
  // }

  /**
   * 打印详细诊断信息到控制台
   */
  // printDiagnostics(): void {
  //   const diagnostics = this.getDiagnostics();
  //   console.log('🔍 === Subagent Diagnostics ===');
  //   console.log(`Active Runners: ${diagnostics.activeRunners.length}`);
  //   console.log(`Pending Accept Edits: ${diagnostics.pendingAcceptEditsCount}`);

  //   if (diagnostics.activeRunners.length === 0) {
  //     console.log('✅ No active subagents');
  //   } else {
  //     diagnostics.activeRunners.forEach((runner, index) => {
  //       console.log(''); // Empty line for readability
  //       this.formatRunnerDiagnostic(runner, index);
  //     });
  //   }
  // }

  /**
   * 强制清理指定 taskId 的所有 pending 工具（调试用）
   */
  forceClearPendingTools(taskId: string): number {
    const runner = this.runners.get(taskId);
    if (!runner) {
      return 0;
    }

    const count = runner.pendingToolResults.size;

    // 清理所有 pending 工具并 reject
    runner.pendingToolResults.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Force cleared by diagnostic tool`));
    });

    runner.pendingToolResults.clear();
    if (count > 0) {
      console.log(`[Subagent] Force cleared ${count} pending tools for taskId: ${taskId}`);
    }

    return count;
  }

  /**
   * 获取所有活跃 Runner 的 taskId 列表（用于 UI 可观测性）
   */
  getActiveTaskIds(): string[] {
    return Array.from(this.runners.keys());
  }

  /**
   * 按父会话 ID 终止所有关联的子代理。
   * 由 onStop 调用，确保主 agent 停止后所有子代理立即被 abort。
   */
  abortBySession(parentSessionId: string): void {
    this.runners.forEach((state) => {
      if (state.parentSessionId === parentSessionId) {
        state.abortController.abort();
      }
    });
  }

  /**
   * 终止所有活跃的子代理。
   */
  abortAll(): void {
    this.runners.forEach((state) => {
      state.abortController.abort();
    });
  }

  /**
   * 等待 IDE 返回指定 tool_id 的工具结果。
   *
   * 注册一个 PendingToolCall 到 runner 的 pendingToolResults Map 上，
   * 当 resolveToolResult 被调用时完成该 Promise。
   * 超时后自动 reject 并清理，防止永久挂起。
   *
   * @param taskId - 子代理任务 ID
   * @param toolId - 工具调用 ID
   * @param abortSignal - 中止信号，用于提前 reject
   * @param toolName - 工具名称，用于超时错误信息
   * @param toolArguments - 工具调用参数（JSON 字符串），用于事件记录
   * @param timeout - 超时时间（毫秒），默认 TOOL_TIMEOUT_MS
   * @returns 工具执行结果
   */
  waitForTool(
    taskId: string,
    toolId: string,
    abortSignal: AbortSignal,
    toolName: string,
    timeout: number = TOOL_TIMEOUT_MS,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (abortSignal.aborted) {
        reject(new Error('Subagent aborted while waiting for tool result'));
        return;
      }

      const runner = this.runners.get(taskId);
      if (!runner) {
        reject(new Error(`No active runner found for task_id: ${taskId}`));
        return;
      }

      // 设置超时定时器
      const timeoutId = setTimeout(() => {
        runner.pendingToolResults.delete(toolId);
        reject(new Error(`Tool ${toolName} timed out after ${timeout}ms`));
      }, timeout);

      // 创建 PendingToolCall 结构体
      const pending: PendingToolCall = {
        resolve,
        reject,
        toolName,
        startTime: Date.now(),
        timeoutId,
      };

      // 检查是否已存在相同的 toolId（并发冲突检测）
      if (runner.pendingToolResults.has(toolId)) {
        const existingPending = runner.pendingToolResults.get(toolId);
        console.error(`[Subagent] ${taskId} CRITICAL: tool_id collision detected: ${toolId} already exists!`);
        console.error(`[Subagent] ${taskId} existing pending tool:`, {
          toolName: existingPending?.toolName,
          startTime: existingPending?.startTime,
          waitingMs: existingPending ? Date.now() - existingPending.startTime : 0,
        });
        console.error(`[Subagent] ${taskId} new tool:`, {
          toolName,
          startTime: Date.now(),
        });

        // 拒绝新的工具调用，防止覆盖现有的 pending 回调
        reject(new Error(
          `Tool ID collision detected: ${toolId} already exists for taskId: ${taskId}. ` +
          `Existing tool: ${existingPending?.toolName}, New tool: ${toolName}. ` +
          `This usually indicates a race condition or duplicate tool calls.`
        ));
        return;
      }

      // 注册到 runner
      runner.pendingToolResults.set(toolId, pending);

      // 监听 abort 事件，提前 reject 并清理
      const onAbort = () => {
        clearTimeout(pending.timeoutId);
        runner.pendingToolResults.delete(toolId);
        reject(new Error('Subagent aborted while waiting for tool result'));
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * 分发工具调用结果到对应的 Runner。
   *
   * 由 CodeChat.tsx 的 TOOL_CALL_RESULT 事件路由调用，
   * 将结果传递给 waitForTool 创建的 Promise。
   *
   * 对于 run_terminal_cmd，IDE 会分多次推送 TOOL_CALL_RESULT（START/RUNNING/SUCCESS/FAILED）。
   * 只有收到终态（SUCCESS/FAILED/ABORT）时才 resolve，避免用空结果提前结束等待。
   *
   * @param taskId - 子代理任务 ID
   * @param data - IDE 返回的工具调用结果数据
   */
  resolveToolResult(taskId: string, data: any): void {
    const runner = this.runners.get(taskId);
    if (!runner) {
      console.warn(`[Subagent] No active runner found for task_id: ${taskId}`);
      return;
    }

    const toolId = data?.tool_id;
    if (!toolId) {
      console.warn(
        `[Subagent] TOOL_CALL_RESULT missing tool_id for task_id: ${taskId}`,
      );
      return;
    }

    const pending = runner.pendingToolResults.get(toolId);
    if (!pending) {
      // 增强日志：显示当前 runner 的所有 pending tools，便于调试并发问题
      const allPendingIds = Array.from(runner.pendingToolResults.keys());
      console.error(
        `[Subagent] CRITICAL: No pending tool result callback for tool_id: ${toolId}, task_id: ${taskId}. ` +
        `This tool result will be LOST! ` +
        `Current pending tool_ids: [${allPendingIds.join(', ')}]`
      );
      return;
    }

    // terminal 命令特殊处理：等待终态才 resolve
    if (pending.toolName === TERMINAL_CMD_FUNCTION) {
      const terminalStatus = data?.extra?.terminalStatus as string | undefined;
      if (!terminalStatus || !TERMINAL_FINAL_STATUSES.has(terminalStatus)) {
        // 还未到达终态，忽略此次中间推送，继续等待
        // 重置超时计时器，避免中间推送被误判超时
        clearTimeout(pending.timeoutId);
        pending.timeoutId = setTimeout(() => {
          runner.pendingToolResults.delete(toolId);
          pending.reject(
            new Error(
              `Tool ${pending.toolName} timed out after ${TOOL_TIMEOUT_MS}ms`,
            ),
          );
        }, TOOL_TIMEOUT_MS);
        return;
      }
      // 终态：将 extra.terminalLog 提升到 tool_result.content，方便 executor 统一取值
      const terminalLog = data?.extra?.terminalLog ?? data?.tool_result?.content ?? '';
      const normalizedData = {
        ...data,
        tool_result: {
          ...(data?.tool_result || {}),
          content: terminalLog,
          isError: terminalStatus === 'Failed',
        },
      };
      clearTimeout(pending.timeoutId);
      pending.resolve(normalizedData);
      runner.pendingToolResults.delete(toolId);
      return;
    }

    // 非 terminal 工具：立即 resolve
    clearTimeout(pending.timeoutId);
    pending.resolve(data);
    runner.pendingToolResults.delete(toolId);
  }

  /**
   * 等待 ACCEPT_EDIT_RESULT 返回
   *
   * 当 subagent 执行文件编辑工具后，调用 acceptEdit() 发送 ACCEPT_EDIT 消息到 IDE，
   * 需要等待 IDE 返回 ACCEPT_EDIT_RESULT 确认文件是否真正写入成功。
   *
   * @param toolCallId - 工具调用 ID
   * @param abortSignal - 中止信号，用于提前 reject
   * @param timeout - 超时时间（毫秒），默认 TOOL_TIMEOUT_MS
   * @returns ACCEPT_EDIT_RESULT 结果
   */
  waitForAcceptEdit(
    toolCallId: string,
    abortSignal: AbortSignal,
    timeout: number = TOOL_TIMEOUT_MS,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (abortSignal.aborted) {
        reject(
          new Error('Subagent aborted while waiting for accept edit result'),
        );
        return;
      }

      const timeoutId = setTimeout(() => {
        this.pendingAcceptResults.delete(toolCallId);
        console.error(
          `[Subagent] Accept edit timed out for toolCallId: ${toolCallId}`,
        );
        reject(new Error(`Accept edit timed out after ${timeout}ms`));
      }, timeout);

      this.pendingAcceptResults.set(toolCallId, {
        resolve,
        reject,
        toolCallId,
        startTime: Date.now(),
        timeoutId,
      });

      const onAbort = () => {
        clearTimeout(timeoutId);
        this.pendingAcceptResults.delete(toolCallId);
        reject(
          new Error('Subagent aborted while waiting for accept edit result'),
        );
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * 分发 ACCEPT_EDIT_RESULT 到等待的 subagent
   *
   * 由 CodeChat.tsx 的 ACCEPT_EDIT_RESULT 事件路由调用，
   * 将结果传递给 waitForAcceptEdit 创建的 Promise。
   *
   * @param toolCallId - 工具调用 ID
   * @param result - ACCEPT_EDIT_RESULT 结果数据
   * @returns 是否被 subagent 处理（true 表示是 subagent 的 accept，false 表示是主 agent 的）
   */
  resolveAcceptEditResult(toolCallId: string, result: any): boolean {
    const pending = this.pendingAcceptResults.get(toolCallId);
    if (!pending) {
      // 可能是主 agent 的 accept，不是 subagent 的
      return false;
    }

    clearTimeout(pending.timeoutId);
    pending.resolve(result);
    this.pendingAcceptResults.delete(toolCallId);
    return true;
  }
}

/** 全局单例 */
export const runnerManager = new RunnerManager();

/**
 * 手动触发诊断 - 可以在代码中调用或通过导入使用
 * 示例：import { printSubagentDiagnostics } from '@/modules/subagent/lifecycle/manager'
 */
// export function printSubagentDiagnostics(): void {
//   runnerManager.printDiagnostics();
// }

// 开发环境下定期输出诊断信息到控制台（替代全局对象）
// if (import.meta.env.DEV) {
//   // 每30秒自动打印一次诊断信息（如果有活跃的subagent）
//   setInterval(() => {
//     const diagnostics = runnerManager.getDiagnostics();
//     if (diagnostics.activeRunners.length > 0 || diagnostics.pendingAcceptEditsCount > 0) {
//       console.log('🔍 [Subagent] Auto-diagnostics:');
//       console.log(`Active Runners: ${diagnostics.activeRunners.length}`);
//       console.log(`Pending Accept Edits: ${diagnostics.pendingAcceptEditsCount}`);

//       diagnostics.activeRunners.forEach((runner, index) => {
//         runnerManager.formatRunnerDiagnostic(runner, index);
//       });
//     }
//   }, 30000);

//   console.log(
//     '%c[Subagent] Auto-diagnostics enabled - will show status every 30s when active',
//     'color: #4CAF50; font-weight: bold;'
//   );
// }