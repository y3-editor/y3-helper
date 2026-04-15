import { Tag, TagCloseButton, TagLabel } from '@chakra-ui/react';
import { usePromptApp } from '../../store/promp-app';

function ChatPromptAppRunner() {
  const runner = usePromptApp((state) => state.runner);
  const update = usePromptApp((state) => state.update);

  if (!runner) {
    return null;
  }

  return (
    <div className="mb-2">
      <Tag
        variant="solid"
        size="md"
        px={2}
        py={1}
        key={runner._id}
        // backgroundColor="transparent"
        fontSize="12px"
      >
        <TagLabel isTruncated>/ {runner.name}</TagLabel>
        <TagCloseButton onClick={() => update(undefined)} />
      </Tag>
    </div>
  );
}

export default ChatPromptAppRunner;
