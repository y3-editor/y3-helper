import { getBase64FromUrl, truncateContent } from "."
import { ChatMessageContent, ChatMessageContentUnion } from "../services"
import { AttachType } from "../store/attaches"
import { ChatAttachStore, FileItem, FolderItem, ImageUrl, IMultiAttachment, IProblem, useChatStore } from "../store/chat"
import { IDE, useExtensionStore } from "../store/extension"
import { exceedsMaxLines, getLargeFilePrombt } from "../store/workspace/tools/read"

// 提及的文件内容表达
export const mentionRegex = /@((?:\/|\w+:\/\/)[^\s]+?|[a-f0-9]{7,40}\b|problems\b)(?=[.,;:!?]?(?=[\s\r\n]|$))/
export const mentionRegexGlobal = new RegExp(mentionRegex.source, "g")


type TMixAttach = IMultiAttachment['dataSource'][number]

export const getAttachByCondition = (
  attaches: ChatAttachStore['attachs'],
  condition?: (attach: TMixAttach) => boolean
) => {
  if (attaches?.attachType !== AttachType.MultiAttachment) return null
  if (!condition) return null
  const dataSource = (attaches as IMultiAttachment).dataSource
  return dataSource.find(d => condition(d))
}

export const convertAttachToMention = (attach: TMixAttach) => {
  switch (attach.attachType) {
    case AttachType.File: {
      const targetAttach = attach as FileItem
      const lineCount = targetAttach?.content?.split('\n')?.length || 0
      // 只有仓库智聊需要总结
      if (lineCount > exceedsMaxLines
        && useChatStore.getState().chatType === 'codebase'
        && useExtensionStore.getState().IDE === IDE.VisualStudioCode
      ) {
        return getLargeFilePrombt(targetAttach.path, targetAttach?.content || '')
      } else {
        return `<file_content path="${targetAttach.path}">${truncateContent(targetAttach.content)}</file_content>`
      }
    }
    case AttachType.Folder: {
      const targetAttach = attach as FolderItem
      return `<folder_content path="${targetAttach?.path}">${targetAttach?.content}</folder_content>`
    }
    case AttachType.CodeBase: {
      // const targetAttach = attach as CodeBase
      // return `<codebase>${targetAttach.label}</codebase>`
      return `<codebase>Please use retrieve_code tool to retrieve the results</codebase>`
    }
    case AttachType.Docset: {
      // const targetAttach = attach as Docset
      // return `<knowledge_base>${targetAttach.name}</knowledge_base>`
      return `<knowledge_base>Please use retrieve_knowledge tool to retrieve the results</knowledge_base>`
    }
    case AttachType.Problems: {
      const targetAttach = attach as IProblem
      return `<workspace_problems>${targetAttach.problem || 'No workspace problems found'}</workspace_problems>`
    }
    default: return ''
  }
}

/**
 * @name 解析提及内容
 * @param text 文本内容
 * @param attaches 附件信息
 */
export async function parseMentions(text: string, attaches: ChatAttachStore['attachs']): Promise<ChatMessageContentUnion[]> {
  const mentions: Set<string> = new Set();
  const contentWithMentions: ChatMessageContentUnion[] = [];
  const parsedText = text.replace(mentionRegexGlobal, (_, mention) => {
    mentions.add(mention)
    if (mention === 'problems') {
      return 'Workspace problems(see below for workspace_problems)'
    } else {
      const isFolder = mention.trim().endsWith('/')
      const path = mention.trim().slice(1)
      return isFolder
        ? `${path}(see below for folder_content)`
        : `${path}(see file for file_content)`
    }
  })

  contentWithMentions.push({
    type: ChatMessageContent.Text,
    text: parsedText
  });


  for (const mention of mentions) {
    let mentionAttach: TMixAttach | undefined;
    if (mention === 'problems') {
      mentionAttach = (getAttachByCondition(attaches, (d) => d.attachType === AttachType.Problems)) as IProblem
    } else {
      // 默认是路径解析对应Prombt
      const isFolder = mention.trim().endsWith('/')
      if (isFolder) {
        const path = mention?.trim()?.slice(1)
        mentionAttach = (getAttachByCondition(attaches, (d) => d.attachType === AttachType.Folder && (d as FolderItem)?.path?.replace(/(^\/)|(^\/\/)/, '') === path)) as FolderItem
        // mentionContent += `\n\n the path of workspace folder is ${targetFolder.path}, content is ${targetFolder.content}. \n\n`
      } else {
        const filePath = mention.trim().slice(1)
        const data = (getAttachByCondition(attaches, (d) => d.attachType === AttachType.File && (d as FileItem)?.path?.replace(/(^\/)|(^\/\/)/, '') === filePath)) as FileItem
        if (data && !data.isCurrent) {
          // mentionContent += `\n\n the path of workspace file is ${targetFile.path}, content is ${targetFile.content}. \n\n`
          mentionAttach = data
        }
      }
    }
    if (mentionAttach) {
      contentWithMentions.push({
        type: ChatMessageContent.Text,
        text: convertAttachToMention(mentionAttach)
      })
    }
  }

  let hasCodeMap = false
  let hasKnowledge = false
  if (attaches?.attachType === AttachType.MultiAttachment) {
    for (let i = 0; i < (attaches as IMultiAttachment)?.dataSource?.length; i++) {
      const attach = (attaches as IMultiAttachment)?.dataSource[i]
      if (
        // 有吸附文件
        (attach.attachType === AttachType.File && (attach as FileItem)?.isCurrent)
      ) {
        contentWithMentions.push({
          type: ChatMessageContent.Text,
          text: convertAttachToMention(attach)
        })
      } else if (!hasKnowledge && ([AttachType.Docset, AttachType.KnowledgeAugmentation].includes(attach.attachType))) {
        hasKnowledge = true
        contentWithMentions.push({
          type: ChatMessageContent.Text,
          text: convertAttachToMention(attach)
        })
      } else if (!hasCodeMap && ([AttachType.CodeBase].includes(attach.attachType))) {
        hasCodeMap = true
        contentWithMentions.push({
          type: ChatMessageContent.Text,
          text: convertAttachToMention(attach)
        })
      } else if ([AttachType.ImageUrl].includes(attach.attachType)) {
        for (const imgUrl of ((attach as ImageUrl)?.imgUrls || [])) {
          let finalUrl = imgUrl
          if (!imgUrl.startsWith('data:image')) {
            finalUrl = await getBase64FromUrl(imgUrl);
          }
          contentWithMentions.push({
            type: ChatMessageContent.ImageUrl,
            image_url: {
              url: finalUrl,
            }
          })
        }
      }
    }
  }
  return contentWithMentions;
}


/**
 * @name 提交消息时，解析提及内容并且保留真正被@过的资源
 */
export const filterMentionedAttach = (
  content: string,
  attaches: IMultiAttachment,
): IMultiAttachment['dataSource'] | [] => {
  const loadedSet = new Set<string>([])
  const unusedAttaches: (IMultiAttachment['dataSource'][number])[] = []

  const filteredAttaches = attaches?.dataSource?.filter((i) => {
    if ([AttachType.Docset, AttachType.CodeBase, AttachType.ImageUrl, AttachType.Rules].includes(i.attachType)) {
      return true
    }
    // 默认吸附的文件
    if (i.attachType === AttachType.File && (i as FileItem)?.isCurrent) {
      // loadedSet.set(i.attachType + (i as FileItem)?.path)
      loadedSet.add(i.attachType + (i as FileItem)?.path)
      return true
    }
    unusedAttaches.push(i)
    return false
  }) || []

  content.replace(mentionRegexGlobal, (_, mention: string) => {
    if (loadedSet.has(mention)) return ''
    loadedSet.add(mention)
    if (mention === 'problems') {
      const attach = unusedAttaches.find(d => d?.attachType === AttachType.Problems)
      if (attach) {
        filteredAttaches.push(attach)
      }
    } else {
      const isFolder = mention.endsWith('/')
      const realPath = mention.slice(1)
      if (isFolder) {
        const targetAttach = unusedAttaches.find(d => d?.attachType === AttachType.Folder && (d as FolderItem)?.path?.replace(/^\//, '') === realPath) as FolderItem
        if (!targetAttach) return ''
        filteredAttaches.push(targetAttach)
      } else {
        const targetAttach = unusedAttaches.find(d => d?.attachType === AttachType.File && (d as FileItem)?.path?.replace(/^\//, '') === realPath) as FileItem
        if (!targetAttach || targetAttach?.isCurrent) return ''
        filteredAttaches.push(targetAttach)
      }
    }
    return ''
  })

  return filteredAttaches
}
