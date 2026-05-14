import { useRef, useState } from 'react';
import {
  Text,
  Box,
  Flex,
  IconButton,
  Icon,
  Tooltip,
  Collapse,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from '@chakra-ui/react';
import { FaAngleDown, FaAngleRight } from 'react-icons/fa';
import { IoSettingsOutline } from 'react-icons/io5';
import { BUILTIN_AGENTS } from '../../modules/subagent/agents';
import { useChatConfig } from '../../store/chat-config';
import { getLocalStorage, setLocalStorage } from '../../utils/storage';
import SelectWithTooltip, { SelectOption } from '../../components/SelectWithTooltip';
import { useChatTerminalStore } from '../../store/chatTerminal';
import { RiRobot2Line } from 'react-icons/ri';

const COLLAPSE_KEY = 'codechat-agent-collapse-config';

const SUBAGENT_MODE_OPTIONS: SelectOption[] = [
  { value: 'off', label: '关闭' },
  { value: 'on', label: '启用' },
  {
    value: 'auto',
    label: '启用(Auto)',
    tooltipTitle: '启用(Auto)',
    tooltip: '开启后，模型将自行判断是否调起子代理，自动执行代码修改与终端命令，无需手动触发',
  },
];

interface IProps {
  setAgentSettingOpen: (open: boolean) => void;
}

const AgentConfigCollapse = ({ setAgentSettingOpen }: IProps) => {
  const [isCollapsed, setIsCollapsed] = useState(!!getLocalStorage(COLLAPSE_KEY));
  const subagentModelConfig = useChatConfig((state) => state.subagentModelConfig);
  const enableSubagent = useChatConfig((state) => state.enableSubagent);
  const setEnableSubagent = useChatConfig((state) => state.setEnableSubagent);
  const enableSubagentManualTriggerOnly = useChatConfig(
    (state) => state.enableSubagentManualTriggerOnly,
  );
  const setEnableSubagentManualTriggerOnly = useChatConfig(
    (state) => state.setEnableSubagentManualTriggerOnly,
  );

  const updateAutoApply = useChatConfig((state) => state.updateAutoApply);
  const updateAutoExecute = useChatConfig((state) => state.updateAutoExecute);
  const setEnableEditableMode = useChatConfig((state) => state.setEnableEditableMode);
  const setEnableTerminal = useChatTerminalStore((state) => state.setEnableTerminal);

  const [pendingMode, setPendingMode] = useState<'on' | 'auto' | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 从两个 boolean 派生出三态 select 值
  const subagentMode: 'off' | 'on' | 'auto' = !enableSubagent
    ? 'off'
    : enableSubagentManualTriggerOnly
      ? 'on'
      : 'auto';

  const handleToggleChange = (e: { target: { value: string } }) => {
    const val = e.target.value as 'off' | 'on' | 'auto';
    if (subagentMode === 'off' && val !== 'off') {
      setPendingMode(val);
    } else {
      applyMode(val);
    }
  };

  const applyMode = (val: 'off' | 'on' | 'auto') => {
    // 确保三态与布尔值完全同步映射
    if (val === 'off') {
      setEnableSubagent(false);
      // 关闭时重置为默认值 false，避免隐藏状态不一致
      setEnableSubagentManualTriggerOnly(false);
    } else if (val === 'on') {
      setEnableSubagent(true);
      setEnableSubagentManualTriggerOnly(true);
    } else {
      // val === 'auto'
      setEnableSubagent(true);
      setEnableSubagentManualTriggerOnly(false);
    }
  };

  const handleConfirm = () => {
    if (!pendingMode) return;
    applyMode(pendingMode);
    updateAutoApply(true);
    updateAutoExecute(true);
    setEnableEditableMode(true);
    setEnableTerminal(true);
    setPendingMode(null);
  };

  return (
    <>
      <Flex justifyContent="space-between" alignItems="center" fontSize="small">
        <Flex
          alignItems="center"
          userSelect="none"
          cursor="pointer"
          onClick={() => {
            setLocalStorage(COLLAPSE_KEY, !isCollapsed);
            setIsCollapsed(!isCollapsed);
          }}
        >
          <RiRobot2Line size={16} />
          <Text marginLeft={2} fontSize={12}>
            Agent 配置
          </Text>
          <Box display="inline-flex" alignItems="center" ml={2}>
            <Icon as={isCollapsed ? FaAngleRight : FaAngleDown} size="xs" />
          </Box>
        </Flex>
        <Flex alignItems="center" gap={1}>
          <Tooltip label="配置 Agent 模型">
            <IconButton
              size="sm"
              height="20px"
              aria-label="配置 Agent 模型"
              icon={<Icon as={IoSettingsOutline} fontSize="16px" />}
              onClick={() => setAgentSettingOpen(true)}
              bg="none"
              color="text.default"
            />
          </Tooltip>
          <SelectWithTooltip
            size="xs"
            width="90px"
            options={SUBAGENT_MODE_OPTIONS}
            value={subagentMode}
            onChange={handleToggleChange}
          />
        </Flex>
      </Flex>

      <Collapse in={!isCollapsed && subagentMode !== 'off'} animate={false}>
        {BUILTIN_AGENTS.map((agent) => {
          const userModel = subagentModelConfig?.[agent.name];
          const modelLabel =
            userModel ||
            (agent.model === 'inherit' ? '默认' : (agent.model ?? '默认'));

          return (
            <Box key={agent.name} marginLeft={4} position="relative">
              <Flex
                paddingLeft={1}
                paddingBottom={2}
                _before={{
                  content: '""',
                  position: 'absolute',
                  left: '-10px',
                  top: '-60%',
                  width: '8px',
                  height: '100%',
                  borderLeft: '1px solid #797979',
                  borderBottom: '1px solid #797979',
                }}
              >
                <Flex
                  justifyContent="space-between"
                  alignItems="center"
                  width="full"
                >
                  <Text fontSize="sm">{agent.name}</Text>
                  <Tooltip label={modelLabel} placement="top">
                    <Text
                      fontSize="sm"
                      maxW="110px"
                      isTruncated
                      cursor="default"
                    >
                      {modelLabel}
                    </Text>
                  </Tooltip>
                </Flex>
              </Flex>
            </Box>
          );
        })}
      </Collapse>

      <AlertDialog
        isOpen={pendingMode !== null}
        leastDestructiveRef={cancelRef}
        onClose={() => setPendingMode(null)}
        size="sm"
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="md" fontWeight="bold">
              启用 Agent 自动模式
            </AlertDialogHeader>
            <AlertDialogBody fontSize="sm">
              启用后，模型将自行判断是否调起子代理，并自动将「代码
              Apply」和「执行 CMD」设置为启用（Auto）状态。
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelRef}
                size="sm"
                onClick={() => setPendingMode(null)}
              >
                取消
              </Button>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={handleConfirm}
                ml={2}
              >
                确认
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default AgentConfigCollapse;