import * as React from 'react';
import { Box, Flex, VStack, Text, Grid } from '@chakra-ui/react';
import { TypeAheadModePrefix, TypeAheadSubProps } from '../../const';
import { getListIndex, scrollToFocusItem } from '../../utils';
import TypeAheadRowItem from '../../TypeAheadRowItem';
import { useChatAttach } from '../../../../../store/chat';
import { AttachType } from '../../../../../store/attaches';
import { Rule } from '../../../../../store/workspace';
import AttachIcon from '../AttachIcon';
import AttachActionBar from '../AttachActionBar';
import { checkValueOfPressedKeyboard } from '../../../../../utils';
import { useRulesOptions } from '../../../../../components/DevSpacePanel/useRulesOptions';
import { useSelectRuleAttach } from '../Hooks/useSelectRuleAttach';

function RuleSelectorPanel(props: TypeAheadSubProps) {
  const {
    focusIndex,
    userInputRef,
    mentionKeyword,
    updateOpenState,
    resetAttachType,
  } = props;
  const listRef = React.useRef<HTMLDivElement>(null);
  const attachs = useChatAttach((state) => state.attachs);
  const rulesOptions = useRulesOptions();
  const selectedRuleHook = useSelectRuleAttach();

  // 过滤规则选项
  const filterRuleOptions = React.useMemo(() => {
    let filteredRules = rulesOptions;

    // 根据搜索关键词过滤
    if (mentionKeyword && mentionKeyword !== TypeAheadModePrefix.Attach) {
      const keyword = mentionKeyword.toLowerCase();
      filteredRules = rulesOptions.filter(rule =>
        rule.name.toLowerCase().includes(keyword) ||
        (rule.metaData.name && rule.metaData.name.toLowerCase().includes(keyword)) ||
        (rule.metaData.description && rule.metaData.description.toLowerCase().includes(keyword))
      );
    }

    // 过滤掉已经选中的规则
    if (attachs?.attachType === AttachType.MultiAttachment) {
      const selectedRulePaths = (attachs as any).dataSource
        ?.filter((item: any) => item.attachType === AttachType.Rules)
        ?.map((item: Rule) => item.filePath) || [];

      filteredRules = filteredRules.filter(rule =>
        !selectedRulePaths.includes(rule.filePath)
      );
    }

    return filteredRules;
  }, [rulesOptions, attachs, mentionKeyword]);

  const currentIndex = React.useMemo(
    () => getListIndex(filterRuleOptions, focusIndex),
    [focusIndex, filterRuleOptions],
  );

  const handleSelectRule = React.useCallback(
    (rule: Rule) => {
      selectedRuleHook.selectRuleAttaches([rule]);
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
    [selectedRuleHook, updateOpenState],
  );

  React.useEffect(() => {
    if (listRef.current) {
      scrollToFocusItem(listRef.current, currentIndex);
    }
  }, [currentIndex]);

  React.useEffect(() => {
    const element = userInputRef?.current;
    function addEnterEventLinstener(event: KeyboardEvent) {
      if (checkValueOfPressedKeyboard(event, ['Enter'])) {
        const currentSelectedRule = filterRuleOptions[currentIndex];
        if (currentSelectedRule) {
          handleSelectRule(currentSelectedRule);
          event.stopPropagation();
          event.preventDefault();
        }
      }
    }

    element?.addEventListener('keydown', addEnterEventLinstener);
    return () => {
      element?.removeEventListener('keydown', addEnterEventLinstener);
    };
  }, [currentIndex, handleSelectRule, filterRuleOptions, userInputRef]);

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
          <RuleList
            rules={filterRuleOptions}
            currentIndex={currentIndex}
            searchKeyword={mentionKeyword}
            onSelect={handleSelectRule}
          />
        </VStack>
        <Box className="mt-2">
          <AttachActionBar onBack={resetAttachType} type="rule" />
        </Box>
      </Box>
    </>
  );
}

function RuleList(props: {
  rules: Rule[];
  currentIndex: number;
  searchKeyword: string;
  onSelect: (rule: Rule) => void;
}) {
  const { rules, currentIndex, onSelect, searchKeyword } = props;

  if (searchKeyword.startsWith(TypeAheadModePrefix.Attach)) {
    if (searchKeyword === TypeAheadModePrefix.Attach && !rules.length) {
      return (
        <Flex w="full" h="100px" alignItems="center" justifyContent="center">
          <Box>暂无可引用的规则</Box>
        </Flex>
      );
    } else if (searchKeyword !== TypeAheadModePrefix.Attach && !rules.length) {
      return (
        <Flex w="full" h="100px" justifyContent="center" alignItems="center">
          <Box>无匹配的规则，请检查规则名称或创建新规则</Box>
        </Flex>
      );
    }
  }

  console.log(rules);

  return rules.map((rule, index) => {
    const displayName = rule.metaData.name || rule.name;
    // const sourceTag = rule.metaData.source || 'codemaker';

    return (
      <TypeAheadRowItem
        key={rule.filePath}
        index={index}
        currentIndex={currentIndex}
        onClick={() => onSelect(rule)}
      >
        <Grid
          position="relative"
          textAlign="left"
          w="full"
          h="full"
          py={2}
          color={currentIndex === index ? 'white' : 'text.primary'}
          display="flex"
          alignItems="center"
          gap="2"
        >
          <AttachIcon attachType={AttachType.Rules} />
          <Box flex="1" overflow="hidden">
            <Text fontSize="sm" fontWeight="medium" isTruncated>
              {displayName}
            </Text>
            {/* <Text fontSize="xs" color={currentIndex === index ? 'gray.200' : 'text.secondary'} isTruncated>
                {rule.filePath}
              </Text> */}
          </Box>
        </Grid>
      </TypeAheadRowItem>
    );
  });
}

export default RuleSelectorPanel;