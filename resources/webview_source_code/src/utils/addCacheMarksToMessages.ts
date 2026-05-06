import { cloneDeep, findLastIndex, isEqual } from "lodash";
import { ChatMessage } from "../services";
import { Tool } from "../store/workspace";

/**
 * AIGW：在 tools 数组最后一项上打 cache_control，整份工具声明参与 5min 缓存。
 */
export function addCacheMarksToTools(tools: Tool[] | undefined): Tool[] | undefined {
  if (!tools || tools.length === 0) {
    return tools;
  }
  const lastToolIdx = tools.length - 1;
  return tools.map((tool, i) =>
    i === lastToolIdx
      ? { ...tool, cache_control: { type: "ephemeral" as const } }
      : tool,
  );
}

export default function addCacheMarksToMessages(messages: ChatMessage[]): ChatMessage[] {
  const sendMessages = cloneDeep(messages);

  // Breakpoint 1: system 前 N 个 slot 内的 text block 打标 AIGW / Anthropic
  const systemMessage = sendMessages.find(m => m.role === 'system');
  if (systemMessage && Array.isArray(systemMessage.content) && systemMessage.content.length > 0) {
    for (let i = 0; i < Math.min(1, systemMessage.content.length); i++) {
      const block = systemMessage.content[i];
      if (block.type === "text") {
        (block as any).cache_control = { type: "ephemeral" as const };
      }
    }
  }

  // Breakpoints 3-4: 最后一条 user + 最后一条 non-system（重叠时回退到前一条 non-system）AIGW
  const conversationIndexes: number[] = [];
  const lastUserIndex = findLastIndex(sendMessages, (m) => m.role === "user");
  // const lastUserIndex = -1;
  const lastNonSystemIndex = findLastIndex(sendMessages, (m) => m.role !== "system");

  if (lastUserIndex !== -1) {
    conversationIndexes.push(lastUserIndex);
  }
  if (lastNonSystemIndex !== -1 && !conversationIndexes.includes(lastNonSystemIndex)) {
    conversationIndexes.push(lastNonSystemIndex);
  } else if (lastNonSystemIndex !== -1) {
    const prevNonSystemIndex = findLastIndex(
      sendMessages,
      (m) => m.role !== "system",
      lastNonSystemIndex - 1,
    );
    if (prevNonSystemIndex !== -1 && !conversationIndexes.includes(prevNonSystemIndex)) {
      conversationIndexes.push(prevNonSystemIndex);
    }
  }

  for (const idx of conversationIndexes) {
    const msg = sendMessages[idx];
    if (Array.isArray(msg.content) && msg.content.length > 0) {
      const lastBlock = msg.content[msg.content.length - 1];
      (lastBlock as any).cache_control = { type: "ephemeral" as const };
    } else if (typeof msg.content === "string") {
      msg.content = [
        {
          type: "text" as const,
          text: msg.content,
          cache_control: { type: "ephemeral" as const },
        },
      ] as any;
    }

    if (msg.role === "assistant" && msg.tool_calls?.length) {
      const tcs = msg.tool_calls;
      tcs[tcs.length - 1] = {
        ...tcs[tcs.length - 1],
        cache_control: { type: "ephemeral" as const },
      } as any;
    }
  }

  return sendMessages;
}

let lastMessages: ChatMessage[] = [];
let lastCacheMessageId = '';
let lastTools: Tool[] = [];

export function checkReusable(options: {
  messages: ChatMessage[];
  tools: Tool[];
}) {
  const {
    messages,
    tools
  } = options;
  const cloneMessages = cloneDeep(messages);
  const thisTimeMessages = cloneMessages.map((message) => {
    return {
      id: message.id,
      content: message.content,
      role: message.role
    }
  });
  const thisTools = cloneDeep(tools);
  const thisTimeCacheIndex = findLastIndex(cloneMessages, (message) => message.cache_control?.type === 'ephemeral');
  if (thisTimeCacheIndex !== -1) {
    if (lastCacheMessageId) {
      const lastTimeCacheIndex = findLastIndex(thisTimeMessages, (message) => message.id === lastCacheMessageId);
      if (lastTimeCacheIndex === -1) {
        console.log('prompt cache: 上次缓存消息不存在, 无法命中缓存');
      } else if (!isEqual(thisTimeMessages.slice(0, lastTimeCacheIndex + 1), lastMessages)) {
        console.log(thisTimeMessages.slice(0, lastTimeCacheIndex + 1));
        console.log(lastMessages);
        for (let i = 0; i < thisTimeMessages.slice(0, lastTimeCacheIndex + 1).length; i++) {
          if (!isEqual(thisTimeMessages.slice(0, lastTimeCacheIndex + 1)[i], lastMessages[i])) {
            console.log('prompt cache: 第' + i + '条消息不匹配, 无法命中缓存');
          }
        }
        console.log('prompt cache: messages 不匹配, 无法命中缓存');
      } else if (!isEqual(thisTools, lastTools)) {
        console.log('prompt cache: tools 不匹配, 无法命中缓存');
      } else {
        console.log('prompt cache: 前缀匹配，可命中缓存');
      }
    }
    lastCacheMessageId = cloneMessages[thisTimeCacheIndex].id || '';
    lastMessages = thisTimeMessages.slice(0, thisTimeCacheIndex + 1);
    lastTools = thisTools;
  } else {
    console.log('prompt cache: 本次未设置缓存标记');
  }
}