import * as React from 'react';
import {
  Flex,
  Spinner,
  Box,
  Text,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Grid,
  VStack,
} from '@chakra-ui/react';
import { TbDotsVertical } from 'react-icons/tb';
import { Prompt, PromptCategoryType } from '../../../../services/prompt';
import TypeAheadRowItem from '../TypeAheadRowItem';
import { scrollToFocusItem } from '../utils';
import { UnionData, UnionType } from './type';
import { PluginShortcutRow } from './PluginAppList';
import EventBus, { EBusEvent } from '../../../../utils/eventbus';
// import { MERMAID_SIGN } from '../../../../store/chat-config';

interface PromptListProps {
  loading: boolean;
  prompts: UnionData[];
  currentIndex: number;
  onSubmit: (prompt: UnionData) => void;
  onEdit: (prompt: Prompt) => void;
  onRemove: (prompt: Prompt) => void;
}

function PromptList(props: PromptListProps) {
  const { loading, prompts, currentIndex, onSubmit, onEdit, onRemove } = props;
  const promptsBodyRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (promptsBodyRef.current) {
      scrollToFocusItem(promptsBodyRef.current, currentIndex);
    }
  }, [currentIndex]);

  const renderPrompt = (prompt: UnionData, index: number) => {
    const active = index === currentIndex;
    if (prompt.type === UnionType.Prompt) {
      if (prompt.meta.type === PromptCategoryType.User) {
        return (
          <UserPrompt
            prompt={prompt.meta}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        );
      } else if (prompt.meta.type === PromptCategoryType.Skill) {
        return <SkillPrompt prompt={prompt.meta} source={prompt.extra?.source} active={active} />;
      } else {
        return <SystemPrompt prompt={prompt.meta} />;
      }
    } else {
      return <PluginShortcutRow data={prompt.meta} />;
    }
  };

  if (loading) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        <Spinner size="md" />
      </Flex>
    );
  }

  if (prompts.length === 0) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        无快捷指令
      </Flex>
    );
  }

  return (
    <>
      <VStack
        pr={2}
        align="stretch"
        gap="2"
        minH="80px"
        overflowY="scroll"
        ref={promptsBodyRef}
      >
        {prompts.map((item, index) => {
          return (
            <TypeAheadRowItem
              key={index}
              index={index}
              currentIndex={currentIndex}
              onClick={() => {
                EventBus.instance.dispatch(EBusEvent.Focus_Textarea)
                onSubmit(item);
              }}
            >
              <Box
                position="relative"
                textAlign="left"
                w="full"
                h="full"
                py={2}
                color="text.secondary"
              >
                {renderPrompt(item, index)}
              </Box>
            </TypeAheadRowItem>
          );
        })}
      </VStack>
      <Text
        as={Flex}
        mt={2}
        pl={2}
        color="text.secondary"
        fontSize="sm"
        alignItems="center"
        gap={1}
      >
        Enter 键立即发送，Tab 键补全到聊天窗口
      </Text>
    </>
  );
}

function SystemPrompt(props: { prompt: Prompt }) {
  const { prompt } = props;
  const displayText = prompt.description || prompt.prompt;

  return (
    <Box>
      <Text mb={1} fontSize="14px" isTruncated>
        / {prompt.name}
      </Text>
      <Text fontSize="12px" opacity="0.6" isTruncated title={displayText}>
        {displayText}
      </Text>
    </Box>
  );
}

function UserPrompt(props: {
  prompt: Prompt;
  onEdit: (prompt: Prompt) => void;
  onRemove: (prompt: Prompt) => void;
}) {
  const { prompt, onEdit, onRemove } = props;

  return (
    <Grid w="full" gridTemplateColumns="1fr 40px">
      <Grid>
        <Text mb={1} fontSize="14px" isTruncated>
          / {prompt.name}
        </Text>
        <Text fontSize="12px" opacity="0.6" isTruncated>
          {prompt.prompt}
        </Text>
      </Grid>
      <Grid
        px={2}
        alignItems="center"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
      >
        <Menu isLazy placement="left" boundary="scrollParent">
          <MenuButton
            size="sm"
            as={IconButton}
            icon={<TbDotsVertical />}
          ></MenuButton>
          <MenuList minWidth="64px">
            <MenuItem onClick={() => onEdit(prompt)}>编辑</MenuItem>
            <MenuItem onClick={() => onRemove(prompt)}>删除</MenuItem>
          </MenuList>
        </Menu>
      </Grid>
    </Grid>
  );
}

function SkillPrompt(props: { prompt: Prompt; source?: string; active?: boolean }) {
  const { prompt, source, active } = props;
  const displayText = prompt.description || prompt.prompt;

  return (
    <Box>
      <Flex mb={1} alignItems="center">
        <Text fontSize="14px" isTruncated>
          / {prompt.name}
        </Text>
        {source && (
          <Box
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            ml="2"
            px="2"
            borderRadius="md"
            borderWidth="1px"
            fontSize="xs"
            h="20px"
            maxW="120px"
            color={active ? 'white' : 'blue.300'}
            borderColor={active ? 'white' : 'blue.300'}
          >
            <Text
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {source}
            </Text>
          </Box>
        )}
      </Flex>
      <Text fontSize="12px" opacity="0.6" isTruncated title={displayText}>
        {displayText}
      </Text>
    </Box>
  );
}

export default PromptList;
