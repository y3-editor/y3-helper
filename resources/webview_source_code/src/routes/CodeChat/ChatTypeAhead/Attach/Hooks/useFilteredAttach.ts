/**
 * @name 知识库支持附件被选中策略Hook
 */
import { useCallback } from "react";
import { ChatAttachStore, IMultiAttachment, useChatAttach, useChatStore } from "../../../../../store/chat";
import { AttachType } from "../../../../../store/attaches";
import { cloneDeep } from "lodash";


export const useFilteredAttach = (): {
  filterAttachesByAttachType: (attachs: ChatAttachStore['attachs'], types: AttachType[]) => void
} => {
  const chatType = useChatStore((state) => state.chatType)
  const updateAttachs = useChatAttach((state) => state.update);
  const updateCurrentSession = useChatStore(state => state.updateCurrentSession)
  const syncHistory = useChatStore((state) => state.syncHistory);

  const syncDocsetsToHistories = useCallback((newAttachs: IMultiAttachment) => {
    updateCurrentSession((session) => {
      session.data = session.data || {
        messages: [],
        consumedTokens: { input: 0, output: 0, inputCost: 0, outputCost: 0, },
        attaches: { attachType: AttachType.MultiAttachment, dataSource: [] },
      }
      session.data.attaches = newAttachs
      return session
    });
    requestAnimationFrame(() => syncHistory())
  }, [syncHistory, updateCurrentSession])

  const filterAttachesByAttachType = useCallback((attachs: ChatAttachStore['attachs'], types: AttachType[]) => {
    if (chatType !== 'codebase') return
    const curAttach = attachs as IMultiAttachment
    if (curAttach?.attachType === AttachType.MultiAttachment) {
      const attach = {
        attachType: AttachType.MultiAttachment,
        dataSource: cloneDeep(curAttach.dataSource).filter(i => !types.includes(i.attachType))
      }
      updateAttachs(attach)
      syncDocsetsToHistories(attach)
    }
  }, [chatType, syncDocsetsToHistories, updateAttachs])

  return {
    filterAttachesByAttachType,
  }
}
