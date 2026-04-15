import { Docset } from "../services/docsets";
import { AttachType } from "../store/attaches";
import { CodeBase, IMultiAttachment, useChatStore } from "../store/chat";
import { useWorkspaceStore } from "../store/workspace";

/**
 * @name 解析@指令中提及的知识库内容用于functioncall调用
 */
export const parseAtMentionedKnowledgeBaseByAttach = (appendDocsets?: string[]) => {
  let docsets: string[] = appendDocsets || [];
  const knowledge_bases = useWorkspaceStore.getState().devSpace.knowledge_bases;
  if (knowledge_bases && knowledge_bases.length) {
    docsets = (knowledge_bases.map(base => base.knowledge_base_id));
  }
  const userMessage = useChatStore.getState().getRecentUserMessageFromCurrentSession()
  const originalAttachs = userMessage?._originalRequestData?.attachs as IMultiAttachment

  if (originalAttachs?.attachType === AttachType.MultiAttachment) {
    for (let i = 0; i < originalAttachs?.dataSource?.length; i++) {
      const attach = originalAttachs?.dataSource?.[i] as Docset
      if (attach.attachType !== AttachType.Docset) {
        continue
      }
      if (docsets) {
        docsets.push(attach.code)
      }
    }
  }
  return docsets.length ? JSON.stringify(docsets) : undefined;
}

/**
 * @name 解析@指令中提及的知识库内容用于functioncall调用
 */
export const parseAtMentionedCodeBaseByAttach = () => {
  const devSpace = useWorkspaceStore.getState().devSpace;
  const workspaceInfo = useWorkspaceStore.getState().workspaceInfo;
  let codeMaps: string[] = []
  if (devSpace.codebases && devSpace.codebases.length) {
    // codeTable = devSpace.codebases[0].codebase_name;
    codeMaps = devSpace.codebases.map(codebase => codebase.codebase_id)
    // .join(',');
  } else if (workspaceInfo.repoCodeTable) {
    codeMaps = [workspaceInfo.repoCodeTable]
  }
  const userMessage = useChatStore.getState().getRecentUserMessageFromCurrentSession()
  const originalAttachs = userMessage?._originalRequestData?.attachs as IMultiAttachment
  if (originalAttachs?.attachType === AttachType.MultiAttachment) {
    for (let i = 0; i < originalAttachs?.dataSource.length; i++) {
      const attach = originalAttachs?.dataSource[i] as CodeBase
      if (attach.attachType !== AttachType.CodeBase) {
        continue
      }
      codeMaps.push(attach.collection)
    }
  }
  return codeMaps.length ? codeMaps.join(',') : undefined
}
