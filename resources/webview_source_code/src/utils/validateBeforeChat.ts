import { createStandaloneToast } from '@chakra-ui/react';
import { CreateCustomToast } from '../components/CustomToast';
import { ChatMessage, ChatMessageContent, ChatMessageContentText, ChatMessageContentUnion, MultipleAttach } from '../services';
import { logger as webToolsLogger, hub as webToolsHub } from '@dep305/codemaker-web-tools';
import { cloneDeep } from 'lodash'
import { ChatSession, getContentString, nanoid } from '../store/chat';
import { UserEvent } from '../types/report';
import { ChatRole } from '../types/chat';
import { PromptCategoryType } from '../services/prompt';
import { BUILT_IN_PROMPTS } from '../services/builtInPrompts';
import { parseMentions } from './chatMention';
import { ChatModelSupplyChannel, getModelSupplyChannel, useChatConfig } from '../store/chat-config';
import { ChatModel, IChatModelConfig } from '../services/chatModel';
const { toast } = createStandaloneToast();


// 只有私有模型下才允许 c、lpc 语言使用 chat 的功能
export function validateBeforeChat(
  language: string,
  model: string,
  c_unrestrict: boolean,
) {
  if (!c_unrestrict) {
    // 仅 c_unrestrict 为 true 时可以跳过 c 的校验
    if (language === 'c' || language === 'lpc') {
      const modelConfig = useChatConfig.getState()?.chatModels[model as ChatModel]
      if (modelConfig?.isPrivate) {
        return true
      }
      toast({
        title:
          '为保证项目代码安全，禁止使用商业模型对 C&LPC 代码进行操作。可在 Chat 聊天窗口下切换模型到【私有模型(开源模型私有部署)】再尝试操作',
        status: 'error',
        position: 'top',
        isClosable: true,
        render: CreateCustomToast,
      });
      return false;
    }
  }
  return true;
}

/**
 * 校验代码块数组中是否包含 C/LPC 语言，非 c_unrestrict 用户在公共模型下禁止使用
 */
export function validateCodeBlocksLanguage(
  codeBlocks: { language: string }[] | null,
  model: string,
  c_unrestrict: boolean,
): boolean {
  if (!codeBlocks || codeBlocks.length === 0) {
    return true;
  }
  const hasCLpc = codeBlocks.some(
    (block) => block.language === 'c' || block.language === 'lpc',
  );
  if (!hasCLpc) {
    return true;
  }
  return validateBeforeChat('c', model, c_unrestrict);
}

/**
 * @name 检查Thinking消息列表有效性
 * @param messages
 */
export const checkThinkingSignatureValid = (messages: ChatMessage[]) => {
  let containUserMessage = false
  for (let i = messages.length - 1; i >= 0; i--) {
    const curMessage = messages[i]
    const preMessage = messages[i - 1]
    if (curMessage.role === ChatRole.User) {
      containUserMessage = true
    }
    if (preMessage) {
      if (preMessage.role === ChatRole.User && curMessage.role === ChatRole.Assistant && (
        (!curMessage.thinking_signature || curMessage.thinking_signature === '-') && (
          !!curMessage?.tool_calls?.length
        )
      )) {
        return false
      }
    }
  }
  if (!containUserMessage) {
    return false
  }
  return true
}

/**
 * @name 序列化消息上下文, 用于发送给模型
 * @param message
 */
export const serializeCodebaseMessages = async (
  model: ChatModel,
  sendMessages: ChatMessage[],
  session?: ChatSession,
  isReAct?: boolean
) => {
  const filteredMessages: ChatMessage[] = [];
  for (let i = 0; i < sendMessages.length; i++) {
    const message = cloneDeep(sendMessages[i]);
    delete message._originalRequestData;
    if (message.role === ChatRole.Assistant && message.tool_calls) {
      const filteredToolCalls: any = [];
      for (const toolCall of message.tool_calls) {
        // FIX: 剔除掉无 id 的 toolcall
        if (toolCall.id) {
          if (toolCall.function) {
            if (toolCall.function.name) {
              if (!toolCall.function.arguments) {
                toolCall.function.arguments = JSON.stringify({
                  input: "empty"
                })
              }
              try {
                JSON.parse(toolCall.function.arguments);
              } catch (error) {
                // FIX: 如果参数格式异常，则直接替换为默认值
                toolCall.function.arguments = JSON.stringify({
                  input: "empty"
                })
              }
            }
          }
          if (toolCall.type.includes('function')) {
            toolCall.type = 'function'
          }
          filteredToolCalls.push(toolCall);
        }
      }
      message.tool_calls = filteredToolCalls;
    }
    if (typeof message.content === 'string' && /^\s*$/.test(message.content)) {
      message.content = '-';
    }
    if (Array.isArray(message.content)) {
      for (const msgContent of message.content) {
        if (msgContent.type === ChatMessageContent.Text) {
          const textContent = msgContent as ChatMessageContentText;
          if (typeof textContent.text === 'string' && /^\s*$/.test(textContent.text)) {
            textContent.text = '-';
          }
        }
      }
      if (message.role === ChatRole.User) {
        if (message.content[0].type === ChatMessageContent.Text) {
          if (message.systemPrompt?.type === PromptCategoryType._CodeMaker && BUILT_IN_PROMPTS.some(prompt =>
            prompt.name === message.systemPrompt?.name
          )) {
            message.content[0].text = message.systemPrompt.prompt
          } else {
            message.content[0].text = `<user_query>${message.content[0].text}</user_query>`
          }
        }

        if (message.attachs) {
          const currentContent = getContentString(
            message.content,
          );
          const currentAttach = message.attachs[0] as MultipleAttach;
          message.content = await parseMentions(currentContent, currentAttach.attachs);
        }
      }
    }
    const extraUserMessage: ChatMessage = {
      id: `${message.id || '0'}-1`,
      role: ChatRole.User,
      content: []
    }
    let hasToolImageContent = false;
    if (message.role === ChatRole.Tool && !isReAct) {
      // 确保 content 不为空
      message.content = message.content || '';
      if (Array.isArray(message.content)) {
        for (const msgContent of message.content) {
          if (msgContent.type === ChatMessageContent.ImageUrl) {
            hasToolImageContent = true;
            (extraUserMessage.content as ChatMessageContentUnion[]).push(msgContent)
          }
        }
        message.content = message.content.filter(msgContent => msgContent.type === 'text').map(msgContent => msgContent.text).join('\n');
      }
    }
    if (isReAct) {
      const tool_calls = message.tool_calls;
      delete message.tool_calls;
      if (message.role !== ChatRole.Tool) {
        filteredMessages.push(message);
      }
      if (message.role === ChatRole.Assistant && tool_calls && message.tool_result && Object.keys(message.tool_result).length > 0) {
        let messageContent = '';
        tool_calls.forEach((tool) => {
          messageContent += `[${tool.function.name} for ${tool.function.arguments}] Results:\n\n`;
          if (message.tool_result && message.tool_result[tool.id]) {
            messageContent += `${message.tool_result[tool.id].content}\n\n` || '(empty)\n\n'
          } else {
            messageContent += '(empty)\n\n'
          }
        });
        filteredMessages.push({
          id: nanoid(),
          role: ChatRole.User,
          content: messageContent,
        });
      }
    } else {
      filteredMessages.push(message);
      if (hasToolImageContent) {
        filteredMessages.push(extraUserMessage);
      }
    }
  }
  const errorMessages: string[] = []
  const modelConfig = useChatConfig.getState()?.chatModels?.[model] as IChatModelConfig
  const hasThinking = modelConfig?.hasThinking
  const isClaudeModel = ["claude"].includes(modelConfig?.supplyChannel?.toLowerCase?.() || '') || modelConfig?.useModel?.startsWith('claude')
  let startIndex = 0
  while (filteredMessages.length > startIndex) {
    const curMessage = filteredMessages[startIndex]
    const nextMessage = filteredMessages[startIndex + 1]
    const preMessage = filteredMessages[startIndex - 1]
    if (!hasThinking && isClaudeModel) {
      delete curMessage.redacted_thinking;
      delete curMessage.thinking_signature;
      delete curMessage.reasoning_content;
      delete curMessage.reasoningContent;
    }
    // 修复有推理内容没有签名的情况
    if (hasThinking && curMessage.role === ChatRole.Assistant && curMessage?.reasoning_content && !curMessage?.thinking_signature) {
      curMessage.reasoning_content = '';
    }
    if (nextMessage) {
      if (nextMessage.role === ChatRole.User && curMessage.role === ChatRole.Assistant && curMessage.tool_calls?.length) {
        curMessage.tool_calls = []
        errorMessages.push('有工具调用信息，但没有tool消息')
      }
      if (curMessage.role === ChatRole.Assistant && curMessage.tool_calls?.length
        && nextMessage.role === ChatRole.Tool
        && nextMessage.tool_call_id && curMessage.tool_calls.every(tool => tool.id !== nextMessage.tool_call_id)) {
        // 工具信息对应不上则该消息无效
        filteredMessages.splice(startIndex, 1)
        filteredMessages.splice(startIndex, 1)
        startIndex--
        errorMessages.push('有工具信息，但工具消息执行的Id对应不上')
        continue
      }
      if (nextMessage.role === ChatRole.User && curMessage.role === ChatRole.User) {
        // 合并前一条消息的内容到最新消息
        if (typeof nextMessage.content === 'string') {
          // 如果最后一条的content是string类型,将前一条消息内容通过\n合并
          const curContent = getContentString(curMessage.content);
          nextMessage.content = curContent + '\n' + nextMessage.content;
        } else if (Array.isArray(nextMessage.content)) {
          // 如果最后一条的content是数组类型,将前一条消息转换为数组格式并添加
          const curContent = getContentString(curMessage.content);
          const curContentArray: ChatMessageContentUnion[] = [
            { type: ChatMessageContent.Text, text: curContent }
          ];
          nextMessage.content = [...curContentArray, ...nextMessage.content];
        }
        // 删除前一条消息
        filteredMessages.splice(startIndex, 1)
        errorMessages.push('相邻2个用户消息')
        continue
      } else if (curMessage.role === ChatRole.Tool && ![ChatRole.Assistant, ChatRole.Tool].some(role => preMessage?.role === role)) {
        // 当前是工具消息，且上一条不是Assistant
        filteredMessages.splice(startIndex, 1)
        errorMessages.push('错误的消息格式: Assistant -- Tool')
        continue
      } else if (nextMessage.role === ChatRole.Assistant && curMessage.role === ChatRole.Assistant) {
        // 以旧的Assistant为主，跟上文格式一致
        filteredMessages.splice(startIndex, 1)
        errorMessages.push('错误的消息格式: Assistant -- Assistant')
        continue
      } else if (nextMessage.role === ChatRole.Tool && curMessage.role === ChatRole.User) {
        // 丢弃无效的工具
        filteredMessages.splice(startIndex + 1, 1)
        errorMessages.push('错误的消息格式: User -- Tool')
        continue
      } else if (!curMessage.tool_calls?.length && curMessage.role === ChatRole.Assistant && nextMessage.role === ChatRole.Tool) {
        // 如果出现没有工具调用，但有工具消息
        filteredMessages.splice(startIndex + 1, 1)
        errorMessages.push('Assistant中没有tool_calls信息，消息格式: Assistant -- Tool')
        continue
      }
    }
    startIndex++
  }

  if (hasThinking && isClaudeModel && !checkThinkingSignatureValid(filteredMessages)) {
    errorMessages.push('缺失Thinking字段，默认降级到Claude3.7')
    filteredMessages.forEach(message => {
      delete message.redacted_thinking;
      delete message.thinking_signature;
      delete message.reasoning_content;
      delete message.reasoningContent;
    })
  }

  // 错误类型处理上报
  if (errorMessages.length) {
    webToolsHub.withScope((scope) => {
      scope.setExtras({
        event: UserEvent.SESSION_MESSAGE_EXCEPTION,
        model,
        session_id: session?._id || '',
        session_name: session?.topic || '',
        error_message: errorMessages
      });
      webToolsLogger.captureMessage('');
    });
  }
  return filteredMessages
}

/**
 * 将重复的文件读取，替换为已读标记，默认不启用，因为前缀变化无法命中缓存
 *
 * 当触发截断时，triggerReuse 为 true，才会启用，或者遍历到 reuseStart 时，也会启用（上一次截断的标记）
 */
export function reuseDuplicateFileRead(options: {
  messages: ChatMessage[];
  triggerReuse: boolean;
}) {
  const {
    messages,
    triggerReuse
  } = options;
  let reuseEnable = triggerReuse;
  const fileContentMap = new Map<string, string>();
  const readFileParamMap: Record<string, { offset: number, limit: 0 }[]> = {};
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.reuseStart) {
      reuseEnable = true;
    }
    if (message.role === ChatRole.Assistant && message.tool_calls) {
      const filteredToolCalls: any = [];
      for (const toolCall of message.tool_calls) {
        // FIX: 剔除掉无 id 的 toolcall
        if (toolCall.id) {
          if (toolCall.function) {
            if (['read_file'].includes(toolCall.function.name) && toolCall.function.arguments) {
              if (message.tool_result && message.tool_result[toolCall.id] && message.tool_result[toolCall.id].content) {
                try {
                  const toolcallParams = JSON.parse(toolCall.function.arguments);
                  if (toolcallParams && toolcallParams.path) {
                    if (fileContentMap.has(toolcallParams.path) && readFileParamMap[toolcallParams.path]?.find(i => i.limit === (toolcallParams?.limit || 0) && i.offset === (toolcallParams?.offset || 0))) {
                      // 如果文件已经读取过，将下一条信息，toolcall 结果改为已读标记
                      if (messages[i + 1] && messages[i + 1].role === ChatRole.Tool) {
                        if (reuseEnable) {
                          messages[i + 1].content = '[[NOTE] This file read has been removed to save space in the context window. Refer to the latest file read for the most up to date version of this file.]';
                        }
                      }
                    } else {
                      fileContentMap.set(toolcallParams.path, message.tool_result[toolCall.id].content);
                      if (!Array.isArray(readFileParamMap[toolcallParams.path])) {
                        readFileParamMap[toolcallParams?.path] = []
                      }
                      readFileParamMap[toolcallParams?.path].push({
                        offset: toolcallParams?.offset || 0,
                        limit: toolcallParams?.limit || 0,
                      })
                    }
                  }
                } finally { /* empty */ }
              }
            }
          }
          filteredToolCalls.push(toolCall);
        }
      }
      message.tool_calls = filteredToolCalls;
    }
    if (Array.isArray(message.content)) {
      for (const msgContent of message.content) {
        if (msgContent.type === ChatMessageContent.Text) {
          const textContent = msgContent as ChatMessageContentText;
          const attachFilePattern = new RegExp(`<file_content path="([^"]*)">([\\s\\S]*?)</file_content>`, "g");
          let attachFileMatch;
          const revertFilePattern = new RegExp(`<final_file_content path="([^"]*)">([\\s\\S]*?)</final_file_content>`, "g");
          let revertFileMatch;
          if ((attachFileMatch = attachFilePattern.exec(textContent.text)) !== null) {
            const filePath = attachFileMatch[1];
            const fileContent = attachFileMatch[2];
            if (fileContentMap.has(filePath)) {
              if (reuseEnable) {
                msgContent.text = `<file_content path="${filePath}">[[NOTE] This file read has been removed to save space in the context window. Refer to the latest file read for the most up to date version of this file.]</file_content>`;
              }
            } else {
              fileContentMap.set(filePath, fileContent);
            }
          } else if ((revertFileMatch = revertFilePattern.exec(textContent.text)) !== null) {
            const filePath = revertFileMatch[1];
            const fileContent = revertFileMatch[2];
            if (fileContentMap.has(filePath)) {
              if (reuseEnable) {
                msgContent.text = `<final_file_content path="${filePath}">[[NOTE] This file read has been removed to save space in the context window. Refer to the latest file read for the most up to date version of this file.]</final_file_content>`;
              }
            } else {
              fileContentMap.set(filePath, fileContent);
            }
          }
        }
      }
    } else if (typeof message.content === 'string') {
      let msgContent = message.content;
      const editResultPattern = new RegExp(`<final_file_content path="([^"]*)">([\\s\\S]*?)</final_file_content>`, "g");
      let editResultMatch;
      if ((editResultMatch = editResultPattern.exec(msgContent)) !== null) {
        const filePath = editResultMatch[1];
        const fileContent = editResultMatch[2];
        if (fileContentMap.has(filePath)) {
          if (reuseEnable) {
            msgContent = msgContent.replace(editResultMatch[0], `<final_file_content path="${filePath}">[[NOTE] This file read has been removed to save space in the context window. Refer to the latest file read for the most up to date version of this file.]</final_file_content>`);
          }
        } else {
          fileContentMap.set(filePath, fileContent);
        }
      }
      message.content = msgContent;
    }
    // TODO: 删除字段，改成发送前只提取必要字段
    // delete message.tool_result;
    delete message.response;
  }
}
// Deepseek需要转换成平级消息
export const convertDeepseekMessages = (
  model: ChatModel,
  sendMessages: ChatMessage[],
) => {
  if (getModelSupplyChannel(model) === ChatModelSupplyChannel.DEEPSEEK) {
    sendMessages.forEach(message => {
      if (message.role === ChatRole.User) {
        message.content = getContentString(message.content);
      }
    })
  }
}

/**
 * @name 修复上下文工具Id异常，导致无法访问Claude系列模型
 */
export const repairToolIdOfMessages = (messages: ChatMessage[], usedModel: string) => {
  if (!usedModel) return messages

  // Claude系列
  if (usedModel.toLocaleLowerCase().includes('claude')) {

    const generateValidToolId = (length = 24) => {
      const prefix = "toolu_bdrk_";
      const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let randomPart = "";
      for (let i = 0; i < length; i++) {
        randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return `${prefix}${randomPart}`;
    }
    const toolIdRegex = /^toolu_bdrk_[a-zA-Z0-9]{24}$/;
    const idMap: Record<string, string> = {};

    for (const message of messages) {
      if (message.role === ChatRole.Assistant && Array.isArray(message.tool_calls)) {
        for (const toolCall of message.tool_calls) {
          const originalId = toolCall.id;
          if (!originalId || !toolIdRegex.test(originalId)) {
            const newId = generateValidToolId();
            if (originalId) {
              idMap[originalId] = newId;
            }
            toolCall.id = newId;
          }
        }
      } else if (message.role === ChatRole.Tool && message?.tool_call_id && idMap[message?.tool_call_id]) {
        message.tool_call_id = idMap[message.tool_call_id];
      }
    }
  }

  return messages
}
