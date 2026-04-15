import * as React from 'react';
import { Link, Box, Collapse, Text, Tooltip } from '@chakra-ui/react';
import Markdown from '../../components/Markdown';
import { usePostMessage } from '../../PostMessageProvider';
import Icon from '../../components/Icon';
import { RiArrowDownSLine, RiArrowRightSLine, RiProhibitedLine } from 'react-icons/ri';
import styles from './index.module.scss';
import CircularCheckbox from '../../components/CircularCheckbox';
import { useChatConfig } from '../../store/chat-config';

const DEFAULT_LANGUAGE = 'plaintext';

export interface RetrieveResult {
  id: string;
  name: string;
  content: string;
  language?: string;
  link: string;
  annotation?: string;
  linkTooltip?: string;
  path?: string;
  code?: string;
  url?: string;
  docset?: string;
  text?: string;
  attributes?: {
    filename: string;
  };
  func_name?: string;
  to_func?: any;
  isLpc?: boolean;
}

interface RetrieveResultBlockProps {
  index: number;
  data: RetrieveResult;
  isOpen?: boolean;
  isSelected: boolean;
  onSelectionChange: (isSelected: boolean) => void;
  toolResponseDisabled?: boolean;
  toolId?: string;
}

const RetrieveResultBlock = (props: RetrieveResultBlockProps) => {
  const { data, index, isOpen, isSelected, onSelectionChange, toolResponseDisabled } = props;
  const { postMessage } = usePostMessage();
  const [expand, setExpand] = React.useState(isOpen);
  const [expandAnnotation, setExpandAnnotation] = React.useState(false);
  const [model] = useChatConfig((state) => [
    state.config.model
  ]);
  const chatModels = useChatConfig((state) => state.chatModels)
  const markdownContent = React.useMemo(() => {
    const { language, content } = data as RetrieveResult;
    if (!content) return '';
    const currentLanguage = language || DEFAULT_LANGUAGE;
    return '```' + currentLanguage + '\n' + content;
  }, [data]);

  const locateFileAndLine = () => {
    const { name, content, link } = data as RetrieveResult;
    if (!content) return;
    const fileInfo = {
      name: name,
      startLine: (content || '').split('\n')[0],
      fileName: link,
    };
    postMessage({
      type: 'SEARCH_AND_OPEN',
      data: fileInfo,
    });
  };

  const borderRadius = React.useMemo(() => {
    return expand ? { borderTopRadius: '8px' } : { borderRadius: '8px' };
  }, [expand]);

  const isUrl =
    data.link && typeof data.link === 'string' && data.link.startsWith('http');
  return (
    <div
      className={`w-full mb-4 ${styles['search-item-block']}`}
      onClick={() => {
        setExpand((prev) => !prev);
      }}
    >
      <Box
        className="w-full p-2 flex items-center justify-between rounded-none text-base"
        bg="questionsBgColor"
        h="32px"
        border="1px"
        borderColor="customBorder"
        color="text.default"
        _hover={{
          cursor: 'pointer',
          color: 'blue.300',
          borderColor: 'blue.300',
        }}
        {...borderRadius}
      >
        <div className={`flex items-center w-full ${data.name ? 'justify-between' : ''}`}>
          <div className={`flex items-center truncate ${data.name ? 'mr-4' : ''}`}>
            <div>
              {
                toolResponseDisabled
                  ?
                  <Box
                    className="w-4 h-4 min-w-4 flex items-center justify-center mr-2 bg-gray-500 text-[10px] text-gray-800 rounded-full"
                    bg="blue.300"
                    color="text.primary"
                  >
                    {index + 1}
                  </Box> : data.isLpc && !chatModels[model]?.isPrivate ?
                    <Tooltip label={'由于安全限制，LPC代码不允许与商用模型交互'}>
                      <Box mr={0.5} pt={0.5} className='flex items-center'>
                        <RiProhibitedLine />
                      </Box>
                    </Tooltip>
                    :
                    <CircularCheckbox
                      isChecked={isSelected}
                      onChange={(e) => onSelectionChange(e.target.checked)}
                    />
              }
            </div>
            {data.name && (
              <div className="ml-0.5 truncate mr-1 overflow-hidden">
                {data.name}
              </div>
            )}
          </div>

          <div className="flex items-center relative ">
            <Tooltip label={data.linkTooltip || data.link}>
              <Link
                onClick={(e) => {
                  if (isUrl) {
                    e.stopPropagation();
                    postMessage({
                      type: 'OPEN_IN_BROWSER',
                      data: {
                        url: data.link,
                      },
                    });
                  } else if ((data as RetrieveResult)?.content) {
                    // 阻止事件冒泡导致触发展开代码块的逻辑
                    e.stopPropagation();
                    locateFileAndLine();
                  }
                }}
                isTruncated
                maxW="100px"
              >
                <Box
                  className="lowercase"
                  isTruncated
                  _hover={{
                    cursor: !(data as RetrieveResult)?.content
                      ? 'not-allowed'
                      : 'pointer',
                  }}
                >
                  {isUrl ? '链接' : data.link}
                </Box>
              </Link>
            </Tooltip>

            <div className="w-[16px]">
              {expand ? (
                <Icon as={RiArrowDownSLine} size="sm" />
              ) : (
                <Icon as={RiArrowRightSLine} size="sm" />
              )}
            </div>
          </div>
        </div>
      </Box>
      <Collapse in={expand}>
        <Box
          onClick={(e) => {
            // 阻止事件冒泡导致触发展开代码块的逻辑
            e.stopPropagation();
          }}
        >
          <Markdown data={data}>{markdownContent}</Markdown>
        </Box>
        {data.annotation ? (
          <>
            <div onClick={(e) => e.stopPropagation()}>
              {!expandAnnotation ? (
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandAnnotation((prev) => !prev);
                  }}
                  borderRadius="bottom"
                  p="2"
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  border="1px"
                  borderColor="customBorder"
                  borderBottomRadius="8px"
                  _hover={{
                    cursor: 'pointer',
                    color: 'blue.300',
                    borderColor: 'blue.300',
                  }}
                  h="32px !important"
                  fontSize="sm"
                >
                  <Text
                    w="full"
                    textAlign="left"
                    className="truncate"
                    color="text.default"
                    mb="0 !important"
                  >
                    参考：{data.annotation}
                  </Text>
                  <Text mb="0 !important">
                    {expandAnnotation ? (
                      <Icon
                        as={RiArrowDownSLine}
                        size="sm"
                        color="text.default"
                      />
                    ) : (
                      <Icon
                        as={RiArrowRightSLine}
                        size="sm"
                        color="text.default"
                      />
                    )}
                  </Text>
                </Box>
              ) : (
                <div>
                  <Collapse in={expandAnnotation} animate={false}>
                    <Box
                      p="2"
                      shadow="md"
                      fontSize="sm"
                      className="flex items-center justify-between"
                      border="1px"
                      borderColor="customBorder"
                      borderBottomRadius="8px"
                      color="text.default"
                      mb="0 !important"
                      minH="32px"
                      onClick={(e) => {
                        e.stopPropagation();
                        const selection = window.getSelection();
                        if (!selection?.toString().length) {
                          setExpandAnnotation((prev) => !prev);
                        }
                      }}
                      _hover={{
                        cursor: 'pointer',
                      }}
                    >
                      <span>参考：{data.annotation}</span>
                      <Icon
                        as={RiArrowDownSLine}
                        size="xs"
                        color="text.default"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandAnnotation((prev) => !prev);
                        }}
                        _hover={{
                          cursor: 'pointer',
                        }}
                      />
                    </Box>
                  </Collapse>
                </div>
              )}
            </div>
          </>
        ) : null}
      </Collapse>
    </div>
  );
};

export default RetrieveResultBlock;
