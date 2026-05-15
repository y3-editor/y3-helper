import { ChatRole } from '../types/chat';
import { UserEvent } from '../types/report';
import { handleStreamError } from '../utils';
import { DEFAULT_USAGE_MODEL, useChatConfig } from '../store/chat-config';
import { ChatMessage, ChatMessageContent, ChatMessageContentText } from './index';
import { requestChatStream } from './useChatStream';
import type { Rule } from '../store/workspace';
import { ChatModel } from './chatModel';

// ---- Types ----

export interface GeneratedAgent {
  identifier: string;
  whenToUse: string;
  systemPrompt: string;
  /** 任意可选 yaml metadata，由 UI 层写入，formatAgentAsMarkdown 自动序列化到 frontmatter */
  agentMetadata?: Record<string, unknown>;
}

interface GenerateAgentCallbacks {
  onSuccess: (config: GeneratedAgent) => void;
  /** 单次失败回调（重试中也会触发，用于日志/调试，不展示给用户） */
  onError: (error: Error) => void;
  /** 所有重试均失败后的最终错误回调（用于展示 Alert Dialog） */
  onFatalError?: (error: Error) => void;
  /** 即将开始第 N 次重试（attempt 从 2 开始，1 为首次尝试） */
  onRetry?: (attempt: number, maxAttempts: number) => void;
  onController?: (controller: AbortController) => void;
  /** 已存在的 agent identifier 列表，生成时会在 prompt 中提示 LLM 避开 */
  existingIdentifiers?: string[];
  /** 注入到 system-reminder 的有效规则（来自 computeEffectiveRules） */
  rules?: Rule[];
}

// ---- Constants ----

const AGENT_TOOL_NAME = 'Agent';

/** 创建 Agent 时调用 LLM 的默认模型，当外部未传入有效模型时使用 */
export const AGENT_CREATION_DEFAULT_MODEL = DEFAULT_USAGE_MODEL as string;

/** 最大重试次数（首次 + 重试，共 N 次尝试） */
export const MAX_GENERATE_RETRIES = 3;

// Ported from CC (Claude Code) generateAgent implementation
export const AGENT_CREATION_SYSTEM_PROMPT = `You are an elite AI agent architect specializing in crafting high-performance agent configurations. Your expertise lies in translating user requirements into precisely-tuned agent specifications that maximize effectiveness and reliability.

**Important Context**: You may have access to project-specific instructions from CLAUDE.md files and other context that may include coding standards, project structure, and custom requirements. Consider this context when creating agents to ensure they align with the project's established patterns and practices.

When a user describes what they want an agent to do, you will:

1. **Extract Core Intent**: Identify the fundamental purpose, key responsibilities, and success criteria for the agent. Look for both explicit requirements and implicit needs. Consider any project-specific context from CLAUDE.md files. For agents that are meant to review code, you should assume that the user is asking to review recently written code and not the whole codebase, unless the user has explicitly instructed you otherwise.

2. **Design Expert Persona**: Create a compelling expert identity that embodies deep domain knowledge relevant to the task. The persona should inspire confidence and guide the agent's decision-making approach.

3. **Architect Comprehensive Instructions**: Develop a system prompt that:
   - Establishes clear behavioral boundaries and operational parameters
   - Provides specific methodologies and best practices for task execution
   - Anticipates edge cases and provides guidance for handling them
   - Incorporates any specific requirements or preferences mentioned by the user
   - Defines output format expectations when relevant
   - Aligns with project-specific coding standards and patterns from CLAUDE.md

4. **Optimize for Performance**: Include:
   - Decision-making frameworks appropriate to the domain
   - Quality control mechanisms and self-verification steps
   - Efficient workflow patterns
   - Clear escalation or fallback strategies

5. **Create Identifier**: Design a concise, descriptive identifier that:
   - Uses lowercase letters, numbers, and hyphens only
   - Is typically 2-4 words joined by hyphens
   - Clearly indicates the agent's primary function
   - Is memorable and easy to type
   - Avoids generic terms like "helper" or "assistant"

6. **Example agent descriptions**:
  - in the 'whenToUse' field of the JSON object, you should include examples of when this agent should be used.
  - examples should be of the form:
    - <example>
      Context: The user is creating a test-runner agent that should be called after a logical chunk of code is written.
      user: "Please write a function that checks if a number is prime"
      assistant: "Here is the relevant function: "
      <function call omitted for brevity only for this example>
      <commentary>
      Since a significant piece of code was written, use the ${AGENT_TOOL_NAME} tool to launch the test-runner agent to run the tests.
      </commentary>
      assistant: "Now let me use the test-runner agent to run the tests"
    </example>
    - <example>
      Context: User is creating an agent to respond to the word "hello" with a friendly joke.
      user: "Hello"
      assistant: "I'm going to use the ${AGENT_TOOL_NAME} tool to launch the greeting-responder agent to respond with a friendly joke"
      <commentary>
      Since the user is greeting, use the greeting-responder agent to respond with a friendly joke.
      </commentary>
    </example>
  - If the user mentioned or implied that the agent should be used proactively, you should include examples of this.
  - NOTE: Ensure that in the examples, you are making the assistant use the Agent tool and not simply respond directly to the task.

Your output must be a valid JSON object with exactly these fields:
{
  "identifier": "A unique, descriptive identifier using lowercase letters, numbers, and hyphens (e.g., 'test-runner', 'api-docs-writer', 'code-formatter')",
  "whenToUse": "A precise, actionable description starting with 'Use this agent when...' that clearly defines the triggering conditions and use cases. Ensure you include examples as described above.",
  "systemPrompt": "The complete system prompt that will govern the agent's behavior, written in second person ('You are...', 'You will...') and structured for maximum clarity and effectiveness"
}

Key principles for your system prompts:
- Be specific rather than generic - avoid vague instructions
- Include concrete examples when they would clarify behavior
- Balance comprehensiveness with clarity - every instruction should add value
- Ensure the agent has enough context to handle variations of the core task
- Make the agent proactive in seeking clarification when needed
- Build in quality assurance and self-correction mechanisms

Remember: The agents you create should be autonomous experts capable of handling their designated tasks with minimal additional guidance. Your system prompts are their complete operational manual.`;

// ---- Helpers ----

/**
 * 解析并校验 LLM 返回的 JSON，提取 GeneratedAgent 配置
 */
export function parseAndValidateConfig(text: string): GeneratedAgent {
  let parsed: any;

  // 先尝试直接解析
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    // 失败则用正则提取 JSON block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse JSON from response');
    }
  }

  // 校验必填字段
  const requiredFields = ['identifier', 'whenToUse', 'systemPrompt'] as const;
  for (const field of requiredFields) {
    if (!parsed[field] || typeof parsed[field] !== 'string') {
      throw new Error(`Invalid agent configuration: missing or invalid field "${field}"`);
    }
  }

  // 校验 identifier 格式 (kebab-case)
  if (!/^[a-z0-9-]+$/.test(parsed.identifier)) {
    throw new Error(
      `Invalid identifier "${parsed.identifier}": must use lowercase letters, numbers, and hyphens only`,
    );
  }

  return {
    identifier: parsed.identifier,
    whenToUse: parsed.whenToUse,
    systemPrompt: parsed.systemPrompt,
  };
}

/**
 * 将 agent 配置格式化为 Markdown 文件内容 (YAML frontmatter + body)
 */
export function formatAgentAsMarkdown(config: GeneratedAgent): string {
  // 转义 YAML double-quoted string 中的特殊字符
  const escapedWhenToUse = config.whenToUse
    .replace(/\\/g, '\\\\') // 先转义反斜杠
    .replace(/"/g, '\\"')   // 转义双引号
    .replace(/\n/g, '\\n'); // 转义换行符

  // 序列化 agentMetadata 中所有非空 key-value 到 frontmatter
  let extraMeta = '';
  if (config.agentMetadata) {
    for (const [key, value] of Object.entries(config.agentMetadata)) {
      if (value === undefined || value === null || value === '') continue;
      let serialized =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      // model 字段需要加上 netease-codemaker/ 前缀
      if (key === 'model') {
        serialized = `netease-codemaker/${serialized}`;
      }
      extraMeta += `\n${key}: ${serialized}`;
    }
  }

  return `---
name: ${config.identifier}
description: "${escapedWhenToUse}"${extraMeta}
---

${config.systemPrompt}`;
}

// ---- Main Service ----

/**
 * 单次调用 LLM 生成 Agent 配置
 * - 内部封装 requestChatStream + JSON 解析 + 校验
 * - 不处理重试逻辑
 * - resolve 时返回 GeneratedAgent，reject 时抛出错误
 * - 若用户主动取消（aborted 且非 timeout），reject 一个特殊 Error: { name: 'UserCancelled' }
 */
function singleGenerateAgent(
  userPrompt: string,
  model: string,
  existingIdentifiers: string[],
  rules: Rule[],
  onController?: (controller: AbortController) => void,
): Promise<GeneratedAgent> {
  return new Promise<GeneratedAgent>((resolve, reject) => {
    // 1. 构造 prompt：附加已存在的 identifier 黑名单
    const existingList =
      existingIdentifiers.length > 0
        ? `\n\nIMPORTANT: The following identifiers already exist and must NOT be used: ${existingIdentifiers.join(', ')}`
        : '';
    const prompt = `Create an agent configuration based on this request: "${userPrompt}".${existingList}
Return ONLY the JSON object, no other text.`;

    // 2. 构造 userMessage content array
    //    第一项（有规则时）：system-reminder 注入 effectiveRules
    //    第二项：实际用户指令
    const contentArray: ChatMessageContentText[] = [];

    if (rules.length > 0) {
      const rulesContext = rules
        .map((rule) => `# ${rule.filePath}\n${rule.content}`)
        .join('\n');
      contentArray.push({
        type: ChatMessageContent.Text,
        text: `<system-reminder>\nAs you answer the user's questions, you can use the following context:\n${rulesContext}\n\nIMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.\n</system-reminder>\n`,
      });
    }

    contentArray.push({
      type: ChatMessageContent.Text,
      text: prompt,
    });

    const systemMessage: ChatMessage = {
      role: ChatRole.System,
      content: AGENT_CREATION_SYSTEM_PROMPT,
    };

    const userMessage: ChatMessage = {
      role: ChatRole.User,
      content: contentArray,
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const safeResolve = (config: GeneratedAgent) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(config);
    };

    const safeReject = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    // 与 buildCodebaseChatPayload / buildSubagentChatPromptBody 保持一致
    const chatModels = useChatConfig.getState().chatModels;
    let DEFAULT_MAX_TOKENS = 10240;
    if ([ChatModel.Gemini25, ChatModel.Gemini3Pro].includes(model as ChatModel)) {
      DEFAULT_MAX_TOKENS = 32000;
    }
    const maxTokens = Math.max(
      DEFAULT_MAX_TOKENS,
      chatModels[model]?.tokenInfo?.maxOutputTokens || 10240,
    );

    requestChatStream(
      UserEvent.CODE_CHAT_CREATE_AGENT,
      {
        messages: [systemMessage, userMessage],
        model,
        stream: true,
        tool_choice: 'auto',
        temperature: 0,
        max_tokens: maxTokens,
      },
      undefined,
      {
        onController: (controller) => {
          abortController = controller;
          onController?.(controller);

          timeoutId = setTimeout(() => {
            controller.abort({
              name: 'RequestTimeout',
              message: '生成超时,请重试',
            });
          }, 5 * 60 * 1000);
        },
        onMessage: (content, done) => {
          if (done) {
            try {
              const config = parseAndValidateConfig(content);
              safeResolve(config);
            } catch (err) {
              safeReject(err instanceof Error ? err : new Error(String(err)));
            }
          }
        },
        onError: (error) => {
          if (
            abortController?.signal.aborted &&
            (abortController.signal.reason as any)?.name !== 'RequestTimeout'
          ) {
            const cancelErr = new Error('User cancelled');
            cancelErr.name = 'UserCancelled';
            safeReject(cancelErr);
            return;
          }
          const message = handleStreamError(error);
          safeReject(new Error(message || error.message));
        },
        setError: () => {
          cleanup();
        },
      },
    ).catch((err) => {
      safeReject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/**
 * 调用 LLM 根据用户描述生成 agent 配置（带最多 N 次重试）
 *
 * - 若未传入 model 或 model 为空字符串，回退到 AGENT_CREATION_DEFAULT_MODEL
 * - 单次失败（网络错误 / JSON 解析失败 / 校验失败）会自动重试，最多 MAX_GENERATE_RETRIES 次
 * - 用户主动取消（abort）不触发重试，直接静默返回
 * - 若所有重试均失败，调用 onFatalError 让 UI 弹窗告知用户
 */
export async function generateAgent(
  userPrompt: string,
  model: string | undefined,
  callbacks: GenerateAgentCallbacks,
): Promise<void> {
  const effectiveModel = model && model.trim() ? model : AGENT_CREATION_DEFAULT_MODEL;
  const existingIdentifiers = callbacks.existingIdentifiers ?? [];
  const rules = callbacks.rules ?? [];
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_GENERATE_RETRIES; attempt++) {
    if (attempt > 1) {
      callbacks.onRetry?.(attempt, MAX_GENERATE_RETRIES);
    }

    try {
      const config = await singleGenerateAgent(
        userPrompt,
        effectiveModel,
        existingIdentifiers,
        rules,
        callbacks.onController,
      );
      callbacks.onSuccess(config);
      return;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (error.name === 'UserCancelled') {
        return;
      }

      lastError = error;
      callbacks.onError(error);

      if (attempt < MAX_GENERATE_RETRIES) {
        // eslint-disable-next-line no-console
        console.warn(
          `[agentCreation] generateAgent attempt ${attempt}/${MAX_GENERATE_RETRIES} failed:`,
          error.message,
        );
        continue;
      }
    }
  }

  if (lastError) {
    if (callbacks.onFatalError) {
      callbacks.onFatalError(lastError);
    } else {
      callbacks.onError(lastError);
    }
  }
}