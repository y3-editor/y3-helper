import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import userReporter from '../utils/report';
import { countGodeGenerate } from '../utils';
import { createPatch, diffLines } from "diff";
import { BroadcastActions } from '../PostMessageProvider';
import { codemakerApiRequest } from '../services';
import { UserEvent } from '../types/report';
import { useChatStore } from './chat';

export interface ChatApplyItem {
  /** ToolCall 附带信息 */
  filePath: string;         // 文件路径
  updateSnippet?: string;    // 文件修改描述
  isCreateFile?: boolean;   // 是否创建新文件
  toolCallId: string;       // tool ID
  replaceSnippet?: string; // 替换的代码片段

  /** Apply 后更新的信息 */
  originalContent: string;  // 本轮会话开始时文件的初始状态
  beforeEdit?: string;      // 修改前的文件内容
  finalResult?: string;     // 修改结果
  diffPatch?: string;       // 本次修改的 diff 信息
  taskId?: string;          // 任务 ID
  diffInfo?: {              // diff 信息
    content: string;
    added: number[];
    removed: number[];
  }
  autoApply?: boolean;      // 是否自动应用

  /** EditFile 状态 */
  applying: boolean;        // apply 模型处理中
  accepted?: boolean;        // apply 已应用
  rejected?: boolean;        // apply 已拒绝
  reverted?: boolean;        // apply 已回退
  type: 'edit' | 'replace';   // 编辑类型
}

export interface ChatFileItem {
  filePath: string;
  originalContent: string;
  finalResult: string;
  accepted: boolean;
  isCreateFile?: boolean;
  autoApply?: boolean;
  diffLines?: {
    add: number;
    delete: number;
  };
  // 用于关联到具体的某次 toolCall
  applyItems: {
    type: 'edit' | 'replace';
    toolCallId: string;
    taskId: string;
  }[];
}

export type ChatApplyStore = {
  enableNewApply: boolean;
  disableNewApply: boolean;
  setEnableNewApply: (enableNewApply: boolean) => void;
  setDisableNewApply: (disableNewApply: boolean) => void;
  chatApplyInfo: {
    [propName: string]: ChatApplyItem
  };
  setChatApplyItem: (
    toolCallId: string,
    item: ChatApplyItem
  ) => void;
  updateChatApplyItem: (
    toolCallId: string,
    item: Partial<ChatApplyItem>
  ) => void;
  updateChatApplyInfo: (
    info: ChatApplyStore['chatApplyInfo'],
  ) => void;
  getChatApplyItem: (toolCallId: string) => ChatApplyItem | undefined;
  clearChatApplyInfoByFilePath: (filePath: string) => void;
  clearChatApplyInfo: () => void;
  chatFileInfo: {
    [propName: string]: ChatFileItem
  }
  setChatFileItem: (
    filePath: string,
    item: ChatFileItem
  ) => void;
  updateChatFileItem: (
    filePath: string,
    item: Partial<ChatFileItem>
  ) => void;
  updateChatFileInfo: (
    info: ChatApplyStore['chatFileInfo'],
  ) => void;
  getChatFileItem: (filePath: string) => ChatFileItem | undefined;
  removeChatFileItem: (filePath: string) => void;
  clearChatFileInfo: () => void;
  handleAcceptEditSuccess: (item: ChatApplyItem) => void;
  handleAcceptEditFailed: (item: ChatApplyItem) => void;
  handleRevertEditSuccess: (item: ChatFileItem) => void;
  handleRevertEditFailed: (item: ChatFileItem) => void;
  acceptEdit: (toolCallId: string, force?: boolean) => void;
  rejectEdit: (toolCallId: string) => void;
};

export const useChatApplyStore = create<ChatApplyStore>()(
  persist(
    (set, get) => ({
      enableNewApply: true,
      setEnableNewApply(enableNewApply) {
        set(() => ({
          enableNewApply: enableNewApply ? true : true
        }))
      },
      disableNewApply: false,
      setDisableNewApply(disableNewApply) {
        set(() => ({
          disableNewApply: disableNewApply ? false : false
        }))
      },
      chatApplyInfo: {},
      setChatApplyItem(toolCallId: string, item: ChatApplyItem) {
        const chatApplyInfo = get().chatApplyInfo;
        set(() => ({
          chatApplyInfo: {
            ...chatApplyInfo,
            [toolCallId]: item,
          }
        }))
      },
      updateChatApplyItem(toolCallId: string, item: Partial<ChatApplyItem>) {
        const chatApplyInfo = get().chatApplyInfo;
        const chatFileInfo = get().chatFileInfo;
        const chatApplyItem = chatApplyInfo[toolCallId];
        if (chatApplyItem) {
          const newApplyItem = {
            ...chatApplyInfo[toolCallId] || {},
            ...item
          }
          if (newApplyItem.beforeEdit && newApplyItem.finalResult) {
            const diffPatch = createPatch(newApplyItem.filePath, newApplyItem.beforeEdit.replace(/\r\n/g, '\n'), newApplyItem.finalResult.replace(/\r\n/g, '\n'));
            newApplyItem.diffInfo = parseDiffToCodeAndLines(diffPatch);
          }
          set(() => ({
            chatApplyInfo: {
              ...chatApplyInfo,
              [toolCallId]: newApplyItem
            }
          }))
          if (newApplyItem.filePath && newApplyItem.finalResult && newApplyItem.accepted) {
            // 如果是采纳记过，将内容记录到 chatFileInfo
            if (chatFileInfo[newApplyItem.filePath]) {
              get().updateChatFileItem(newApplyItem.filePath, {
                finalResult: newApplyItem.finalResult,
                accepted: newApplyItem.accepted,
                applyItems: [...chatFileInfo[newApplyItem.filePath].applyItems, {
                  type: newApplyItem.type,
                  toolCallId: newApplyItem.toolCallId,
                  taskId: newApplyItem.taskId || '',
                }]
              })
            } else {
              get().setChatFileItem(newApplyItem.filePath, {
                filePath: newApplyItem.filePath,
                isCreateFile: newApplyItem.isCreateFile,
                originalContent: newApplyItem.beforeEdit || '',
                finalResult: newApplyItem.finalResult,
                accepted: newApplyItem.accepted,
                applyItems: [{
                  type: newApplyItem.type,
                  toolCallId: newApplyItem.toolCallId,
                  taskId: newApplyItem.taskId || '',
                }]
              })
            }
          }
        }
      },
      getChatApplyItem(toolCallId: string) {
        return get().chatApplyInfo[toolCallId];
      },
      updateChatApplyInfo(info: ChatApplyStore['chatApplyInfo']) {
        set(() => ({
          chatApplyInfo: info,
        }));
      },
      clearChatApplyInfo() {
        set(() => ({
          chatApplyInfo: {},
        }));
        get().clearChatFileInfo();
      },
      chatFileInfo: {},
      setChatFileItem(filePath: string, item: ChatFileItem) {
        const chatFileInfo = get().chatFileInfo;
        if (item.originalContent !== undefined && item.finalResult !== undefined) {
          const changedLines = { add: 0, delete: 0 };
          const diffInfo = diffLines(item.originalContent, item.finalResult)
          diffInfo.forEach(d => {
            if (d.added) {
              changedLines.add += (d.count || 0)
            } else if (d.removed) {
              changedLines.delete += (d.count || 0)
            }
          });
          item.diffLines = changedLines;
        }
        set(() => ({
          chatFileInfo: {
            ...chatFileInfo,
            [filePath]: item,
          }
        }))
      },
      updateChatFileItem(filePath: string, item: Partial<ChatFileItem>) {
        const chatFileInfo = get().chatFileInfo;
        const chatFileItem = chatFileInfo[filePath];
        if (chatFileItem) {
          const newFileItem = {
            ...chatFileInfo[filePath],
            ...item
          }
          if (newFileItem.originalContent !== undefined && newFileItem.finalResult !== undefined) {
            const changedLines = { add: 0, delete: 0 };
            const diffInfo = diffLines(newFileItem.originalContent, newFileItem.finalResult)
            diffInfo.forEach(d => {
              if (d.added) {
                changedLines.add += (d.count || 0)
              } else if (d.removed) {
                changedLines.delete += (d.count || 0)
              }
            });
            newFileItem.diffLines = changedLines;
          }
          set(() => ({
            chatFileInfo: {
              ...chatFileInfo,
              [filePath]: newFileItem
            }
          }))
        }
      },
      updateChatFileInfo(info: ChatApplyStore['chatFileInfo']) {
        set(() => ({
          chatFileInfo: info,
        }));
      },
      getChatFileItem(filePath: string) {
        return get().chatFileInfo[filePath];
      },
      removeChatFileItem(filePath: string) {
        const chatFileInfo = get().chatFileInfo;
        const newChatFileInfo = { ...chatFileInfo };
        delete newChatFileInfo[filePath];
        set(() => ({
          chatFileInfo: newChatFileInfo,
        }))
      },
      clearChatApplyInfoByFilePath(filePath: string) {
        const chatFileInfo = get().chatFileInfo;
        if (chatFileInfo[filePath]) {
          const newChatFileInfo = { ...chatFileInfo };
          delete newChatFileInfo[filePath];
          set(() => ({
            chatFileInfo: newChatFileInfo,
          }))
        }
      },
      clearChatFileInfo() {
        set(() => ({
          chatFileInfo: {},
        }))
      },
      handleAcceptEditSuccess(
        item: ChatApplyItem
      ) {
        const {
          toolCallId,
          filePath,
          beforeEdit,
          finalResult,
          updateSnippet,
          replaceSnippet,
          isCreateFile
        } = item;
        const increateCodes = getIncreaseCodes(beforeEdit || '', finalResult || '');
        userReporter.report({
          event: UserEvent.CODE_CHAT_ACCEPT_EDIT_SUCCESS,
          extends: {
            chat_type: 'codebase',
            tool_id: toolCallId,
            filePath,
            beforeEdit,
            finalResult,
            editSnippet: updateSnippet,
            replaceSnippet,
            isCreateFile,
            type: item.type,
            enablePlanMode: useChatStore.getState().currentSession()?.data?.enablePlanMode || false,
            ...countGodeGenerate(increateCodes.join('\n')),
          },
        });
        get().updateChatApplyItem(toolCallId, {
          accepted: true
        });
      },
      handleAcceptEditFailed(
        item: ChatApplyItem
      ) {
        const {
          toolCallId,
          filePath,
          originalContent,
          finalResult,
          isCreateFile
        } = item;
        userReporter.report({
          event: UserEvent.CODE_CHAT_ACCEPT_EDIT_FAILED,
          extends: {
            chat_type: 'codebase',
            tool_id: toolCallId,
            filePath,
            originalContent,
            finalResult,
            isCreateFile,
            type: item.type,
            enablePlanMode: useChatStore.getState().currentSession()?.data?.enablePlanMode || false,
          },
        });
      },
      handleRevertEditSuccess(
        item: ChatFileItem
      ) {
        const {
          filePath,
          originalContent,
          finalResult,
          isCreateFile,
          applyItems
        } = item;
        get().removeChatFileItem(filePath);
        const increateCodes = getIncreaseCodes(finalResult || '', originalContent || '');
        userReporter.report({
          event: UserEvent.CODE_CHAT_REVERT_FILE_SUCCESS,
          extends: {
            chat_type: 'codebase',
            filePath,
            originalContent,
            finalResult,
            isCreateFile,
            enablePlanMode: useChatStore.getState().currentSession()?.data?.enablePlanMode || false,
            ...countGodeGenerate(increateCodes.join('\n')),
          },
        });
        for (const applyItem of applyItems) {
          if (applyItem.taskId) {
            codemakerApiRequest.post('/apply/revert_code_generate', {
              task_id: applyItem.taskId
            });
          }
          userReporter.report({
            event: UserEvent.CODE_CHAT_REVERT_EDIT_SUCCESS,
            extends: {
              chat_type: 'codebase',
              tool_id: applyItem.toolCallId,
              task_id: applyItem.taskId,
              type: applyItem.type,
              enablePlanMode: useChatStore.getState().currentSession()?.data?.enablePlanMode || false
            },
          });
          if (applyItem.toolCallId) {
            get().updateChatApplyItem(applyItem.toolCallId, {
              accepted: false,
              reverted: true
            });
          }
        }
      },
      handleRevertEditFailed(
        item: ChatFileItem
      ) {
        const {
          filePath,
          originalContent,
          finalResult,
          isCreateFile
        } = item;
        userReporter.report({
          event: UserEvent.CODE_CHAT_REVERT_EDIT_FAILED,
          extends: {
            chat_type: 'codebase',
            filePath,
            originalContent,
            finalResult,
            isCreateFile,
            enablePlanMode: useChatStore.getState().currentSession()?.data?.enablePlanMode || false
          },
        });
      },
      acceptEdit(toolCallId: string, force?: boolean) {
        const targetApplyItem = get().chatApplyInfo[toolCallId];
        const {
          filePath,
          finalResult,
          isCreateFile,
          beforeEdit,
          replaceSnippet,
          updateSnippet,
          taskId,
          type
        } = targetApplyItem;
        window.parent.postMessage({
          type: BroadcastActions.ACCEPT_EDIT,
          data: {
            item: {
              toolCallId,
              filePath,
              beforeEdit,
              finalResult,
              isCreateFile: isCreateFile
            },
            force
          },
        }, '*');
        userReporter.report({
          event: UserEvent.CODE_CHAT_ACCEPT_EDIT,
          extends: {
            toolCallId,
            filePath,
            beforeEdit,
            finalResult,
            replaceSnippet,
            editSnippet: updateSnippet,
            isCreateFile: isCreateFile,
            type,
            enablePlanMode: useChatStore.getState().currentSession()?.data?.enablePlanMode || false
          },
        });
        if (taskId) {
          codemakerApiRequest.post('/apply/accept_code_generate', {
            task_id: taskId
          });
        }
      },
      rejectEdit(toolCallId: string) {
        get().updateChatApplyItem(toolCallId, {
          rejected: true
        });
        const targetApplyItem = get().chatApplyInfo[toolCallId];
        if (!targetApplyItem) {
          return;
        }
        const {
          filePath,
          finalResult,
          isCreateFile,
          beforeEdit,
          replaceSnippet,
          updateSnippet,
          taskId,
          type
        } = targetApplyItem;
        userReporter.report({
          event: UserEvent.CODE_CHAT_REJECT_EDIT,
          extends: {
            toolCallId,
            filePath,
            beforeEdit,
            finalResult,
            replaceSnippet,
            editSnippet: updateSnippet,
            isCreateFile: isCreateFile,
            type,
            enablePlanMode: useChatStore.getState().currentSession()?.data?.enablePlanMode || false
          },
        });
        if (taskId) {
          codemakerApiRequest.post('/apply/reject_code_generate', {
            task_id: taskId
          })
        }
      }
    }),
    {
      name: 'codemaker-chat-apply-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        enableNewApply: state.enableNewApply
      }),
    }
  )
);


/**
 * 解析 unified diff patch 为代码和变更行号
 * @param {string} diffStr - unified diff patch 字符串
 * @returns {Object} - 包含代码内容和变更行号的对象
 */
function parseDiffToCodeAndLines(diffStr: string) {
  const lines = diffStr.split('\n');
  const code = [];
  const added = [];
  const removed = [];
  let currentLine = 1;

  // 跳过头部元信息
  let startIndex = 0;
  // while (startIndex < lines.length &&
  //        !lines[startIndex].startsWith('+') &&
  //        !lines[startIndex].startsWith('-') &&
  //        !lines[startIndex].startsWith(' ')) {
  //   startIndex++;
  // }
  while (startIndex < lines.length && (
    lines[startIndex].startsWith('+++') ||
    lines[startIndex].startsWith('---') ||
    lines[startIndex].startsWith('===') ||
    lines[startIndex].startsWith('Index'))) {
    startIndex++;
  }

  // 处理代码内容和变更行
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('+')) {
      // 添加的行
      code.push(line.substring(1));
      added.push(currentLine);
      currentLine++;
    } else if (line.startsWith('-')) {
      // 删除的行 (在最终代码中不显示)
      code.push(line.substring(1));
      removed.push(currentLine);
      currentLine++;
      // 注意：删除的行不增加当前行号计数
    } else if (line.startsWith(' ') || line.startsWith('@@')) {
      // 未变更的行
      code.push(line.substring(1));
      currentLine++;
    } else {
      // 其他元信息，例如 @@ -1,7 +1,6 @@ 这样的行信息标记
      continue;
    }
  }

  return {
    content: code.join('\n'),
    added,
    removed
  };
}

function getIncreaseCodes(originalContent: string, finalResult: string) {
  const increaseCodes = [];
  const changes = diffLines(originalContent, finalResult);
  for (const change of changes) {
    if (change.added) {
      increaseCodes.push(change.value);
    }
  }
  return increaseCodes;
}
