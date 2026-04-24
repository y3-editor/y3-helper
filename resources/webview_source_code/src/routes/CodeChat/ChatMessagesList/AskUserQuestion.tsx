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

/**
 * 将 option 安全转为字符串
 * 模型幻觉可能传入对象数组 (如 {label, desc})，需要兜底处理
 */
function normalizeOption(opt: unknown): string {
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object') {
    const obj = opt as Record<string, unknown>;
    // 优先取 label 字段，其次 name / value，最后 JSON 序列化
    if (typeof obj.label === 'string') return obj.label;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.value === 'string') return obj.value;
    try {
      return JSON.stringify(opt);
    } catch {
      return String(opt);
    }
  }
  return String(opt);
}

export default function AskUserQuestion(props: AskUserQuestionProps) {
  const {
    toolCallId,
    question,
    options: rawOptions = [],
    multiSelect = false,
    isSubmitted,
    submittedResult,
  } = props;

  // 归一化 options，防止模型传入非字符串元素导致渲染崩溃
  const options = React.useMemo(
    () => (Array.isArray(rawOptions) ? rawOptions.map(normalizeOption) : []),
    [rawOptions],
  );

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
    
  }, [canSubmit, selectedValues, isOtherSelected, customInput, toolCallId, question]);

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
