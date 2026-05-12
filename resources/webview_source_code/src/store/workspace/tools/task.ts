import type { Tool } from '..';
import { useSubagentStore } from '../../../modules/subagent';
import { useChatConfig } from '../../chat-config';
import type { Agent } from '../../../modules/subagent';


/**
 * 根据 Agent Registry 动态生成 task 工具的 description。
 * 包含使用指引、并发提示、上下文隔离说明和使用示例，帮助主模型正确使用。
 *
 * Agent 列表不再内联到此 description 中，而是通过 system-reminder 消息动态注入，
 * 避免 agent 定义变化时导致 tool description cache bust。
 */
export function buildTaskDescription(): string {
  // 检查 Subagent 功能是否启用
  const enableSubagent = useChatConfig.getState().enableSubagent;
  if (!enableSubagent) {
    return 'Subagent functionality is currently disabled.';
  }

  const agents: Agent[] = useSubagentStore.getState().agents;
  const stepLimitLines = agents.length
    ? agents
        .map(
          (a) =>
            `- **${a.name}**: at most **${a.maxSteps ?? '—'}** tool-using steps per run`,
        )
        .join('\n')
    : '';

  return `Launch a new agent to handle complex, multistep tasks autonomously.

When using the Task tool, you must specify a subagent_type parameter to select which agent type to use.
The available agent types are listed in the system-reminder message at the start of the conversation.

When to use the Task tool:
- Complex multi-step tasks that require multiple rounds of file reading, searching, and analysis
- Tasks that can be performed independently without needing the current conversation context
- When you are instructed to execute custom slash commands. Use the Task tool with the slash command invocation as the entire prompt. For example: Task(description="Check the file", prompt="/check-file path/to/file.py")

When NOT to use the Task tool:
- If you want to read a specific file path, use the Read tool instead, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use the Grep tool instead, to find the match more quickly
- If you are searching for code within a specific file or set of 2-3 files, use the Read tool instead of the Task tool, to find the match more quickly
- Simple tasks that can be done in 1-2 tool calls in the current conversation

**IMPORTANT — every \`prompt\` you send MUST include:**
1. **Effort level**: e.g. "quick scan (minimal breadth)" vs "deeper pass (more files ok)". Match the user's ask; default to **quick** unless they explicitly need exhaustive analysis.
2. **Definition of done**: concrete stop condition (e.g. "find the single call site for X", "list 3–5 relevant files with one-line roles", "patch Y and pass tests").
3. **Output shape**: bullets, sections, or fields you need back so the subagent can stop once that is satisfied.
4. **Context to avoid duplicate work**: paths, files, or conclusions already gathered in this conversation so the subagent does not re-explore the same areas.

Avoid vague phrases like "investigate thoroughly" unless breadth is truly required; subagents have a **per-run step budget** (see below).

Usage notes:
1. **CRITICAL**: The task tool must be called **alone** in a separate response. Do **NOT** batch it with other tool calls in the same turn.
2. Run **multiple** agents in parallel only when subtasks are **independent** and **non-overlapping** (different modules/questions). Do not parallelize duplicate exploration of the same area.
3. When the agent is done, it returns a single message to you. That text is **not** visible to the user — summarize for the user yourself.
4. Each invocation starts with a **fresh** context. Put all needed detail in \`prompt\`.
5. Subagent outputs are usually trustworthy; still sanity-check against the repo when it matters.
6. State whether you want **research only** or **code changes**, and how to verify (e.g. tests, commands).

Per-agent step budget (one "step" ≈ one model turn that may invoke tools):
${stepLimitLines || '- (registry empty — assume a limited budget per run)'}

Step limits and task continuation:
- If the task needs more steps than the budget above, the run may be **truncated** automatically.
- When truncated, the agent summarizes progress and handoff; results include a **task_id** to resume via \`task_id\` on a later call.
- **When truncated**, prefer **(a)** using partial results if they answer the user's question, over **(b)** resuming—only resume if something **essential** is still missing. Avoid resume loops that repeat the same exploration.
- Truncation is expected for large tasks; use the summary to decide **once** whether to resume or answer from partials.`;
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
              'Full instructions for the subagent (fresh context each run). MUST include: (1) effort level — quick scan vs deeper pass; (2) definition of done — when to stop; (3) desired output format; (4) any paths/findings from this chat to avoid duplicate exploration. Highly detailed is good; vague "thorough investigation" without stop criteria is bad.',
          },
          subagent_type: {
            type: 'string',
            description:
              'The type of agent to use. See the system-reminder at the start of the conversation for available agent types and their capabilities.',
          },
          task_id: {
            type: 'string',
            description:
              'Optional. The task_id from a previous truncated task result to resume that subagent session and continue from where it left off. If provided, the subagent will restore its previous context and continue the task. Leave empty for new tasks.',
          },
        },
        required: ['description', 'prompt', 'subagent_type'],
      },
    },
  };
}