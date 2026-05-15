import { findLastIndex, isArray } from 'lodash';

import {
  ChatMessage,
  ChatMessageContent,
  ChatMessageContentUnion,
  ChatPromptBody,
} from '../services';
import { ChatRole } from '../types/chat';
import { ChatModel, IChatModelConfig } from '../services/chatModel';
import { getAIGWModel } from '../store/chat-config';
import {
  ChatSession,
  CodebaseChatMode,
  getContentString,
  reassembleContentWithImages,
  useChatPromptStore,
} from '../store/chat';
import { Rule, useWorkspaceStore } from '../store/workspace';
import { CACHE_TIER_BREAK } from '../store/workspace/constructRemixPrompt';
import {
  AgentTaskDirective,
  buildAgentListingReminder,
  generateSubagentConstraintText,
  wrapSystemReminder,
} from '../modules/subagent/utils/messages';
import { Agent } from '../modules/subagent/types';
import {
  clearContextWithUnrelatedProperties,
  reuseDuplicateFileRead,
  serializeCodebaseMessages,
  stripImagesForUnsupportedModel,
} from '../utils/validateBeforeChat';
import addCacheMarksToMessages, {
  addCacheMarksToTools,
} from '../utils/addCacheMarksToMessages';
import { configureThinkingSignature } from '../utils/chatThinkingHandler';
import {
  injectTodoListToLastUserMessage,
  TodoList,
} from '../services/harness/tools/todo';
import { getPlanContextTruncationInstruction } from '../store/workspace/planModePrompts';
import {
  CFG_PROMPT,
  CLASS_PROMPT,
  ER_PROMPT,
  MINDMAP_PROMPT,
  SEQUENCE_PROMPT,
} from '../utils/prompt';
import { usePromptApp } from '../store/promp-app';
import {
  BUILT_IN_PROMPTS,
  BUILT_IN_PROMPTS_OPENSPEC_V023,
  BUILT_IN_PROMPTS_OPENSPEC_V1,
  BUILT_IN_PROMPTS_SPECKIT,
  specPromptMap,
} from '../services/builtInPrompts';

export interface BuildCodebaseChatPayloadInput {
  /** 已截断好的 history(主对话 unCompressedMessages 经 prune/truncate 之后)。函数内会复制后操作,不修改入参。 */
  sendMessages: ChatMessage[];
  /** 截断结果:是否包含 user 消息(若 false 函数会在末尾补一条降级提示) */
  containUserMessage: boolean;
  /** 截断结果:新窗口起点。配合 cacheEnable 决定 reuseDuplicateFileRead 触发条件 */
  newTruncateStart: number;
  /** 是否启用 prompt cache(由 inferCodebaseCacheEnable 决定,可被 truncationResult.fallbackToSlideWindow 覆盖) */
  cacheEnable: boolean;

  /** 当前模型(原 chatConfig.model) */
  model: ChatModel;
  /** chatModels 配置表(用于 stripImagesForUnsupportedModel / configureThinkingSignature / DEFAULT_MAX_TOKENS) */
  chatModels: Record<string, IChatModelConfig>;
  /** 用户自定义 apiKey(可选) */
  codeChatApiKey?: string;

  /** 是否 ReAct 模式(主对话固定 false) */
  isReAct: boolean;
  /** 当前生效 rules(主对话:即时算;压缩:从 lastMsg attachs 反推) */
  effectiveRules: Rule[];
  /** subagent 调用指令(slash 触发时存在) */
  agentTaskDirective?: AgentTaskDirective;
  /** subagent 功能开关(来自 useChatConfig.getState().enableSubagent) */
  enableSubagent: boolean;
  /** subagent 列表 */
  agents: Agent[];

  /** session 上下文(serializeCodebaseMessages 需要) */
  session: ChatSession;
  /** plan 模式开关(来自 session.data?.enablePlanMode) */
  enablePlanMode?: boolean;
  /** plan 模式 todo list(来自 session.data?.todoList) */
  todoList?: TodoList;

  /** 当前对话模式 */
  codebaseChatMode?: CodebaseChatMode;
  /** OpenSpec 当前 active change */
  activeChangeId?: string;
  /** SpecKit 当前 active feature */
  activeFeatureId?: string;

  /**
   * 仅压缩调用使用:在 sendMessages 末尾追加一条 user message(summary prompt)。
   * 该消息会一同进入 serializeCodebaseMessages、addCacheMarksToMessages、
   * 以及后续所有 message 处理流程,确保它能拿到末尾的 cache breakpoint。
   */
  extraTailUserMessage?: ChatMessage;

  /**
   * 当前 user 输入的原始 content,用于 reassembleContentWithImages 还原文本部分。
   * 主对话:外部 content 局部变量;压缩:''(不会触发该分支)。
   */
  currentUserContent?: string;
}

export interface BuildCodebaseChatPayloadResult {
  /**
   * 完整可发送的 payload。
   *
   * 防护层:
   * - 本字段 `readonly`:调用方不能通过 `buildResult.data = newData` 整体替换
   * - dev 环境下 `Object.freeze(data)`:深入属性改写(`data.xxx = yyy`)会抛异常
   *
   * 若确实需要修改 payload,请在 `buildCodebaseChatPayload` 内部完成,
   * 不要在外部对产物做补丁 —— 以免压缩侧/主对话侧行为再次分叉。
   */
  readonly data: ChatPromptBody;
  /**
   * 是否需要在调用方 reset chatPromptStore。
   * true = 命中了 chatPromptStoreState.prompt 的内置 prompt 检查(原 chat.ts L4357),
   * 主对话调用方应在调用本函数后立即 reset;压缩侧应忽略。
   */
  readonly shouldResetChatPromptStore: boolean;
  /**
   * 是否需要在调用方 reset prompApp。
   * true = 命中了 mermaid prompt 替换(原 chat.ts L4391),
   * 主对话调用方应在调用本函数后立即 reset;压缩侧应忽略。
   */
  readonly shouldResetPromptApp: boolean;
}

const MERMAID_PROMPT_MAP: Record<string, string> = {
  '66cf10e1f16cb1260db58a08': ER_PROMPT,
  '66cf0a830fe8cbf0be33b162': CLASS_PROMPT,
  '66d0704b0fe8cbf0be33b170': CFG_PROMPT,
  '66e00c47f16cb1260db58a95': SEQUENCE_PROMPT,
  '66cd9986f16cb1260db589ec': MINDMAP_PROMPT,
};

/**
 * 把 store/chat.ts 主对话路径里"组装 ChatPromptBody"那一大段(原 L4296-4643)
 * 抽成纯函数,返回完整 data + 副作用建议(由调用方决定是否执行 reset)。
 *
 * 抽离动机:让主对话与压缩调用走同一份构造逻辑,确保两者发出的 payload
 * 在 system + tools + model + tool_choice + messages prefix 完全一致,
 * 命中 Anthropic prompt cache。
 *
 * 行为承诺:与原 inline 实现字节级一致。
 * - 不修改入参 sendMessages(内部复制后操作)
 * - 不读写任何 zustand store(除了 useWorkspaceStore.getState() 取
 *   getCodebaseChatSystemPrompt/getCodebaseChatTools 这两个稳定方法)
 * - 不调用 reset();命中 reset 条件时通过返回值告知调用方
 */
export async function buildCodebaseChatPayload(
  input: BuildCodebaseChatPayloadInput,
): Promise<BuildCodebaseChatPayloadResult> {
  const {
    sendMessages: sendMessagesInput,
    containUserMessage,
    newTruncateStart,
    cacheEnable,
    model,
    chatModels,
    codeChatApiKey,
    isReAct,
    effectiveRules,
    agentTaskDirective,
    enableSubagent,
    agents,
    session,
    enablePlanMode,
    todoList,
    codebaseChatMode,
    activeChangeId,
    activeFeatureId,
    extraTailUserMessage,
    currentUserContent,
  } = input;

  // 入参不可变:全程操作复本
  const sendMessages: ChatMessage[] = [...sendMessagesInput];
  if (extraTailUserMessage) {
    sendMessages.push(extraTailUserMessage);
  }

  // ---- agent reminders(原 L4297-4317)----
  const systemReminders: string[] = [];
  if (enableSubagent && agents.length > 0) {
    systemReminders.push(buildAgentListingReminder(agents));
  }
  if (agentTaskDirective) {
    const invocationReminder = wrapSystemReminder(
      generateSubagentConstraintText(agentTaskDirective.agentName),
    );
    systemReminders.push(invocationReminder);
  }
  const agentReminders =
    systemReminders.length > 0 ? systemReminders.join('\n\n') : undefined;

  // ---- system prompt(原 L4318-4342)----
  const getCodebaseChatSystemPrompt =
    useWorkspaceStore.getState().getCodebaseChatSystemPrompt;
  const codebaseChatSystemPrompt = getCodebaseChatSystemPrompt({
    isReAct,
    effectiveRules,
    agentReminders,
  });

  if (cacheEnable) {
    const parts = codebaseChatSystemPrompt
      .split(CACHE_TIER_BREAK)
      .filter(Boolean);
    sendMessages.unshift({
      role: ChatRole.System,
      content: parts.map((text) => ({
        type: ChatMessageContent.Text,
        text,
      })),
    });
  } else {
    sendMessages.unshift({
      role: ChatRole.System,
      content: codebaseChatSystemPrompt
        .split(CACHE_TIER_BREAK)
        .join('\n'),
    });
  }

  // ---- serialize(原 L4343-4354)----
  const filteredMessages = await serializeCodebaseMessages({
    model,
    sendMessages,
    session,
    isReAct,
    status: 1,
    iterator: (message) => {
      stripImagesForUnsupportedModel(message, chatModels[model]);
    },
  });

  // ---- 内置 prompt 重组(原 L4356-4379),命中时由调用方负责 reset ----
  let shouldResetChatPromptStore = false;
  const chatPromptStoreState = useChatPromptStore.getState();
  if (
    chatPromptStoreState.prompt &&
    ![
      ...BUILT_IN_PROMPTS.map((prompt) => prompt.name),
      ...BUILT_IN_PROMPTS_OPENSPEC_V023.map((p) => p.name),
      ...BUILT_IN_PROMPTS_OPENSPEC_V1.map((p) => p.name),
      ...BUILT_IN_PROMPTS_SPECKIT.map((p) => p.name),
    ].includes(chatPromptStoreState.prompt.name)
  ) {
    const currentMessageIndex = filteredMessages.length - 1;
    filteredMessages[currentMessageIndex].content =
      reassembleContentWithImages(
        filteredMessages[currentMessageIndex].content,
        currentUserContent ?? '',
      );
    shouldResetChatPromptStore = true;
  }

  // ---- mermaid 替换(原 L4381-4411),命中时由调用方负责 reset ----
  let shouldResetPromptApp = false;
  const prompApp = usePromptApp.getState();
  const metaId = prompApp?.runner?.meta?._id || '';
  const targetPrompt = MERMAID_PROMPT_MAP[metaId];
  if (targetPrompt) {
    const lastMessage: ChatMessage =
      filteredMessages[filteredMessages.length - 1];
    const originalPrompt = prompApp?.runner?.meta?.prompt || '';
    const replaceContent = (text: string) =>
      `${targetPrompt}\n${text.replace(originalPrompt, '')}`;

    if (typeof lastMessage.content === 'string') {
      lastMessage.content = replaceContent(lastMessage.content);
    } else if (
      isArray(lastMessage.content) &&
      lastMessage.content[0]?.type === 'text'
    ) {
      lastMessage.content[0].text = replaceContent(
        lastMessage.content[0].text,
      );
    }
    shouldResetPromptApp = true;
  }

  // ---- forceIncludeTask + tools(原 L4414-4452)----
  const forceIncludeTask = !!agentTaskDirective;

  // 将约束指令也注入到最后一条 user message 末尾,提高 LLM 遵从率
  // system prompt 中的 reminder 容易被稀释,user message 末尾权重更高
  // (原 chat.ts L4417-4441)
  if (agentTaskDirective) {
    const lastMessage = filteredMessages[filteredMessages.length - 1];
    const constraintReminder = wrapSystemReminder(
      generateSubagentConstraintText(agentTaskDirective.agentName),
    );
    if (typeof lastMessage.content === 'string') {
      lastMessage.content = `${lastMessage.content}\n\n${constraintReminder}`;
    } else if (isArray(lastMessage.content)) {
      const blocks = lastMessage.content as Array<{ type: string; text?: string }>;
      let lastTextBlock: { type: string; text?: string } | undefined;
      for (let i = blocks.length - 1; i >= 0; i--) {
        if (blocks[i].type === ChatMessageContent.Text) {
          lastTextBlock = blocks[i];
          break;
        }
      }
      if (lastTextBlock) {
        lastTextBlock.text += `\n\n${constraintReminder}`;
      } else {
        blocks.push({ type: ChatMessageContent.Text, text: constraintReminder });
      }
    }
  }

  const getCodebaseChatTools =
    useWorkspaceStore.getState().getCodebaseChatTools;

  const data: ChatPromptBody = {
    messages: filteredMessages,
    model: getAIGWModel(model),
    mode_type: 'main.agent',
    stream: true,
    tool_choice: model.startsWith('claude') ? undefined : 'auto',
    tools: getCodebaseChatTools({ forceIncludeTask }),
  };

  // ---- apiKey(原 L4428-4439)----
  if (codeChatApiKey) {
    try {
      const [apiId, apiKey] = codeChatApiKey.split('.');
      if (apiId && apiKey) {
        data.app_id = apiId;
        data.app_key = apiKey;
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ---- temperature(原 L4441-4442)----
  data.temperature = 0;

  // ---- 各 message 处理:shortcut/specPrompt/空 tool_calls 清理(原 L4458-4486)----
  for (const message of data.messages) {
    if (message.role === ChatRole.User && message?.shortcutPrompt) {
      message.content = [
        {
          type: ChatMessageContent.Text,
          text:
            message?.shortcutPrompt.content +
            '\n' +
            getContentString(message.content),
        },
      ];
    }
    if (message.tool_calls && !message.tool_calls.length) {
      delete message.tool_calls;
    }
    if (message.specPrompt) {
      const realPrompt = specPromptMap[message.specPrompt];
      if (Array.isArray(message.content)) {
        message.content.unshift({
          type: ChatMessageContent.Text,
          text: realPrompt,
        });
      } else {
        message.content = realPrompt + '\n\n' + message.content;
      }
    }
  }

  // ---- reuseDuplicateFileRead(原 L4488-4492)----
  reuseDuplicateFileRead({
    messages: data.messages,
    triggerReuse: !cacheEnable || newTruncateStart >= 0,
  });

  // ---- thinking signature(原 L4495)----
  configureThinkingSignature(chatModels[model], data);

  // ---- cache marks(原 L4497-4500)----
  if (cacheEnable) {
    data.messages = addCacheMarksToMessages(data.messages);
    data.tools = addCacheMarksToTools(data.tools);
  }

  // ---- 补丢失 user(原 L4502-4534)----
  if (!containUserMessage && session.data) {
    const sessionMessages = session.data.messages;
    const lastUserIndex = findLastIndex(
      sessionMessages,
      (msg) => msg.role === ChatRole.User,
    );
    if (lastUserIndex >= 0) {
      const lastUserMessage = sessionMessages[lastUserIndex];
      let lastUserContent: ChatMessageContentUnion[] = [];
      if (Array.isArray(lastUserMessage.content)) {
        lastUserContent = lastUserMessage.content;
      } else {
        lastUserContent = [
          {
            type: ChatMessageContent.Text,
            text: lastUserMessage.content,
          },
        ];
      }
      data.messages.push({
        role: ChatRole.User,
        content: [
          {
            type: ChatMessageContent.Text,
            text:
              getPlanContextTruncationInstruction() +
              `<important>\n由于上文长度限制，未展示所有历史对话消息，请不要继续调用多工具，尝试总结并回复，若已有消息不足以得出结论，提示用户提供更多信息\n\n原始题内容如下:</important>\n\n`,
          },
          ...lastUserContent,
        ],
      });
    }
  }

  // ---- max_tokens(原 L4572-4582)----
  let DEFAULT_MAX_TOKENS = 10240;
  if ([ChatModel.Gemini25, ChatModel.Gemini3Pro].includes(model)) {
    DEFAULT_MAX_TOKENS = 32000;
  }
  data.max_tokens = Math.max(
    data.max_tokens || 0,
    DEFAULT_MAX_TOKENS,
    chatModels[model]?.tokenInfo?.maxOutputTokens || 10240,
  );

  // ---- plan 模式注入 todo(原 L4602-4608)----
  if (
    enablePlanMode &&
    !['openspec', 'speckit'].includes(codebaseChatMode || '')
  ) {
    injectTodoListToLastUserMessage(data.messages, todoList);
  }

  // // ---- DeepSeek 扁平化(原 L4611)----
  // convertDeepseekMessages(model, data.messages);

  // ---- 清理无关属性(原 L4613)----
  clearContextWithUnrelatedProperties(data.messages);

  // ---- 模型差异处理(原 L4615-4629)----
  if (
    data.model.includes('gpt-5')
  ) {
    delete data.temperature;
  } else if (
    data.model.includes('gemini') ||
    data.model.includes('Gemini')
  ) {
    data.messages[0].content += `\nNote:Don't repeat yourself`;
    data.temperature = 1;
  } else if (
    [ChatModel.Glm47, ChatModel.Glm5, ChatModel.Glm5Turbo, ChatModel.Glm51].includes(
      data.model as ChatModel,
    )
  ) {
    data.temperature = 2;
    data.top_p = 0.95;
  } else if (data.model.includes('claude')) {
    data.temperature = 1;
  } else if (data.model.includes('deepseek')) {
    data.temperature = 1;
  }


  // ---- 杂项业务字段(原 L4635-4643)----
  data.codebase_chat_mode = codebaseChatMode || 'vibe';
  if (activeChangeId) {
    data.active_change_id = activeChangeId;
  }
  if (activeFeatureId) {
    data.active_feature_id = activeFeatureId;
  }

  // dev-mode 冻结产物,防止调用方对 data.xxx 做魔改。
  // 严格模式下(import '...' 模块顶层默认严格)违规赋值会抛 TypeError,
  // 配合 interface 上的 readonly 修饰符,静态 + 运行时双重保护。
  if (process.env.NODE_ENV === 'development') {
    Object.freeze(data);
  }

  return {
    data,
    shouldResetChatPromptStore,
    shouldResetPromptApp,
  };
}
