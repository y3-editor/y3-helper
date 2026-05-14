import * as React from 'react';
import { Box, Flex, Icon, Text } from '@chakra-ui/react';
import { RiRobot2Line } from 'react-icons/ri';
import type { Agent } from '../../../../modules/subagent/types';
import AgentModelPicker from './AgentModelPicker';

interface BuiltinAgentCardProps {
  agent: Agent;
  isDark: boolean;
  cardBg: string;
  cardBorderColor: string;
  cardHoverBg: string;
}

const BuiltinAgentCard: React.FC<BuiltinAgentCardProps> = ({
  agent,
  isDark,
  cardBg,
  cardBorderColor,
  cardHoverBg,
}) => (
  <Box
    key={agent.name}
    p={4}
    borderWidth="1px"
    borderColor={cardBorderColor}
    borderRadius="xl"
    bg={cardBg}
    transition="all 0.15s"
    _hover={{
      bg: cardHoverBg,
      borderColor: isDark ? 'rgba(66,153,225,0.2)' : 'blue.100',
      boxShadow: isDark
        ? '0 2px 12px rgba(0,0,0,0.3)'
        : '0 2px 8px rgba(66,153,225,0.08)',
    }}
  >
    <Flex alignItems="center" justifyContent="space-between" gap={4}>
      <Flex alignItems="flex-start" gap={3} flex={1} minW={0}>
        <Flex
          w="36px"
          h="36px"
          borderRadius="lg"
          bg={isDark ? 'rgba(255,255,255,0.05)' : 'gray.50'}
          border="1px solid"
          borderColor={cardBorderColor}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
          mt={0.5}
        >
          <Icon
            as={RiRobot2Line}
            w="18px"
            h="18px"
            color={isDark ? 'gray.400' : 'gray.500'}
          />
        </Flex>
        <Box flex={1} minW={0}>
          <Text
            fontWeight="600"
            fontSize="13px"
            color={isDark ? 'gray.100' : 'gray.800'}
            mb={0.5}
          >
            {agent.name}
          </Text>
          <Text
            fontSize="11px"
            color={isDark ? 'gray.500' : 'gray.400'}
            noOfLines={2}
            wordBreak="break-word"
            lineHeight="1.5"
          >
            {agent.description}
          </Text>
        </Box>
      </Flex>
      <Box flexShrink={0}>
        <Text
          fontSize="10px"
          color={isDark ? 'gray.600' : 'gray.400'}
          mb={1}
          textAlign="right"
          letterSpacing="0.03em"
        >
          使用模型
        </Text>
        <AgentModelPicker
          agentName={agent.name}
          agentDefaultModel={agent.model}
          isDark={isDark}
        />
      </Box>
    </Flex>
  </Box>
);

export default BuiltinAgentCard;