/**
 * @name 知识库支持附件被选中策略Hook
 * @returns
 */
import { useCallback } from "react";
import { IMultiAttachment, useChatAttach, useChatStore } from "../../../../../store/chat";
import { Docset, Docsets } from "../../../../../services/docsets";
import { AttachType } from "../../../../../store/attaches";
import { cloneDeep } from "lodash";
import { filterDocsetsFn } from "../../../../../utils";


export const useSelectDocsetAttach = (): {
  selectDocsetAttaches: (selectedDocsets: Docset[]) => void,
  removeDocsetAttaches: (docsetIds: string[]) => void,
} => {
  const attachs = useChatAttach((state) => state.attachs);
  const chatType = useChatStore((state) => state.chatType);
  const updateCurrentSession = useChatStore(state => state.updateCurrentSession)
  const updateAttach = useChatAttach((state) => state.update);
  const syncHistory = useChatStore((state) => state.syncHistory);

  const convertToDocsetAttach = useCallback((docset: Docset) => ({
    ...docset,
    attachType: AttachType.Docset,
  }), [])

  const syncDocsetsToHistories = useCallback((docsets: Docset[]) => {
    updateCurrentSession((session) => {
      session.data = session.data || {
        messages: [],
        consumedTokens: { input: 0, output: 0, inputCost: 0, outputCost: 0, },
        attaches: chatType === 'codebase'
          ? { attachType: AttachType.MultiAttachment, dataSource: [] }
          : { attachType: AttachType.Docset, docsets: [], },
      }
      if (!session.data) return

      if (chatType === 'codebase') {
        session.data.attaches = {
          attachType: AttachType.MultiAttachment,
          dataSource: docsets,
        }
      } else {
        // 非仓库智聊，只保存 docsets
        session.data.attaches = {
          docsets: docsets,
          attachType: AttachType.Docset
        }
      }

      return session
    });
    requestAnimationFrame(() => syncHistory())
  }, [chatType, syncHistory, updateCurrentSession])

  const selectDocsetAttaches = useCallback((selectedDocsets: Docset[]) => {
    const docsets = (filterDocsetsFn(selectedDocsets) as Docset[])?.map(i => convertToDocsetAttach(i)) || []
    if (chatType !== 'codebase') {
      if (attachs?.attachType !== AttachType.Docset) {
        syncDocsetsToHistories(docsets)
        updateAttach({
          attachType: AttachType.Docset,
          docsets: docsets,
        })
      } else {
        const originalDocsets = cloneDeep((attachs as Docsets)?.docsets || [])
        docsets.forEach(d => {
          const targetIndex = originalDocsets.findIndex(docset => docset._id === d._id)
          if (targetIndex >= 0) {
            originalDocsets[targetIndex] = d
          } else {
            originalDocsets.push(d)
          }
        })
        syncDocsetsToHistories(originalDocsets)
        updateAttach({
          attachType: AttachType.Docset,
          docsets: originalDocsets,
        })
      }
      return
    }

    // 兼容多附件类型存在，比如@文件、文件夹和文档集
    if (attachs?.attachType !== AttachType.MultiAttachment) {
      syncDocsetsToHistories(docsets)
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource: docsets
      })
    } else {
      const dataSource = cloneDeep(((attachs as IMultiAttachment)?.dataSource || []))
      docsets.forEach(docset => {
        const targetIndex = (dataSource.findIndex((i) => i?.attachType === AttachType.Docset && (i as Docset)._id === docset._id))
        if (targetIndex >= 0) {
          dataSource[targetIndex] = docset
        } else {
          dataSource.push(docset)
        }
      })
      const existDocsets = dataSource.filter(i => [AttachType.Docset, AttachType.CodeBase].includes(i.attachType))
      syncDocsetsToHistories(existDocsets as Docset[])
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource,
      })
    }
  }, [attachs, chatType, convertToDocsetAttach, syncDocsetsToHistories, updateAttach])

  const removeDocsetAttaches = useCallback((docsetIds: string[]) => {
    if (chatType !== 'codebase') {
      if (attachs?.attachType !== AttachType.Docset) {
        syncDocsetsToHistories([])
        updateAttach(undefined)
      } else {
        const originalDocsets = cloneDeep((attachs as Docsets)?.docsets || [])
        docsetIds.forEach(id => {
          const targetIndex = originalDocsets.findIndex(docset => docset._id === id)
          if (targetIndex >= 0) {
            originalDocsets.splice(targetIndex, 1)
          }
        })
        syncDocsetsToHistories(originalDocsets)
        if (!originalDocsets.length) {
          updateAttach(undefined)
        } else {
          updateAttach({
            attachType: AttachType.Docset,
            docsets: originalDocsets,
          })
        }
      }
      return
    }

    // 兼容多附件类型存在，比如@文件、文件夹和文档集
    if (attachs?.attachType !== AttachType.MultiAttachment) {
      syncDocsetsToHistories([])
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource: [],
      })
    } else {
      const dataSource = cloneDeep(((attachs as IMultiAttachment).dataSource || []))
      docsetIds.forEach(docsetId => {
        const targetIndex = (dataSource.findIndex((i) => i?.attachType === AttachType.Docset && (i as Docset)._id === docsetId))
        if (targetIndex >= 0) {
          dataSource.splice(targetIndex, 1)
        }
      })
      const existDocsets = dataSource.filter(i => [AttachType.Docset, AttachType.CodeBase].includes(i.attachType))
      syncDocsetsToHistories(existDocsets as Docset[])
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource: dataSource,
      })
    }
  }, [attachs, chatType, syncDocsetsToHistories, updateAttach])

  return {
    selectDocsetAttaches,
    removeDocsetAttaches,
  }
}
