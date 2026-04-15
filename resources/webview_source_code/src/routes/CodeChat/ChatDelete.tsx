import * as React from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverArrow,
  PopoverBody,
  PopoverFooter,
  ButtonGroup,
  Button,
  Tooltip,
  useOutsideClick,
} from '@chakra-ui/react';
import { RiDeleteBinLine } from 'react-icons/ri';
import { useChatStore, useChatStreamStore } from '../../store/chat';
import { toastErrorMessage } from '../../utils';
import userReporter from '../../utils/report';
import useCustomToast from '../../hooks/useCustomToast';
import Icon from '../../components/Icon';
import { UserEvent } from '../../types/report';

export default function ChatDelete() {
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const removeSession = useChatStore((state) => state.removeSession);
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { toast } = useCustomToast();

  useOutsideClick({
    ref: ref,
    handler: () => setIsOpen(false),
  });

  const handleDelete = async () => {
    userReporter.report({
      event: UserEvent.CODE_CHAT_REMOVE_SESSION,
    });
    if (!currentSessionId) {
      return;
    }
    try {
      await removeSession(currentSessionId);
      toast({
        title: '删除成功',
        position: 'top',
        isClosable: true,
        duration: 1000,
        status: 'success',
      });
    } catch (error) {
      console.log(error);
      toast({
        title: toastErrorMessage(error as Error),
        position: 'top',
        isClosable: true,
        status: 'error',
      });
    }
  };

  return (
    <Tooltip label="删除会话" isDisabled={isOpen}>
      <div ref={ref}>
        <Popover placement="bottom" closeOnBlur={true} isOpen={isOpen} isLazy>
          <PopoverTrigger>
            <Button
              aria-label="删除会话"
              size="xs"
              isDisabled={isStreaming || isSearching}
              onClick={() => {
                if (isStreaming || isSearching) return;
                setIsOpen((prev) => !prev);
              }}
              bg="none"
              color="text.default"
            >
              <Icon as={RiDeleteBinLine} size="xs" className='mr-1' /> 删除会话
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <PopoverHeader pt={4} fontWeight="bold" border="0">
              删除当前会话
            </PopoverHeader>
            <PopoverArrow />
            <PopoverBody>确定删除吗？删除后会话将不可恢复。</PopoverBody>
            <PopoverFooter
              border="0"
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              pb={4}
            >
              <ButtonGroup size="sm">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  取消
                </Button>
                <Button
                  colorScheme="blue"
                  color="white"
                  onClick={() => {
                    handleDelete();
                    setIsOpen(false);
                  }}
                >
                  删除
                </Button>
              </ButtonGroup>
            </PopoverFooter>
          </PopoverContent>
        </Popover>
      </div>
    </Tooltip>
  );
}
