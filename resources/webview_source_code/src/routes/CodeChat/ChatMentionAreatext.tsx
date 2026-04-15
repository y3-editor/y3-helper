import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Textarea } from '@chakra-ui/react';
import { mentionRegex, mentionRegexGlobal } from '../../utils/chatMention';
import EventBus, { EBusEvent } from '../../utils/eventbus';
import { AttachType } from '../../store/attaches';
import { FileItem, useChatAttach, useChatStore } from '../../store/chat';
import { BroadcastActions, SubscribeActions, usePostMessage } from '../../PostMessageProvider';
import { useWorkspaceStore } from '../../store/workspace';
import { useExtensionStore, IDE } from '../../store/extension';
import { debounce } from 'lodash';
import useCustomToast from '../../hooks/useCustomToast';
import { useDraftInput } from '../../hooks/useDraftInput';
import { SpecFramework } from '../../store/workspace';

interface ChatInputProp {
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  disabled?: boolean
  placeholder?: string;
  handlePaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  onFocus?: () => void
  onChange?: (value?: string) => void
}


interface ISelectedMention {
  type: AttachType,
  data?: unknown
}

const insertMention = (
  text: string,
  position: number,
  value: string
): { newValue: string; mentionIndex: number } => {
  const beforeCursor = text.slice(0, position)
  const afterCursor = text.slice(position)
  const lastAtIndex = beforeCursor.lastIndexOf("@")


  let newValue: string
  let mentionIndex: number

  if (lastAtIndex !== -1) {

    // 如果有 '@' 符号，替换从@符号开始到光标位置的内容
    const beforeMention = text.slice(0, lastAtIndex)
    // 移除光标后面的第一个非空白字符序列（原有逻辑）
    newValue = beforeMention + "@" + value + " " + afterCursor.replace(/^[^\s]*/, "")
    mentionIndex = lastAtIndex
  } else {

    // 如果没有 '@' 符号，在光标位置插入@value
    newValue = beforeCursor + "@" + value + " " + afterCursor
    mentionIndex = position
  }


  return { newValue, mentionIndex }
}


const insertMentionFile = (
  text: string,
  position: number,
  value: string
): { newValue: string; mentionIndex: number } => {
  const beforeCursor = text.slice(0, position)
  const afterCursor = text.slice(position)

  // 检查光标前是否已经有@符号
  const lastAtIndex = beforeCursor.lastIndexOf("@")


  let newValue: string
  let mentionIndex: number

  if (lastAtIndex !== -1) {
    // 找到@符号，检查@符号后面到光标位置之间是否只有非空白字符（搜索关键词）
    const textAfterAt = beforeCursor.slice(lastAtIndex + 1)
    // 如果@后面只有非空白字符或为空，说明是在搜索状态，应该替换整个@xxx
    if (!/\s/.test(textAfterAt)) {
      // 替换从@开始到光标位置的内容
      const beforeAt = text.slice(0, lastAtIndex)
      newValue = beforeAt + "@" + value + " " + afterCursor
      mentionIndex = lastAtIndex
    } else {
      // @后面有空白字符，说明已经选择过文件了
      // 检查光标后面是否只有空白字符（多选文件时光标可能在尾部空格前）
      const trailingWhitespace = afterCursor.match(/^(\s*)/)
      if (trailingWhitespace && trailingWhitespace[0].length > 0 && afterCursor.trim() === '') {
        // 光标后只有空白字符，将新的@value插入到所有尾部空白之后
        // 保留原有的尾部空白，在真正的末尾插入
        const trimmedAfter = afterCursor.replace(/^\s+/, '')
        newValue = beforeCursor + afterCursor.match(/^\s*/)![0] + "@" + value + " " + trimmedAfter
        mentionIndex = beforeCursor.length + afterCursor.match(/^\s*/)![0].length
      } else {
        // 光标后有实际内容，在当前位置插入新的@value
        newValue = beforeCursor + "@" + value + " " + afterCursor
        mentionIndex = position
      }
    }
  } else {
    // 没有找到@符号，在光标位置插入@value
    newValue = beforeCursor + "@" + value + " " + afterCursor
    mentionIndex = position
  }


  return { newValue, mentionIndex }
}


export default function ChatMentionAreatext(props: ChatInputProp) {
  const {
    inputRef,
    disabled,
    placeholder,
    handlePaste,
    onKeyDown,
    onBlur,
    onFocus,
    onChange,
  } = props;
  const [cursorPosition, setCursorPosition] = useState(0)
  const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false)
  const [, setInputValue] = useState('')
  const hightlightLayerRef = useRef<HTMLDivElement>(null)
  const { postMessage } = usePostMessage();
  const chatType = useChatStore((state) => state.chatType);
  const updateAttachs = useChatAttach((state) => state.update);
  const workspaceList = useWorkspaceStore((state) => state.workspaceList);
  const ide = useExtensionStore((state) => state.IDE);
  const isVscode = ide === IDE.VisualStudioCode;
  const { toast } = useCustomToast();

  // 使用 useDraftInput Hook 管理输入框草稿
  const { saveCurrentDraft } = useDraftInput(chatType, inputRef);
  // 抽取条件判断，避免重复代码
  const shouldEnableComplexFeatures = useCallback(() => {
    return isVscode && (placeholder?.includes('打开该仓库使用或新建会话') || placeholder?.includes('打开该仓库后可继续对话'));
  }, [isVscode, placeholder]);
  
  // 获取 setInitModalVisible 用于打开初始化弹窗
  const setInitModalVisible = useWorkspaceStore((state) => state.setInitModalVisible);
  const setCurrentSpecFramework = useWorkspaceStore((state) => state.setCurrentSpecFramework);
  
  // 检测是否需要显示初始化提示（提取框架类型和显示文本）
  const initRequiredInfo = useCallback(() => {
    if (!placeholder?.startsWith('__INIT_REQUIRED__')) return null;
    // 格式: __INIT_REQUIRED__framework__displayText
    const parts = placeholder.split('__');
    if (parts.length >= 4) {
      const frameworkStr = parts[2]; // openspec 或 speckit
      return {
        framework: frameworkStr === 'openspec' ? SpecFramework.OpenSpec : SpecFramework.SpecKit,
        displayText: parts.slice(3).join('__'),
      };
    }
    return null;
  }, [placeholder]);
  
  // 处理初始化提示点击事件 - 打开初始化弹窗
  const handleInitClick = useCallback(() => {
    const info = initRequiredInfo();
    if (info) {
      setCurrentSpecFramework(info.framework);
      setInitModalVisible(true);
    }
  }, [initRequiredInfo, setCurrentSpecFramework, setInitModalVisible]);

  const handleScroll = useCallback(() => {
    if (!inputRef.current || !hightlightLayerRef.current) return
    hightlightLayerRef.current.scrollTop = inputRef.current.scrollTop
    hightlightLayerRef.current.scrollLeft = inputRef.current.scrollLeft
  }, [inputRef])

  const updateHighlights = useCallback(() => {
    if (!inputRef.current || !hightlightLayerRef.current) return
    const text = inputRef.current.value
    hightlightLayerRef.current.innerHTML = text
      .replace(/[<>&]/g, (c: string) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] || c)
      .replace(mentionRegexGlobal, '<mark_SPACE_class="mention-context-textarea-highlight">$&</mark>')
      .replace(/( ){2}/ig, `<span class='w-[0.5rem] h-[1rem] inline-block'></span>`)// 高亮层单词换行
      .replace(/_SPACE_/ig, ' ')
      .replace(/\n$/, "\n\n") // Y轴上下文错位
      .replace(/\n/ig, `<br />`)
    handleScroll()
  }, [inputRef, hightlightLayerRef, handleScroll])

  // 处理各个指令关系
  const handleMentionKey = useCallback((selected: ISelectedMention) => {
    const { type } = selected
    switch (type) {
      case AttachType.Problems: {
        postMessage({
          type: BroadcastActions.GET_WORKSPACE_PROBLEMS,
        });
        break
      }
      default: break
    }
  }, [postMessage])

  // 获取插入值
  const getInsertValue = useCallback((selected: ISelectedMention) => {
    const { type, data } = selected
    let insertValue = ''
    if (type === AttachType.Problems) {
      insertValue = `problems`
    } else if (type === AttachType.File && Array.isArray(data)) {
      insertValue = data.reduce((pre, cur, index) => {
        const curPath = (cur as FileItem).path
        const newVal = curPath.startsWith('/') ? curPath : `/${curPath}`
        return pre + (index > 0 ? '@' : '') + newVal + ' '
      }, insertValue)
    } else if (type === AttachType.Folder && Array.isArray(data)) {
      insertValue = data.reduce((pre, cur, index) => {
        const curPath = (cur as FileItem).path
        const newVal = curPath.startsWith('/') ? curPath : `/${curPath}`
        return pre + (index > 0 ? '@' : '') + newVal + ' '
      }, insertValue)
    }
    return insertValue
  }, [])


  useEffect(() => {
    const onMentionSelect = (selectedMention: ISelectedMention) => {
      handleMentionKey(selectedMention)
      if (!inputRef.current) return
      const insertValue = getInsertValue(selectedMention)
      if (!insertValue) return
      // 实时获取当前光标位置，而不使用状态中的cursorPosition
      const currentCursorPosition = inputRef.current.selectionStart || 0
      const { newValue, mentionIndex } = insertMention(inputRef.current.value, currentCursorPosition, insertValue)
      inputRef.current.value = newValue
      setInputValue(newValue)
      const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
      setCursorPosition(newCursorPosition)
      updateHighlights()

      // 针对@problems特殊处理，避免blur/focus导致的状态问题
      if (selectedMention.type === AttachType.Problems) {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current?.setSelectionRange?.(newCursorPosition, newCursorPosition)
          }
        })
      } else {
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.blur()
            inputRef.current?.setSelectionRange?.(newCursorPosition, newCursorPosition)
            inputRef.current.focus()
          }
        }, 0)
      }
    }
    EventBus.instance.on(EBusEvent.Mention_Select, onMentionSelect)
    return () => {
      return EventBus.instance.off(EBusEvent.Mention_Select, onMentionSelect)
    }
  }, [inputRef, cursorPosition, updateHighlights, handleMentionKey, getInsertValue])


  useEffect(() => {
    const onMentionSelectFile = (selectedMention: ISelectedMention) => {
      handleMentionKey(selectedMention)
      if (!inputRef.current) return
      const insertValue = getInsertValue(selectedMention)
      if (!insertValue) return
      // 实时获取当前光标位置，而不使用状态中的cursorPosition
      const currentCursorPosition = inputRef.current.selectionStart || 0
      const { newValue, mentionIndex } = insertMentionFile(inputRef.current.value, currentCursorPosition, insertValue)
      inputRef.current.value = newValue
      setInputValue(newValue)
      // 修复：计算光标位置时，应该找到插入内容的末尾位置
      // insertValue 以空格结尾，所以光标应该在 mentionIndex + 1（@符号后）+ insertValue.length 的位置
      const newCursorPosition = mentionIndex + 1 + insertValue.length
      setCursorPosition(newCursorPosition)
      updateHighlights()
      // 直接设置光标位置并聚焦输入框
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current?.setSelectionRange?.(newCursorPosition, newCursorPosition)
        }
      })
    }
    EventBus.instance.on(EBusEvent.Mention_Select_File, onMentionSelectFile)
    return () => {
      return EventBus.instance.off(EBusEvent.Mention_Select_File, onMentionSelectFile)
    }
  }, [inputRef, cursorPosition, updateHighlights, handleMentionKey, getInsertValue])


  useEffect(() => {
    const onFocusTextarea = () => {
      inputRef.current?.focus()
      updateHighlights()
    }
    EventBus.instance.on(EBusEvent.Focus_Textarea, onFocusTextarea)
    return () => {
      return EventBus.instance.off(EBusEvent.Focus_Textarea, onFocusTextarea)
    }
  }, [inputRef, updateHighlights])

  const updateCursorPosition = useCallback(() => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart)
    }
  }, [inputRef])

  const onCustomChange = useCallback(() => {
    const value = inputRef.current?.value || ''
    setInputValue(value)
    onChange?.()
    updateHighlights()
    updateCursorPosition()
    // 实时保存草稿
    saveCurrentDraft()
  }, [onChange, updateCursorPosition, updateHighlights, inputRef, saveCurrentDraft])

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
        updateCursorPosition()
      }
      updateHighlights()
    },
    [updateHighlights, updateCursorPosition],
  )

  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const isComposing = e.nativeEvent?.isComposing ?? false
    if (e.key === "Backspace" && !isComposing && inputRef.current) {
      // 此时值还没更新,游标位置更新了
      const inputValue = inputRef.current.value
      const cursorPosition = inputRef.current.selectionStart
      const newCursorPosition = cursorPosition - 1
      const charAfterCursor = inputValue[newCursorPosition]
      const charAfterIsWhitespace = charAfterCursor === " " || charAfterCursor === "\n" || charAfterCursor === "\r\n"
      if (
        charAfterIsWhitespace &&
        inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + "$"))
      ) {
        e.preventDefault()
        setJustDeletedSpaceAfterMention(true)
        inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
      } else if (justDeletedSpaceAfterMention) {
        const beforeCursor = inputValue.slice(0, cursorPosition)
        const afterCursor = inputValue.slice(cursorPosition)
        const matchEnd = beforeCursor.match(new RegExp(mentionRegex.source + "$"))
        if (matchEnd) {
          const newText = inputValue.slice(0, cursorPosition - matchEnd[0].length) + afterCursor.replace(" ", "")
          const newPosition = cursorPosition - matchEnd[0].length
          e.preventDefault()
          inputRef.current.value = newText
          inputRef.current.setSelectionRange(newPosition, newPosition)
          updateHighlights()
        }
        setJustDeletedSpaceAfterMention(false)
      } else {
        onKeyDown?.(e)
        setJustDeletedSpaceAfterMention(false)
      }
    } else {
      onKeyDown?.(e)
    }
  }, [inputRef, justDeletedSpaceAfterMention, onKeyDown, updateHighlights])

  const onCustomPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    handlePaste?.(e)
    updateHighlights()
  }, [handlePaste, updateHighlights])

  const onCustomFocus = useCallback(() => {
    onFocus?.()
    updateHighlights()
  }, [onFocus, updateHighlights])

  // 监听 chatType 变化，恢复对应的草稿内容并更新所有相关状态
  useEffect(() => {
    if (inputRef.current) {
      // useDraftInput Hook 已经处理了 inputRef.current.value 的恢复
      // 这里只需要同步组件内部状态
      const currentValue = inputRef.current.value;
      setInputValue(currentValue);
      setCursorPosition(currentValue.length); // 光标设置到末尾
    } else {
      setInputValue('');
      setCursorPosition(0);
    }
    setJustDeletedSpaceAfterMention(false);
    updateHighlights();
  }, [chatType, inputRef, updateAttachs, updateHighlights]);

  // 获取初始化信息（只用于决定渲染哪种 UI）
  const initInfo = initRequiredInfo();

  return (
    <Box position={'relative'} w={'full'} h={'full'}>
      {initInfo ? (
        // 需要初始化的提示：显示可点击的提示，点击后打开初始化弹窗
        <>
          <Box
            position="absolute"
            top="8px"
            left="0"
            right="0"
            paddingLeft="0"
            fontSize="12px"
            color="orange.400"
            zIndex={2}
            pointerEvents="auto"
            cursor="pointer"
            onClick={handleInitClick}
            _hover={{ color: 'orange.500' }}
          >
            <Box textDecoration="underline">
              ⚠ {initInfo.displayText}
            </Box>
          </Box>
          <Box
            ref={hightlightLayerRef}
            position={'absolute'}
            top="8px"
            right="0"
            bottom="0"
            left="0"
            w={'full'}
            lineHeight={1.375}
            pb={'8px'}
            overflow={'auto'}
            fontSize={'1rem'}
            backgroundColor={'transparent'}
            color={'transparent'}
          />
          <Textarea
            disabled={true}
            ref={inputRef}
            h="full"
            px="0"
            border="none"
            resize="none"
            borderRadius="8px"
            zIndex={1}
            fontSize={'1rem'}
            placeholder=""
            _focus={{ boxShadow: 'none' }}
            _placeholder={{ fontSize: '12px', color: 'text.default' }}
            onKeyUp={handleKeyUp}
            onSelect={updateCursorPosition}
            onMouseUp={updateCursorPosition}
            onBlur={onBlur}
            onFocus={onCustomFocus}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onPaste={onCustomPaste}
            onChange={debounce(onCustomChange, 300)}
          />
        </>
      ) : shouldEnableComplexFeatures() ? (
        // VSCode环境且placeholder包含特定文本：显示复杂的点击跳转功能
        <>
          {placeholder && (
            <Box
              position="absolute"
              top="8px"
              left="0"
              right="0"
              paddingLeft="0"
              fontSize="12px"
              color="#666"
              zIndex={2}
              pointerEvents="auto"
            >
              <Box>
                {(() => {
                  // 匹配"当前会话关联仓库 仓库名称"的模式，并查找"打开该仓库"文本
                  const repoMatch = placeholder.match(/当前会话关联仓库\s+([^，,]+)/);
                  const openRepoMatch = placeholder.match(/打开该仓库/);

                  if (repoMatch && openRepoMatch) {
                    const repoName = repoMatch[1].trim();
                    const beforeOpen = placeholder.substring(0, openRepoMatch.index!);
                    const afterOpen = placeholder.substring(openRepoMatch.index! + '打开该仓库'.length);

                    return (
                      <>
                        <Box as="span">
                          {beforeOpen}
                        </Box>
                        <Box
                          as="span"
                          color="blue.400"
                          cursor="pointer"
                          textDecoration="underline"
                          _hover={{ color: "blue.500" }}
                          onClick={() => {
                            // 根据仓库名称在workspaceList中查找对应的path
                            const matchedWorkspace = workspaceList.find((workspace: any) => {
                              // 假设workspaceList中的每个项目都有name或repoName字段
                              return workspace.name === repoName ||
                                workspace.repoName === repoName ||
                                workspace.workspace === repoName ||
                                (workspace.path && workspace.path.includes(repoName));
                            });

                            if (matchedWorkspace) {
                              // 调用OPEN_NEW_WINDOW打开文件
                              postMessage({
                                type: SubscribeActions.OPEN_NEW_WINDOW,
                                data: {
                                  path: matchedWorkspace.path || matchedWorkspace.workspace,
                                },
                              }, '*');
                            } else {
                              toast({
                                title: `未找到名称为"${repoName}"的仓库`,
                                status: 'warning',
                                duration: 2000,
                              });
                            }
                          }}
                        >
                          打开该仓库
                        </Box>
                        <Box as="span">
                          {afterOpen}
                        </Box>
                      </>
                    );
                  }
                  return placeholder;
                })()
                }
              </Box>
            </Box>
          )}
          <Box
            ref={hightlightLayerRef}
            position={'absolute'}
            top="8px"
            right="0"
            bottom="0"
            left="0"
            w={'full'}
            lineHeight={1.375}
            pb={'8px'}
            overflow={'auto'}
            fontSize={'1rem'}
            backgroundColor={'transparent'}
            color={'transparent'}
          // style={{
          //   whiteSpace: "pre-wrap",
          //   wordSpacing: "normal",
          //   textRendering: 'auto',
          //   wordWrap: "break-word",
          //   overflowWrap: 'break-word',
          // }}
          // pointerEvents={'none'}
          />
          <Textarea
            disabled={disabled}
            ref={inputRef}
            h="full"
            px="0"
            border="none"
            resize="none"
            borderRadius="8px"
            zIndex={1}
            fontSize={'1rem'}
            placeholder=""
            _focus={{ boxShadow: 'none' }}
            _placeholder={{ fontSize: '12px', color: 'text.default' }}
            onKeyUp={handleKeyUp}
            onSelect={updateCursorPosition}
            onMouseUp={updateCursorPosition}
            onBlur={onBlur}
            onFocus={onCustomFocus}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onPaste={onCustomPaste}
            onChange={debounce(onCustomChange, 300)}
          />
        </>
      ) : (
        // 其他情况：也使用高亮层包裹textarea
        <>
          <Box
            ref={hightlightLayerRef}
            position={'absolute'}
            top="8px"
            right="0"
            bottom="0"
            left="0"
            w={'full'}
            lineHeight={1.375}
            pb={'8px'}
            overflow={'auto'}
            fontSize={'1rem'}
            backgroundColor={'transparent'}
            color={'transparent'}
          />
          <Textarea
            disabled={disabled}
            ref={inputRef}
            h="full"
            px="0"
            border="none"
            resize="none"
            borderRadius="8px"
            zIndex={1}
            fontSize={'1rem'}
            placeholder={placeholder}
            _focus={{ boxShadow: 'none' }}
            _placeholder={{ fontSize: '12px', color: 'text.default' }}
            onKeyUp={handleKeyUp}
            onSelect={updateCursorPosition}
            onMouseUp={updateCursorPosition}
            onBlur={onBlur}
            onFocus={onCustomFocus}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onPaste={onCustomPaste}
            onChange={debounce(onCustomChange, 300)}
          />
        </>
      )}
    </Box>
  )
}
