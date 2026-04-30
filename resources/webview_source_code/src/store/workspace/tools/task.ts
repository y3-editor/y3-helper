import type { Tool } from '..';
import { useSubagentStore } from '../../../modules/subagent';
import { useExtensionStore } from '../../extension';
import type { Agent } from '../../../modules/subagent';

/**
 * 根据 Agent Registry 动态构建 agent 列表描述，包含每个 agent 的名称、描述和工具列表。
 */
function buildAgentList(agents: Agent[]): string {
  return agents
    .map((agent) => {
      const toolList =
        agent.tools && agent.tools.length > 0
          ? agent.tools.join(', ')
          : 'all available tools';
      return `- **${agent.name}**: ${agent.description} (tools: ${toolList})`;
    })
    .join('\n');
}

/**
 * 根据 Agent Registry 动态生成 task 工具的 description。
 * 包含使用指引、并发提示、上下文隔离说明和使用示例，帮助主模型正确使用。
 */
export function buildTaskDescription(): string {
  // 检查 Subagent 功能是否启用
  const subagentEnable = useExtensionStore.getState().subagentEnable;
  if (!subagentEnable) {
    return 'Subagent functionality is currently disabled.';
  }

  const agents: Agent[] = useSubagentStore.getState().agents;
  const agentList = buildAgentList(agents);

  return `Launch a new agent to handle complex, multistep tasks autonomously.

Available agent types and the tools they have access to:
${agentList}

When using the Task tool, you must specify a subagent_type parameter to select which agent type to use.

When to use the Task tool:
- Complex multi-step tasks that require multiple rounds of file reading, searching, and analysis
- Tasks that can be performed independently without needing the current conversation context
- When you are instructed to execute custom slash commands. Use the Task tool with the slash command invocation as the entire prompt. For example: Task(description="Check the file", prompt="/check-file path/to/file.py")

When NOT to use the Task tool:
- If you want to read a specific file path, use the Read tool instead, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use the Grep tool instead, to find the match more quickly
- If you are searching for code within a specific file or set of 2-3 files, use the Read tool instead of the Task tool, to find the match more quickly
- Simple tasks that can be done in 1-2 tool calls in the current conversation

Usage notes:
1. Launch multiple agents concurrently whenever possible to maximize performance; to do that, use a single message with multiple tool uses
2. When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result. The output includes a task_id you can reuse later to continue the same subagent session.
3. Each agent invocation starts with a fresh context unless you provide task_id to resume the same subagent session (which continues with its previous messages and tool outputs). When starting fresh, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
4. The agent's outputs should generally be trusted
5. Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, etc.), since it is not aware of the user's intent. Tell it how to verify its work if possible (e.g., relevant test commands).`;
}

/**
 * 生成 task 工具的 Tool 对象。
 * description 在每次调用时动态生成，以反映最新的 Agent Registry。
 */
export function getTaskTool(): Tool {
  return {
    type: 'function',
    function: {
      name: 'task',
      description: buildTaskDescription(),
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description:
              'A short, human-readable description of the task to be performed by the subagent.',
          },
          prompt: {
            type: 'string',
            description:
              'The full, detailed prompt for the subagent, including all necessary context and instructions. When starting fresh, this should be highly detailed. When resuming via task_id, this can be a follow-up instruction.',
          },
          subagent_type: {
            type: 'string',
            description:
              'The type of agent to use. Must match one of the available agent types listed above.',
          },
          task_id: {
            type: 'string',
            description:
              'Optional. Provide a task_id from a previous task result to resume that subagent session with its full conversation history intact.',
          },
        },
        required: ['description', 'prompt', 'subagent_type'],
      },
    },
  };
}