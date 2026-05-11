import { useState } from 'react';
import {
  Text,
  Box,
  Flex,
  IconButton,
  Icon,
  Tooltip,
  Collapse,
} from '@chakra-ui/react';
import { FaAngleDown, FaAngleRight } from 'react-icons/fa';
import { IoSettingsOutline } from 'react-icons/io5';
import { MdOutlineSmartToy } from 'react-icons/md';
import { useExtensionStore } from '../../store/extension';
import { BUILTIN_AGENTS } from '../../modules/subagent/agents';
import { useChatConfig } from '../../store/chat-config';
import { getLocalStorage, setLocalStorage } from '../../utils/storage';

const COLLAPSE_KEY = 'codechat-agent-collapse-config';

interface IProps {
  setAgentSettingOpen: (open: boolean) => void;
}

const AgentConfigCollapse = ({ setAgentSettingOpen }: IProps) => {
  const subagentEnable = useExtensionStore((state) => state.subagentEnable);
  const [isCollapsed, setIsCollapsed] = useState(!!getLocalStorage(COLLAPSE_KEY));
  const subagentModelConfig = useChatConfig((state) => state.subagentModelConfig);

  if (!subagentEnable) return null;

  return (
    <>
      <Flex
        justifyContent="space-between"
        alignItems="center"
        fontSize="small"
      >
        <Flex
          alignItems="center"
          userSelect="none"
          cursor="pointer"
          onClick={() => {
            setLocalStorage(COLLAPSE_KEY, !isCollapsed);
            setIsCollapsed(!isCollapsed);
          }}
        >
          <MdOutlineSmartToy size={16} />
          <Text marginLeft={2} fontSize={12}>
            Agent 配置
          </Text>
          <Box display="inline-flex" alignItems="center" ml={2}>
            <Icon as={isCollapsed ? FaAngleRight : FaAngleDown} size="xs" />
          </Box>
        </Flex>
        <Box>
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
        </Box>
      </Flex>

      <Collapse in={!isCollapsed} animate={false}>
        {BUILTIN_AGENTS.map((agent) => {
          const userModel = subagentModelConfig?.[agent.name];
          // 显示用户配置的模型，否则显示 agent 默认值的语义描述
          const modelLabel = userModel || (agent.model === 'inherit' ? '默认' : (agent.model ?? '默认'));

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
                <Flex justifyContent="space-between" alignItems="center" width="full">
                  <Text fontSize="sm" >
                    {agent.name}
                  </Text>
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
    </>
  );
};

export default AgentConfigCollapse;