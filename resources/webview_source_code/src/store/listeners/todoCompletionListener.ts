/**
 * Todo 完成状态监听器
 * 
 * 监听当前会话中 TODO 列表的变化，当所有任务首次完成时触发回调
 */
import { ChatSession, useChatStore } from '../chat';
import type { TodoList } from '../workspace/tools/todo';
import type { ChatMessage } from '../../services';

interface TodoCompletionConfig {
  /**
   * 所有任务完成时的回调函数
   * @param todos 完成的任务列表
   * @param session 会话
   */
  onAllTodosCompleted?: (todos: TodoList['todos'], session: ChatSession) => void;

  /**
   * 是否启用调试日志
   */
  debug?: boolean;
}

interface TodoCompletionState {
  // 记录每个 session 的完成状态
  completedSessions: Set<string>;
}

class TodoCompletionListener {
  private state: TodoCompletionState = {
    completedSessions: new Set()
  };

  private config: TodoCompletionConfig = {};
  private unsubscribe?: () => void;

  initialize(config: TodoCompletionConfig = {}) {
    this.config = config;
    this.setupListener();

    if (this.config.debug) {
      console.debug('[TodoCompletionListener] 已初始化');
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    if (this.config.debug) {
      console.debug('[TodoCompletionListener] 已销毁');
    }
  }

  resetSessionState(sessionId: string) {
    this.state.completedSessions.delete(sessionId);

    if (this.config.debug) {
      console.debug(`[TodoCompletionListener] 重置会话状态: ${sessionId}`);
    }
  }

  resetAllStates() {
    this.state.completedSessions.clear();

    if (this.config.debug) {
      console.debug('[TodoCompletionListener] 重置所有会话状态');
    }
  }

  /**
   * 过滤会话消息，提取从第一次 make_plan 到最后一次 write_todo 完成的消息列表
   * @param session 会话对象
   * @returns 过滤后的消息列表，如果没找到完整的周期则返回空数组
   */
  extractPlanToCompletionMessages(session: ChatSession): ChatMessage[] {
    const messages = session.data?.messages || [];
    if (messages.length === 0) return [];

    const firstMakePlanIndex = messages.findIndex(message =>
      message.tool_calls?.some(tool => tool.function.name === 'make_plan')
    );

    if (firstMakePlanIndex === -1) {
      if (this.config.debug) {
        console.debug('[TodoCompletionListener] 未找到 make_plan 工具调用');
      }
      return [];
    }

    const firstWriteTodoIndex = messages.findIndex((message, index) =>
      index > firstMakePlanIndex &&
      message.tool_calls?.some(tool => tool.function.name === 'write_todo')
    );

    if (firstWriteTodoIndex === -1) {
      if (this.config.debug) {
        console.debug('[TodoCompletionListener] 未找到 write_todo 工具调用');
      }
      return [];
    }

    let lastTodoUpdateIndex = firstWriteTodoIndex;
    for (let i = firstWriteTodoIndex + 1; i < messages.length; i++) {
      if (messages[i].tool_calls?.some(tool => tool.function.name === 'write_todo')) {
        lastTodoUpdateIndex = i;
      }
    }

    const extractedMessages = messages.slice(firstMakePlanIndex - 1, lastTodoUpdateIndex + 1);

    if (this.config.debug) {
      console.debug('[TodoCompletionListener] 提取plan完成周期消息', {
        firstMakePlanIndex,
        firstWriteTodoIndex,
        lastTodoUpdateIndex,
        extractedCount: extractedMessages.length,
        totalMessages: messages.length
      });
    }

    return extractedMessages;
  }

  private setupListener() {
    this.unsubscribe = useChatStore.subscribe((state) => {
      const currentSession = state.sessions.get(state.currentSessionId || '');
      if (!currentSession?.data?.todoList?.todos) {
        return;
      }

      const { todos } = currentSession.data.todoList;

      this.handleTodoListChange(todos, currentSession);
    });
  }

  private handleTodoListChange(todos: TodoList['todos'], session: ChatSession) {
    if (todos.length === 0) {
      return;
    }

    const allCompleted = todos.every(todo =>
      todo.status === 'completed' || todo.status === 'skipped'
    );

    const sessionId = session._id;
    const isFirstTimeCompleted = allCompleted && !this.state.completedSessions.has(sessionId);

    if (isFirstTimeCompleted) {
      this.state.completedSessions.add(sessionId);

      this.config.onAllTodosCompleted?.(todos, session);

      if (this.config.debug) {
        console.debug('[TodoCompletionListener] 所有 TODO 任务首次完成！', {
          sessionId,
          completedTodos: todos.length,
          completedAt: new Date().toISOString()
        });
      }
    }
  }
}

// 创建全局单例实例
export const todoCompletionListener = new TodoCompletionListener();

/**
 * 启动 Todo 完成监听
 * @param config 配置选项
 */
export function startTodoCompletionListener(config?: TodoCompletionConfig) {
  todoCompletionListener.initialize(config);
}

/**
 * 停止 Todo 完成监听
 */
export function stopTodoCompletionListener() {
  todoCompletionListener.destroy();
}

/**
 * 重置指定会话的完成状态
 * @param sessionId 会话 ID
 */
export function resetTodoCompletionState(sessionId: string) {
  todoCompletionListener.resetSessionState(sessionId);
}

/**
 * 重置所有会话的完成状态
 */
export function resetAllTodoCompletionStates() {
  todoCompletionListener.resetAllStates();
}

/**
 * 提取指定会话从第一次 make_plan 到所有 todo 完成的消息列表
 * @param session 会话对象
 * @returns 过滤后的消息列表
 */
export function extractPlanToCompletionMessages(session: ChatSession): ChatMessage[] {
  return todoCompletionListener.extractPlanToCompletionMessages(session);
}

export type { TodoCompletionConfig };
