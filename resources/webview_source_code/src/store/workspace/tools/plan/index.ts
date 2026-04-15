import { jsonrepair } from 'jsonrepair'

import type { ExtendedPlanData, Priority, TaskStatus } from "../../../../types/plan";
import type { ToolCall, ToolResultItem, ChatMessage } from "../../../../services";
import userReporter from '../../../../utils/report';
import { UserEvent } from '../../../../types/report';
import { updateCurrentSession } from '../../../../hooks/useCurrentSession';

interface Task {
  title: string;
  description: string;
  priority: Priority;
}

export interface Plan {
  title: string;
  description?: string;
  tasks: Task[];
}

export const PLAN_SKILL = `to analyze technical requirements and produce clear, actionable implementation plans.
These plans will then be carried out by a junior software engineer so you need to be specific and detailed. However do not actually write the code, just explain the plan.

Follow these steps for each request:
1. Carefully analyze requirements to identify core functionality and constraints
2. Define clear technical approach with specific technologies and patterns
3. Break down implementation into concrete, actionable steps at the appropriate level of abstraction

Keep responses focused, specific and actionable.

IMPORTANT: Do not ask the user if you should implement the changes at the end. Just provide the plan as described above.`

export const ARCHITECT_SYSTEM_PROMPT = `You are an expert software architect. Your role is ${PLAN_SKILL}
IMPORTANT: Do not attempt to write the code or use any string modification tools. Just provide the plan.`


export const SYSTEM_PROMPT = `# Plan Generation and Task Decomposition
You have access to the make_plan tool for creating comprehensive execution plans. Use this tool to Create concise execution plans. Keep descriptions brief and focused.

Guidelines:
  - Task titles: 5-8 words max
  - Task descriptions: 1-2 sentences, focus on WHAT not HOW
  - For simple changes: avoid over-decomposition
  - Prioritize actionable outcomes over implementation details

Example for "Add FPS display":
  - Title: "Add FPS counter component"
  - Description: "Create FPS display in top-right corner with toggle option"
	NOT: "Create a new React component with useState for FPS tracking, implement useEffect for requestAnimationFrame, add CSS positioning..."`

export const DESCRIPTION = `Creates structured execution plans with comprehensive task decomposition for complex multi-step operations.`

export const PROMPT = `Create CONCISE execution plans. Keep task descriptions brief (1-2 sentences). Focus on WHAT needs to be done, not detailed HOW.`

export const Tool = {
  type: 'function',
  function: {
    name: 'make_plan',
    description: PROMPT,
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Plan title that concisely summarizes the objective'
        },
        description: {
          type: 'string',
          description: 'Detailed plan description and background context'
        },
        tasks: {
          type: 'array',
          description: 'Ordered list of executable tasks with clear dependencies. Tasks must be arranged in logical execution sequence, ensuring prerequisites are completed before dependent tasks.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Clear, action-oriented task title' },
              description: { type: 'string', description: 'Detailed task description with specific deliverables and scope' },
              priority: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'Task priority based on criticality and dependencies'
              }
            },
            required: ['title', 'description', 'priority']
          }
        }
      },
      required: ['title', 'tasks']
    }
  }
}

export function processMakePlanDenied(): string {
  updateCurrentSession((session) => {
    if (session.data) {
      session.data.planModeState = 'rejected';
    }
  });

  return `CRITICAL: Plan FAILED! Plan REJECTED! STOP all development immediately!

**MANDATORY:**
1. STOP using modification tools (edit_file, replace_in_file, execute_command)
2. STOP creating files/features
3. Ask user for detailed feedback

**REQUIRED QUESTIONS:**
1. What parts of the plan do you object to?
2. What adjustments do you want?
3. Minor modifications or completely different approach?
4. Is this task simpler than expected?

**PROHIBITED:** Code modifications, file changes, development tasks
**ALLOWED:** Questions, read-only analysis, discussing approaches

**RESTART:** User feedback + new plan + approval

**IMPORTANT:** Plan Mode is enabled - you MUST create plans even if user says "no plan needed". If they truly don't want plans, they should disable Plan Mode first.

Remember: Plan rejection = STOP + COLLECT FEEDBACK!`;
}

export function processMakePlanResult(tool: ToolCall, result: ToolResultItem, userMessage?: ChatMessage): string {
  try {
    const toolParams = getToolParams(tool);

    const hasStructuredData = toolParams.title || toolParams.tasks;

    if (hasStructuredData) {
      const planData = createPlanData(toolParams, userMessage);

      const planText = generatePlanText(toolParams);

      updateCurrentSession((session) => {
        if (session.data) {
          session.data.plan = planText;
          session.data.planData = planData;
          session.data.todoList = {
            todos: session?.data.planData?.tasks.map(
              (task, index) => ({
                title: task.title,
                description: task.description,
                priority: task.priority,
                status: index === 0 ? 'in_progress' : task.status,
                id: task.id,
              }),
            ),
          };
          session.data.planModeState = 'executing';
          window.parent.postMessage({
            type: 'WEBVIEW_ACK',
            data: {
              event: 'write_todo_result',
              payload: session.data.todoList,
            },
          }, '*');
        }
      })

      return 'Plan has been approved. You can now start executing.';
    } else {
      updateCurrentSession((session) => {
        if (session.data) {
          session.data.planModeState = 'rejected';
        }
      });
      return 'Plan generation failed: insufficient data.';
    }
  } catch (err) {
    console.error('make_plan error:', err);
    result.isError = true;
    return 'Error processing plan generation.';
  }
}

/**
 * 创建结构化计划数据
 */
function createPlanData(toolParams: Plan, userMessage?: ChatMessage): ExtendedPlanData {
  const tasks = (toolParams.tasks || []).map((task, index) => ({
    id: `task-${Date.now()}-${index}`,
    title: task.title,
    description: task.description,
    status: 'pending' as TaskStatus,
    toolCalls: [],
    results: [],
    priority: task.priority || 'medium',
    tags: []
  }));

  return {
    id: `plan-${Date.now()}`,
    version: '1.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastModifiedBy: 'system',
    title: toolParams.title || 'Generated Plan',
    description: toolParams.description || '',
    summary: `计划包含 ${tasks.length} 个任务`,
    tags: [],
    status: 'pending_approval',
    mode: 'manual',
    tasks: tasks,
    currentTaskIndex: 0,
    totalTasks: tasks.length,
    completedTasks: 0,
    originalPrompt: userMessage?.content || ''
  };
}

/**
 * 生成计划文本版本
 */
export function generatePlanText(toolParams: Plan): string {
  let planText = `# ${toolParams.title || 'Generated Plan'}\n\n`;
  if (toolParams.description) {
    planText += `${toolParams.description}\n\n`;
  }

  planText += '## 计划列表\n\n';
  (toolParams.tasks || []).forEach((task) => {
    planText += `### **${task.title}**\n`;
    planText += `   > ${task.description}\n\n`;
  });

  return planText;
}

export function report(args: string) {
  let toolParams: Plan;
  try {
    toolParams = JSON.parse(args || '{}');
  } catch {
    toolParams = JSON.parse(jsonrepair(args || '{}'));
    userReporter.report({
      event: UserEvent.CODE_CHAT_PLAN_PARSE_ERROR,
    });
  }

  if (!Array.isArray(toolParams.tasks)) {
    userReporter.report({
      event: UserEvent.CODE_CHAT_PLAN_TYPE_ERROR,
      extends: {
        type: typeof toolParams.tasks,
      },
    });
  }
}

export function getToolParams(tool: ToolCall): Plan {
  let toolParams: Plan
  try {
    toolParams = JSON.parse(tool.function?.arguments || '{}');
  } catch (error) {
    toolParams = JSON.parse(jsonrepair(tool.function?.arguments || '{}'));
  }

  if (!Array.isArray(toolParams.tasks)) {
    if (typeof toolParams.tasks === 'string') {
      toolParams.tasks = JSON.parse(jsonrepair(toolParams.tasks || '[]'));
      if (!Array.isArray(toolParams.tasks)) {
        throw new Error(`Invalid tasks format: ${typeof toolParams.tasks}`);
      }
    } else {
      throw new Error(`Invalid tasks format: ${typeof toolParams.tasks}`);
    }
  }

  return toolParams;
}
