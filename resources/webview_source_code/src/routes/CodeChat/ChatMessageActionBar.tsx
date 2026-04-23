import * as React from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  useMediaQuery,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import { FiCopy } from 'react-icons/fi';
import { RiDeleteBinLine } from 'react-icons/ri';
import { TbRefresh } from 'react-icons/tb';
import { TbDotsVertical, TbThumbUp, TbThumbDown } from 'react-icons/tb';
import Icon from '../../components/Icon';
import { SmallScreenWidth } from '../../const';
import { ChatFeedbackType } from '../../services';
import { ThemeStyle, useTheme } from '../../ThemeContext';
import { useChatBillStore } from '../../store/chatBill';
interface ChatMessageActionBarProps {
  onCopyClick?: () => void;
  onNewSessionClick?: () => void;
  onRemoveClick?: () => void;
  onRetryClick?: () => void;
  onFeedbackClick?: (feedbackType: ChatFeedbackType) => void;
  hideNewSession?: boolean;
  hideRemove?: boolean;
  hideRetry?: boolean; // 隐藏回复按钮
  feedbackType?: ChatFeedbackType;
  shouldShowFeedback?: boolean;
  isCompressedMessage?: boolean;
  isCompressionSummary?: boolean;
}
const ChatMessageActionBar = (props: ChatMessageActionBarProps) => {
  const {
    onCopyClick,
    // onNewSessionClick,
    onRemoveClick,
    onRetryClick,
    onFeedbackClick,
    // hideNewSession,
    hideRemove,
    hideRetry,
    feedbackType,
    shouldShowFeedback,
    isCompressedMessage,
    isCompressionSummary,
  } = props;
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
  const { activeTheme } = useTheme();
  const isExceedCost = useChatBillStore((state) => state.isExceedCost)
  const showFeedbackAction = React.useMemo(() => {
    if (!feedbackType) {
      return (
        <Box display="flex">
          <Tooltip label="赞">
            <IconButton
              variant="ghost"
              aria-label="赞"
              size="sm"
              color="text.default"
              icon={<Icon as={TbThumbUp} size="sm" />}
              onClick={() => {
                if (onFeedbackClick) {
                  onFeedbackClick(ChatFeedbackType.UpVote);
                }
              }}
            />
          </Tooltip>
          <Tooltip label="踩">
            <IconButton
              variant="ghost"
              aria-label="踩"
              size="sm"
              color="text.default"
              icon={<Icon as={TbThumbDown} size="sm" />}
              onClick={() => {
                if (onFeedbackClick) {
                  onFeedbackClick(ChatFeedbackType.DownVote);
                }
              }}
            />
          </Tooltip>
        </Box>
      );
    }
    if (feedbackType === ChatFeedbackType.UpVote) {
      return (
        <>
          <Tooltip label="赞">
            <IconButton
              variant="ghost"
              aria-label="赞"
              size="sm"
              color="blue.300"
              icon={<Icon as={TbThumbUp} size="sm" />}
              disabled
              _hover={{
                bg: 'none',
                cursor: 'not-allowed',
              }}
            />
          </Tooltip>
        </>
      );
    }
    if (feedbackType === ChatFeedbackType.DownVote) {
      return (
        <>
          <Tooltip label="踩">
            <IconButton
              variant="ghost"
              aria-label="踩"
              size="sm"
              color="blue.300"
              icon={<Icon as={TbThumbDown} size="sm" />}
              disabled
              _hover={{
                bg: 'none',
                cursor: 'not-allowed',
              }}
            />
          </Tooltip>
        </>
      );
    }
  }, [feedbackType, onFeedbackClick]);

  const shouldHideRemove = React.useMemo(() => {
    if (hideRemove) return true;

    if (isCompressedMessage || isCompressionSummary) return true;

    return false;
  }, [hideRemove, isCompressedMessage, isCompressionSummary]);

  // const shouldHideNewSession = React.useMemo(() => {
  //   if (hideNewSession) return true;

  //   if (isCompressedMessage || isCompressionSummary) return true;

  //   return false;
  // }, [hideNewSession, isCompressedMessage, isCompressionSummary]);

  return (
    <Box display="flex" backgroundColor="answerBgColor" ml="auto">
      {isSmallScreen ? (
        <>
          <Menu>
            <Tooltip label="更多操作">
              <MenuButton>
                <IconButton
                  variant="ghost"
                  aria-label="更多"
                  size="sm"
                  icon={<Icon as={TbDotsVertical} size="sm" />}
                  color="text.default"
                />
              </MenuButton>
            </Tooltip>
            <MenuList>
              <MenuItem
                onClick={() => {
                  if (onCopyClick) {
                    onCopyClick();
                  }
                }}
              >
                <Icon as={FiCopy} size="sm" className="mt-[-4px] mr-1" />
                复制
              </MenuItem>
              {/* {!shouldHideNewSession && (
                <MenuItem
                  onClick={() => {
                    if (onNewSessionClick) {
                      onNewSessionClick();
                    }
                  }}
                >
                  <Icon
                    as={RiFileAddLine}
                    size="sm"
                    className="mt-[-4px] mr-1"
                  />
                  从此处重新发起对话
                </MenuItem>
              )} */}
              {!!shouldHideRemove && (
                <MenuItem
                  onClick={() => {
                    if (onRemoveClick) {
                      onRemoveClick();
                    }
                  }}
                >
                  <Icon
                    as={RiDeleteBinLine}
                    size="sm"
                    className="mt-[-4px] mr-1"
                  />
                  删除
                </MenuItem>
              )}
            </MenuList>
          </Menu>
        </>
      ) : (
        <>
          {!hideRetry && !isExceedCost && (
            <Tooltip label="重新回复">
              <IconButton
                aria-label="重新回复"
                variant="ghost"
                icon={<Icon as={TbRefresh} size="sm" />}
                onClick={onRetryClick}
                size="sm"
                color="text.default"
              />
            </Tooltip>
          )}
          <Tooltip label="复制">
            <IconButton
              aria-label="复制"
              variant="ghost"
              size="sm"
              icon={<Icon as={FiCopy} size="sm" />}
              onClick={() => {
                if (onCopyClick) {
                  onCopyClick();
                }
              }}
              color="text.default"
            />
          </Tooltip>
          {/* {!shouldHideNewSession && (
            <Tooltip label="从此处重新发起对话">
              <IconButton
                aria-label="从此处重新发起对话"
                variant="ghost"
                size="sm"
                icon={<Icon as={RiFileAddLine} size="sm" />}
                onClick={() => {
                  if (onNewSessionClick) {
                    onNewSessionClick();
                  }
                }}
                color="text.default"
              />
            </Tooltip>
          )} */}
          {!shouldHideRemove && (
            <Tooltip label="删除">
              <IconButton
                aria-label="删除"
                variant="ghost"
                icon={<Icon as={RiDeleteBinLine} size="sm" />}
                onClick={() => {
                  if (onRemoveClick) {
                    onRemoveClick();
                  }
                }}
                size="sm"
                color="text.default"
              />
            </Tooltip>
          )}
        </>
      )}
      {
        shouldShowFeedback &&
        <>
          <Box mx="2" className='flex justify-center items-center' >
            <Box height="14px" width="1px" bg={activeTheme === ThemeStyle.Light ? "gray.300" : 'whiteAlpha.400'} />
          </Box>
          {showFeedbackAction}
        </>
      }

    </Box>
  );
};

export default ChatMessageActionBar;