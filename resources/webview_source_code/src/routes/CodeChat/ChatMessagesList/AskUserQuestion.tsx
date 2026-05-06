import * as React from 'react';
import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Flex,
  Radio,
  RadioGroup,
  Stack,
  Text,
  VStack,
  Textarea,
  IconButton,
  useToast,
} from '@chakra-ui/react';
import { CopyIcon } from '@chakra-ui/icons';
import { AskUserQuestionProps } from './types';
import { useChatStreamStore } from '../../../store/chat';
import { BroadcastActions, SubscribeActions, usePostMessage } from '../../../PostMessageProvider';

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
  // 追踪 IME 输入法组合状态，避免中文选词回车误触发提交
  const isComposingRef = React.useRef(false);
  const toast = useToast();
  const { postMessage } = usePostMessage();

  // 复制文本到剪贴板
  const handleCopy = React.useCallback((text: string) => {
    console.log('text',text);

     postMessage({
         type: BroadcastActions.COPY_TO_CLIPBOARD,
         data: text,
       });
       toast({
         title: '复制成功',
         position: 'top',
         isClosable: true,
         duration: 1000,
         status: 'success',
       });
  }, [postMessage, toast]);

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
                <Flex
                  key={option}
                  alignItems="center"
                  gap={1}
                  className="group"
                  _hover={{ bg: 'whiteAlpha.50' }}
                  borderRadius="md"
                  px={1}
                  py={0.5}
                  ml={-1}
                >
                  <Checkbox
                    value={option}
                    isDisabled={isProcessing}
                    colorScheme='blue'
                    alignItems="center"
                    flex="1"
                  >
                    <Box
                      as="span"
                      color='text.primary'
                      userSelect="text"
                      cursor="text"
                    >
                      {option}
                    </Box>
                  </Checkbox>
                  <IconButton
                    aria-label="复制"
                    icon={<CopyIcon />}
                    size="xs"
                    variant="ghost"
                    minW="20px"
                    h="20px"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(option);
                    }}
                    opacity={0}
                    _groupHover={{ opacity: 1 }}
                    transition="opacity 0.2s"
                  />
                </Flex>
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
                <Flex
                  key={option}
                  alignItems="center"
                  gap={1}
                  className="group"
                  _hover={{ bg: 'whiteAlpha.50' }}
                  borderRadius="md"
                  px={1}
                  py={0.5}
                  ml={-1}
                >
                  <Radio
                    value={option}
                    isDisabled={isProcessing}
                    colorScheme='blue'
                    alignItems="center"
                    flex="1"
                  >
                    <Box
                      as="span"
                      color='text.primary'
                      userSelect="text"
                      cursor="text"
                    >
                      {option}
                    </Box>
                  </Radio>
                  <IconButton
                    aria-label="复制"
                    icon={<CopyIcon />}
                    size="xs"
                    variant="ghost"
                    minW="20px"
                    h="20px"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(option);
                    }}
                    opacity={0}
                    _groupHover={{ opacity: 1 }}
                    transition="opacity 0.2s"
                  />
                </Flex>
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
          <Textarea
            placeholder="请输入您的答案..."
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              // 自动调整高度
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onInput={(e) => {
              // 捕获所有输入事件，包括撤销操作
              const target = e.target as HTMLTextAreaElement;
              setCustomInput(target.value);
            }}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onKeyDown={(e) => {
              // IME 组合输入中（如中文选词），忽略回车键
              if (isComposingRef.current) return;
              // 回车提交，Shift+Enter 换行
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSubmit && !isProcessing) {
                  handleSubmit();
                }
              }
            }}
            isDisabled={isProcessing}
            size="sm"
            mt={2}
            // minH="30px"
            // maxH="300px"
            // resize="none"
            // overflow="hidden"
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
