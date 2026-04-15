import { useCallback } from "react"
import { ImageUrl, IMultiAttachment, useChatAttach } from "../../../../../store/chat"
import { AttachType } from "../../../../../store/attaches"
import { cloneDeep } from "lodash"


export const useSelectImageAttach = (): {
  selectImageAttach: (urls: string[]) => void,
  removeImageAttach: (urls: string[]) => void
} => {
  const attachs = useChatAttach((state) => state.attachs)
  const updateAttach = useChatAttach((state) => state.update)


  const selectImageAttach = useCallback((urls: string[]) => {
    let curAttachs = cloneDeep(attachs) as IMultiAttachment
    if (curAttachs?.attachType !== AttachType.MultiAttachment) {
      curAttachs = {
        attachType: AttachType.MultiAttachment,
        dataSource: []
      }
    }
    let imageAttach = curAttachs.dataSource.find(i => i.attachType === AttachType.ImageUrl) as ImageUrl
    if (!imageAttach) {
      imageAttach = {
        attachType: AttachType.ImageUrl,
        imgUrls: urls
      }
      curAttachs.dataSource.push(imageAttach)
    } else {
      imageAttach.imgUrls.push(...urls)
    }
    updateAttach(curAttachs)
  }, [attachs, updateAttach])


  const removeImageAttach = useCallback((urls: string[]) => {
    if (attachs?.attachType !== AttachType.MultiAttachment) return
    const curAttachs = cloneDeep(attachs) as IMultiAttachment
    const imageAttach = curAttachs.dataSource.find(i => i.attachType === AttachType.ImageUrl) as ImageUrl
    if (imageAttach) {
      imageAttach.imgUrls = imageAttach.imgUrls.filter(i => !urls.includes(i))
      updateAttach(curAttachs)
    }
  }, [attachs, updateAttach])


  return {
    selectImageAttach,
    removeImageAttach,
  }
}


export const getImageUrlFromAttachs = (attachs: IMultiAttachment | undefined) => {
  if (attachs?.attachType !== AttachType.MultiAttachment) return []
  const imageAttach = attachs?.dataSource?.find(i => i.attachType === AttachType.ImageUrl) as ImageUrl
  return imageAttach?.imgUrls || []
}
