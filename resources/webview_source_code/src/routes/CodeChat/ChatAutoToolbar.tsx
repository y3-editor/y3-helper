import {
  Box,
  Button,
  Divider,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Tooltip,
  useOutsideClick,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useChatApplyStore } from '../../store/chatApply';
import userReporter from '../../utils/report';
import { IDE, useExtensionStore } from '../../store/extension';
import { usePostMessage } from '../../PostMessageProvider';
import { RiToolsLine } from 'react-icons/ri';
// import { useTheme } from '../../ThemeContext';
import { useChatConfig } from '../../store/chat-config';
import { UserEvent } from '../../types/report';
import { useChatTerminalStore } from '../../store/chatTerminal';
import { useCurrentSession } from '../../hooks/useCurrentSession';
import MiniButton from '../../components/MiniButton';

enum EAutoConfig {
  AutoApprove = 'autoApprove',
  AutoApply = 'autoApply',
  AutoExecute = 'autoExecute',
  AutoTodo = 'autoTodo',
}

// const autoConfig = []

function ChatAutoToolbar({ disabled = false }: { disabled?: boolean }) {
  // const {} = props
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [focusConfig, setFocusConfig] = useState<EAutoConfig | null>(null);
  // const { activeTheme } = useTheme();
  // const isLight = activeTheme === 'light';
  const currentSession = useCurrentSession();
  const enablePlanMode = currentSession?.data?.enablePlanMode || false;
  const config = useChatConfig((state) => ({
    autoApprove: state.autoApprove,
    autoApply: state.autoApply,
    autoExecute: state.autoExecute,
    autoTodo: state.autoTodo,
    updateAutoApprove: state.updateAutoApprove,
    updateAutoApply: state.updateAutoApply,
    updateAutoExecute: state.updateAutoExecute,
    updateAutoTodo: state.updateAutoTodo,
  }));
  const { postMessage } = usePostMessage();

  const enableNewApply = useChatApplyStore((state) => state.enableNewApply);
  const enableTerminal = useChatTerminalStore((state) => state.enableTerminal);

  const [ide] = useExtensionStore((state) => [state.IDE]);
  const isVsCodeIDE = ide === IDE.VisualStudioCode;
  const isJetbrains = ide === IDE.JetBrains;

  useOutsideClick({
    ref: popoverRef,
    handler: (e) => {
      if (!popoverRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    },
  });

  const openExtensionSetting = useCallback(() => {
    postMessage({
      type: 'OPEN_EXTENSION_SETTING_AUTHORIZATION_PATH',
    });
  }, [postMessage]);

  const autoConfig = useMemo(() => {
    return [
      {
        label: '仓库自动读取',
        value: EAutoConfig.AutoApprove,
        tip: config.autoApprove ? (
          <span>
            开启后，智聊过程将自动进行目录/文件授权，可通过
            <Button
              variant="link"
              color="#776fff"
              onClick={(e) => {
                e.stopPropagation();
                openExtensionSetting();
              }}
            >
              配置忽略目录
            </Button>
            来保护敏感文件。
          </span>
        ) : null,
      },
      {
        label: 'Plan 自动执行',
        value: EAutoConfig.AutoTodo,
        hidden: !enablePlanMode,
      },
      {
        label: '代码自动应用',
        value: EAutoConfig.AutoApply,
        tip: config.autoApply
          ? '开启后，智聊过程的代码修改将自动应用，可通过消息回撤来恢复变更。'
          : null,
        hidden: !enableNewApply,
      },
      {
        label: '命令自动执行',
        value: EAutoConfig.AutoExecute,
        tip: config.autoExecute ? (
          <span>
            开启后，智聊过程需运行的命令将自动执行，可通过
            <Button
              variant="link"
              color="#776fff"
              onClick={(e) => {
                e.stopPropagation();
                openExtensionSetting();
              }}
            >
              配置忽略命令
            </Button>
            来规避高危操作。
          </span>
        ) : null,
        hidden: !enableTerminal || !(isVsCodeIDE || isJetbrains),
      },
    ].filter((i) => !i.hidden);
  }, [
    config.autoApprove,
    config.autoApply,
    config.autoExecute,
    enablePlanMode,
    enableNewApply,
    enableTerminal,
    isVsCodeIDE,
    isJetbrains,
    openExtensionSetting,
  ]);

  // 检查是否有任何一个自动配置为true
  // const hasAnyAutoEnabled = useMemo(() => {
  //   return (
  //     config.autoApprove ||
  //     config.autoApply ||
  //     config.autoExecute ||
  //     (enablePlanMode && config.autoTodo)
  //   );
  // }, [config.autoApprove, config.autoApply, config.autoExecute, config.autoTodo, enablePlanMode]);

  const onReportAutoConfig = useCallback(
    (autoType: string, enable: boolean) => {
      userReporter.report({
        event: UserEvent.CODE_CHAT_ACCEPT_AUTO_MODE,
        extends: {
          autoApply: config.autoApply,
          autoExecute: config.autoExecute,
          autoApprove: config.autoApprove,
          [autoType]: enable,
        },
      });
    },
    [config.autoApply, config.autoApprove, config.autoExecute],
  );

  return (
    <Box ref={popoverRef}>
      <Popover isLazy placement="top" isOpen={isOpen}>
        <PopoverTrigger>
          <MiniButton
            // size="sm"
            // color={hasAnyAutoEnabled ? 'blue.300' : 'text.secondary'}
            // bg={isLight ? '#F2F2F2' : '#2C2C2C'}
            // h="28px"
            // minH="28px"
            // _hover={{
            //   bg: isLight ? '#F2F2F2' : '#2C2C2C',
            //   color: 'blue.300',
            // }}
            // px="2"
            // fontSize="12px"
            fontWeight="normal"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            style={{
              opacity: disabled ? 0.4 : 1,
              pointerEvents: disabled ? 'none' : 'auto',
            }}
          >
            {/* <Divider h="14px" mx="2" orientation="vertical" /> */}
            <Tooltip label="开启智聊操作的自动化" placement="top">
                Auto
            </Tooltip>
          </MiniButton>
        </PopoverTrigger>
        <PopoverContent w={'220px'}>
          <PopoverBody display="flex" flexDirection="column">
            <VStack
              flex={1}
              align="stretch"
              maxH="300px"
              overflowY="scroll"
              spacing={3}
              py={2}
            >
              {autoConfig.map((item) => (
                <Box key={item.value}>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Box fontSize={14}>{item.label}</Box>
                    <Tooltip
                      label={item.tip}
                      placement="top"
                      hasArrow
                      key={item.value}
                      hidden={
                        focusConfig !== item.value ||
                        !(config[item.value as keyof typeof config] as boolean)
                      }
                    >
                      <Switch
                        defaultChecked={
                          (config[
                            item.value as keyof typeof config
                          ] as boolean) || false
                        }
                        onMouseEnter={() => {
                          setFocusConfig(item.value);
                        }}
                        onMouseLeave={() => {
                          setFocusConfig(null);
                        }}
                        onChange={(e) => {
                          onReportAutoConfig(item.value, e.target.checked);
                          switch (item.value) {
                            case EAutoConfig.AutoApprove: {
                              config.updateAutoApprove(e.target.checked);
                              break;
                            }
                            case EAutoConfig.AutoApply: {
                              config.updateAutoApply(e.target.checked);
                              break;
                            }
                            case EAutoConfig.AutoExecute: {
                              config.updateAutoExecute(e.target.checked);
                              break;
                            }
                            case EAutoConfig.AutoTodo: {
                              config.updateAutoTodo(e.target.checked);
                              break;
                            }
                            default:
                              break;
                          }
                        }}
                        isDisabled={disabled}
                      />
                    </Tooltip>
                  </Box>
                </Box>
              ))}
              <Divider />
              <Button
                variant="link"
                color="#776fff"
                size={'sm'}
                onClick={(e) => {
                  e.stopPropagation();
                  openExtensionSetting();
                }}
              >
                <RiToolsLine />
                <Box marginLeft={1}>配置自动授权详情</Box>
              </Button>
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Box>
  );
}

export default ChatAutoToolbar;
