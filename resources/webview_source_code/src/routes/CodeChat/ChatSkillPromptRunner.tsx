import { Tag, TagCloseButton, TagLabel, Tooltip, Box, Spinner } from '@chakra-ui/react';
import { useSkillPromptApp } from '../../store/skills/skill-prompt';

function ChatSkillPromptRunner() {
  const runner = useSkillPromptApp((state) => state.runner);
  const resultText = useSkillPromptApp((state) => state.resultText);
  const loading = useSkillPromptApp((state) => state.loading);
  const reset = useSkillPromptApp((state) => state.reset);

  if (!runner && !loading) return null;

  if (loading) {
    return (
      <div className="mb-2">
        <Tag variant="solid" size="md" px={2} py={1} fontSize="12px" cursor="default">
          <Spinner size="xs" mr={2} />
          <TagLabel>加载 Skill...</TagLabel>
        </Tag>
      </div>
    );
  }

  const label = runner?.title || `/skill-${runner?.skillName}`;

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
        <Tag variant="solid" size="md" px={2} py={1} fontSize="12px" cursor="default" colorScheme="purple">
          <TagLabel isTruncated>{label}</TagLabel>
          <TagCloseButton onClick={() => reset()} />
        </Tag>
      </Tooltip>
    </div>
  );
}

export default ChatSkillPromptRunner;
