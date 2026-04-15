import * as React from 'react';
import {
  Button,
  Box,
  Tooltip,
} from '@chakra-ui/react';
import {
  TbRefresh,
} from 'react-icons/tb';
import {
  useChatStore,
  useChatStreamStore,
} from '../../../store/chat';
import { FeedbackPool } from '../../../services/useChatStream';
import Icon from '../../../components/Icon';
import '../../../assets/github-markdown-dark.css';

export default function Retry(props: { userScrollLock: boolean }) {
  const { userScrollLock } = props;
  const currentSession = useChatStore((state) => state.currentSession());
  const setError = useChatStore((state) => state.setError);
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const [shouldShowReTry, setShouldShowReTry] = React.useState(false);
  const onUserResubmit = useChatStreamStore((state) => state.onUserResubmit);
  const reTryRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isStreaming || isSearching || isProcessing) {
      setShouldShowReTry(false);
    }

    if (!isStreaming && !isProcessing) {
      setShouldShowReTry(true);
      if (!userScrollLock) {
        setTimeout(() => {
          if (reTryRef.current) {
            reTryRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
    }
    // prevStreamState.current = isStreaming;
  }, [isStreaming, isSearching, isProcessing, userScrollLock]);

  const resetFeedback = () => {
    FeedbackPool.clear();
    setShouldShowReTry(false);
    setError(false);
    onUserResubmit();
  };

  if (!currentSession?.data?.messages.length) {
    return null;
  }

  return (
    <Box mt={1} hidden={!shouldShowReTry}>
      <Tooltip label='重新回复该消息'>
        <Button
          border={0}
          backgroundColor={'transparent'}
          onClick={resetFeedback}
          color={'#615BDD'}
          p={1}
          cursor={'pointer'}
          borderRadius={4}
          display={'flex'}
          justifyContent={'center'}
          verticalAlign={'center'}
          _hover={{
            color: '#9258FD',
            fontWeight: '800',
            backgroundColor: '!transparent',
          }}
        >
          <Icon as={TbRefresh} size="sm" mr={1.5} mt={0.5} /> 重新生成
        </Button>
      </Tooltip>
    </Box>
  );
}
