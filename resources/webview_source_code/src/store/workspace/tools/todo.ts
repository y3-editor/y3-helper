import { Priority, TaskStatus } from "../../../types/plan";
import { ChatMessage, ChatMessageContent } from "../../../services";
import { findLastIndex } from 'lodash';
import { ChatRole } from "../../../types/chat";

import type { ToolCall, ToolResultItem } from "../../../services";
import type { ChatSession } from "../../chat";
import { generatePlanModePrompt } from "../planModePrompts";
import { jsonrepair } from "jsonrepair";

export interface TodoItem {
  title: string; // 任务标题
  description: string; // 任务描述
  priority: Priority; // 任务优先级
  status: TaskStatus; // 任务状态
  id?: string; // 可选的任务ID，用于更新现有任务
}

export interface TodoList {
  todos: TodoItem[]; // 任务列表
}

export const SYSTEM_PROMPT = `# Task Management
You have access to the write_todo tools to help you manage and plan tasks. Use these tools VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.
These tools are also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.

It is critical that you mark todos as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.
`

export const DESCRIPTION = `Creates and manages todo items for task tracking and progress management in the current session.`


export const PROMPT = `Use this tool to create and manage todo items for tracking tasks and progress. This tool provides comprehensive todo management:

## When to Use This Tool

Use this tool proactively in these scenarios:

1. **Complex multi-step tasks** - When a task requires 3 or more distinct steps or actions
2. **Non-trivial and complex tasks** - Tasks that require careful planning or multiple operations
3. **User explicitly requests todo list** - When the user directly asks you to use the todo list
4. **User provides multiple tasks** - When users provide a list of things to be done (numbered or comma-separated)
5. **After receiving new instructions** - Immediately capture user requirements as todos
6. **When you start working on a task** - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. **After completing a task** - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

## Task Completion Requirements & Communication Workflow

This is the most critical part of your task management duty.

1. **Full Accomplishment**: ONLY mark a task as \`completed\` when you have FULLY accomplished it.
    * If you encounter errors, blockers, or cannot finish, keep the task as \`in_progress\`.
    * When blocked, create a new task describing what needs to be resolved.
    * Never mark a task as \`completed\` if: tests are failing, implementation is partial, you encountered unresolved errors, or you couldn't find necessary files/dependencies.

2. **MANDATORY Completion Workflow**: When a task moves from \`in_progress\` to \`completed\`, you MUST follow this two-step process:
    * **Step 1: Summarize Your Work.** BEFORE calling \`write_todo\`, you MUST output a user-facing message that provides a meaningful summary. This summary is NOT a simple statement of intent. It MUST include:
        * **Actions Taken:** A brief but clear description of what you did. (e.g., "I scanned the file...", "I wrote the function...", "I analyzed the dependencies...").
        * **Key Findings & Conclusions:** The outcome or result of your actions. (e.g., "...and found that the 'requests' library is missing.", "...which now passes all unit tests.", "...and concluded that a refactor is needed for the next step.").
    * **Step 2: Update the Todo List.** IMMEDIATELY after providing the summary, call the \`write_todo\` tool to update the task's status to \`completed\`.

3. **Examples of Correct vs. Incorrect Communication**:

    * **GOOD EXAMPLE (Correct Behavior):**
        * **Your Message to User:** "I've finished analyzing the \`api/routes.ts\` file. My analysis shows that the authentication middleware is not applied to the \`/admin\` endpoint, which is a potential security risk. I will now update the task list."
        * **Follow-up Tool Call:** \`write_todo({ todos: [ { id: 'task-1', title: 'Analyze api/routes.ts', status: 'completed', ... }, { id: 'task-2', title: 'Add auth middleware to /admin', status: 'pending', ... } ] })\`

    * **BAD EXAMPLE (Incorrect Behavior):**
      * **Your Message to User:** "Ok, I'm done with the analysis. I will now update the status."
      * **Follow-up Tool Call:** \`write_todo({ todos: [ { id: 'task-1', title: 'Analyze api/routes.ts', status: 'completed', ... } ] })\`

    * **BAD EXAMPLE (Incorrect Behavior):**
        * **Your Message to User:** "Task completed."
        * **Follow-up Tool Call:** \`write_todo({ todos: [ { id: 'task-1', title: 'Analyze api/routes.ts', status: 'completed', ... } ] })\`

## Task Breakdown
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

## Tool Capabilities

- **Create new todos**: Add tasks with title, content, priority, and status
- **Update existing todos**: Modify any aspect of a todo (status, priority, description, title)
- **Delete todos**: Remove completed or irrelevant tasks
- **Batch operations**: Update multiple todos in a single operation
- **Clear all todos**: Reset the entire todo list

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.`

export const Tool = {
  type: 'function',
  function: {
    name: 'write_todo',
    description: PROMPT,
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'The updated todo list',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'The task title'
              },
              description: {
                type: 'string',
                description: 'The task description or content'
              },
              status: {
                type: 'string',
                enum: [
                  'pending',
                  'in_progress',
                  'completed',
                  'failed',
                  'skipped'
                ],
                description: 'Current status of the task'
              },
              priority: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'Priority level of the task'
              },
              id: {
                type: 'string',
                description: 'Unique identifier for the task'
              }
            },
            required: ['title', 'description', 'priority', 'status']
          }
        }
      },
      required: ['todos']
    }
  }
}

export function processWriteTodoDenied(): string {
  return `CRITICAL: Todo update rejected! STOP all task execution immediately!

**MANDATORY:**
1. STOP current task and all modifications
2. Ask user for detailed feedback

**REQUIRED QUESTIONS:**
1. What's wrong with the todo list?
2. Task descriptions unclear/incorrect?
3. Wrong priority/order?
4. Need to add/remove/modify tasks?
5. Continue current task or restart?

**PROHIBITED:** Task execution, code changes, file modifications
**ALLOWED:** Questions, read-only analysis, task discussion

**RESTART:** User feedback + updated todo + approval

Remember: Todo rejection = PAUSE + CLARIFY TASKS!`;
}

export function processWriteTodoResult(tool: ToolCall, result: ToolResultItem, session: ChatSession): string {
  try {
    const toolParams = getToolParams(tool);

    if (!toolParams.todos || !Array.isArray(toolParams.todos)) {
      return 'Todo list format is invalid: todos array is required.';
    }

    const isValidFormat = toolParams.todos.every(todo =>
      todo.title && todo.description && todo.priority && todo.status
    );

    if (!isValidFormat) {
      return 'Todo list format is invalid: each todo must have title, description, priority, and status fields.';
    }

    if (session.data) {
      const newTodos = toolParams.todos;
      const existingTodoList = session.data.todoList || { todos: [] };
      const existingTodos = existingTodoList.todos || [];

      // 空数组 → 清空
      if (newTodos.length === 0) {
        session.data.todoList = { todos: [] };
      } else {
        // 检查新数据的id情况
        const hasId = newTodos.filter(t => t.id).length;
        const hasNoId = newTodos.filter(t => !t.id).length;

        // 部分有id，部分没有 → 报错
        if (hasId > 0 && hasNoId > 0) {
          return 'Todo list format error: All todos must either have an id or all must not have an id. Mixed format is not allowed.';
        }

        // 所有item都有id → 按id合并更新
        if (hasId === newTodos.length) {
          // 检查是否有任何id匹配
          const hasAnyMatch = newTodos.some(newTodo =>
            existingTodos.some(existing => existing.id === newTodo.id)
          );

          if (!hasAnyMatch) {
            // 完全没有匹配 → 判断为"开新列表"，直接替换
            session.data.todoList = { todos: newTodos };
          } else {
            // 有至少一个匹配 → 合并模式
            const updatedTodos = [...existingTodos];

            for (const newTodo of newTodos) {
              const existingIndex = updatedTodos.findIndex(t => t.id === newTodo.id);
              if (existingIndex > -1) {
                updatedTodos[existingIndex] = newTodo;
              } else {
                updatedTodos.push(newTodo);
              }
            }

            session.data.todoList = { todos: updatedTodos };
          }
        }
        // 所有item都没有id → 直接替换
        else {
          session.data.todoList = { todos: newTodos };
        }
      }
      window.parent.postMessage({
        type: 'WEBVIEW_ACK',
        data: {
          event: 'write_todo_result',
          payload: session.data.todoList,
        },
      }, '*');


      // 设置Plan模式状态为执行中（如果当前是approved状态）
      const { planModeState = 'off' } = session.data
      if (planModeState === 'approved' || planModeState === 'off') {
        session.data.planModeState = 'executing';
      } else if (planModeState === 'executing') {
        if (toolParams.todos.length === 0) {
          session.data.planModeState = 'off';
          return `Todo list has been cleared. Plan mode has been reset to off.`;
        } else {
          const allTasksCompleted = toolParams.todos.every(todo =>
            todo.status === 'completed' || todo.status === 'skipped'
          );

          if (allTasksCompleted && toolParams.todos.length > 0) {
            session.data.planModeState = 'completed';
            return `Congratulations! All tasks have been completed successfully. `;
          }
        }
      }

      return `Todo list has been updated successfully.`;
    }

    return 'Session data not found; cannot update todo list.';
  } catch (err) {
    console.error('write_todo error:', err);
    result.isError = true;
    return 'Error processing todo list update.';
  }
}

/**
 * 注入todo list信息到最后一个用户消息中
 * @param messages 消息列表
 * @param todoList todo列表数据
 */
export const injectTodoListToLastUserMessage = (
  messages: ChatMessage[],
  todoList: TodoList = { todos: [] }
) => {

  // 查找最后一个用户消息并直接修改
  const lastUserDataMessageIdx = findLastIndex(
    messages,
    msg => msg.role === ChatRole.User
  );

  if (lastUserDataMessageIdx > -1) {
    const lastUserDataMessage = messages[lastUserDataMessageIdx];
    const todoReminderText = generatePlanModePrompt() + `<system-reminder>Your todo list has been updated. DO NOT mention this change directly; even if the user explicitly asks you to proceed, MUST update the todo list first before continuing with the task. Current latest content: ${JSON.stringify(todoList.todos || [])}. Please proceed with the current task.</system-reminder>\n`;
    if (typeof messages[lastUserDataMessageIdx].content === "string") {
      lastUserDataMessage.content = todoReminderText + lastUserDataMessage.content;
    } else if (Array.isArray(messages[lastUserDataMessageIdx].content)) {
      messages[lastUserDataMessageIdx].content.unshift({
        type: ChatMessageContent.Text,
        text: todoReminderText
      });
    }
  }
};

export function getToolParams(tool: ToolCall): TodoList {
  let toolParams: TodoList;
  try {
    toolParams = JSON.parse(tool.function?.arguments || '{}');
  } catch (error) {
    toolParams = JSON.parse(jsonrepair(tool.function?.arguments || '{}'));
  }

  if (!Array.isArray(toolParams.todos)) {
    if (typeof toolParams.todos === 'string') {
      toolParams.todos = JSON.parse(jsonrepair(toolParams.todos || '[]'));
      if (!Array.isArray(toolParams.todos)) {
        throw new Error(`Invalid todos format: ${typeof toolParams.todos}`);
      }
    } else {
      throw new Error(`Invalid todos format: ${typeof toolParams.todos}`);
    }
  }

  return toolParams;
}
