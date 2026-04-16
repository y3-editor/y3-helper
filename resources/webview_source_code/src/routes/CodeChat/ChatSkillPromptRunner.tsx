import * as React from 'react';
import { Tag, TagCloseButton, TagLabel, Tooltip, Box, Spinner } from '@chakra-ui/react';
import { useSkillPromptApp } from '../../store/skills/skill-prompt';
import { useSkillsStore } from '../../store/skills';

function ChatSkillPromptRunner() {
  // 支持多skill模式
  const activeSkills = useSkillPromptApp((state) => state.activeSkills);
  const loading = useSkillPromptApp((state) => state.loading);
  const removeSkill = useSkillPromptApp((state) => state.removeSkill);
  const skills = useSkillsStore((state) => state.skills);
  const skillConfigs = useSkillsStore((state) => state.skillConfigs);

  const runners = Array.from(activeSkills.values());

  // 当 runner 对应的 skill 已被删除或关闭时，自动清除引用
  React.useEffect(() => {
    runners.forEach((runner) => {
      const skill = skills.find((s) => s.name === runner.skillName);
      const isDisabled = skillConfigs[runner.skillName]?.disabled ?? false;
      if (!skill || isDisabled) {
        removeSkill(runner.skillName);
      }
    });
  }, [activeSkills, skills, skillConfigs, removeSkill]);

  if (runners.length === 0 && !loading) return null;

  if (loading && runners.length === 0) {
    return (
      <div className="mb-2">
        <Tag variant="solid" size="md" px={2} py={1} fontSize="12px" cursor="default">
          <Spinner size="xs" mr={2} />
          <TagLabel>加载 Skill...</TagLabel>
        </Tag>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <Box display="flex" gap={2} flexWrap="wrap">
        {runners.map((runner) => {
          const label = runner.title || `/skill-${runner.skillName}`;
          return (
            <Tooltip
              key={runner.skillName}
              label={
                <Box maxHeight="400px" overflowY="auto" whiteSpace="pre-wrap" maxWidth="600px" fontSize="xs">
                  {runner?.data?.content || label}
                </Box>
              }
              placement="top-start"
              hasArrow
              openDelay={500}
            >
              <Tag variant="solid" size="md" px={2} py={1} fontSize="12px" cursor="default" colorScheme="purple">
                {runner.loading && <Spinner size="xs" mr={2} />}
                <TagLabel isTruncated>{label}</TagLabel>
                <TagCloseButton onClick={() => removeSkill(runner.skillName)} />
              </Tag>
            </Tooltip>
          );
        })}
      </Box>
    </div>
  );
}

export default ChatSkillPromptRunner;
