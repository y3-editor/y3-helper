/* eslint-disable react-refresh/only-export-components */

import * as React from 'react';
import { useAuthStore } from './store/auth';
import { useExtensionStore } from './store/extension';
import { useEditorFileState } from './store/editor';
import { useWorkspaceStore, SpecInfo } from './store/workspace';
import { autoSelectActiveChangeOrFeature } from './store/chat';

// 广播的事件，webview -> IDE
export enum BroadcastActions {
  Login = 'LOGIN',
  LOGOUT = 'LOGOUT',
  GET_INIT_DATA = 'GET_INIT_DATA',
  COPY_TO_CLIPBOARD = 'COPY_TO_CLIPBOARD',
  INSERT_TO_EDITOR = 'INSERT_TO_EDITOR',
  INSERT_WITH_DIFF = 'INSERT_WITH_DIFF',
  SEARCH_AND_OPEN = 'SEARCH_AND_OPEN',
  STOP_CODE_SEARCH = 'STOP_CODE_SEARCH',
  INIT_REVIEW_DATA = 'INIT_REVIEW_DATA',
  STOP_CODE_REVIEW = 'STOP_CODE_REVIEW',
  REMOVE_REVIEW = 'REMOVE_REVIEW',
  // 使用用户的浏览器打开 url
  OPEN_IN_BROWSER = 'OPEN_IN_BROWSER',
  // 唤出重新登录框
  RE_LOGIN = 'RE_LOGIN',
  // reload window
  RELOAD = 'RELOAD',
  UPDATE_GATEWAY = 'UPDATE_GATEWAY',
  // 获取 workspace 中的文件
  GET_WORKSPACE_FILES = 'GET_WORKSPACE_FILES',
  EXPORT_FILE = 'EXPORT_FILE',
  // 插件 app 交互
  PLUGIN_APP_ACTION_START = 'PLUGIN_APP_ACTION_START',
  PLUGIN_APP_ACTION_END = 'PLUGIN_APP_ACTION_END',
  PLUGIN_APP_CHECK_STATUS = 'PLUGIN_APP_CHECK_STATUS',
  PROXY_REQUEST = 'PROXY_REQUEST',
  // 获取 editor 中当前文件的 meta 信息
  GET_EDITOR_FILE_STATE = 'GET_EDITOR_FILE_STATE',
  // 获取 code search 数据集
  GET_CODE_SEARCH_LIST_CONTEXT = 'GET_CODE_SEARCH_LIST_CONTEXT',
  // 打开文件选择器
  OPEN_FILE_PICKER = 'OPEN_FILE_PICKER',
  // 删除某个文件
  REMOVE_FILE = 'REMOVE_FILE',
  // 上传文件
  UPLOAD_FILE = 'UPLOAD_FILE',
  // 取消上传文件
  CANCEL_UPLOAD_FILE = 'CANCEL_UPLOAD_FILE',
  // 新建文件并且插入代码
  CREATE_FILE_AND_INSERT_CODE = 'CREATE_FILE_AND_INSERT_CODE',
  // 插入命令到终端
  INSERT_TERMINAL = 'INSERT_TERMINAL',
  // 在新窗口打开 Webview
  OPEN_WEBVIEW_IN_NEW_WINDOW = 'OPEN_WEBVIEW_IN_NEW_WINDOW',
  OPEN_SOURCE_CONTROL = 'OPEN_SOURCE_CONTROL',
  // 新增DISCUSSION
  ADD_DISCUSSION = 'ADD_DISCUSSION',
  OPEN_DISCUSSION_FILE = 'OPEN_DISCUSSION_FILE',
  // 打开新MERMAID窗口
  OPEN_MERMAID = 'OPEN_MERMAID',
  // 打开新HTML窗口
  OPEN_HTML = 'OPEN_HTML',
  // 插件调用方法
  TOOL_CALL = 'TOOL_CALL',
  // 打开新PLANTUML窗口
  OPEN_PLANTUML = 'OPEN_PLANTUML',
  // 打开新GRAPHVIZ窗口
  OPEN_GRAPHVIZ = 'OPEN_GRAPHVIZ',
  // 打开文件选择器，更换工作区
  OPEN_WORKSPACE = 'OPEN_WORKSPACE',

  SEARCH_WORKSPACE_PATH = 'SEARCH_WORKSPACE_PATH',
  APPLY_EDIT = 'APPLY_EDIT',
  APPLY_CONFIRM = 'APPLY_CONFIRM',
  APPLY_DENY = 'APPLY_DENY',
  // 预览对比代码
  PREVIEW_DIFF_CODE = 'PREVIEW_DIFF_CODE',
  // 批量应用代码修改
  BATCH_APPLY_CHANGES = 'BATCH_APPLY_CHANGES',
  // 应用单次代码改变
  APPLY_SINGLE_CHANGES = 'APPLY_SINGLE_CHANGES',
  // 更新默认忽略路径
  UPDATE_CODEBASE_IGNORE_PATH = 'UPDATE_CODEBASE_IGNORE_PATH',
  // CodeChat 复制代码
  CODE_CHAT_COPY_CODE = 'CODE_CHAT_COPY_CODE',
  // 获取工作区间错误
  GET_WORKSPACE_PROBLEMS = 'GET_WORKSPACE_PROBLEMS',

  // LocalReview
  GET_LOCAL_REVIEW_CONFIG = 'GET_LOCAL_REVIEW_CONFIG', // 获取 LocalReview 配置
  GET_LOCAL_REVIEW_CONFIG_OLD = 'GET_IDE_CACHE_REVIEWS', // 获取 LocalReview 配置 (Visual Studio)
  SAVE_LOCAL_REVIEW_CONFIG = 'SAVE_LOCAL_REVIEW_CONFIG', // 保存 LocalReview 配置
  START_LOCAL_REVIEW = 'START_LOCAL_REVIEW', // 发起本地待提交代码 Review
  OPEN_LOCAL_REVIEW_FILE = 'OPEN_LOCAL_REVIEW_FILE', // 打开 LocalReview 本地文件
  OPEN_LOCAL_REVIEW_FILE_OLD = 'OPEN_REVIEW_FILE', // 打开 LocalReview 本地文件 (Visual Studio)
  GET_COMMITS_LIST = 'GET_COMMITS_LIST', // 获取 commits 列表（分页）
  SUBMIT_COMMIT_REVIEW = 'SUBMIT_COMMIT_REVIEW', // 提交 Commit Review 请求

  // MCP
  GET_MCP_SERVERS = 'GET_MCP_SERVERS',
  ADD_MCP_SERVERS = 'ADD_MCP_SERVERS',
  UPDATE_MCP_SERVERS = 'UPDATE_MCP_SERVERS',
  REMOVE_MCP_SERVERS = 'REMOVE_MCP_SERVERS',
  OPEN_MCP_SETTING = 'OPEN_MCP_SETTING',
  OPEM_MCP_SETTING = 'OPEM_MCP_SETTING',  // 历史版本拼写错误兼容
  RESTART_MCP_SERVERS = 'RESTART_MCP_SERVERS',
  PING_MCP_SERVERS = 'PING_MCP_SERVERS',
  GET_MCP_PROMPT = 'GET_MCP_PROMPT',

  // New Apply
  REAPPLY_EDIT = 'REAPPLY_EDIT',
  APPLY_CHANGE = 'APPLY_CHANGE',
  REVERT_CHANGE = 'REVERT_CHANGE',
  APPLY_CHANGE_AND_EDIT = 'APPLY_CHANGE_AND_EDIT',
  PREVIEW_DIFF_FILE = 'PREVIEW_DIFF_FILE',
  ACCEPT_EDIT = 'ACCEPT_EDIT',
  REVERT_EDIT = 'REVERT_EDIT',
  BATCH_ACCEPT_EDIT = 'BATCH_ACCEPT_EDIT',
  BATCH_REVERT_EDIT = 'BATCH_REVERT_EDIT',
  CANCEL_APPLY = 'CANCEL_APPLY',
  REAPPLY_REPLACE = 'REAPPLY_REPLACE',
  PREVIEW_DIFF_EDIT = 'PREVIEW_DIFF_EDIT',

  // CodeChat terminal actions
  STOP_TERMINAL_PROGRESS = 'STOP_TERMINAL_PROGRESS',
  SHOW_TERMINAL_WINDOW = 'SHOW_TERMINAL_WINDOW',
  STOP_ALL_TERMINAL = 'STOP_ALL_TERMINAL',

  // 更新 Chat 快捷键设置
  UPDATE_CHAT_SUBMIT_KEY = 'UPDATE_CHAT_SUBMIT_KEY',

  // Chat 请求开始通知
  CHAT_REQUEST_START = 'CHAT_REQUEST_START',
  // Chat 回复完成通知
  CHAT_REPLY_DONE = 'CHAT_REPLY_DONE',

  CREATE_NEW_RULE = 'CREATE_NEW_RULE',
  UPDATE_RULE = 'UPDATE_RULE',
  DELETE_RULE = 'DELETE_RULE',

  GET_RULES = 'GET_RULES',
  GET_SKILLS = 'GET_SKILLS',
  CREATE_SKILL_TEMPLATE = 'CREATE_SKILL_TEMPLATE',
  INSTALL_BUILTIN_SKILL = 'INSTALL_BUILTIN_SKILL',
  UPDATE_SKILL_CONFIG = 'UPDATE_SKILL_CONFIG',
  REMOVE_SKILL = 'REMOVE_SKILL',
  UPLOAD_SKILL = 'UPLOAD_SKILL',

  // 拖拽文件
  DROP_FILES = 'DROP_FILES',

  // 新建并行会话（在新窗口打开 Codebase Chat）

  // 更新面板标题（用于并行会话窗口动态更新标题）
  UPDATE_PANEL_TITLE = 'UPDATE_PANEL_TITLE',
  // Spec 框架
  GET_SPEC_INFO = 'GET_SPEC_INFO', // 请求获取当前仓库的 Spec 信息
  OPEN_SPEC_SETUP = 'OPEN_SPEC_SETUP', // 触发 OpenSpec 初始化流程
  SPECKIT_SETUP = 'SPECKIT_SETUP', // 触发 SpecKit 初始化流程
  OPENSPEC_UPDATE = 'OPENSPEC_UPDATE', // 触发 OpenSpec 升级流程 (0.23 -> 1.x)

  // 检查更新
  OPEN_CHECK_UPDATE = 'OPEN_CHECK_UPDATE', // 检查插件更新
  RELOAD_WINDOW = 'RELOAD_WINDOW', // 重载窗口
}

// 订阅的事件，IDE -> webview
export enum SubscribeActions {
  Login = 'LOGIN',
  LOGOUT = 'LOGOUT',
  INIT_DATA = 'INIT_DATA',
  CHAT_INSERT_CODE = 'CHAT_INSERT_CODE',
  CHAT_ACTION = 'CHAT_ACTION',
  SWITCH_TAB = 'switchTab',
  SET_CHAT_TYPE = 'setChatType',
  CREATE_NEW_SESSION = 'createNewSession',
  APPLY_KEYBOARD_PASTE = 'APPLY_KEYBOARD_PASTE',
  // 插入代码并使用自定义 prompt template
  RUN_CUSTOM_PROMPT_TEMPLATE = 'RUN_CUSTOM_PROMPT_TEMPLATE',
  // worksapce 中的文件
  WORKSPACE_FILES = 'WORKSPACE_FILES',
  // 插件 app 交互
  PLUGIN_APP_STATUS = 'PLUGIN_APP_STATUS',
  JUMP_TO_REVIEW_REQUEST = 'JUMP_TO_REVIEW_REQUEST',
  PROXY_REQUEST_RESPONSE = 'PROXY_REQUEST_RESPONSE',
  PROXY_REQUEST_ERROR = 'PROXY_REQUEST_ERROR',
  RUN_PLUGIN_PROMPT_TEMPLATE = 'RUN_PLUGIN_PROMPT_TEMPLATE',
  // 实时 editor 中当前文件的 meta 信息
  EDITOR_FILE_STATE = 'EDITOR_FILE_STATE',
  // 打开文件之后的回调
  OPEN_FILE_PICKER_RESPONSE = 'OPEN_FILE_PICKER_RESPONSE',
  // 上传文件之后的回调
  UPLOAD_FILE_RESPONSE = 'UPLOAD_FILE_RESPONSE',
  // 取消上传文件之后的回调
  CANCEL_UPLOAD_RESPONSE = 'CANCEL_UPLOAD_RESPONSE',
  // codeSearch返回的列表
  CODE_SEARCH_LIST_CONTEXT = 'CODE_SEARCH_LIST_CONTEXT',
  // 直接发送 CodeChat 消息
  SEND_CODE_CHAT_MESSAGE = 'SEND_CODE_CHAT_MESSAGE',
  // 报错分析
  ERROR_ANALYSIS = 'ERROR_ANALYSIS',
  // 终端输出分析
  EXPLAIN_TERMINAL_SELECTION = 'EXPLAIN_TERMINAL_SELECTION',
  // DISCUSSION发起
  DISCUSSION_SELECTION = 'DISCUSSION_SELECTION',
  // 帮助插件获得文档DISCUSSION
  GET_DISCUSSIONS = 'GET_DISCUSSIONS',
  // 打开discussion详情
  OPEN_DISCUSSIONS_DETAIL = 'OPEN_DISCUSSIONS_DETAIL',
  // 响应插件toast
  TOAST_MESSAGE = 'TOAST_MESSAGE',

  // 自定义 prompt 示例
  SHOW_CUSTOM_PROMPT_SAMPLE = 'SHOW_CUSTOM_PROMPT_SAMPLE',
  // 自定义聊天模式示例
  SHOW_CUSTOM_MASK_SAMPLE = 'SHOW_CUSTOM_MASK_SAMPLE',
  // 打开插件市场
  SHOW_PLUGIN_MARKET = 'SHOW_PLUGIN_MARKET',
  // 选中文件列表
  SELECTED_FILES = 'SELECTED_FILES',
  // 选中目录列表
  SELECTED_PATHS = 'SELECTED_PATHS',
  // 同步工作空间状态
  SYNC_WORKSPACE_INFO = 'SYNC_WORKSPACE_INFO',
  // 获取工作区间文件列表
  GET_WORKSPACE_LIST = 'GET_WORKSPACE_LIST',
  // 同步工作区间文件列表
  SYNC_WORKSPACE_LIST = 'SYNC_WORKSPACE_LIST',
  // 打开文件
  OPEN_NEW_WINDOW = 'OPEN_NEW_WINDOW',
  // TOOL 调用结果
  TOOL_CALL_RESULT = 'TOOL_CALL_RESULT',

  // ide选中信息
  TEXT_EDITOR_SELECTION = 'TEXT_EDITOR_SELECTION',

  APPLY_EDIT_CONFIRM = 'APPLY_EDIT_CONFIRM',
  APPLY_EDIT_CANCEL = 'APPLY_EDIT_CANCEL',
  APPLY_EDIT_START = 'APPLY_EDIT_START',
  APPLY_EDIT_FAILED = 'APPLY_EDIT_FAILED',
  APPLY_EDIT_SUCCESS = 'APPLY_EDIT_SUCCESS',
  // 批量编辑成功
  BATCH_APPLY_CHANGES_SUCCESS = 'BATCH_APPLY_CHANGES_SUCCESS',
  BATCH_APPLY_CHANGES_FAILED = 'BATCH_APPLY_CHANGES_FAILED',
  APPLY_SINGLE_EDIT_SUCCESS = 'APPLY_SINGLE_EDIT_SUCCESS',
  // 获取工作区间错误回调
  ON_GET_WORKSPACE_PROBLEMS = 'ON_GET_WORKSPACE_PROBLEMS',

  // LocalReview
  LOCAL_REVIEW_CONFIG = 'LOCAL_REVIEW_CONFIG', // 获取 LocalReview 配置的回调
  LOCAL_REVIEW_CONFIG_OLD = 'IDE_CACHE_REVIEWS', // 获取 LocalReview 配置的回调 (Visual Studio)
  START_CODE_REVIEW = 'REVIEW_CODE', // 发起 LocalReview (代码片段)
  START_COMMIT_REVIEW = 'LOCAL_COMMIT_REVIEW', // 发起 LocalReview (本地暂存区/已提交代码)
  OPEN_LOCAL_REVIEW_SETTING = 'OPEN_LOCAL_REVIEW_SETTING', // 打开 LocalReview 设置面板
  LOCAL_REVIEW_LOADING_START = 'LOCAL_REVIEW_LOADING_START', // 开启发起LocalReview按钮Loading状态
  LOCAL_REVIEW_LOADING_FINISH = 'LOCAL_REVIEW_LOADING_FINISH', // 关闭发起LocalReview按钮Loading状态
  LOCAL_COMMITS_LIST = 'LOCAL_COMMITS_LIST', // 获取 commits 列表（分页）
  OPEN_COMMIT_REVIEW_MODAL = 'OPEN_COMMIT_REVIEW_MODAL', // 打开 Commit Review 弹窗

  // TeamReview
  REVIEW_SELECTED_FILE = 'REVIEW_SELECTED_FILE', // 对选中的文件发起 TeamReview

  // 质量问题修复功能
  CODEBASE_QUALITY_ISSUE_AUTOFIX = 'CODEBASE_QUALITY_ISSUE_AUTOFIX',

  // MCP
  SYNC_MCP_SERVERS = 'SYNC_MCP_SERVERS',
  GET_MCP_PROMPT_SUCCESS = 'GET_MCP_PROMPT_SUCCESS',
  GET_MCP_PROMPT_ERROR = 'GET_MCP_PROMPT_ERROR',
  SHOW_MCP_ERROR = 'SHOW_MCP_ERROR',

  // New Apply
  SHOW_DIFF_SUCCESS = 'SHOW_DIFF_SUCCESS',
  REAPPLY_EDIT_RESULT = 'REAPPLY_EDIT_RESULT',
  APPLY_CHANGE_SUCCESS = 'APPLY_CHANGE_SUCCESS',
  APPLY_CHANGE_FAILED = 'APPLY_CHANGE_FAILED',
  REVERT_CHANGE_SUCCESS = 'REVERT_CHANGE_SUCCESS',
  REVERT_CHANGE_FAILED = 'REVERT_CHANGE_FAILED',
  ACCEPT_EDIT_RESULT = 'ACCEPT_EDIT_RESULT',
  REVERT_EDIT_RESULT = 'REVERT_EDIT_RESULT',
  BATCH_ACCEPT_EDIT_RESULT = 'BATCH_ACCEPT_EDIT_RESULT',
  BATCH_REVERT_EDIT_RESULT = 'BATCH_REVERT_EDIT_RESULT',
  REAPPLY_REPLACE_RESULT = 'REAPPLY_REPLACE_RESULT',
  PREVIEW_DIFF_RESULT = 'PREVIEW_DIFF_RESULT',
  CREATE_SKILL_TEMPLATE_RESULT = 'CREATE_SKILL_TEMPLATE_RESULT',
  INSTALL_BUILTIN_SKILL_RESULT = 'INSTALL_BUILTIN_SKILL_RESULT',
  REMOVE_SKILL_RESULT = 'REMOVE_SKILL_RESULT',
  UPLOAD_SKILL_RESULT = 'UPLOAD_SKILL_RESULT',

  // Terminal Command
  TERMINAL_TRANSFER_LOG = 'TERMINAL_TRANSFER_LOG',
  NOTIFY_MCP_SERVER_SUCCESS = "NOTIFY_MCP_SERVER_SUCCESS",

  // Workspace Session
  SAVE_WORKSPACE_SESSION = 'SAVE_WORKSPACE_SESSION',

  CURRENT_FILE_CHANGE = 'CURRENT_FILE_CHANGE',

  // 打开或创建研发知识集设置
  OPEN_OR_CREATE_SDETTING = 'OPEN_OR_CREATE_SDETTING',
  EDIT_CODEBASE_RULES = 'EDIT_CODEBASE_RULES',
  // 打开个人看板
  TOGGLE_USER_DASHBOARD = 'TOGGLE_USER_DASHBOARD',

  SYNC_RULES = 'SYNC_RULES',
  SYNC_SKILLS = 'SYNC_SKILLS',
  // 系统主题改变
  THEME_CHANGED = 'THEME_CHANGED',

  // 拖拽放置事件
  ON_WEBVIEW_DROP = 'ON_WEBVIEW_DROP',
  ON_VSCODE_DROP_FILES = 'ON_VSCODE_DROP_FILES',
  ON_WEBVIEW_DRAG_ENTER = 'ON_WEBVIEW_DRAG_ENTER',
  ON_WEBVIEW_DRAG_LEAVE = 'ON_WEBVIEW_DRAG_LEAVE',
  // 评测任务
  EVALUATION_TASK = 'EVALUATION_TASK',
  // Spec 框架检测信息更新 (IDE 推送)
  SPEC_INFO_UPDATE = 'SPEC_INFO_UPDATE',
  // Spec 框架检测信息同步 (IDE 推送)
  SYNC_SPEC_INFO = 'SYNC_SPEC_INFO',
}

export interface PostMessageSubscribeType {
  type: SubscribeActions;
  data: unknown;
  targetPanelId?: string;
}

export interface PostMessageBroadcastType {
  type: BroadcastActions;
  data: unknown;
}

export default function PostMessageProvider({
  targetOrigin,
  children,
}: {
  targetOrigin: string;
  children: React.ReactNode;
}) {
  const [message, setMessage] = React.useState<PostMessageSubscribeType | null>(
    null,
  );
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setUsername = useAuthStore((state) => state.setUsername);
  const extensionStore = useExtensionStore();
  const updateEditState = useEditorFileState((state) => state.update);
  const updateSpecInfo = useWorkspaceStore((state) => state.updateSpecInfo);

  React.useEffect(() => {
    function handleMessage(event: MessageEvent<PostMessageSubscribeType>) {
      if (!Object.values(SubscribeActions).includes(event.data.type)) {
        return;
      }
      console.log('[Event] WebView Received Message', event.data);

      // 注入 auth token
      if (event.data.type === SubscribeActions.Login) {
        setAccessToken(event.data.data as string);
      } else if (event.data.type === SubscribeActions.LOGOUT) {
        setAccessToken(null);
        setUsername(null);
      } else if (event.data.type === SubscribeActions.EDITOR_FILE_STATE) {
        updateEditState(event.data.data as any);
      } else if (event.data.type === SubscribeActions.SYNC_SPEC_INFO) {
        // 更新 Spec 框架检测信息
        const specInfo = event.data.data as SpecInfo;
        if (specInfo && specInfo.frameworks) {
          updateSpecInfo(specInfo);
          // 自动选择最新的 change 或 feature（如果当前未选中）
          autoSelectActiveChangeOrFeature(specInfo);
        }
      }
      // 从 event.data 中获取消息内容
      const receivedMessage = event.data;
      // 将消息内容更新到 state 中
      setMessage(receivedMessage);
    }

    // 监听 postMessage 消息
    window.addEventListener('message', handleMessage);

    return () => {
      // 移除消息监听器
      window.removeEventListener('message', handleMessage);
    };
  }, [extensionStore, updateEditState, updateSpecInfo]);

  // 向目标窗口发送消息的函数
  const postMessage = React.useCallback(
    (message: MessageEvent<PostMessageBroadcastType>) => {
      window.parent.postMessage(message, targetOrigin);
    },
    [targetOrigin],
  );

  const contextValue = React.useMemo(
    () => ({ postMessage, message }),
    [postMessage, message],
  );

  return (
    // 将 postMessage 函数和最新的消息内容通过 React context API 传递给子组件
    <PostMessageContext.Provider value={contextValue}>
      {children}
    </PostMessageContext.Provider>
  );
}

export const PostMessageContext = React.createContext({} as any);
PostMessageContext.displayName = 'PostMessageContext';

export function usePostMessage() {
  const context = React.useContext(PostMessageContext);
  if (!context) {
    throw new Error('expect provider for PostMessageContext');
  }
  return context;
}