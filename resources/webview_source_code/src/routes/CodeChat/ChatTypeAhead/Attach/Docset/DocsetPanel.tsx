import * as React from 'react';
import { Box, Flex, VStack, Text, Spinner, Grid, Link, Tooltip } from '@chakra-ui/react';
import {
  Docset,
  DocsetOptions,
  DocsetFile,
  DocsetItem,
} from '../../../../../services/docsets';
import useUserDocset from './useUserDocset';
import { TypeAheadModePrefix, TypeAheadSubProps } from '../../const';
import { getListIndex, scrollToFocusItem } from '../../utils';
import TypeAheadRowItem from '../../TypeAheadRowItem';
import { AttachType } from '../../../../../store/attaches';
import {
  generateDocsetOptions,
  // CODEMAKER_TAG,
  // LABEL_TAG,
} from './generateDocsetOptions';
import AttachIcon from '../AttachIcon';
import AttachActionBar from '../AttachActionBar';
import {
  checkValueOfPressedKeyboard,
} from '../../../../../utils';
import { useSelectDocsetAttach } from '../Hooks/useSelectDocsetAttach';

function DocsetSelectorPanel(props: TypeAheadSubProps) {
  const {
    focusIndex,
    userInputRef,
    mentionKeyword,
    resetIndex,
    updateOpenState,
    resetAttachType,
  } = props;
  const listRef = React.useRef<HTMLDivElement>(null);
  const { docsets, loading } = useUserDocset();
  const selectDocsetHook = useSelectDocsetAttach();
  const [renderDocsets, setRenderDocsets] = React.useState<DocsetItem[]>([]);
  const docsetOptions = React.useMemo(() => {
    if (!docsets) return [];
    const options = generateDocsetOptions(docsets);
    // 遍历 options , 假如 options 中有 children,那么就加上 parent 属性
    // TODO: 目前层级是有限制的，所以没必要使用递归，后续如果发生变化则再重新设计
    options.forEach((option) => {
      if (option.children?.length) {
        option.children.forEach((child) => {
          (child as DocsetOptions).parent = options;
          if (child.children) {
            child.children.forEach((child) => {
              (child as DocsetOptions).parent = option.children;
            });
          }
        });
      }
    });
    return options;
  }, [docsets]);

  React.useEffect(() => {
    if (!docsetOptions.length) return;
    if (mentionKeyword) {
      setRenderDocsets(searchDocsets(docsetOptions, mentionKeyword));
      return;
    }
    setRenderDocsets(docsetOptions);
  }, [docsetOptions, mentionKeyword]);

  const currentIndex = React.useMemo(
    () => getListIndex(renderDocsets, focusIndex),
    [focusIndex, renderDocsets],
  );

  const updateSelectedDocset = React.useCallback(
    (docset: Docset) => {
      if (docset?.parent) {
        delete docset.parent;
      }
      // 兼容多附件类型存在，比如@文件、文件夹和文档集
      selectDocsetHook.selectDocsetAttaches([docset])
      // 选择后移除 `@` 标识符
      if (userInputRef.current) {
        const value = userInputRef.current.value;
        const attachLastIndex = value.lastIndexOf(TypeAheadModePrefix.Attach);
        const nextValue = value.slice(0, attachLastIndex);
        userInputRef.current.value = nextValue;
        userInputRef.current.dispatchEvent(
          new Event('input', { bubbles: true }),
        );
        userInputRef.current.focus();
      }
      updateOpenState(false);
    },
    [selectDocsetHook, userInputRef, updateOpenState],
  );

  const handleSelectDocset = React.useCallback(
    (docset: DocsetItem) => {
      if (docset.children?.length) {
        setRenderDocsets(docset?.children);
      } else {
        updateSelectedDocset(docset as DocsetOptions);
      }
      resetIndex(0);
    },
    [updateSelectedDocset, resetIndex],
  );

  React.useEffect(() => {
    if (listRef.current) {
      scrollToFocusItem(listRef.current, currentIndex);
    }
  }, [currentIndex]);

  const handleToBack = React.useCallback(() => {
    const currentSelectedDocset = renderDocsets[currentIndex];
    if (currentSelectedDocset?.parent) {
      setRenderDocsets(currentSelectedDocset.parent);
    } else {
      // 没有父节点，回退到开始层级
      if (resetAttachType) {
        resetAttachType();
      }
    }
  }, [renderDocsets, resetAttachType, currentIndex]);

  React.useEffect(() => {
    const element = userInputRef?.current;
    function addEnterEventLinstener(event: KeyboardEvent) {
      if (checkValueOfPressedKeyboard(event, ['Enter'])) {
        const currentSelectedDocset = renderDocsets[currentIndex];
        handleSelectDocset(currentSelectedDocset);
        event.stopPropagation();
        event.preventDefault();
      }
      if (event.shiftKey && checkValueOfPressedKeyboard(event, ['ArrowLeft'])) {
        handleToBack();
        event.stopPropagation();
        event.preventDefault();
      }
    }

    element?.addEventListener('keydown', addEnterEventLinstener);
    return () => {
      element?.removeEventListener('keydown', addEnterEventLinstener);
    };
  }, [
    currentIndex,
    handleSelectDocset,
    renderDocsets,
    userInputRef,
    setRenderDocsets,
    handleToBack,
  ]);

  return (
    <>
      <Box flex={1} w="100%" p={2} bg="themeBgColor">
        <VStack
          pr={2}
          align="stretch"
          maxH="calc(100vh - 400px)"
          minH="80px"
          overflowY="scroll"
          ref={listRef}
        >
          <DocsetList
            userInputRef={userInputRef}
            loading={loading}
            docsets={renderDocsets}
            currentIndex={currentIndex}
            onSelect={handleSelectDocset}
          />
        </VStack>
        <Box className="mt-2">
          <AttachActionBar onBack={handleToBack} />
        </Box>
      </Box>
    </>
  );
}

function DocsetList(props: {
  loading: boolean;
  docsets: DocsetItem[];
  currentIndex: number;
  userInputRef: React.RefObject<HTMLTextAreaElement>;
  onSelect: (docset: DocsetItem) => void;
}) {
  const { loading, docsets, currentIndex, userInputRef, onSelect } = props;
  const { handleOpenBrainmakerHelpWebsite } = useUserDocset();

  if (loading) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        <Spinner size="md" />
      </Flex>
    );
  }

  if (docsets.length === 0) {
    return (
      <Flex
        w="full"
        h="full"
        p={4}
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        gap={2}
      >
        <Box>无知识库</Box>
        <Link color="blue.300" onClick={handleOpenBrainmakerHelpWebsite}>
          接入私域知识库
        </Link>
      </Flex>
    );
  }

  return docsets.map((item, index) => {
    return (
      <TypeAheadRowItem
        key={item._id}
        index={index}
        currentIndex={currentIndex}
        onClick={() => {
          onSelect(item);
          userInputRef.current?.focus();
        }}
      >
        <Grid
          position="relative"
          textAlign="left"
          w="full"
          h="full"
          py={2}
          color={currentIndex === index ? 'white' : 'text.primary'}
          display="flex"
        >
          <Box display="flex" alignItems="center" gap="2" overflow="hidden">
            <AttachIcon attachType={AttachType.Docset} flexShrink={0} />
            <Tooltip label={item.name} placement="top">
              <Text fontSize="sm" isTruncated flex="1" minW="0">
                {item.name}
              </Text>
            </Tooltip>
          </Box>
          {/* {(item?.tags || [])
            .filter((tag) => tag !== CODEMAKER_TAG)
            .filter((tag) => !tag.startsWith(LABEL_TAG))
            .map((tag, tagIndex) => (
              <Box
                key={tagIndex}
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
                color={currentIndex === index ? 'white' : 'blue.300'}
                borderColor={currentIndex === index ? 'white' : 'blue.300'}
              >
                <Text
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {tag}
                </Text>
              </Box>
            ))} */}
        </Grid>
      </TypeAheadRowItem>
    );
  });
}

const searchDocsets = (
  options: DocsetItem[],
  keyword: string,
): DocsetItem[] => {
  const lowercaseKeyword = keyword.toLowerCase();
  if (!keyword) return [];
  const flattenDocsets = (items: DocsetItem[]): DocsetItem[] => {
    return items.flatMap((item) => {
      if ((item as DocsetFile).children?.length) {
        return [item, ...flattenDocsets((item as DocsetFile).children)];
      }
      return [item];
    });
  };

  const flattenedOptions = flattenDocsets(options);
  return flattenedOptions.filter((option) =>
    option.label.toLowerCase().includes(lowercaseKeyword),
  );
};

export default DocsetSelectorPanel;
