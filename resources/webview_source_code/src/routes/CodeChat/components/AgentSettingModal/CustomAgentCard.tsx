import * as React from 'react';
import { Badge, Box, Flex, Icon, IconButton, Text } from '@chakra-ui/react';
import { RiRobot2Line } from 'react-icons/ri';
import { RiExternalLinkLine } from 'react-icons/ri';
import type { Agent } from '../../../../modules/subagent/types';
import CustomAgentModelDisplay from './CustomAgentModelDisplay';
import AgentMCPServersDisplay from './AgentMCPServersDisplay';

interface CustomAgentCardProps {
  agent: Agent;
  isDark: boolean;
  cardBg: string;
  cardBorderColor: string;
  cardHoverBg: string;
  onOpenFile: (filePath: string) => void;
}

const CustomAgentCard: React.FC<CustomAgentCardProps> = ({
  agent,
  isDark,
  cardBg,
  cardBorderColor,
  cardHoverBg,
  onOpenFile,
}) => (
  <Box
    p={4}
    borderWidth="1px"
    borderColor={cardBorderColor}
    borderRadius="xl"
    bg={cardBg}
    position="relative"
    overflow="hidden"
    transition="all 0.15s"
    _hover={{
      bg: cardHoverBg,
      borderColor: isDark ? 'rgba(167,139,250,0.25)' : 'purple.100',
      boxShadow: isDark
        ? '0 2px 12px rgba(0,0,0,0.3)'
        : '0 2px 8px rgba(167,139,250,0.1)',
    }}
    _before={{
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: '3px',
      bg: 'linear-gradient(180deg, #a78bfa, #818cf8)',
      borderRadius: '2px 0 0 2px',
    }}
  >
    <Flex alignItems="flex-start" justifyContent="space-between" gap={4} pl={2}>
      {/* 左侧：icon + 文字内容区（flex 撑满，随 MCP tags 自然增高） */}
      <Flex alignItems="flex-start" gap={3} flex={1} minW={0}>
        {/* icon 固定 36×36，顶部对齐标题行 */}
        <Flex
          w="36px"
          h="36px"
          borderRadius="lg"
          bg={isDark ? 'rgba(167,139,250,0.08)' : 'purple.50'}
          border="1px solid"
          borderColor={isDark ? 'rgba(167,139,250,0.15)' : 'purple.100'}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon as={RiRobot2Line} w="18px" h="18px" color="purple.400" />
        </Flex>
        <Box flex={1} minW={0}>
          <Flex alignItems="center" gap={2} mb={0.5}>
            <Text
              fontWeight="600"
              fontSize="13px"
              color={isDark ? 'gray.100' : 'gray.800'}
            >
              {agent.name}
            </Text>
            {agent.scope && (
              <Badge
                fontSize="10px"
                px={1.5}
                py={0.5}
                borderRadius="sm"
                colorScheme={agent.scope === 'project' ? 'blue' : 'purple'}
                variant="subtle"
                flexShrink={0}
              >
                {agent.scope === 'project' ? '项目' : '个人'}
              </Badge>
            )}
          </Flex>
          <Text
            fontSize="11px"
            color={isDark ? 'gray.500' : 'gray.400'}
            noOfLines={2}
            wordBreak="break-word"
            lineHeight="1.5"
          >
            {agent.description}
          </Text>
          {/* MCP Servers 展示：非空时显示 */}
          {agent.mcpServers && Object.keys(agent.mcpServers).length > 0 && (
            <AgentMCPServersDisplay
              mcpServers={agent.mcpServers}
              isDark={isDark}
            />
          )}
        </Box>
      </Flex>

      {/* 右侧：模型展示 + 打开按钮，顶部对齐，不随卡片高度垂直居中 */}
      <Flex alignItems="flex-start" gap={2} flexShrink={0} pt="2px">
        <CustomAgentModelDisplay model={agent.model} isDark={isDark} />
        {agent.path && (
          <IconButton
            aria-label="在编辑器中打开"
            icon={<Icon as={RiExternalLinkLine} w="18px" h="18px" />}
            size="sm"
            variant="ghost"
            color={isDark ? 'gray.500' : 'gray.400'}
            _hover={{
              color: 'purple.400',
              bg: isDark ? 'rgba(167,139,250,0.1)' : 'purple.50',
            }}
            title={agent.path}
            onClick={() => onOpenFile(agent.path!)}
          />
        )}
      </Flex>
    </Flex>
  </Box>
);

export default CustomAgentCard;