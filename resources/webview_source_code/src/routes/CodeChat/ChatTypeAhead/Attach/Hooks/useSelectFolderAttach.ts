import { useCallback } from "react"
import { AttachType } from "../../../../../store/attaches"
import { FolderItem, IMultiAttachment, useChatAttach } from "../../../../../store/chat"
import { cloneDeep } from "lodash"
import EventBus, { EBusEvent } from "../../../../../utils/eventbus"

export const useSelectedFolderAttach = (): {
  selectFolderAttaches: (folders: FolderItem[], autoFill?: boolean, hasSelectFolder?: boolean) => void
} => {
  const attachs = useChatAttach((state) => state.attachs)
  const updateAttach = useChatAttach((state) => state.update)

  const convertToFolderAttach = useCallback((folder: FolderItem) => {
    return {
      ...folder,
      attachType: AttachType.Folder,
    }
  }, [])

  const selectFolderAttaches = useCallback((folders: FolderItem[], autoFill = true, hasSelectFolder = false) => {
    if (attachs?.attachType !== AttachType.MultiAttachment) {
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource: folders.map(folder => convertToFolderAttach(folder))
      })
    } else {
      const dataSource = cloneDeep(((attachs as IMultiAttachment)?.dataSource || []))
      // const targetIndex = (dataSource.findIndex((i: ChatAttachStore['attachs']) => i?.attachType === AttachType.Folder))
      folders.forEach(folder => {
        const targetIndex = dataSource.findIndex(i => i.attachType === AttachType.Folder && (i as FolderItem)?.path === folder.path)
        if (targetIndex >=0) {
          dataSource[targetIndex] = convertToFolderAttach(folder)
        } else {
          dataSource.push(convertToFolderAttach(folder))
        }
      })
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource
      })
    }
    // 自动填充文件进行选中
    if (autoFill) {
      if (hasSelectFolder) {
        EventBus.instance.dispatch(EBusEvent.Mention_Select_File, {
          type: AttachType.Folder,
          data: folders,
        })
      } else {
        EventBus.instance.dispatch(EBusEvent.Mention_Select, {
         type: AttachType.Folder,
          data: folders,
        })
      }
    }
  }, [attachs, convertToFolderAttach, updateAttach])

  return {
    selectFolderAttaches,
  }
}
