import { Tag, TagCloseButton, TagLabel, Tooltip } from '@chakra-ui/react';
import { useAgentPromptStore } from '../../store/agent-prompt';

function ChatAgentPromptRunner() {
  const runner = useAgentPromptStore((state) => state.runner);
  const clear = useAgentPromptStore((state) => state.clear);

  if (!runner) {
    return null;
  }

  return (
    <div className="mb-2">
      <Tooltip label={runner.description || `/${runner.name}`} placement="top-start">
        <Tag
          variant="solid"
          size="md"
          px={2}
          py={1}
          fontSize="12px"
          cursor="default"
          colorScheme="blue"
          maxW="full"
        >
          <TagLabel isTruncated>{`/${runner.name}`}</TagLabel>
          <TagCloseButton onClick={clear} />
        </Tag>
      </Tooltip>
    </div>
  );
}

export default ChatAgentPromptRunner;