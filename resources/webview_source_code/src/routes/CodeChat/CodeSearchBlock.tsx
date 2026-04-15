import * as React from 'react';
import { Link, Box, Collapse, Text, Tooltip } from '@chakra-ui/react';
import useSearchStore, { SearchData } from '../../store/searchResult';
import { CodeBaseSearchResult } from '../../services/index';
import Markdown from '../../components/Markdown';
import { usePostMessage } from '../../PostMessageProvider';
import Icon from '../../components/Icon';
import { RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import styles from './index.module.scss';
interface CodeSearchBlockProps {
  index: number;
  data: CodeBaseSearchResult;
  isOpen?: boolean;
}
const DEFAULT_LANGUAGE = 'python';
const CodeSearchBlock = (props: CodeSearchBlockProps) => {
  const { data, index, isOpen } = props;
  const { postMessage } = usePostMessage();
  const getResult = useSearchStore((state) => state.getResultByID);
  const result = getResult(data.id) || data;
  const [expand, setExpand] = React.useState(isOpen);
  const [expandAnnotation, setExpandAnnotation] = React.useState(false);
  const content = React.useMemo(() => {
    const { language, code } = result as SearchData;
    if (!code) return '';
    const currentLanguage = language || DEFAULT_LANGUAGE;
    return '```' + currentLanguage + '\n' + code;
  }, [result]);

  const locateFileAndLine = () => {
    const { name, code, module_name } = result as SearchData;
    if (!code) return;
    const fileInfo = {
      name: name,
      startLine: (code || '').split('\n')[0],
      fileName: module_name,
    };
    postMessage({
      type: 'SEARCH_AND_OPEN',
      data: fileInfo,
    });
  };

  const borderRadius = React.useMemo(() => {
    return expand ? { borderTopRadius: '8px' } : { borderRadius: '8px' };
  }, [expand]);

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
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center truncate mr-4">
            <div>
              <Box
                className="w-4 h-4 min-w-4 flex items-center justify-center bg-gray-500 text-[10px] text-gray-800 rounded-full"
                bg="blue.300"
                color="text.primary"
              >
                {index + 1}
              </Box>
            </div>
            <div className="ml-2 truncate mr-1 overflow-hidden">
              {result.name}
            </div>
          </div>

          <div className="flex items-center relative ">
            <Tooltip label={result.module_name}>
              <Link
                onClick={(e) => {
                  if (!(result as SearchData)?.code) return;
                  // 阻止事件冒泡导致触发展开代码块的逻辑
                  e.stopPropagation();
                  locateFileAndLine();
                }}
                isTruncated
                maxW="100px"
              >
                <Box
                  className="lowercase"
                  isTruncated
                  _hover={{
                    cursor: !(result as SearchData)?.code
                      ? 'not-allowed'
                      : 'pointer',
                  }}
                >
                  {result.module_name}
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
          <Markdown data={data}>{content}</Markdown>
        </Box>
        {result.annotation ? (
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
                    参考：{result.annotation}
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
                      <span>参考：{result.annotation}</span>
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

export default CodeSearchBlock;
