import { ChatPromptBody } from '../../index';
import {
  ABORT_ERROR_NAME,
  createAbortReason,
} from '../../../utils/abort';
import { ChatModelSupplyChannel } from '../../../store/chat-config';
import { IChatModelConfig } from '../../../services/chatModel';
import AzureOpenAIStream from '../stream/azureOpenAI';
import CmCodebaseStream from '../stream/cmCodebase';
import { ICmCodebaseStreamOption } from '../stream/cmCodebase/interface';

enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  ABORTED = 'aborted',
}


/**
 * Agent实例 - 重构 requestCodebaseChatStream 逻辑
 */
export class AgentEntry {
  public name = 'CodebaseAgent'
  public description = '仓库智聊 Agent'
  public status: AgentStatus = AgentStatus.IDLE

  private abortController: AbortController | null = null
  private stream: AzureOpenAIStream | CmCodebaseStream | null = null



  /**
   * 开始执行仓库智聊流式请求
   */
  public async execute(
    chatModelConfig: IChatModelConfig,
    data: ChatPromptBody,
    options: ICmCodebaseStreamOption
  ): Promise<void> {
    if (this.status === AgentStatus.RUNNING) {
      return
    }
    const supplyChannel = chatModelConfig?.supplyChannel?.toLocaleLowerCase?.() ?? ''
    this.status = AgentStatus.RUNNING
    const commonOptions = {
      ...options,
      onController: (controller: AbortController) => {
        this.abortController = controller;
        options.onController?.(controller);
      },
      onFinish: () => {
        this.status = AgentStatus.IDLE;
      },
      onError: (error: Error) => {
        options.onError?.(error);
        this.status = AgentStatus.IDLE;
      }
    }
    // Y3 真实链路说明（2026-04-27 同步时确认）：
    //   1. Y3 在 App.tsx 注入 fixedModel 到 chatModels 时未设 supplyChannel，
    //      所以即使用户填 GPT-5/Codex，supplyChannel 依旧是 undefined
    //   2. 因此实际永远走 default 分支（CmCodebaseStream）→ /proxy/gpt/u5_chat/codebase_chat_stream
    //      → api-server (streamChatCompletion) → 用户配置的上游（Chat Completions 或 Responses 协议）
    //   3. AzureOpenAIStream 通路在 Y3 是 dead code（前端发往 /proxy/cm/openai/v1/responses
    //      的请求 api-server 没注册路由），但保留代码以便未来同步上游不冲突
    switch (supplyChannel) {
      case ChatModelSupplyChannel.GPT:
        // Y3 不会走到这里（见上方说明）
        this.stream = new AzureOpenAIStream(data, commonOptions);
        break;
      default: {
        this.stream = new CmCodebaseStream(data, commonOptions);
        break
      }
    }
  }

  /**
   * 终止执行
   */
  public abort(): void {
    this.status = AgentStatus.ABORTED;
    if (this.abortController) {
      this.abortController.abort(createAbortReason(ABORT_ERROR_NAME, 'AgentEntry.abort'));
    }
    this.stream?.close?.()
  }

}


// 单例获取 AgentEntry 实例
let agentEntryInstance: AgentEntry | null = null
export const getCodemakerAgentEntry = () => {
  if (!agentEntryInstance) {
    agentEntryInstance = new AgentEntry()
  }
  return agentEntryInstance
}