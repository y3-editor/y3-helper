import { ChatPromptBody } from "../services";
import { IChatModelConfig } from "../services/chatModel";
import { useChatStore } from "../store/chat";
import { CHAT_MIN_TOKENS, ChatModelSupplyChannel } from "../store/chat-config";
import { checkThinkingSignatureValid } from "./validateBeforeChat";


/**
 * 为支持 thinking 的 Claude 模型配置相关参数
 * @param modelConfig 当前模型配置
 * @param data 聊天请求数据
 * @param isThinkingSignatureValid thinking 签名是否有效
 */
export const configureThinkingSignature = (
  modelConfig: IChatModelConfig,
  data: ChatPromptBody,
) => {
  const channel = modelConfig?.supplyChannel?.toLocaleLowerCase?.()
  const chatType = useChatStore.getState().chatType

  switch (channel) {
    case ChatModelSupplyChannel.CLAUDE: {
      // 检查模型是否支持 thinking 功能
      if (!modelConfig.hasThinking || !checkThinkingSignatureValid(data.messages)) {
        break;
      }
      if (chatType === 'codebase') {
        data.max_tokens = modelConfig?.tokenInfo?.maxOutputTokens || 10240;
      }
      // 计算预算 token 数量，确保不少于 1024
      const budgetToken = Math.max(
        Math.floor((data?.max_tokens || CHAT_MIN_TOKENS) / 2),
        1024,
      );
      if (!data.extra_body) data.extra_body = {}
      // 设置 thinking 配置
      Object.assign(data.extra_body, {
        thinking: {
          type: 'enabled',
          budget_tokens: budgetToken,
        },
      })
      break;
    }
    case ChatModelSupplyChannel.GLM: {
      if (!modelConfig.hasThinking || !checkThinkingSignatureValid(data.messages)) {
        if (!data.extra_body) data.extra_body = {}
        Object.assign(data.extra_body, {
          thinking: {
            type: 'disabled',
          },
        })
      }
      break
    }
    case ChatModelSupplyChannel.KIMI: {
      if (!data.extra_body) data.extra_body = {}
      if (!modelConfig.hasThinking || !checkThinkingSignatureValid(data.messages)) {
        Object.assign(data.extra_body, {
          thinking: {
            type: 'disabled',
          },
        })
      } else {
        Object.assign(data.extra_body, {
          thinking: {
            type: 'enabled',
          },
        })
      }
      break
    }
    default:
      // 对于不支持 thinking 的模型供应商，不做处理
      break;
  }

};