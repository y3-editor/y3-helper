import * as React from 'react';
import { Box, Icon, useMediaQuery } from '@chakra-ui/react';
import { UseToastOptions } from '@chakra-ui/react';
import {
  TbCircleX,
  TbAlertCircle,
  TbCircleCheck,
  TbX,
  TbCopy,
  TbRefresh,
} from 'react-icons/tb';
import { RiInformationLine } from 'react-icons/ri';
import { SmallScreenWidth } from '../../const';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';

const SMALL_ICON_SIZE = '20px';
const DEFAULT_ICON_SIZE = '24px';
type CustomToastProps = UseToastOptions & {
  onClose: () => void;
  isCopyable?: boolean;
  enableHtml?: boolean;
};

function CustomToast(props: CustomToastProps) {
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
  const { postMessage } = usePostMessage();
  const [isCopied, setIsCopied] = React.useState(false);

  const {
    status,
    title,
    onClose,
    description,
    isClosable = true,
    isCopyable = false,
    enableHtml = false,
  } = props;
  // 根据状态展示不同的Icon
  const showIcon = React.useMemo(() => {
    switch (status) {
      case 'success':
        return (
          <Icon
            w={DEFAULT_ICON_SIZE}
            h={DEFAULT_ICON_SIZE}
            as={TbCircleCheck}
            color="success"
          />
        );
      case 'error':
        return (
          <Icon
            w={DEFAULT_ICON_SIZE}
            h={DEFAULT_ICON_SIZE}
            as={TbCircleX}
            color="error"
          />
        );
      case 'warning':
        return (
          <Icon
            w={DEFAULT_ICON_SIZE}
            h={DEFAULT_ICON_SIZE}
            as={TbAlertCircle}
            color="warning"
          />
        );
      case 'info':
        return (
          <Icon
            w={DEFAULT_ICON_SIZE}
            h={DEFAULT_ICON_SIZE}
            as={RiInformationLine}
            color="info"
          />
        );
      case 'loading':
        return (
          <Icon
            className='animate-spin'
            w={SMALL_ICON_SIZE}
            h={SMALL_ICON_SIZE}
            as={TbRefresh}
            color="info"
          />
        );
      default:
        return (
          <Icon
            w={DEFAULT_ICON_SIZE}
            h={DEFAULT_ICON_SIZE}
            as={RiInformationLine}
            color="info"
          />
        );
    }
  }, [status]);

  const renderContent = React.useCallback(
    (content: React.ReactNode) => {
      if (typeof content === 'string' && enableHtml) {
        return <HtmlContentWrapper content={content} />;
      }
      return content;
    },
    [enableHtml],
  );

  const tip = React.useMemo(() => {
    if (!title && !description) return;
    if (title && !description) {
      return (
        <div className="flex items-center h-full mr-2">
          <Box>
            <Box w="24px" h="24px">
              {showIcon}
            </Box>
          </Box>
          <Box mx="3">{renderContent(title)}</Box>
        </div>
      );
    } else if (!title && description) {
      return (
        <div className="flex items-center h-full mr-2">
          <Box>
            <Box w="24px" h="24px">
              {showIcon}
            </Box>
          </Box>
          <Box mx="3">{renderContent(description)}</Box>
        </div>
      );
    }

    if (title && description) {
      return (
        <Box>
          <div className="min-h-[32px] flex items-center mr-2 ">
            <Box>{showIcon}</Box>
            <Box mx="3" display="flex" flexWrap="wrap">
              <strong>{renderContent(title)}</strong>
            </Box>
          </div>
          <Box
            color="text.default"
            mt="2"
            lineHeight="8"
            display="flex"
            flexWrap="wrap"
          >
            {renderContent(description)}
          </Box>
        </Box>
      );
    }
  }, [title, description, showIcon, renderContent]);

  const smallScreenStyle: React.CSSProperties = React.useMemo(() => {
    return isSmallScreen
      ? {
          position: 'fixed',
          top: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
        }
      : { position: 'relative' };
  }, [isSmallScreen]);

  const handleCopy = React.useCallback(() => {
    const textToCopy = description || title || '';
    postMessage({
      type: BroadcastActions.COPY_TO_CLIPBOARD,
      data: textToCopy,
    });
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1500);
  }, [title, description, postMessage]);

  return (
    <Box
      color="text.primary"
      p="4"
      bg="themeBgColor"
      borderRadius="8px"
      style={{ ...smallScreenStyle }}
    >
      {tip}
      <Box
        position="absolute"
        top="2"
        right="3"
        display="flex"
        alignItems="center"
      >
        {isCopyable && (
          <Box
            w="16px"
            h="16px"
            color={isCopied ? 'info' : 'text.default'}
            mr="2"
            transition="all 0.2s"
            _hover={{
              cursor: 'pointer',
            }}
            onClick={handleCopy}
          >
            <Icon as={isCopied ? TbCircleCheck : TbCopy} w="full" h="full" />
          </Box>
        )}
        {isClosable && (
          <Box
            w="16px"
            h="16px"
            color="text.default"
            _hover={{
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            <Icon as={TbX} w="full" h="full" />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function CreateCustomToast(options: CustomToastProps) {
  // 统一在顶部展示
  return <CustomToast position="top" {...options} />;
}
const MemoizedCustomToast = React.memo(CustomToast);
export default MemoizedCustomToast;

// HTML 内容包装组件，安全地处理 a 标签点击
const HtmlContentWrapper = ({ content }: { content: string }) => {
  const { postMessage } = usePostMessage();

  const parseContent = React.useMemo(() => {
    if (!content) return null;

    const htmlElement = document.createElement('div');
    htmlElement.innerHTML = content;

    const processNode = (node: Node): React.ReactNode[] => {
      const result: React.ReactNode[] = [];
      node.childNodes.forEach((childNode, index) => {
        // 如果是文本节点，直接添加文本
        if (childNode.nodeType === Node.TEXT_NODE) {
          if (childNode.textContent) {
            result.push(childNode.textContent);
          }
        }
        // 如果是A标签，创建React的a元素
        else if (
          childNode.nodeType === Node.ELEMENT_NODE &&
          (childNode as Element).tagName.toLowerCase() === 'a'
        ) {
          const aElement = childNode as HTMLAnchorElement;
          result.push(
            <span
              key={`link-${index}`}
              className="text-[#8786ff] no-underline cursor-pointer hover:underline"
              onClick={(e) => {
                e.preventDefault();
                const url =
                  aElement.getAttribute('href') || aElement.textContent;
                postMessage({
                  type: 'OPEN_IN_BROWSER',
                  data: { url },
                });
              }}
            >
              {aElement.textContent}
            </span>,
          );
        }
        // 如果是其他元素节点，提取其文本内容
        else if (childNode.nodeType === Node.ELEMENT_NODE) {
          result.push(...processNode(childNode));
        }
      });

      return result;
    };

    return processNode(htmlElement);
  }, [content, postMessage]);

  return parseContent;
};
