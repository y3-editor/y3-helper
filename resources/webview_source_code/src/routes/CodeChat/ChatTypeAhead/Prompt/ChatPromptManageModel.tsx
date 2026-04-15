import * as React from 'react';
import {
  Box,
  Flex,
  IconButton,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Button,
  UnorderedList,
  ListItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
} from '@chakra-ui/react';
import { TbChevronLeft } from 'react-icons/tb';
import useUserPrompt, {
  INNER_VARIABLE,
  PROMPT_CODE_VARIABLE,
} from './useUserPrompt';
import { Prompt } from '../../../../services/prompt';
import useCustomToast from '../../../../hooks/useCustomToast';
import CopyButton from '../../../../components/CopyButton';
import { debounce } from 'lodash';

interface ChatPromptModelProps {
  isOpen: boolean;
  prompt?: Prompt;
  onClose: () => void;
}

export interface ChatNewPromptModelHandle {
  setFormValue: (formValue: {
    promptName: string;
    promptContent: string;
  }) => void;
}

export const ChatNewPromptModel = React.forwardRef(
  (props: ChatPromptModelProps, ref) => {
    const { isOpen, onClose } = props;
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [promptName, setPromptName] = React.useState('');
    const [promptContent, setPromptContent] = React.useState('');
    const { handleCreatePrompt } = useUserPrompt();
    const { toast } = useCustomToast();

    const handleReset = () => {
      setPromptName('');
      setPromptContent('');
    };

    const handleSubmit = async () => {
      setIsSubmitting(true);
      const trimmedPromptName = promptName.trim();
      const trimmedPromptContent = promptContent.trim();
      if (!trimmedPromptName || !trimmedPromptContent) {
        toast({
          title: 'Prompt 标题与内容均不可为空',
          status: 'error',
          position: 'top',
          isClosable: true,
        });
        setIsSubmitting(false);
        return;
      }
      await handleCreatePrompt(promptName, promptContent);
      handleCloseModel();
      setIsSubmitting(false);
    };

    // 使用 debounce 包裹 handleSubmit
    const debouncedHandleSubmit = debounce(handleSubmit, 200);

    const handleCloseModel = () => {
      handleReset();
      onClose();
    };

    const setFormValue = React.useCallback(
      (formValue: { promptName: string; promptContent: string }) => {
        setPromptName(formValue.promptName);
        setPromptContent(formValue.promptContent);
      },
      [],
    );

    React.useImperativeHandle(ref, () => ({
      setFormValue: setFormValue,
    }));

    return (
      <Modal
        size="full"
        autoFocus={false}
        trapFocus={false}
        isOpen={isOpen}
        onClose={handleCloseModel}
      >
        <ModalOverlay />
        <ModalContent className="chat-typeahead-inner-element">
          <ModalHeader>
            <Flex gap={2} alignItems="center">
              <IconButton
                aria-label="back"
                icon={<TbChevronLeft />}
                mr={2}
                onClick={handleCloseModel}
              />
              <Text>新建自定义 prompt</Text>
            </Flex>
          </ModalHeader>
          <Divider size="lg" />
          <ModalBody>
            <Flex py={4} flexDirection="column" gap={3}>
              <Text>自定义常用 Prompt，可以在 chat 的过程中快速应用。</Text>
              <Box py={4}>
                <FormControl isRequired>
                  <FormLabel>Prompt 标题</FormLabel>
                  <Input
                    value={promptName}
                    onChange={(event) => setPromptName(event.target.value)}
                    onInput={(e) => {
                      const nextValue = (e.target as HTMLInputElement).value;
                      setPromptName(nextValue);
                    }}
                  />
                </FormControl>

                <FormControl isRequired mt={4}>
                  <FormLabel>Prompt 内容</FormLabel>
                  <Textarea
                    rows={10}
                    value={promptContent}
                    onChange={(event) => setPromptContent(event.target.value)}
                    onInput={(e) => {
                      const nextValue = (e.target as HTMLTextAreaElement).value;
                      setPromptContent(nextValue);
                    }}
                  />
                </FormControl>
              </Box>
              <Text>
                支持多种
                <Popover>
                  <PopoverTrigger>
                    <Text display="inline" color="blue.200" cursor="pointer">
                      参数占位符
                    </Text>
                  </PopoverTrigger>
                  <PopoverContent minW="480px">
                    <PopoverArrow />
                    <PopoverBody width="100%">
                      <PromptVariableTooltip />
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
                。没有显式指定
                <code className="mx-2">{PROMPT_CODE_VARIABLE}</code>
                占位符的Prompt会把所选的代码自动添加到Prompt的末尾。
              </Text>
            </Flex>
          </ModalBody>
          <ModalFooter justifyContent="center" gap={4}>
            <Button
              colorScheme="blue"
              color="white"
              onClick={debouncedHandleSubmit}
              isLoading={isSubmitting}
            >
              新建
            </Button>
            <Button onClick={onClose}>取消</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  },
);

export function ChatEditPromptModel(props: Required<ChatPromptModelProps>) {
  const { isOpen, prompt, onClose } = props;

  const [promptName, setPromptName] = React.useState(prompt.name);
  const [promptContent, setPromptContent] = React.useState(prompt.prompt);
  const { handleUpdatePrompt } = useUserPrompt();
  const { toast } = useCustomToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleReset = () => {
    setPromptName('');
    setPromptContent('');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const trimmedPromptName = promptName.trim();
    const trimmedPromptContent = promptContent.trim();
    if (!trimmedPromptName || !trimmedPromptContent) {
      toast({
        title: 'Prompt 标题与内容均不可为空',
        status: 'error',
        position: 'top',
        isClosable: true,
      });
      setIsSubmitting(false);
      return;
    }
    await handleUpdatePrompt(prompt._id, promptName, promptContent);
    handleCloseModel();
    setIsSubmitting(false);
  };

  // 使用 debounce 包裹 handleSubmit
  const debouncedHandleSubmit = debounce(handleSubmit, 200);

  const handleCloseModel = () => {
    handleReset();
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      setPromptName(prompt.name);
      setPromptContent(prompt.prompt);
    }
  }, [isOpen, prompt]);

  return (
    <Modal
      id="prompt-edit-modal"
      size="full"
      autoFocus={false}
      trapFocus={false}
      isOpen={isOpen}
      onClose={handleCloseModel}
    >
      <ModalOverlay />
      <ModalContent className="chat-typeahead-inner-element">
        <ModalHeader>
          <Flex gap={2} alignItems="center">
            <IconButton
              aria-label="back"
              icon={<TbChevronLeft />}
              mr={2}
              onClick={handleCloseModel}
            />
            <Text>编辑自定义 prompt</Text>
          </Flex>
        </ModalHeader>
        <Divider size="lg" />
        <ModalBody>
          <Flex py={4} flexDirection="column" gap={3}>
            <Text>自定义常用 Prompt，可以在 chat 的过程中快速应用。</Text>
            <Box py={4}>
              <FormControl isRequired>
                <FormLabel>Prompt 标题</FormLabel>
                <Input
                  value={promptName}
                  onChange={(event) => setPromptName(event.target.value)}
                  onInput={(e) => {
                    const nextValue = (e.target as HTMLInputElement).value;
                    setPromptName(nextValue);
                  }}
                />
              </FormControl>

              <FormControl isRequired mt={4}>
                <FormLabel>Prompt 内容</FormLabel>
                <Textarea
                  rows={10}
                  value={promptContent}
                  onChange={(event) => setPromptContent(event.target.value)}
                  onInput={(e) => {
                    const nextValue = (e.target as HTMLTextAreaElement).value;
                    setPromptContent(nextValue);
                  }}
                />
              </FormControl>
            </Box>
            <Text>
              支持多种
              <Popover>
                <PopoverTrigger>
                  <Text display="inline" color="blue.200" cursor="pointer">
                    参数占位符
                  </Text>
                </PopoverTrigger>
                <PopoverContent minW="480px">
                  <PopoverArrow />
                  <PopoverBody width="100%">
                    <PromptVariableTooltip />
                  </PopoverBody>
                </PopoverContent>
              </Popover>
              。没有显式指定
              <code className="mx-2">{PROMPT_CODE_VARIABLE}</code>
              占位符的Prompt会把所选的代码自动添加到Prompt的末尾。
            </Text>
          </Flex>
        </ModalBody>
        <ModalFooter justifyContent="center" gap={4}>
          <Button
            colorScheme="blue"
            isLoading={isSubmitting}
            onClick={debouncedHandleSubmit}
          >
            保存
          </Button>
          <Button onClick={onClose}>取消</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function ChatRemovePromptModel(props: Required<ChatPromptModelProps>) {
  const { isOpen, prompt, onClose } = props;

  const { handleRemovePrompt } = useUserPrompt();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await handleRemovePrompt(prompt._id);
    onClose();
    setIsSubmitting(false);
  };

  // 使用 debounce 包裹 handleSubmit
  const debouncedHandleSubmit = debounce(handleSubmit, 200);

  return (
    <Modal
      size="full"
      autoFocus={false}
      trapFocus={false}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalOverlay />
      <ModalContent className="chat-typeahead-inner-element">
        <ModalHeader>
          <Flex gap={2} alignItems="center">
            <IconButton
              aria-label="back"
              icon={<TbChevronLeft />}
              mr={2}
              onClick={onClose}
            />
            <Text>删除自定义 prompt</Text>
          </Flex>
        </ModalHeader>
        <Divider size="lg" />
        <ModalBody>
          <Flex py={4} flexDirection="column" gap={6}>
            <Text>确定删除 prompt 吗？</Text>
            <Flex gap={2}>
              <Button
                colorScheme="blue"
                color="white"
                onClick={debouncedHandleSubmit}
                isLoading={isSubmitting}
              >
                确定
              </Button>
              <Button onClick={onClose}>取消</Button>
            </Flex>
          </Flex>
        </ModalBody>
        <ModalFooter justifyContent="center" gap={4}></ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function PromptVariableTooltip() {
  return (
    <Box>
      <UnorderedList spacing={1}>
        <ListItem>
          <CopyButton content={PROMPT_CODE_VARIABLE}>
            <code>{PROMPT_CODE_VARIABLE}</code>
          </CopyButton>
          : 引用所选代码作为上下文
        </ListItem>
        <ListItem>
          <CopyButton content={INNER_VARIABLE.__USER__}>
            <code>{INNER_VARIABLE.__USER__}</code>
          </CopyButton>
          : 获取当前用户名
        </ListItem>
        <ListItem>
          <CopyButton content={INNER_VARIABLE.__DATETIME__}>
            <code>{INNER_VARIABLE.__DATETIME__}</code>
          </CopyButton>
          : 获取 prompt 执行时的系统时间，如 2024-01-01 10:00:00
        </ListItem>
      </UnorderedList>
    </Box>
  );
}
