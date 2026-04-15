import { Button, ButtonProps, Icon } from '@chakra-ui/react';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import useCustomToast from '../../hooks/useCustomToast';
import { FiCopy } from 'react-icons/fi';

interface CopyButtonProps extends ButtonProps {
  content: string;
}
const CopyButton = (props: CopyButtonProps) => {
  const { postMessage } = usePostMessage();
  const { toast } = useCustomToast();
  const handleCopy = () => {
    postMessage({
      type: BroadcastActions.COPY_TO_CLIPBOARD,
      data: props.content,
    });
    toast({
      title: '复制成功',
      position: 'top',
      isClosable: true,
      duration: 1000,
      status: 'success',
    });
  };
  return (
    <Button
      size="sm"
      cursor="pointer"
      {...props}
      onClick={handleCopy}
      rightIcon={<Icon as={FiCopy} />}
    >
      {props.children}
    </Button>
  );
};

export default CopyButton;
