import * as React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Flex,
  Text,
  Icon,
  Button,
  VStack,
} from '@chakra-ui/react';
import { AiOutlineSetting, AiOutlinePlus } from 'react-icons/ai';
import { usePostMessage } from '../../../../PostMessageProvider';
import { ThemeStyle, useTheme } from '../../../../ThemeContext';
import { BUILTIN_AGENTS } from '../../../../modules/subagent/agents';
import CreateAgentView from '../CreateAgentView';
import { useCustomAgents } from '../../../../hooks/useCustomAgents';
import SectionHeading from './SectionHeading';
import BuiltinAgentCard from './BuiltinAgentCard';
import CustomAgentCard from './CustomAgentCard';

type AgentSettingView = 'settings' | 'create';

interface AgentSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AgentSettingModal: React.FC<AgentSettingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeTheme } = useTheme();
  const isDark = activeTheme !== ThemeStyle.Light;
  const { postMessage } = usePostMessage();
  const [view, setView] = React.useState<AgentSettingView>('settings');
  const { customAgents, refresh } = useCustomAgents();

  React.useEffect(() => {
    if (isOpen) {
      refresh();
      setView('settings');
    }
  }, [isOpen, refresh]);

  const handleModalClose = React.useCallback(() => {
    setView('settings');
    onClose();
  }, [onClose]);

  const handleBackToSettings = React.useCallback(() => {
    setView('settings');
  }, []);

  const handleSwitchToCreate = React.useCallback(() => setView('create'), []);

  const handleOpenFile = React.useCallback(
    (filePath: string) => {
      postMessage({ type: 'OPEN_FILE', data: { filePath } });
    },
    [postMessage],
  );

  const modalBg = isDark ? '#1a1a1a' : '#f5f6f8';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#fff';
  const cardBorderColor = isDark ? 'rgba(255,255,255,0.09)' : 'gray.200';
  const cardHoverBg = isDark ? 'rgba(255,255,255,0.07)' : '#fafbff';
  const headerBg = isDark ? '#1a1a1a' : '#fff';
  const headerBorderColor = isDark ? 'rgba(255,255,255,0.08)' : 'gray.100';

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} closeOnEsc={false} size="full">
      <ModalOverlay bg={isDark ? 'rgba(0,0,0,0.7)' : 'blackAlpha.400'} />
      <ModalContent h="100vh" maxH="100vh" bg={modalBg} borderRadius={0}>
        <ModalHeader
          px={6}
          py={4}
          bg={headerBg}
          borderBottomWidth="1px"
          borderBottomColor={headerBorderColor}
        >
          <Flex alignItems="center" justifyContent="space-between" pr={8}>
            <Flex alignItems="center" gap={2.5}>
              <Flex
                w="28px"
                h="28px"
                borderRadius="md"
                bg={isDark ? 'rgba(66,153,225,0.12)' : 'blue.50'}
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
              >
                <Icon
                  as={view === 'create' ? AiOutlinePlus : AiOutlineSetting}
                  w="15px"
                  h="15px"
                  color="blue.400"
                />
              </Flex>
              <Box>
                <Text
                  fontSize="15px"
                  fontWeight="600"
                  color={isDark ? 'gray.100' : 'gray.800'}
                  lineHeight="1.2"
                >
                  {view === 'create' ? '创建自定义 Agent' : '子代理配置'}
                </Text>
                <Text fontSize="11px" color={isDark ? 'gray.500' : 'gray.400'} mt={0.5}>
                  {view === 'create'
                    ? '描述需求，AI 将自动生成完整的 Agent 配置'
                    : '管理内置与自定义 Agent 的模型偏好'}
                </Text>
              </Box>
            </Flex>
            {view === 'settings' && (
              <Button
                size="sm"
                leftIcon={<Icon as={AiOutlinePlus} w="12px" h="12px" />}
                onClick={handleSwitchToCreate}
                fontWeight="500"
                fontSize="12px"
                h="30px"
                px={3}
                bg={isDark ? 'rgba(66,153,225,0.12)' : 'blue.50'}
                color="blue.400"
                border="1px solid"
                borderColor={isDark ? 'rgba(66,153,225,0.25)' : 'blue.100'}
                borderRadius="md"
                _hover={{
                  bg: isDark ? 'rgba(66,153,225,0.2)' : 'blue.100',
                  borderColor: 'blue.300',
                }}
                transition="all 0.15s"
                variant="unstyled"
                display="inline-flex"
                alignItems="center"
              >
                创建 Agent
              </Button>
            )}
          </Flex>
        </ModalHeader>

        <ModalCloseButton
          top={4}
          right={4}
          color={isDark ? 'gray.400' : 'gray.500'}
          _hover={{ bg: isDark ? 'rgba(255,255,255,0.08)' : 'gray.100' }}
          borderRadius="md"
        />

        <ModalBody
          overflowY="auto"
          px={6}
          py={5}
          css={{
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.1)',
              borderRadius: '2px',
            },
            'scrollbar-width': 'thin',
          }}
        >
          {view === 'create' ? (
            <Box maxW="720px" mx="auto">
              <CreateAgentView
                key="create-agent-view"
                onBack={handleBackToSettings}
                onClose={handleModalClose}
                onSuccess={refresh}
              />
            </Box>
          ) : (
            <Box maxW="860px" mx="auto">
              <SectionHeading
                label="内置 Agent"
                count={BUILTIN_AGENTS.length}
                isDark={isDark}
              />
              <VStack align="stretch" spacing={2} mb={6}>
                {BUILTIN_AGENTS.map((agent) => (
                  <BuiltinAgentCard
                    key={agent.name}
                    agent={agent}
                    isDark={isDark}
                    cardBg={cardBg}
                    cardBorderColor={cardBorderColor}
                    cardHoverBg={cardHoverBg}
                  />
                ))}
              </VStack>

              {customAgents.length > 0 && (
                <>
                  <SectionHeading
                    label="自定义 Agent"
                    count={customAgents.length}
                    isDark={isDark}
                  />
                  <VStack align="stretch" spacing={2}>
                    {customAgents.map((agent) => (
                      <CustomAgentCard
                        key={agent.name}
                        agent={agent}
                        isDark={isDark}
                        cardBg={cardBg}
                        cardBorderColor={cardBorderColor}
                        cardHoverBg={cardHoverBg}
                        onOpenFile={handleOpenFile}
                      />
                    ))}
                  </VStack>
                </>
              )}
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AgentSettingModal;