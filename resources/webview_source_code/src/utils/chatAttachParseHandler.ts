import { cloneDeep } from "lodash";
import ParseNoneCodeFileStream from "../services/Agents/Stream/ParseNoneCodeFile";
import { AttachType } from "../store/attaches";
import { FileItem, IMultiAttachment, useChatAttach, useChatStore, useChatStreamStore } from "../store/chat";
import { toastError } from "../services/error";
import { ChatMessageAttachType, ChatMessageContent, MultipleAttach } from "../services";
import { getErrorMessage, truncateContent } from ".";
import EventBus, { EBusEvent } from "./eventbus";
import { uploadImg } from "../services/chat";
import { compressImage } from "../components/ImageUpload/ImageUpload";
import { useChatConfig } from "../store/chat-config";
import { ParseImgType } from "../services/chatModel";



const audioExtensions = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg']);
const videoExtensions = new Set(['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm']);
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp']);
const docsetExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const archiveExtensions = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2',]);
const fontExtensions = new Set(['ttf', 'otf', 'woff', 'woff2', 'eot']);
const otherExtensions = new Set(['exe', 'dll', 'so', 'dylib', 'app']);
const maxSize = 10 * 1024 * 1024

export let parseFileController = new AbortController()

export const checkFileTypeValid = (fileName: string) => {
  const fileType = fileName?.split('.')?.pop()
  if (!fileType) return false
  if (docsetExtensions.has(fileType)) {
    return true
  }
  const getTip = (content: string) => `当前聊天不支持${content}，请在输入框中将${fileName}移除。`
  if (audioExtensions.has(fileType)) {
    toastError(getTip('语音文件'))
    throw new Error(getTip('语音文件'))
  }
  if (videoExtensions.has(fileType)) {
    toastError(getTip('视频文件'))
    throw new Error(getTip('视频文件'))
  }
  if (imageExtensions.has(fileType)) {
    toastError(getTip('图片文件'))
    throw new Error(getTip('图片文件'))
  }
  if (archiveExtensions.has(fileType)) {
    toastError(getTip('压缩文件'))
    throw new Error(getTip('压缩文件'))
  }
  if (fontExtensions.has(fileType) || otherExtensions.has(fileType)) {
    toastError(getTip('不支持的文件类型'))
    throw new Error(getTip('不支持的文件类型'))
  }
  return false
}


export const convertTextByAddress = (address: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    let content = ''
    new ParseNoneCodeFileStream(address, {
      onMessage: (message: string) => {
        content += message
      },
      onFinish: () => {
        return resolve(
          content.length > 50000
            ? (truncateContent(content, 50000) + '\n\n Note: This is a binary file. Do not use any tools to read it.')
            : content
        )
      },
      onError: (err: Error) => {
        return reject(err)
      },
      onController: (controller) => {
        parseFileController = controller
      }
    })
  })
}


// const parseMarkdownImages = (markdown: string) => {
//   // Markdown 图片正则: ![alt](url "title") 或 ![alt](url)
//   const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

//   const imageUrls: string[] = [];
//   let imageIndex = 1;

//   const content = markdown.replace(imageRegex, (__, ___, url) => {
//     const placeholder = `[图片${imageIndex}]`;

//     imageUrls.push(url);

//     imageIndex++;
//     return placeholder;
//   });

//   return { content, imageUrls };
// }


export const getParsedAttachs = async (originalAttachs: MultipleAttach[]) => {
  // useChatAttach.getState().attachs
  if (originalAttachs?.[0]?.type !== ChatMessageAttachType.MultiAttachment) {
    return originalAttachs
  }
  const attachs = cloneDeep((originalAttachs?.[0]?.attachs as IMultiAttachment)?.dataSource || [])
  const { setIsStreaming, setLoadingMessage, reset } = useChatStreamStore.getState();
  let currentFileName = ''
  let hadParsed = false
  try {
    setIsStreaming(true)
    setLoadingMessage('正在解析文件...')

    for (let i = 0; i < attachs.length; i++) {
      const item = attachs[i] as FileItem
      if (item.attachType !== AttachType.File || item?.hadParsed) {
        continue
      }
      currentFileName = item.fileName

      if (!checkFileTypeValid(currentFileName)) {
        continue
      }

      const formData = new FormData()
      const uint8Array = new Uint8Array((item.content as any)?.data as any);
      const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
      if (blob.size > maxSize) {
        throw new Error(`${currentFileName}文件大小超过限制: ${(blob.size / 1024 / 1024).toFixed(2)}MB，最大允许10MB`);
      }
      formData.append('file', blob, item.fileName);
      const uploadInfo = await uploadImg(formData)
      const parsedContent = await convertTextByAddress(uploadInfo.url)
      item.content = parsedContent
      item.hadParsed = true
      hadParsed = true
    }
    setLoadingMessage('')
    // throw new Error('解析文件失败')

    // 查看是否有解析好文件
    if (hadParsed) {
      const newAttach = {
        attachType: AttachType.MultiAttachment,
        dataSource: attachs
      }
      // 优化自动附件解析内容
      useChatAttach.getState().update(newAttach)
      return [{
        type: ChatMessageAttachType.MultiAttachment,
        attachs: newAttach
      }]
    }
    return originalAttachs
  } catch (e: any) {
    const { updateCurrentSession, syncHistory } = useChatStore.getState()
    let userMessage: any
    updateCurrentSession((session) => {
      userMessage = session.data?.messages?.pop()
    });
    requestAnimationFrame(() => {
      reset()
      syncHistory()
    })
    if (userMessage) {
      setTimeout(() => {
        EventBus.instance.dispatch(EBusEvent.Edit_User_Message, (userMessage?._originalRequestData?.content || '').replace(/`/g, ""))
        useChatAttach.getState().update(userMessage?._originalRequestData?.attachs)
      }, 300)
    }
    toastError(`解析${currentFileName}失败, 请在聊天框中删除该文件后重新聊天: ${e.message}`)
    throw new Error(`parse file exception`)
  }

}


export enum EParsedDocsStatus {
  NotParsed = 1,
  Parsed = 1,
}

export const parseDocContentFromReadFileTool = async (
  tool_id: string,
  fileToolResult: {
    content: string
    path: string,
    isError: boolean,
    extra: {
      parseDocStatus: number,
    },
  }
) => {
  const { updateCurrentSession } = useChatStore.getState()
  const { updateToolCallResults, setLoadingMessage, } = useChatStreamStore.getState()
  const { content, path, extra, isError } = fileToolResult
  let errorContent = ''
  try {
    if (isError) {
      throw new Error(content)
    }
    setLoadingMessage('正在解析文件...')
    const fileNeme = path.split(/[/\\]/).pop() || path
    const formData = new FormData()
    const uint8Array = new Uint8Array((content as any)?.data as any);
    const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
    if (blob.size > maxSize) {
      throw new Error(`${fileNeme}文件大小超过限制: ${(blob.size / 1024 / 1024).toFixed(2)}MB，最大允许10MB`);
    }
    formData.append('file', blob, fileNeme);
    const uploadInfo = await uploadImg(formData)
    const parsedContent = await convertTextByAddress(uploadInfo.url)
    fileToolResult.content = parsedContent
  } catch (e) {
    errorContent = getErrorMessage(e)
  } finally {
    setLoadingMessage('')
    // 显示消息
    updateCurrentSession((session) => {
      const messages = session?.data?.messages;
      if (messages?.length) {
        const lastMessage = messages[messages.length - 1];
        lastMessage.processing = false;
      }
    })
    updateToolCallResults(
      {
        [tool_id]: {
          path: path,
          content: errorContent ? errorContent : fileToolResult.content,
          isError: !!errorContent,
          extra: {
            parseDocStatus: EParsedDocsStatus.Parsed,
          }
        },
      },
      extra,
    );
  }

}

/**
 * 从读取文件工具中解析图片文件
 * @param tool_id
 * @param fileToolResult
 */
export const parseImageFromReadFileTool = async (
  tool_id: string,
  fileToolResult: {
    content: string
    path: string,
    isError: boolean,
  }
) => {
  const { path, content, isError } = fileToolResult
  const { updateCurrentSession } = useChatStore.getState()
  const { updateToolCallResults, setLoadingMessage, } = useChatStreamStore.getState()
  const onFinish = () => {
    updateCurrentSession((session) => {
      const messages = session?.data?.messages;
      if (messages?.length) {
        const lastMessage = messages[messages.length - 1];
        lastMessage.processing = false;
      }
    })
  }

  if (isError) {
    onFinish()
    updateToolCallResults(
      {
        [tool_id]: {
          path: path,
          content: content,
          isError: true,
        },
      }
    );
    setLoadingMessage('')
    return
  }

  try {
    const chatModels = useChatConfig.getState().chatModels
    const model = useChatConfig.getState().config.model
    if (chatModels[model].parseImgType === ParseImgType.NONE) {
      throw new Error('当前模型不支持解析图片，请更换到Claude或Gemini系列模型~')
    }
    const fileNeme = path.split(/[/\\]/).pop() || path
    const uint8Array = new Uint8Array((content as any)?.data as any);
    const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
    // 转换为 File 对象
    const file = new File([blob], fileNeme, {
      type: 'application/octet-stream',
      lastModified: Date.now()
    });
    const smallFile = await compressImage(file);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // 移除 "data:image/xxx;base64," 前缀
      // const pureBase64 = base64.split(',')[1];
      onFinish()
      updateToolCallResults(
        {
          [tool_id]: {
            path: path,
            content: [{
              type: ChatMessageContent.ImageUrl,
              image_url: {
                url: base64,
              }
            }] as unknown as string,
            isError: false,
          },
        }
      );
    };
    reader.onerror = (error) => {
      throw new Error(getErrorMessage(error))
    };
    reader.readAsDataURL(smallFile);
  } catch (e) {
    onFinish()
    updateToolCallResults(
      {
        [tool_id]: {
          path: path,
          content: getErrorMessage(e),
          isError: true,
        },
      }
    );
  } finally {
    setLoadingMessage('')
  }

}