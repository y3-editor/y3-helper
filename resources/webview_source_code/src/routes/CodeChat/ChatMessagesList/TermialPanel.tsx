import { shallow } from "zustand/shallow"
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChatMessage, ChatRole } from "./types"
import { Box, Button, Icon, IconButton, Spinner, Tooltip, useMediaQuery, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, useDisclosure } from "@chakra-ui/react"
import { VscError } from "react-icons/vsc"
import { FiCopy } from "react-icons/fi";
import { MdFullscreen } from "react-icons/md";
import { BroadcastActions } from "../../../PostMessageProvider";
import useCustomToast from "../../../hooks/useCustomToast";
import { useChatStore, useChatStreamStore } from "../../../store/chat";
import { ThemeStyle, useTheme } from "../../../ThemeContext";
import { IoIosArrowForward } from "react-icons/io";
import { RxCheckCircled } from "react-icons/rx";
import { IoWarningOutline } from "react-icons/io5";
import { IDE, useExtensionStore } from "../../../store/extension";
import { useChatTerminalStore } from "../../../store/chatTerminal";
import { useConfigStore } from "../../../store/config";
import { isCommandSafe, truncateContent } from "../../../utils";
import { GoTerminal } from "react-icons/go";
import { MediumPlusScreenWidth } from "../../../const";
import { MdOutlineStopCircle } from "react-icons/md";
import { UserEvent } from "../../../types/report";

const MAX_SHOW_LINE = 300

interface IProps {
  terminalId: string
  log: string
  status: string
  config: {
    command: string
    is_background: boolean
    require_user_approval: boolean
  },
  messageId?: string
  hasShellIntegration?: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export enum ETerminalStatus {
  START = '',
  CANCELED = 'Canceled',
  RUNNING = 'Running',
  FAILED = 'Failed',
  SUCCESS = 'Success',
  ABORT = 'Abort',
}

// const lineHeight = 25
// const maxLineCount = 5
export const terminalCmdFunction = 'run_terminal_cmd'

const getStatusText = (status: string) => {
  switch (status) {
    case ETerminalStatus.START:
      return ''
    case ETerminalStatus.RUNNING:
      return <Box fontSize={'12px'} className="animate-pulse">正在执行</Box>
    case ETerminalStatus.FAILED:
      return <Box color={'red.400'} fontSize={'12px'}>执行失败</Box>
    case ETerminalStatus.CANCELED:
      return <Box color={'yellow.600'} fontSize={'12px'}>取消执行</Box>
    case ETerminalStatus.SUCCESS:
      return <Box color={'green.500'} fontSize={'12px'}>已执行</Box>
    case ETerminalStatus.ABORT:
      return <Box color={'yellow.500'} fontSize={'12px'}>已中止执行</Box>
    default:
      return ''
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case ETerminalStatus.RUNNING:
      return <Spinner size="sm" className="animate-pulse" style={{ zoom: .7 }} />
    case ETerminalStatus.FAILED:
      return <Icon as={VscError} size="sm" color={'red.500'} />
    case ETerminalStatus.SUCCESS:
      return <Icon as={RxCheckCircled} size="sm" color={'green.500'} />
    case ETerminalStatus.ABORT:
      return <Icon as={IoWarningOutline} size="sm" color={'yellow.500'} />
    default:
      return <Icon as={FiCopy} size="sm" />
  }
}

export default function TerminalPanel(
  props: IProps
) {
  const { messageId, terminalId, config, log, status, hasShellIntegration } = props
  const { toast } = useCustomToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isVsCodeIDE = useExtensionStore.getState().IDE === IDE.VisualStudioCode;
  const [
    updateCurrentSession,
  ] = useChatStore((state) => [
    state.updateCurrentSession,
  ])
  const { activeTheme } = useTheme();

  const lines = useMemo(() => {
    return log.split('\n').splice(-300) // 取最新的300行信息
  }, [log])

  const [terminals, updateTerminals] = useChatTerminalStore((state) => [
    state.terminals,
    state.updateTerminals
  ])
  const [isSmallScreen] = useMediaQuery(MediumPlusScreenWidth);

  const logContainerRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!isExpanded) return
    logContainerRef.current?.scrollTo?.({
      top: logContainerRef.current?.scrollHeight || 0,
    })
  }, [log, isExpanded])

  const isLightTheme = activeTheme === ThemeStyle.Light;

  return (
    <Box
      color={isLightTheme ? 'black' : 'white'}
      border={isLightTheme ? '1px solid #e3e3e3' : '1px solid #3e3f43'}
      borderRadius={'5px'}
    >
      <Box
        display={'flex'}
        alignItems={'center'}
        gap={'0.5rem'}
        paddingY={'0.5rem'}
        w={'100%'}
        backgroundColor={isLightTheme ? 'white' : ''}
        borderRadius={'5px'}
      >
        <Box
          display={'flex'}
          alignItems={'center'}
          gap={'0.3rem'}
          paddingX={'1rem'}
          w={'100%'}
        >
          <Box display={'flex'} alignItems={'center'} justifyContent={'center'}>
            <Box mr={1} mb={1}>{getStatusIcon(status)}</Box>
            <Box display={'flex'} alignItems={'center'} justifyContent={'center'} gap={1}>
              {getStatusText(status)}
              <Box mb={'2px'}
                color={
                  activeTheme === ThemeStyle.Light ? '#000000' : '#ccccccef'
                }>
                终端命令</Box>
            </Box>
          </Box>
          <Box marginLeft={'auto'}>
            <Tooltip label="如果终端存在，则为您打开执行命令的终端窗口">
              <IconButton
                hidden={!(isVsCodeIDE && hasShellIntegration)}
                aria-label='打开终端窗口'
                size="xs"
                icon={<Box display={'flex'} justifyContent={'center'} alignItems={'center'}>
                  <Icon fontSize='14px' as={GoTerminal} />
                  <Box hidden={isSmallScreen} marginLeft={1}>终端</Box>
                </Box>}
                bg="none"
                padding={1}
                onClick={(e) => {
                  e.stopPropagation()
                  window.parent.postMessage({
                    type: BroadcastActions.SHOW_TERMINAL_WINDOW,
                    data: {
                      terminalId,
                    }
                  }, "*")
                }}
                color="default"
              />
            </Tooltip>
            <Tooltip label="命令还在后台运行，点击中止按钮即可终止运行">
              <IconButton
                hidden={terminals[terminalId]?.status !== ETerminalStatus.RUNNING}
                aria-label='终止终端运行'
                size="xs"
                icon={<Box display={'flex'} justifyContent={'center'} alignItems={'center'}>
                  <Icon fontSize='14px' as={MdOutlineStopCircle} />
                  <Box hidden={isSmallScreen} marginLeft={1}>终止</Box>
                </Box>}
                bg="none"
                padding={1}
                onClick={(e) => {
                  e.stopPropagation();
                  window.parent.postMessage({
                    type: BroadcastActions.STOP_TERMINAL_PROGRESS,
                    data: {
                      terminalId,
                    }
                  }, '*');
                  updateTerminals(terminalId, {
                    id: terminalId,
                    status: ETerminalStatus.ABORT,
                  });
                  updateCurrentSession((session) => {
                    const messages = session.data?.messages || []
                    if (!messages.length || !session.data) return
                    const message = messages.find((i) => i.id === messageId && i.role === ChatRole.Assistant)
                    if (!message) return
                    const target = message?.tool_result?.[terminalId]
                    if (target?.extra && [ETerminalStatus.RUNNING, ETerminalStatus.START].includes(target?.extra?.terminalStatus as ETerminalStatus)) {
                      target.extra.terminalStatus = ETerminalStatus.ABORT
                      message.tool_result = {
                        ...message.tool_result,
                        [terminalId]: target
                      }
                    }
                  })
                }}
                color="default"
              />
            </Tooltip>
          </Box>
        </Box>
      </Box>
      <Box
        display={'flex'}
        justifyContent={'space-between'}
        alignItems={'center'}
        backgroundColor={isLightTheme ? '#E8E2dd' : '#303035'}
        color={isLightTheme ? 'black' : 'white'}
        paddingY={'.1em'}
        border={isLightTheme ? '1px solid #eee' : '1px solid #3e3f43'}
      >
        <Box display="flex" alignItems="center" width={'90%'}>
          <Tooltip label={isExpanded ? '折叠执行记录' : '展开执行记录'}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <IoIosArrowForward className={isExpanded ? 'rotate-90 transition-all' : ''} />
            </Button>
          </Tooltip>
          <Box className="truncate">
            <Tooltip label={config?.command || ''}>
              <span>$ {config.command}</span>
            </Tooltip>
          </Box>
        </Box>
        <Tooltip label="复制命令">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast({
                title: '复制命令成功',
                status: 'success',
                duration: 2000,
              })
              window.parent.postMessage({
                type: BroadcastActions.COPY_TO_CLIPBOARD,
                data: config.command,
              }, '*')
            }}
            color={activeTheme === ThemeStyle.Light ? '#000000' : '#ccccccef'}
          >
            <Icon as={FiCopy} size="sm" />
          </Button>
        </Tooltip>
      </Box>
      <Box
        ref={logContainerRef}
        hidden={!status || !isExpanded}
        alignItems={'flex-start'}
        padding={'.3em'}
        className="show-scrollbar"
        backgroundColor={isLightTheme ? '#f7f5f2' : '#292929'}
        overflowY={'auto'}
        maxHeight={'100px'}
        position="relative"
      >
        {/* 操作按钮 */}
        <Box
          position="sticky"
          top="4px"
          right="4px"
          display="flex"
          gap="4px"
          zIndex={10}
        >
          <Tooltip label="全屏预览">
            <IconButton
              ml='auto'
              aria-label="全屏预览"
              size="xs"
              icon={<Icon as={MdFullscreen} fontSize="18px" />}
              bg={isLightTheme ? 'white' : 'gray.700'}
              color={isLightTheme ? 'gray.600' : 'white'}
              _hover={{ bg: isLightTheme ? 'gray.100' : 'gray.600' }}
              onClick={onOpen}
            />
          </Tooltip>
          <Tooltip label="复制日志">
            <IconButton
              aria-label="复制日志"
              size="xs"
              mr='2px'
              icon={<Icon as={FiCopy} fontSize="14px" />}
              bg={isLightTheme ? 'white' : 'gray.700'}
              color={isLightTheme ? 'gray.600' : 'white'}
              _hover={{ bg: isLightTheme ? 'gray.100' : 'gray.600' }}
              onClick={() => {
                toast({
                  title: '复制日志成功',
                  status: 'success',
                  duration: 2000,
                });
                window.parent.postMessage({
                  type: BroadcastActions.COPY_TO_CLIPBOARD,
                  data: log,
                }, '*');
              }}
            />
          </Tooltip>
        </Box>
        {lines.map((line, index) => {
          return (
            <Box
              key={index}
              paddingLeft={'1em'}
              lineHeight={`16px`}
              fontSize={'12px'}
            // height={'16px'}
            >
              {line ? line : <br />}
            </Box>
          )
        })}
      </Box>

      {/* 日志全屏预览 Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Box>
              <Box fontSize="lg" fontWeight="bold">终端日志全屏预览</Box>
              <Box fontSize="sm" color="gray.500" mt={1} display={'flex'}>
                <Box>命令: {config.command}</Box>
                <Box ml={2}>(仅显示最新{MAX_SHOW_LINE}行日志)</Box>
              </Box>
            </Box>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Box
              bg={isLightTheme ? '#f7f5f2' : '#292929'}
              color={isLightTheme ? 'black' : '#e0e0e0'}
              p={4}
              borderRadius="md"
              fontFamily="monospace"
              fontSize="sm"
              whiteSpace="pre-wrap"
              overflowY="auto"
              maxHeight="70vh"
              className="show-scrollbar"
              border={isLightTheme ? '1px solid #e3e3e3' : '1px solid #3e3f43'}
            >
              {lines.length > 0 ? lines.join('\n') : '暂无日志内容'}
            </Box>
            <Box mt={4} display="flex" gap={2}>
              <Button
                leftIcon={<Icon as={FiCopy} />}
                onClick={() => {
                  toast({
                    title: '复制日志成功',
                    status: 'success',
                    duration: 2000,
                  });
                  window.parent.postMessage({
                    type: BroadcastActions.COPY_TO_CLIPBOARD,
                    data: log,
                  }, '*');
                }}
              >
                复制运行日志
              </Button>
              <Button onClick={onClose}>关闭</Button>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>

    </Box>
  )
}


// eslint-disable-next-line react-refresh/only-export-components
export const useChatTerminal = (
  message: ChatMessage
) => {
  const { tool_calls, tool_result, id } = message
  const codeBaseCheckCommands = useConfigStore((state) => state.config.codeBaseCheckCommands)

  const termialTool = useMemo(() => {
    return tool_calls?.find((i) => i.function.name === terminalCmdFunction)
  }, [tool_calls])

  const terminalLog = useMemo(() => {
    if (!termialTool) return ''
    return tool_result?.[termialTool?.id || '']?.content || ''
  }, [termialTool, tool_result])

  const terminalStatus = useMemo(() => {
    if (!termialTool) return ''
    return tool_result?.[termialTool?.id || '']?.extra?.terminalStatus || ''
  }, [termialTool, tool_result])

  const hasShellIntegration = useMemo(() => {
    if (!termialTool) return false
    return tool_result?.[termialTool?.id || '']?.extra?.hasShellIntegration || false
  }, [termialTool, tool_result])

  const commandConfig = useMemo(() => {
    const config = {
      command: '',
      is_background: false,
      require_user_approval: false,
    }
    if (!termialTool) return config
    try {
      const data = JSON.parse(termialTool.function.arguments || '')
      config.command = data.command
      config.is_background = data.is_background
      config.require_user_approval = data.require_user_approval
    } catch (error) {
      console.log('===', error)
    }
    return config
  }, [termialTool])

  const ChatTerminalPanel = useMemo(() => {
    if (!termialTool) return null
    return (
      <TerminalPanel
        messageId={id}
        terminalId={termialTool.id}
        config={commandConfig}
        log={terminalLog}
        status={terminalStatus}
        hasShellIntegration={hasShellIntegration}
      />
    )
  }, [termialTool, id, commandConfig, terminalLog, terminalStatus, hasShellIntegration])

  const hasDangerousCommand = useMemo(() => {
    if (!termialTool) return false
    return !isCommandSafe(codeBaseCheckCommands, commandConfig.command)
  }, [termialTool, codeBaseCheckCommands, commandConfig.command])

  return {
    hasTerminalTool: !!termialTool,
    hasDangerousCommand,
    ChatTerminalPanel,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTerminalMessage = () => {
  const [
    updateCurrentSession,
    syncHistory,
  ] = useChatStore((state) => [
    state.updateCurrentSession,
    state.syncHistory,
  ], shallow)
  const [
    isTerminalProcessing,
    onUserSubmit,
    setIsProcessing,
    setIsTerminalProcessing,
  ] = useChatStreamStore((state) => [
    state.isTerminalProcessing,
    state.onUserSubmit,
    state.setIsProcessing,
    state.setIsTerminalProcessing,
  ], shallow)
  const isVsCodeIDE = useExtensionStore((state) => state.IDE === IDE.VisualStudioCode);
  const terminalTimeout = useChatTerminalStore((state) => state.terminalTimeout)


  const updateTerminalResult = useCallback((data: {
    messageId: string,
    terminalId: string,
    content: string,
    terminalStatus: string,
    hasShellIntegration?: boolean
  }) => {
    const { messageId, terminalId, content, terminalStatus, hasShellIntegration } = data
    if (!isTerminalProcessing) return
    if (terminalTimerRef.current) clearTimeout(terminalTimerRef.current)
    updateCurrentSession((session) => {
      const messages = session.data?.messages || []
      if (!messages.length || !session.data) return setIsTerminalProcessing(false)
      const message = messages.find((i) => (i.id === messageId && i.role === ChatRole.Assistant))
      if (!message) return setIsTerminalProcessing(false)
      if (!message.tool_result) message.tool_result = {}
      const target = message.tool_result?.[terminalId] || {
        content: '',
        path: '终端执行结果',
      }
      Object.assign(target, {
        isError: terminalStatus === ETerminalStatus.FAILED,
        extra: {
          hasShellIntegration: hasShellIntegration,
          terminalStatus: target?.extra?.terminalStatus === ETerminalStatus.ABORT ? ETerminalStatus.ABORT : terminalStatus,
          terminalLog: truncateContent(content),
        }
      })
      message.tool_result = {
        ...message.tool_result,
        [terminalId]: target
      }
      // 手动中止优先级别大于一切
      if (target?.extra?.terminalStatus === ETerminalStatus.ABORT) return setIsTerminalProcessing(false)
      setIsTerminalProcessing(false)
      const lastIndex = messages.length - 1
      if (messages[lastIndex].id === messageId) {
        // 只有最后一条消息是Command时，才通知模型
        const toolResponses: Record<string, boolean> = {}
        let allToolResponse = true
        message.tool_calls?.forEach((i) => {
          if (i.function.name === terminalCmdFunction) {
            toolResponses[i.id] = !!message.tool_result?.[i.id]?.extra?.terminalLog
          } else {
            toolResponses[i.id] = !!message.tool_result?.[i.id]
          }
          if (!toolResponses[i.id]) {
            allToolResponse = false
          }
        })
        if (allToolResponse) {
          // 只有所有工具都返回结果时，才通知模型
          onUserSubmit(
            '',
            {
              event: UserEvent.CODE_CHAT_CODEBASE,
            },
            undefined,
            toolResponses,
          )
        }
      }
    })
  }, [isTerminalProcessing, updateCurrentSession, setIsTerminalProcessing, onUserSubmit])

  const terminalTimerRef = useRef<NodeJS.Timeout | null>(null)
  const updateTerminalLog = useCallback((data: {
    messageId: string
    terminalId: string
    log: string
    terminalStatus: string,
    enableTimeout?: boolean,
  }, isInitial?: boolean) => {
    const { messageId, terminalId, log, terminalStatus, enableTimeout } = data
    let content = ''
    let isAbort = false
    updateCurrentSession((session) => {
      const messages = session.data?.messages || []
      if (!messages.length || !session.data) return
      const message = messages.find((i) => i.id === messageId && i.role === ChatRole.Assistant)
      if (!message) return
      const target = message.tool_result?.[terminalId] || {
        content: '',
        path: '终端执行结果',
      }
      const currentStatus = target?.extra?.terminalStatus || ETerminalStatus.START
      // 手动中止优先级别大于一切
      if (currentStatus === ETerminalStatus.ABORT) {
        isAbort = true
        return
      }
      content = isInitial ? log : target.content + log
      const lines = content.split('\n')
      // 截取Chunk长度, 只保留最新500行或者8000个字符
      if (lines.length > 500) {
        content = lines.slice(-500).join('\n')
      } else if (content.length > 8000) {
        content = content.slice(-8000)
      }
      target.content = content
      if (!target.extra) target.extra = {}
      target.extra.terminalStatus = [ETerminalStatus.SUCCESS, ETerminalStatus.FAILED, ETerminalStatus.ABORT]
        .includes(currentStatus as ETerminalStatus)
        ? currentStatus
        : terminalStatus
      message.tool_result = {
        ...message.tool_result,
        [terminalId]: target
      }
    })
    if (enableTimeout && !isAbort && isVsCodeIDE) {
      if (terminalTimerRef.current) clearTimeout(terminalTimerRef.current)
      terminalTimerRef.current = setTimeout(() => {
        // 兜底：若推送流1min没有响应&该终端是会话最新消息时，则判定终端执行完毕
        updateTerminalResult({
          messageId,
          terminalId,
          // content: `Command executed successfully. \nOutput: \n ${content}`,
          content: `Command is still running in the user's terminal.`
            + content?.length ? `Here.s the output so far:\n ${content}\n` : ''
          + `\nYou will be updated on the terminal status and new output in the future.`,
          terminalStatus: ETerminalStatus.SUCCESS,
        })
        setIsTerminalProcessing(false)
        terminalTimerRef.current = null
      }, 1000 * ((terminalTimeout || 20) + 10))
    }
  }, [isVsCodeIDE, setIsTerminalProcessing, terminalTimeout, updateCurrentSession, updateTerminalResult])

  const stopRunningTerminal = useCallback((disabledSyncHistory?: boolean) => {
    let hasRunningTerminal = false
    updateCurrentSession((session) => {
      const messages = session.data?.messages || []
      if (!messages.length || !session.data) return
      messages.forEach((message) => {
        Object.keys(message.tool_result || {}).forEach((toolId) => {
          const response = message.tool_result?.[toolId]
          if (response?.extra?.terminalStatus && [ETerminalStatus.RUNNING, ETerminalStatus.START].includes(response?.extra?.terminalStatus as ETerminalStatus)) {
            response.extra.terminalStatus = ETerminalStatus.ABORT
            message.tool_result = {
              ...message.tool_result,
              [toolId]: response
            }
            hasRunningTerminal = true
          }
        })
      })
    })
    if (hasRunningTerminal) {
      if (!disabledSyncHistory) syncHistory()
      setIsProcessing(false)
    }
    window.parent.postMessage({
      type: BroadcastActions.STOP_ALL_TERMINAL,
    }, '*')
    setIsTerminalProcessing(false)
  }, [updateCurrentSession, syncHistory, setIsProcessing, setIsTerminalProcessing])

  return {
    updateTerminalLog,
    updateTerminalResult,
    stopRunningTerminal,
  }
}
