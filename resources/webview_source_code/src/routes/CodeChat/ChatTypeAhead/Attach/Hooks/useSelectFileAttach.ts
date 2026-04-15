import { useCallback } from "react"
import { FileItem, IMultiAttachment, useChatAttach } from "../../../../../store/chat"
import { AttachType } from "../../../../../store/attaches"
import { cloneDeep } from "lodash"
import EventBus, { EBusEvent } from "../../../../../utils/eventbus"

export const useSelecteFileAttach = (): {
  selectFileAttaches: (files: FileItem[], autoFill?: boolean, hasSelectFile?: boolean) => void
  removeFileAttaches: (files: FileItem[]) => void
} => {
  const attachs = useChatAttach((state) => state.attachs)
  const updateAttach = useChatAttach((state) => state.update)

  const convertToFileAttach = useCallback((file: FileItem) => {
    return {
      ...file,
      attachType: AttachType.File,
    }
  }, [])

  // 处理选中文件
  const selectFileAttaches = useCallback((files: FileItem[], autoFill = true, hasSelectFile = false) => {
    if (attachs?.attachType !== AttachType.MultiAttachment) {
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource: files.map(file => convertToFileAttach(file))
      })
    } else {
      const dataSource = cloneDeep(((attachs as IMultiAttachment)?.dataSource || []))
      files.forEach(file => {
        const targetIndex = dataSource.findIndex(i => i.attachType === AttachType.File && (i as FileItem)?.path === file.path)
        const hasCurrentFile = file.isCurrent
        if (targetIndex >= 0) {
          if (hasCurrentFile) {
            dataSource.splice(targetIndex, 1)
            dataSource.unshift(convertToFileAttach(file))
          } else {
            dataSource[targetIndex] = convertToFileAttach({
              ...file,
              isCurrent: !!(dataSource[targetIndex] as FileItem)?.isCurrent // 保留原先自动吸附效果
            })
          }
        } else {
          if (hasCurrentFile) {
            dataSource.unshift(convertToFileAttach(file))
          } else {
            dataSource.push(convertToFileAttach(file))
          }
        }
      })
      // 将原先激活的current移除
      dataSource.forEach((item, index) => {
        const targetFile = item as FileItem
        if (targetFile?.attachType === AttachType.File && targetFile?.isCurrent && index > 0) {
          targetFile.isCurrent = false
        }
      })
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource
      })
    }
    // 自动填充附件到输入框
    if (autoFill) {
      if (hasSelectFile) {
        EventBus.instance.dispatch(EBusEvent.Mention_Select_File, {
          type: AttachType.File,
          data: files,
        })
      } else {
        EventBus.instance.dispatch(EBusEvent.Mention_Select, {
          type: AttachType.File,
          data: files,
        })
      }
    }
  }, [attachs, convertToFileAttach, updateAttach])

  // 移除文件附件
  const removeFileAttaches = useCallback((files: FileItem[]) => {
    if (attachs?.attachType !== AttachType.MultiAttachment) {
      updateAttach(undefined)
    } else {
      const dataSource = cloneDeep(((attachs as IMultiAttachment)?.dataSource || []))
      files.forEach(file => {
        const targetIndex = dataSource.findIndex(i => i.attachType === AttachType.File && (i as FileItem)?.path === file.path)
        if (targetIndex >= 0) {
          dataSource.splice(targetIndex, 1)
        }
      })
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource,
      })
    }
  }, [attachs, updateAttach])

  return {
    selectFileAttaches,
    removeFileAttaches,
  }
}
