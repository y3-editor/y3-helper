import * as React from 'react';
import { Box, Flex, VStack, Text, Spinner, Grid, Link, Tooltip } from '@chakra-ui/react';
import useCodeBase, { GroupValue } from './useCodeBase';
import { TypeAheadModePrefix, TypeAheadSubProps } from '../../const';
import { getListIndex, scrollToFocusItem } from '../../utils';
import TypeAheadRowItem from '../../TypeAheadRowItem';
import { AttachType } from '../../../../../store/attaches';
import { usePostMessage } from '../../../../../PostMessageProvider';
import AttachIcon from '../AttachIcon';
import AttachActionBar from '../AttachActionBar';
import { checkValueOfPressedKeyboard } from '../../../../../utils';
import { useSelectCodebaseAttach } from '../Hooks/useSelectCodebaseAttach';

function CodeBaseSelector(props: TypeAheadSubProps) {
  const {
    inputValue,
    focusIndex,
    userInputRef,
    updateOpenState,
    resetAttachType,
  } = props;
  const listRef = React.useRef<HTMLDivElement>(null);
  const { codeOptions, loading } = useCodeBase();
  const selectCodebaseHook = useSelectCodebaseAttach()

  const codeBaseOptions = React.useMemo(() => {
    const options = [];
    if (codeOptions) {
      for (const item of codeOptions) {
        for (const value of item.options) {
          options.push({
            label: value.label,
            value: value.value,
            branches: value.branches,
            codemaker_public: value.codemaker_public,
            repoUrl: value?.repoUrl || '',
          });
        }
      }
    }
    return options;
  }, [codeOptions]);

  const renderCodeBases = React.useMemo(() => {
    if (!codeBaseOptions) {
      return [];
    }
    const attachLastIndex = inputValue.lastIndexOf(TypeAheadModePrefix.Attach);
    const searchKeyword = inputValue.slice(attachLastIndex + 1);
    if (searchKeyword) {
      return codeBaseOptions.filter((item) =>
        item.label.toLowerCase().includes(searchKeyword.toLowerCase()),
      );
    }
    return codeBaseOptions;
  }, [inputValue, codeBaseOptions]);

  const currentIndex = React.useMemo(
    () => getListIndex(renderCodeBases, focusIndex),
    [renderCodeBases, focusIndex],
  );

  React.useEffect(() => {
    if (listRef.current) {
      scrollToFocusItem(listRef.current, currentIndex);
    }
  }, [currentIndex]);

  const handleSelectCodeBase = React.useCallback(
    (value: GroupValue) => {
      selectCodebaseHook.selecteCodebaseAttaches([value])
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
    [selectCodebaseHook, updateOpenState, userInputRef],
  );

  React.useEffect(() => {
    const element = userInputRef?.current;
    function addEnterEventLinstener(event: KeyboardEvent) {
      if (checkValueOfPressedKeyboard(event, ['Enter'])) {
        const currentSelectedCodeBase = renderCodeBases[currentIndex];
        if (currentSelectedCodeBase) {
          handleSelectCodeBase(currentSelectedCodeBase);
          event.stopPropagation();
          event.preventDefault();
        }
      }
    }

    element?.addEventListener('keydown', addEnterEventLinstener);
    return () => {
      element?.removeEventListener('keydown', addEnterEventLinstener);
    };
  }, [currentIndex, handleSelectCodeBase, renderCodeBases, userInputRef]);

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
          <CodeBaseList
            loading={loading}
            options={renderCodeBases}
            currentIndex={currentIndex}
            onSelect={handleSelectCodeBase}
          />
        </VStack>
        <Box className="mt-2">
          <AttachActionBar onBack={resetAttachType} />
        </Box>
      </Box>
    </>
  );
}

function CodeBaseList(props: {
  loading: boolean;
  options: GroupValue[];
  currentIndex: number;
  onSelect: (value: GroupValue) => void;
}) {
  const { options, currentIndex, onSelect, loading } = props;

  const { postMessage } = usePostMessage();
  if (loading) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        <Spinner size="md" />
      </Flex>
    );
  }
  if (options.length === 0) {
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
        <Box>无代码地图</Box>
        <Link
          color="blue.300"
          onClick={() => {
            postMessage({
              type: 'OPEN_IN_BROWSER',
              data: {
                url: 'https://github.com/user/codemaker',
              },
            });
          }}
        >
          接入代码地图
        </Link>
      </Flex>
    );
  }
  return options.map((item, index) => {
    return (
      <TypeAheadRowItem
        key={item.value}
        index={index}
        currentIndex={currentIndex}
        onClick={() => onSelect(item)}
      >
        <Tooltip label={item.repoUrl || ''} placement='top'>
          <Grid
            position="relative"
            textAlign="left"
            w="full"
            h="full"
            py={2}
            display="flex"
            alignItems="center"
            gap="2"
            color={currentIndex === index ? 'white' : 'text.primary'}
          >
            <AttachIcon attachType={AttachType.CodeBase} />
            <Text fontSize="sm" isTruncated>
              {item.label}
            </Text>
            {item.codemaker_public && (
              <Box
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                px="1"
                py="0.5"
                borderRadius="md"
                fontSize="xs"
                fontWeight="medium"
                color="blue.300"
                border="1px solid"
                borderColor="blue.300"
              >
                公共
              </Box>
            )}
          </Grid>
        </Tooltip>
      </TypeAheadRowItem>
    );
  });
}

export default CodeBaseSelector;
