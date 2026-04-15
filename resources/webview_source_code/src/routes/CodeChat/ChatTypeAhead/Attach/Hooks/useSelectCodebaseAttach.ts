/**
 * @name 知识库支持附件被选中策略Hook
 */
import { useCallback } from "react";
import { CodeBase, IMultiAttachment, useChatAttach, useChatStore } from "../../../../../store/chat";
import { AttachType } from "../../../../../store/attaches";
import { cloneDeep } from "lodash";
import { GroupValue } from "../CodeBase/useCodeBase";


export const useSelectCodebaseAttach = (): {
  selecteCodebaseAttaches: (codebases: GroupValue[]) => void,
  removeCodebaseAttaches: (codebases: CodeBase[]) => void,
} => {
  const chatType = useChatStore((state) => state.chatType)
  const attachs = useChatAttach((state) => state.attachs)
  const updateAttach = useChatAttach((state) => state.update)
  const updateCurrentSession = useChatStore(state => state.updateCurrentSession)
  const syncHistory = useChatStore((state) => state.syncHistory);

  const syncDocsetsToHistories = useCallback((codebases: CodeBase[]) => {
    if (chatType !== 'codebase') return
    updateCurrentSession((session) => {
      session.data = session.data || {
        messages: [],
        consumedTokens: { input: 0, output: 0, inputCost: 0, outputCost: 0, },
        attaches: { attachType: AttachType.MultiAttachment, dataSource: [] },
      }
      session.data.attaches = {
        attachType: AttachType.MultiAttachment,
        dataSource: codebases,
      }
      return session
    });
    requestAnimationFrame(() => syncHistory())
  }, [chatType, syncHistory, updateCurrentSession])

  const convertToCodebaseAttach = useCallback((codebase: GroupValue) => {
    return {
      collection: codebase.value,
      branches: codebase.branches,
      label: codebase.label,
      attachType: AttachType.CodeBase,
    }
  }, [])

  const selecteCodebaseAttaches = useCallback((codebases: GroupValue[]) => {
    if (!codebases.length) return
    if (chatType !== 'codebase') {
      if (!codebases.length) return
      const originalCodebase = codebases[codebases.length - 1]
      if (!originalCodebase) return
      // 代码地图只允许一份访问
      updateAttach(convertToCodebaseAttach(originalCodebase));
    } else {
      // 支持混合多份附件
      if (attachs?.attachType !== AttachType.MultiAttachment) {
        const dataSource = codebases.map(codebase => (convertToCodebaseAttach(codebase)))
        updateAttach({
          attachType: AttachType.MultiAttachment,
          dataSource: dataSource
        })
        syncDocsetsToHistories(dataSource)
      } else {
        const curAttaches = cloneDeep(attachs) as IMultiAttachment
        const dataSource = curAttaches.dataSource || []
        codebases.forEach(codebase => {
          const targetIndex = dataSource.findIndex(attach => attach.attachType === AttachType.CodeBase && (attach as CodeBase).collection === codebase.value)
          if (targetIndex >= 0) {
            dataSource[targetIndex] = convertToCodebaseAttach(codebase)
          } else {
            dataSource.push(convertToCodebaseAttach(codebase))
          }
        })
        curAttaches.dataSource = dataSource
        const existCodebases = dataSource.filter(i => [AttachType.Docset, AttachType.CodeBase].includes(i.attachType))
        syncDocsetsToHistories(existCodebases as CodeBase[])
        updateAttach(curAttaches)
      }
    }
  }, [attachs, chatType, convertToCodebaseAttach, syncDocsetsToHistories, updateAttach])

  const removeCodebaseAttaches = useCallback((codebases: CodeBase[]) => {
    // 兼容多附件类型存在，比如@文件、文件夹和文档集
    if (chatType !== 'codebase') {
      updateAttach(undefined)
    } else {
      if (attachs?.attachType !== AttachType.MultiAttachment) {
        updateAttach({
          attachType: AttachType.MultiAttachment,
          dataSource: []
        })
        syncDocsetsToHistories([])
      } else {
        const curAttaches = cloneDeep(attachs) as IMultiAttachment
        codebases.forEach(codebase => {
          const targetIndex = curAttaches.dataSource.findIndex(attach => attach.attachType === AttachType.CodeBase && (attach as CodeBase).collection === codebase.collection)
          if (targetIndex >= 0) {
            curAttaches.dataSource.splice(targetIndex, 1)
          }
        })
        updateAttach(curAttaches)
        const existCodebases = curAttaches.dataSource.filter(i => [AttachType.Docset, AttachType.CodeBase].includes(i.attachType))
        syncDocsetsToHistories(existCodebases as CodeBase[])
      }
    }
  }, [attachs, chatType, syncDocsetsToHistories, updateAttach])

  return {
    selecteCodebaseAttaches,
    removeCodebaseAttaches,
  }
}
