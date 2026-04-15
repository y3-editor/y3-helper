import { Tag, TagCloseButton, TagLabel, Tooltip, Box } from '@chakra-ui/react';
import { useMcpPromptApp } from '../../store/mcp-prompt';

function ChatMcpPromptRunner() {
  const runner = useMcpPromptApp((state) => state.runner);
  const resultText = useMcpPromptApp((state) => state.resultText);
  const reset = useMcpPromptApp((state) => state.reset);

  if (!runner) return null;

  const label = runner.title || `/mcp.${runner.serverName}.${runner.promptName}`;

  return (
    <div className="mb-2">
      <Tooltip
        label={
          <Box maxHeight="400px" overflowY="auto" whiteSpace="pre-wrap" maxWidth="600px" fontSize="xs">
            {resultText}
          </Box>
        }
        placement="top-start"
        hasArrow
        openDelay={500}
      >
        <Tag variant="solid" size="md" px={2} py={1} fontSize="12px" cursor="default">
          <TagLabel isTruncated>{label}</TagLabel>
          <TagCloseButton onClick={() => reset()} />
        </Tag>
      </Tooltip>
    </div>
  );
}

export default ChatMcpPromptRunner;
