import { batchReport } from '../services/report';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { useExtensionStore } from '../store/extension';
import { LocalRepoType, useWorkspaceStore } from '../store/workspace';
import { UserEvent } from '../types/report';
import { getLanguageFromFilePath } from './getLanguageFromFilePath';

interface UserEventData {
  event: UserEvent | string;
  message?: string;
  extends?: Record<string, unknown>;
  trace_id?: string;
}

interface UserEventSubmitData extends UserEventData {
  user: string;
  department?: string;
  department_code?: string;
  code_generate_model_code?: string;
  app_version?: string;
  plugin_version?: string;
}

// production
const UPLOAD_TIMEOUT = 60 * 1000;
// development
// const UPLOAD_TIMEOUT = 5 * 1000;

// 队列最大缓存条数
const QUEUE_LIMIT = 10;

class UserReporter {
  private queue: UserEventData[] = [];
  private timer: number | null = null;
  // 防抖，避免瞬间（误触等）触发多条事件
  private debounceTimer: number | null = null;
  // private prevEvent: string | null = null;

  public report(message: UserEventData) {
    // 同时突然触发两条相同事件
    // 对于 UserEvent.WEB_ERROR 的上报，需要将所有错误事件进行采集，不需要防抖
    // if (
    //   message.event === this.prevEvent &&
    //   message.event !== UserEvent.WEB_ERROR
    // ) {
    //   if (this.debounceTimer) {
    //     return;
    //   }
    // }

    // codebase_chat_mode 字段记录
    if (message.event.startsWith('CodeChat.')) {
      message.extends = message.extends || {};
      const activeChangeId = useChatStore.getState().activeChangeId;
      const activeFeatureId = useChatStore.getState().activeFeatureId;
      const chatType = useChatStore.getState().chatType;
      const codebaseChatMode = useChatStore.getState().codebaseChatMode;
      message.extends.chat_type = chatType;
      message.extends.codebase_chat_mode = codebaseChatMode;
      if (activeChangeId) {
        message.extends.active_change_id = activeChangeId;
      }
      if (activeFeatureId) {
        message.extends.active_feature_id = activeFeatureId;
      }
      const filePath: string = (message.extends as any).filePath || (message.extends as any).file_path;
      if (filePath) {
        message.extends.language = getLanguageFromFilePath(filePath);
      }
    }

    // this.prevEvent = message.event;
    this.queue.push(message);

    this.debounceTimer = window.setTimeout(() => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    }, 800);

    if (this.queue.length >= QUEUE_LIMIT) {
      this.submit();
    } else {
      // 若 UPLOAD_TIMEOUT 时间内队列中条数不足10条，依旧触发上传机制
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.timer = window.setTimeout(() => {
        this.submit();
      }, UPLOAD_TIMEOUT);
    }
  }

  public batchReport(messages: UserEventData[], isSubmit = false) {
    for (const message of messages) {
      // codebase_chat_mode 字段记录
      if (message.event.startsWith('CodeChat.')) {
        message.extends = message.extends || {};
        const chatType = useChatStore.getState().chatType;
        const codebaseChatMode = useChatStore.getState().codebaseChatMode;
        const activeChangeId = useChatStore.getState().activeChangeId;
        const activeFeatureId = useChatStore.getState().activeFeatureId;
        message.extends.chat_type = chatType;
        message.extends.codebase_chat_mode = codebaseChatMode;
        if (activeChangeId) {
          message.extends.active_change_id = activeChangeId;
        }
        if (activeFeatureId) {
          message.extends.active_feature_id = activeFeatureId;
        }
        const filePath: string = (message.extends as any).filePath || (message.extends as any).file_path;
        if (filePath) {
          message.extends.language = getLanguageFromFilePath(filePath);
        }
      }
      this.queue.push(message);
    }

    // 立即提交
    if (isSubmit) {
      return this.submit();
    }

    this.debounceTimer = window.setTimeout(() => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    }, 800);

    if (this.queue.length >= QUEUE_LIMIT) {
      this.submit();
    } else {
      // 若 UPLOAD_TIMEOUT 时间内队列中条数不足10条，依旧触发上传机制
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.timer = window.setTimeout(() => {
        this.submit();
      }, UPLOAD_TIMEOUT);
    }
  }

  public async submit() {
    const messages = this.queue;
    if (!messages.length) {
      return;
    }
    this.clear();

    const userExtends = useAuthStore.getState().authExtends;
    const user = useAuthStore.getState().username || '';
    const generateModelCode =
      useExtensionStore.getState().generateModelCode || '';
    const pluginVersion = useExtensionStore.getState().codeMakerVersion || '';
    const appVersion = useExtensionStore.getState().IDE || '';
    const workspaceInfo = useWorkspaceStore.getState().workspaceInfo;

    const submitMessages: UserEventSubmitData[] = messages.map((message) => ({
      ...message,
      user: user,
      department_code: userExtends.department_code,
      department: userExtends.department,
      code_generate_model_code: generateModelCode,
      plugin_version: pluginVersion,
      app_version: appVersion,
      workspace: {
        vcs_type: workspaceInfo.repoType === LocalRepoType.GIT ? 'gitlab' : workspaceInfo.repoType,
        vcs_url: workspaceInfo.repoUrl,
        root_path: workspaceInfo.workspace,
      }
    }));

    let retries = 5;
    async function run() {
      if (!retries) {
        return;
      }
      try {
        retries--;
        await batchReport(submitMessages);
      } catch (error) {
        console.error(error);
        run();
      }
    }
    run();
  }

  clear() {
    this.queue = [];
  }

  public getter() {
    return this.queue;
  }
}

export type PrePromptEvent = Pick<
  typeof UserEvent,
  | 'CODE_CHAT_PROMPT_EXPLAIN'
  | 'CODE_CHAT_PROMPT_OPTIMIZE'
  | 'CODE_CHAT_PROMPT_FIND_PROBLEM'
  | 'CODE_CHAT_PROMPT_CUSTOM'
>;

export enum ReportErrorType {
  Uncaught = 'uncaught',
  Request = 'request',
}

const userReporter = new UserReporter();
export default userReporter;
