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
  ModalCloseButton,
} from '@chakra-ui/react';
import { TbChevronLeft } from 'react-icons/tb';
import { useChatStreamStore } from '../../../store/chat';
import { ChatMask } from '../../../store/config';
import useCustomToast from '../../../hooks/useCustomToast';
import { toastUserPromptCategoryWithoutInit } from '../../../utils/toast';
import { useMaskStore } from '../../../store/mask';
import {
  MASK_LABEL,
  createPrompt,
  getMaskPrompts,
  removePrompt,
  updatePrompt,
} from '../../../services/prompt';
import { mutateService } from '../../../hooks/useService';
import { toastErrorMessage } from '../../../utils';

interface ChatMaskModelProps {
  isOpen: boolean;
  mask?: ChatMask;
  onClose: () => void;
}

export function ChatNewMaskModel(props: ChatMaskModelProps) {
  const { isOpen, onClose } = props;

  const userCategoryId = useMaskStore((state) => state.config.categoryId);
  const [maskName, setMaskName] = React.useState('');
  const [maskContent, setMaskContent] = React.useState('');
  const { toast } = useCustomToast();

  const handleCreateMask = async (name: string, prompt: string) => {
    if (!userCategoryId) {
      toastUserPromptCategoryWithoutInit();
      return;
    }
    try {
      await createPrompt(userCategoryId, name, prompt, {
        labels: [MASK_LABEL],
      });
      toast({
        title: `用户自定义模式创建成功。 `,
        status: 'success',
        position: 'top',
        isClosable: true,
      });
      mutateService(getMaskPrompts);
    } catch (error) {
      console.error(error);
      toast({
        title: toastErrorMessage(error as Error),
        status: 'error',
        position: 'top',
        isClosable: true,
      });
    }
  };

  const handleReset = () => {
    setMaskName('');
    setMaskContent('');
  };

  const handleSubmit = async () => {
    const trimmedMaskName = maskName.trim();
    const trimmedMaskContent = maskContent.trim();
    if (!trimmedMaskName || !trimmedMaskContent) {
      toast({
        title: '模式的标题与内容均不可为空',
        status: 'error',
        position: 'top',
        isClosable: true,
      });
      return;
    }
    handleCreateMask(maskName, maskContent);
    handleCloseModel();
  };

  const handleCloseModel = () => {
    handleReset();
    onClose();
  };
  return (
    <Modal
      size="full"
      trapFocus={false}
      isOpen={isOpen}
      onClose={handleCloseModel}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Flex gap={2} alignItems="center">
            <IconButton
              aria-label="back"
              icon={<TbChevronLeft />}
              mr={2}
              onClick={handleCloseModel}
            />
            <Text>新建自定义聊天模式</Text>
          </Flex>
        </ModalHeader>
        <Divider size="lg" />
        <ModalBody>
          <Flex py={4} flexDirection="column" gap={3}>
            <Text>
              为整个会话增加 prompt，可以保持 Code Chat 的上下文一致。
            </Text>
            <Box py={4}>
              <FormControl isRequired>
                <FormLabel>模式名</FormLabel>
                <Input
                  value={maskName}
                  onChange={(event) => setMaskName(event.target.value)}
                  onInput={(e) => {
                    const nextValue = (e.target as HTMLInputElement).value;
                    setMaskName(nextValue);
                  }}
                />
              </FormControl>

              <FormControl isRequired mt={4}>
                <FormLabel>Prompt 内容</FormLabel>
                <Textarea
                  rows={10}
                  value={maskContent}
                  onChange={(event) => setMaskContent(event.target.value)}
                  onInput={(e) => {
                    const nextValue = (e.target as HTMLTextAreaElement).value;
                    setMaskContent(nextValue);
                  }}
                />
              </FormControl>
            </Box>
            <Text>给 Chat 一个上下文语境，如角色、场景、问题背景。</Text>
          </Flex>
        </ModalBody>
        <ModalFooter justifyContent="center" gap={4}>
          <Button colorScheme="blue" color="white" onClick={handleSubmit}>
            新建
          </Button>
          <Button onClick={onClose}>取消</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function ChatEditMaskModel(props: Required<ChatMaskModelProps>) {
  const { isOpen, mask, onClose } = props;

  const userCategoryId = useMaskStore((state) => state.config.categoryId);
  const [maskName, setMaskName] = React.useState(mask.name);
  const [maskContent, setMaskContent] = React.useState(mask.prompt);

  const handleUpdateMask = async (
    prompt_id: string,
    name: string,
    prompt: string,
  ) => {
    if (!userCategoryId) {
      toastUserPromptCategoryWithoutInit();
      return;
    }
    try {
      await updatePrompt(userCategoryId, prompt_id, name, prompt);
      toast({
        title: `用户自定义模式更新成功。 `,
        status: 'success',
        position: 'top',
        isClosable: true,
      });
      mutateService(getMaskPrompts);
    } catch (error) {
      console.error(error);
      toast({
        title: toastErrorMessage(error as Error),
        status: 'error',
        position: 'top',
        isClosable: true,
      });
    }
  };

  const { toast } = useCustomToast();

  const handleReset = () => {
    setMaskName('');
    setMaskContent('');
  };

  const handleSubmit = async () => {
    const trimmedMaskName = maskName.trim();
    const trimmedMaskContent = maskContent.trim();
    if (!trimmedMaskName || !trimmedMaskContent) {
      toast({
        title: '模式的标题与内容均不可为空',
        status: 'error',
        position: 'top',
        isClosable: true,
      });
      return;
    }
    await handleUpdateMask(mask._id, maskName, maskContent);
    handleCloseModel();
  };

  const handleCloseModel = () => {
    handleReset();
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      setMaskName(mask.name);
      setMaskContent(mask.prompt);
    }
  }, [isOpen, mask]);

  return (
    <Modal
      size="full"
      trapFocus={false}
      isOpen={isOpen}
      onClose={handleCloseModel}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Flex gap={2} alignItems="center">
            <IconButton
              aria-label="back"
              icon={<TbChevronLeft />}
              mr={2}
              onClick={handleCloseModel}
            />
            <Text>编辑自定义聊天模式</Text>
          </Flex>
        </ModalHeader>
        <Divider size="lg" />
        <ModalBody>
          <Flex py={4} flexDirection="column" gap={3}>
            <Text>
              为整个会话增加 prompt，可以保持 Code Chat 的上下文一致。
            </Text>
            <Box py={4}>
              <FormControl isRequired>
                <FormLabel>模式名</FormLabel>
                <Input
                  value={maskName}
                  onChange={(event) => setMaskName(event.target.value)}
                  onInput={(e) => {
                    const nextValue = (e.target as HTMLInputElement).value;
                    setMaskName(nextValue);
                  }}
                />
              </FormControl>

              <FormControl isRequired mt={4}>
                <FormLabel>Prompt 内容</FormLabel>
                <Textarea
                  rows={10}
                  value={maskContent}
                  onChange={(event) => setMaskContent(event.target.value)}
                  onInput={(e) => {
                    const nextValue = (e.target as HTMLTextAreaElement).value;
                    setMaskContent(nextValue);
                  }}
                />
              </FormControl>
            </Box>
            <Text>给 Chat 一个上下文语境，如角色、场景、问题背景。</Text>
          </Flex>
        </ModalBody>
        <ModalFooter justifyContent="center" gap={4}>
          <Button colorScheme="blue" onClick={handleSubmit}>
            保存
          </Button>
          <Button onClick={onClose}>取消</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function ChatRemoveMaskModel(props: Required<ChatMaskModelProps>) {
  const { isOpen, mask, onClose } = props;
  const userCategoryId = useMaskStore((state) => state.config.categoryId);

  const { toast } = useCustomToast();
  const handleRemoveMask = async (id: string) => {
    if (!userCategoryId) {
      toastUserPromptCategoryWithoutInit();
      return;
    }
    try {
      await removePrompt(userCategoryId, id);
      toast({
        title: `用户自定义模式删除成功。 `,
        status: 'success',
        position: 'top',
        isClosable: true,
      });
      mutateService(getMaskPrompts);
    } catch (error) {
      console.error(error);
      toast({
        title: toastErrorMessage(error as Error),
        status: 'error',
        position: 'top',
        isClosable: true,
      });
    }
  };

  const handleSubmit = async () => {
    await handleRemoveMask(mask._id);
    onClose();
  };

  return (
    <Modal size="full" trapFocus={false} isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Flex gap={2} alignItems="center">
            <IconButton
              aria-label="back"
              icon={<TbChevronLeft />}
              mr={2}
              onClick={onClose}
            />
            <Text>删除自定义聊天模式</Text>
          </Flex>
        </ModalHeader>
        <Divider size="lg" />
        <ModalBody>
          <Flex py={4} flexDirection="column" gap={6}>
            <Text>确定删除该模式吗？</Text>
            <Flex gap={2}>
              <Button colorScheme="blue" color="white" onClick={handleSubmit}>
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

export function ChatConfirmMaksModel(props: {
  isOpen: boolean;
  mask: ChatMask;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { mask, isOpen, onConfirm, onClose } = props;
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const streamingState = isStreaming || isSearching;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>切换聊天模式</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {streamingState && 'Y3Maker 正在回复中, '}
          确定{streamingState && '中止回复并'}切换为{' '}
          <strong>{mask.name}</strong> 吗？
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onConfirm}>
            确定
          </Button>
          <Button onClick={onClose}>取消</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
