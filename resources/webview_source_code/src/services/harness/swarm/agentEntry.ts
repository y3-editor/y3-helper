
import { ChatPromptBody } from '../../index';
import {
  ABORT_REASON_USER_CANCELLED,
  createAbortReason,
} from '../../../utils/abort';
import { ChatModelSupplyChannel } from '../../../store/chat-config';
import { IChatModelConfig } from '../../../services/chatModel';
import AzureOpenAIStream from '../stream/azureOpenAI';
import CmCodebaseStream from '../stream/cmCodebase';
import { ICmCodebaseStreamOption } from '../stream/cmCodebase/interface';

export enum AgentStatus {
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
        // 用户中止后保持 ABORTED 状态，避免后续异步回调（tool_result 落回触发的
        // handleAutoExecute）绕过 chat.ts 中 status !== 'aborted' 的 guard 再次发起请求。
        // ABORTED → IDLE 的重置由用户主动重试/新提交时的入口负责。
        if (this.status !== AgentStatus.ABORTED) {
          this.status = AgentStatus.IDLE;
        }
      },
      onError: (error: Error) => {
        options.onError?.(error);
        if (this.status !== AgentStatus.ABORTED) {
          this.status = AgentStatus.IDLE;
        }
      }
    }
    switch (supplyChannel) {
      case ChatModelSupplyChannel.GPT:
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
      this.abortController.abort(createAbortReason(ABORT_REASON_USER_CANCELLED, __ABORT_LOC__));
    }
    this.stream?.close?.(ABORT_REASON_USER_CANCELLED)
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
