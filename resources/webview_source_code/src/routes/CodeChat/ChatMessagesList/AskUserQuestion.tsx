import * as React from 'react';
import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Flex,
  Input,
  Radio,
  RadioGroup,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { AskUserQuestionProps } from './types';
import { useChatStreamStore } from '../../../store/chat';
import { SubscribeActions } from '../../../PostMessageProvider';

const OTHER_VALUE = '__other__';

export default function AskUserQuestion(props: AskUserQuestionProps) {
  const {
    toolCallId,
    messageId,
    question,
    options = [],
    multiSelect = false,
    isSubmitted,
    submittedResult,
  } = props;

  const onUserSubmit = useChatStreamStore((state) => state.onUserSubmit);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);

  const [selectedValues, setSelectedValues] = React.useState<string[]>([]);
  const [customInput, setCustomInput] = React.useState('');
  const [isOtherSelected, setIsOtherSelected] = React.useState(false);

  // 处理单选变化
  const handleRadioChange = React.useCallback((value: string) => {
    if (value === OTHER_VALUE) {
      setIsOtherSelected(true);
      setSelectedValues([]);
    } else {
      setIsOtherSelected(false);
      setSelectedValues([value]);
    }
  }, []);

  // 处理多选变化
  const handleCheckboxChange = React.useCallback((values: string[]) => {
    const hasOther = values.includes(OTHER_VALUE);
    setIsOtherSelected(hasOther);
    setSelectedValues(values.filter((v) => v !== OTHER_VALUE));
  }, []);

  // 提交是否可用
  const canSubmit = React.useMemo(() => {
    if (isOtherSelected) {
      return customInput.trim().length > 0;
    }
    return selectedValues.length > 0;
  }, [isOtherSelected, customInput, selectedValues]);

  // 处理提交
  const handleSubmit = React.useCallback(() => {
    if (!canSubmit) return;

    const result = isOtherSelected
      ? [...selectedValues, customInput.trim()].filter(Boolean).join(', ')
      : selectedValues.join(', ');

    window.postMessage({
      type: SubscribeActions.TOOL_CALL_RESULT,
      data: {
        tool_name: 'ask_user_question',
        tool_result: {
          path: question,
          content: result,
          isError: false
        },
        tool_id: toolCallId,
      },
    },
      '*'
    );
    
  }, [
    canSubmit,
    selectedValues,
    isOtherSelected,
    customInput,
    messageId,
    toolCallId,
    onUserSubmit,
    options,
    question,
    toolCallId
  ]);

  // 已提交状态渲染
  if (isSubmitted && submittedResult) {
    return (
      <Box
        borderWidth="1px"
        borderRadius="md"
        p={4}
        bg="bg.subtle"
        opacity={0.8}
      >
        <Flex alignItems="center" gap={2} mb={2}>
          <Text fontWeight="medium" color="text.primary" style={{marginBottom: 0}}>
            {question}
          </Text>
        </Flex>
        <Box color="text.secondary" fontSize="sm">
          <Text style={{marginBottom: 0}}>已选择：{submittedResult}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box borderWidth="1px" borderRadius="md" p={4} bg="bg.subtle">
      <VStack align="stretch" spacing={4}>
        {/* 问题标题 */}
        <Text fontWeight="medium" color="text.primary" style={{marginBottom: 0}}>
          {question}
        </Text>

        {/* 选项列表 */}
        {multiSelect ? (
          <CheckboxGroup
            value={[...selectedValues, ...(isOtherSelected ? [OTHER_VALUE] : [])]}
            onChange={handleCheckboxChange}
          >
            <Stack spacing={2}>
              {options.map((option) => (
                <Checkbox
                  key={option}
                  value={option}
                  isDisabled={isProcessing}
                  colorScheme='blue'
                  alignItems="center"
                >
                  <Box
                    as="span"
                    color='text.primary'
                  >
                    {option}
                  </Box>
                </Checkbox>
              ))}
              {/* Other 选项 */}
              <Checkbox
                value={OTHER_VALUE}
                isDisabled={isProcessing}
                colorScheme='blue'
                alignItems="center"
              >
                <Box as="span" color="text.primary">
                  Other
                </Box>
              </Checkbox>
            </Stack>
          </CheckboxGroup>
        ) : (
          <RadioGroup
            value={isOtherSelected ? OTHER_VALUE : selectedValues[0] || ''}
            onChange={handleRadioChange}
          >
            <Stack spacing={2}>
              {options.map((option) => (
                <Radio
                  key={option}
                  value={option}
                  isDisabled={isProcessing}
                  colorScheme='blue'
                  alignItems="center"
                >
                  <Box
                    as="span"
                    color='text.primary'
                  >
                    {option}
                  </Box>
                </Radio>
              ))}
              {/* Other 选项 */}
              <Radio
                value={OTHER_VALUE}
                isDisabled={isProcessing}
                colorScheme='blue'
                alignItems="center"
              >
                <Box as="span" color="text.primary">
                  Other
                </Box>
              </Radio>
            </Stack>
          </RadioGroup>
        )}

        {/* 自定义输入框 */}
        {isOtherSelected && (
          <Input
            placeholder="请输入您的答案..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            isDisabled={isProcessing}
            size="sm"
            mt={2}
          />
        )}

        {/* 提交按钮 */}
        <Flex justifyContent="flex-end">
          <Button
            size="sm"
            colorScheme='blue'
            bg="blue.300"
            isDisabled={!canSubmit || isProcessing}
            onClick={handleSubmit}
          >
            提交
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
}
