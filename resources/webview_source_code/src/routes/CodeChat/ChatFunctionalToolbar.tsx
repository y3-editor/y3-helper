import { ReactNode, useCallback, useRef, useState } from 'react';
import {
  Box,
  Text,
  Button,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  useOutsideClick,
  VStack,
  Icon,
} from '@chakra-ui/react';
import SelectWithTooltip, { SelectOption } from '../../components/SelectWithTooltip';
import { RiFileEditLine, RiQuestionnaireLine, RiToolsLine } from 'react-icons/ri';
import { useChatConfig } from '../../store/chat-config';
import { LuListTodo } from 'react-icons/lu';
import { IoTerminalOutline } from 'react-icons/io5';
import MCPConfigCollapse from './MCPConfigCollapse';
import SkillConfigCollapse from './SkillConfigCollapse';
import { useChatTerminalStore } from '../../store/chatTerminal';
import MCPSettingModel from './MCPSettingModel';
import SkillSettingModal from './SkillSettingModal';
import { LuMessageSquareTextIcon } from '../../components/Icon';
import { AiOutlineQuestionCircle } from 'react-icons/ai';
import { useChatStore } from '../../store/chat';
import {
  updateCurrentSession,
  useCurrentSession,
} from '../../hooks/useCurrentSession';
import { usePostMessage } from '../../PostMessageProvider';
import userReporter from '../../utils/report';
import { UserEvent } from '../../types/report';
import MiniButton from '../../components/MiniButton';

enum EAutoConfig {
  AutoApprove = 'autoApprove',
  AutoApply = 'autoApply',
  AutoExecute = 'autoExecute',
  AutoTodo = 'autoTodo',
}

function ChatFunctionalToolbar({ disabled = false }: { disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mcpSettingOpen, setMcpSettingOpen] = useState(false);
  const [skillSettingOpen, setSkillSettingOpen] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const syncHistory = useChatStore((state) => state.syncHistory);
  const { postMessage } = usePostMessage();
  const codebaseChatMode = useChatStore((state) => state.codebaseChatMode);

  const supportNewApply = true;

  const currentSession = useCurrentSession();

  const [compressConfig, setCompressConfig] = useChatConfig((state) => [
    state.compressConfig,
    state.setMemoryConfig,
  ]);
  const [enableTerminal, setEnableTerminal] = useChatTerminalStore((state) => [
    state.enableTerminal,
    state.setEnableTerminal,
  ]);

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

  const [
    enableEditableMode,
    setEnableEditableMode,
    enableUserQuestion,
    setEnableUserQuestion,
  ] = useChatConfig((state) => [
    state.enableEditableMode,
    state.setEnableEditableMode,
    state.enableUserQuestion,
    state.setEnableUserQuestion,
  ]);

  useOutsideClick({
    ref: popoverRef,
    handler: (e) => {
      if (!popoverRef.current?.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        const clickTarget = target?.getAttribute?.('data-target') || ''
        if (!['selectOption'].includes(clickTarget)) {
          setIsOpen(false);
        }
      }
    },
  });

  const openExtensionSetting = useCallback(() => {
    postMessage({
      type: 'OPEN_EXTENSION_SETTING_AUTHORIZATION_PATH',
    });
  }, [postMessage]);

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

  const renderSwitchItem = useCallback(
    (item: {
      title: string;
      icon: ReactNode;
      value: boolean;
      tooltip?: string;
      lebalTooltips?: string;
      onChange: (val: boolean) => void;
      autoConfigKey?: EAutoConfig;
      autoValue?: boolean;
      autoTip?: ReactNode;
      onAutoChange?: (val: boolean) => void;
    }) => {
      // 确定 Select 的值
      const selectValue = !item.value ? 'off' : (item.autoValue ? 'auto' : 'on');
      const hasAutoOption = item.autoConfigKey && item.onAutoChange !== undefined;

      // Build options array
      const selectOptions: SelectOption[] = [
        { value: 'off', label: '关闭' },
        { value: 'on', label: '启用' },
      ];

      if (hasAutoOption) {
        // For autoTip, extract text or use a simplified version
        let tooltipText = '自动模式';
        let tooltipTitle = '自动模式';

        if (item.autoConfigKey === EAutoConfig.AutoExecute) {
          tooltipTitle = '自动执行';
          tooltipText = '智聊过程需运行的命令将自动执行，可通过配置忽略命令来规避高危操作';
        } else if (item.autoConfigKey === EAutoConfig.AutoApply) {
          tooltipTitle = '自动应用';
          tooltipText = '智聊过程的代码修改将自动应用，可通过消息回撤来恢复变更';
        } else if (item.autoConfigKey === EAutoConfig.AutoTodo) {
          tooltipTitle = '自动规划';
          tooltipText = '智聊过程生成的plan执行过程全自动，无需手动确认';
        } else if (typeof item.autoTip === 'string') {
          tooltipText = item.autoTip;
        }

        selectOptions.push({
          value: 'auto',
          label: '启用(Auto)',
          tooltipTitle: tooltipTitle,
          tooltip: tooltipText
        });
      }

      return (
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          paddingBottom={2}
        >
          <Box fontSize={12} display="flex" alignItems="center">
            {item?.icon}
            <Text marginLeft={item.icon ? 2 : 0} fontSize="12px">
              {item.title}
            </Text>
            {item.lebalTooltips && (
              <Tooltip label={item.lebalTooltips} placement="top">
                <Box
                  display="inline-flex"
                  alignItems="center"
                  ml={1}
                  cursor="help"
                >
                  <Icon
                    as={AiOutlineQuestionCircle}
                    w="14px"
                    h="14px"
                    color="gray.500"
                  />
                </Box>
              </Tooltip>
            )}
          </Box>
          <Box display="flex" alignItems="center">
            <SelectWithTooltip
              size="xs"
              width="90px"
              options={selectOptions}
              value={selectValue}
              isDisabled={disabled}
              onChange={(e) => {
                const value = e.target.value;
                const isEnabled = value !== 'off';
                const isAuto = value === 'auto';

                // 先更新启用状态
                if (item.value !== isEnabled) {
                  item.onChange(isEnabled);
                }

                // 如果有 auto 选项，更新 auto 状态
                if (hasAutoOption && item.autoValue !== isAuto) {
                  if (isAuto) {
                    onReportAutoConfig(item.autoConfigKey!, isAuto);
                  }
                  item.onAutoChange!(isAuto);
                }
              }}
            />
          </Box>
        </Box>
      );
    },
    [disabled, onReportAutoConfig],
  );

  const renderAutoMemoryItem = useCallback(() => {
    if (!compressConfig.visible) return null;

    return renderSwitchItem({
      title: 'Memory 工具',
      icon: <LuMessageSquareTextIcon w="16px" h="16px" color="white" />,
      value: compressConfig.enable,
      onChange: (val) => {
        setCompressConfig({ enable: val });
      },
    });
  }, [compressConfig, renderSwitchItem, setCompressConfig]);


  return (
    <Box ref={popoverRef} data-tour="chat-functional-toolbar">
      <Popover placement="top" isOpen={isOpen}>
        <PopoverTrigger>
          <MiniButton
            // size="sm"
            // // color={hasAnyAutoEnabled ? "blue.300" : "text.secondary"}
            // bg={isLight ? '#F2F2F2' : '#2C2C2C'}
            // h="28px"
            // minH="28px"
            // _hover={{
            //   bg: isLight ? '#F2F2F2' : '#2C2C2C',
            //   color: 'blue.300',
            // }}
            // px="2"
            // fontSize="12px"
            // fontWeight="normal"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            style={{
              opacity: disabled ? 0.4 : 1,
              pointerEvents: disabled ? 'none' : 'auto',
            }}
          >
            <Tooltip label="仓库聊天时，自动支持开启的工具类型" placement="top">
              <Box>
                <RiToolsLine size={'16px'} />
              </Box>
            </Tooltip>
          </MiniButton>
        </PopoverTrigger>
        <PopoverContent w={'330px'}>
          <PopoverBody display="flex" flexDirection="column" p="2">
            <VStack flex={1} align="stretch" py={1}>
              {!['openspec', 'speckit'].includes(codebaseChatMode || '') && renderSwitchItem({
                title: 'Plan Mode',
                icon: <LuListTodo size={16} />,
                value: currentSession?.data?.enablePlanMode || false,
                lebalTooltips:
                  '将复杂需求分解成可执行的任务，提供plan面板可视化思路与进度，可随时介入调整计划方向',
                onChange: (val) => {
                  console.log('更新plan');
                  updateCurrentSession((session) => {
                    if (session.data) {
                      session.data.enablePlanMode = val;
                      requestAnimationFrame(syncHistory)
                    }
                  });
                },
                autoConfigKey: EAutoConfig.AutoTodo,
                autoValue: config.autoTodo,
                autoTip: '开启后，智聊过程生成的plan执行过程全自动，无需手动确认',
                onAutoChange: (val) => {
                  onReportAutoConfig(EAutoConfig.AutoTodo, val);
                  config.updateAutoTodo(val);
                },
              })}
              {supportNewApply &&
                renderSwitchItem({
                  title: '代码Apply',
                  icon: <RiFileEditLine size={16} />,
                  value: enableEditableMode,
                  lebalTooltips:
                    '将生成的代码智能应用到目标代码文件，提供清晰的Changes与Apply Diff',
                  onChange: (val) => {
                    setEnableEditableMode(val);
                  },
                  autoConfigKey: EAutoConfig.AutoApply,
                  autoValue: config.autoApply,
                  autoTip: '开启后，智聊过程的代码修改将自动应用，可通过消息回撤来恢复变更',
                  onAutoChange: (val) => {
                    onReportAutoConfig(EAutoConfig.AutoApply, val);
                    config.updateAutoApply(val);
                  },
                })}
              {renderSwitchItem({
                title: '执行CMD',
                icon: <IoTerminalOutline size={16} />,
                value: enableTerminal,
                lebalTooltips:
                  '根据需求生成并执行终端命令，实时回显执行结果，自动诊断并修正错误指令，直至任务成功',
                onChange: (val) => {
                  setEnableTerminal(val);
                },
                autoConfigKey: EAutoConfig.AutoExecute,
                autoValue: config.autoExecute,
                autoTip: (
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
                    来规避高危操作
                  </span>
                ),
                onAutoChange: (val) => {
                  onReportAutoConfig(EAutoConfig.AutoExecute, val);
                  config.updateAutoExecute(val);
                },
              })}
              {renderAutoMemoryItem()}
              <SkillConfigCollapse setSkillSettingOpen={setSkillSettingOpen} />
              {renderSwitchItem({
                title: '需求澄清工具',
                icon: <RiQuestionnaireLine size={'16'} color="white" />,
                value: enableUserQuestion,
                lebalTooltips: '针对不明确的问题，仓库智聊会主动向你提问并提供相关选项，助力澄清需求',
                onChange: (val) => {
                  setEnableUserQuestion(val);
                },
              })}
              <MCPConfigCollapse setMcpSettingOpen={setMcpSettingOpen} />
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
      {/* 注入组件 */}
      <MCPSettingModel
        isOpen={mcpSettingOpen}
        onClose={() => setMcpSettingOpen(false)}
      />
      <SkillSettingModal
        isOpen={skillSettingOpen}
        onClose={() => setSkillSettingOpen(false)}
      />
    </Box>
  );
}

export default ChatFunctionalToolbar;
