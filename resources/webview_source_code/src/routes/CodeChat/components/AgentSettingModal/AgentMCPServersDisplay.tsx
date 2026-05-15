import * as React from 'react';
import { Box, Button, Flex, Tag, TagLabel, Text } from '@chakra-ui/react';
import { TbServer } from 'react-icons/tb';
import type { AgentMCPServerConfig } from '../../../../modules/subagent/types';

const COLLAPSE_THRESHOLD = 3;

interface AgentMCPServersDisplayProps {
  mcpServers: Record<string, AgentMCPServerConfig>;
  isDark: boolean;
}

const AgentMCPServersDisplay: React.FC<AgentMCPServersDisplayProps> = ({
  mcpServers,
  isDark,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const serverNames = React.useMemo(
    () => Object.keys(mcpServers),
    [mcpServers],
  );

  const needsCollapse = serverNames.length > COLLAPSE_THRESHOLD;
  const visibleNames = needsCollapse && !isExpanded
    ? serverNames.slice(0, COLLAPSE_THRESHOLD)
    : serverNames;
  const remainingCount = serverNames.length - COLLAPSE_THRESHOLD;

  const handleToggle = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded((prev) => !prev);
    },
    [],
  );

  return (
    <Box mt={2}>
      <Text
        fontSize="10px"
        fontWeight="500"
        color={isDark ? 'gray.600' : 'gray.400'}
        mb={1.5}
        letterSpacing="0.03em"
      >
        MCP SERVERS
      </Text>
      <Flex flexWrap="wrap" gap={1.5} alignItems="center">
        {visibleNames.map((name) => (
          <Tag
            key={name}
            size="sm"
            variant="subtle"
            colorScheme={isDark ? undefined : undefined}
            bg={isDark ? 'rgba(255,255,255,0.06)' : 'gray.100'}
            borderRadius="md"
            maxW="160px"
            title={name}
          >
            <Box
              as={TbServer}
              w="10px"
              h="10px"
              color={isDark ? 'gray.400' : 'gray.500'}
              flexShrink={0}
              mr={1}
            />
            <TagLabel
              fontSize="10px"
              color={isDark ? 'gray.300' : 'gray.600'}
              noOfLines={1}
              isTruncated
            >
              {name}
            </TagLabel>
          </Tag>
        ))}

        {needsCollapse && (
          <Button
            size="xs"
            variant="ghost"
            height="auto"
            py={0.5}
            px={1.5}
            fontSize="10px"
            color={isDark ? 'gray.500' : 'gray.400'}
            _hover={{
              color: isDark ? 'gray.300' : 'gray.600',
              bg: isDark ? 'rgba(255,255,255,0.06)' : 'gray.100',
            }}
            onClick={handleToggle}
            minW="auto"
          >
            {isExpanded ? '收起' : `+${remainingCount} more`}
          </Button>
        )}
      </Flex>
    </Box>
  );
};

export default AgentMCPServersDisplay;