import { RuleItem, IMultiAttachment, FileItem, FolderItem, ChatAttachStore } from '../store/chat';
import { AttachType } from '../store/attaches';
import { getEffectiveRules, Rule, useWorkspaceStore } from '../store/workspace';
import { IDE, useExtensionStore } from '../store/extension';
import { versionCompare } from './common';

/**
 * 计算当前请求生效的 rules。
 *
 * 实现严格对照 store/chat.ts 主对话路径的 effectiveRules 逻辑（原 L3019-3082）：
 * 1. 从 attachs 提取 mention 的文件/文件夹 path,作为 mentionPaths
 * 2. 调 getEffectiveRules:teamRules + 用户勾选的 rules + mention 触发的 rules
 * 3. 把 attachs 中显式 attach 的 RuleItem 也补进来
 * 4. 按 filePath 去重
 *
 * 抽离原因:让主对话与压缩调用走同款实时计算,避免 snapshot。
 * 压缩侧调用时,attachs 来自 lastUserMessage._originalRequestData.attachs,
 * 即"那一轮发请求时的快照",保证输入与主对话一致。
 */
export function computeEffectiveRules(
  attachs: ChatAttachStore['attachs'] | undefined,
): Rule[] {
  let attachFiles: FileItem[] = [];
  let attachFolders: FolderItem[] = [];
  if (attachs && attachs.attachType === AttachType.MultiAttachment) {
    attachFiles = (attachs as IMultiAttachment).dataSource.filter(
      (item) => item.attachType === AttachType.File,
    ) as FileItem[];
    attachFolders = (attachs as IMultiAttachment).dataSource.filter(
      (item) => item.attachType === AttachType.Folder,
    ) as FolderItem[];
  }

  const rules = useWorkspaceStore.getState().rules;
  const teamRules = useWorkspaceStore.getState().teamRules;
  const selectedRules = useWorkspaceStore.getState().selectedRules;
  const ide = useExtensionStore.getState().IDE;
  const pluginVersion = useExtensionStore.getState().codeMakerVersion || '';

  let isOldVersion = true;
  if (
    ide === IDE.VisualStudioCode &&
    versionCompare('2.8.0', pluginVersion) >= 0
  ) {
    isOldVersion = false;
  }
  if (ide === IDE.JetBrains) {
    isOldVersion = false;
  }

  const effectiveRules = getEffectiveRules({
    selectedRules: [
      ...teamRules,
      ...rules.filter((rule) => selectedRules.includes(rule.filePath)),
    ],
    mentionPaths: [
      ...attachFiles.map((file) => file.path),
      ...attachFolders.map((folder) => folder.path),
    ],
    codebaseCustomPrompt:
      useWorkspaceStore.getState().workspaceInfo?.codebaseCustomPrompt || '',
    code_style: useWorkspaceStore.getState().devSpace?.code_style || '',
    oldVersion: isOldVersion,
  });

  if (attachs && attachs.attachType === AttachType.MultiAttachment) {
    const attachRules: RuleItem[] = (
      attachs as IMultiAttachment
    ).dataSource.filter(
      (item) => item.attachType === AttachType.Rules,
    ) as RuleItem[];
    if (attachRules) {
      for (const attachRule of attachRules) {
        if (
          !effectiveRules.find(
            (item) => item.filePath === attachRule.filePath,
          )
        ) {
          const rule = rules.find(
            (item) => item.filePath === attachRule.filePath,
          );
          if (rule) {
            effectiveRules.push(rule);
          }
        }
      }
    }
  }

  return effectiveRules;
}