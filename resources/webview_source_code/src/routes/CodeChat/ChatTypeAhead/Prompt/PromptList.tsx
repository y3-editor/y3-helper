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
  Tooltip,
  Portal,
} from '@chakra-ui/react';
import { TbDotsVertical } from 'react-icons/tb';
import { Prompt, PromptCategoryType } from '../../../../services/prompt';
import TypeAheadRowItem from '../TypeAheadRowItem';
import { scrollToFocusItem } from '../utils';
import { UnionData, UnionType } from './type';
import { PluginShortcutRow } from './PluginAppList';
import EventBus, { EBusEvent } from '../../../../utils/eventbus';
import { BroadcastActions } from '../../../../PostMessageProvider';
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
                minH="24px"
                py={1}
                color="text.secondary"
                display="flex"
                alignItems="center"
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
    <Box display="flex" h="24px" alignItems="center" overflow="hidden">
      <Text fontSize="12px" whiteSpace="nowrap">
        / {prompt.name}
      </Text>
      <Tooltip label={displayText} placement="top" hasArrow openDelay={300}>
        <Text
          ml="2"
          fontSize="10px"
          opacity="0.6"
          isTruncated
          flex={1}
          minW={0}
        >
          {parseMarkdownLinks(displayText)}
        </Text>
      </Tooltip>
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
    <Grid w="full" h="24px" gridTemplateColumns="1fr 40px">
      <Box display="flex" alignItems="center" overflow="hidden">
        <Text fontSize="12px" whiteSpace="nowrap">
          / {prompt.name}
        </Text>
        <Tooltip label={prompt.prompt} placement="top" hasArrow openDelay={300}>
          <Text
            ml="2"
            fontSize="10px"
            opacity="0.6"
            isTruncated
            flex={1}
            minW={0}
          >
            {prompt.prompt}
          </Text>
        </Tooltip>
      </Box>
      <Grid
        px={1}
        alignItems="center"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
      >
        <Menu isLazy placement="bottom-end">
          <MenuButton
            size="xs"
            as={IconButton}
            icon={<TbDotsVertical />}
          />
          <Portal>
            <MenuList minWidth="64px" zIndex="popover">
              <MenuItem onClick={() => onEdit(prompt)}>编辑</MenuItem>
              <MenuItem onClick={() => onRemove(prompt)}>删除</MenuItem>
            </MenuList>
          </Portal>
        </Menu>
      </Grid>
    </Grid>
  );
}

function SkillPrompt(props: { prompt: Prompt; source?: string; active?: boolean }) {
  const { prompt, source, active } = props;
  const displayText = prompt.description || prompt.prompt;

  return (
    <Box display="flex" h="24px" alignItems="center" overflow="hidden">
      <Text fontSize="12px" whiteSpace="nowrap">
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
          maxW="80px"
          flexShrink={0}
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
      <Tooltip label={displayText} placement="top" hasArrow openDelay={300}>
        <Text
          ml="2"
          fontSize="10px"
          opacity="0.6"
          isTruncated
          flex={1}
          minW={0}
        >
          {displayText}
        </Text>
      </Tooltip>
    </Box>
  );
}

// 解析文本中的 Markdown 链接并返回 React 元素数组
function parseMarkdownLinks(text: string): React.ReactNode[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // 添加链接前的文本
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // 添加链接
    const linkText = match[1];
    const linkUrl = match[2];
    parts.push(
      <Text
        key={match.index}
        as="span"
        cursor="pointer"
        _hover={{ textDecoration: 'underline' }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          window.parent.postMessage(
            {
              type: BroadcastActions.OPEN_IN_BROWSER,
              data: {
                url: linkUrl,
              },
            },
            '*',
          );
        }}
      >
        {linkText}
      </Text>,
    );

    lastIndex = match.index + match[0].length;
  }

  // 添加最后的文本
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default PromptList;