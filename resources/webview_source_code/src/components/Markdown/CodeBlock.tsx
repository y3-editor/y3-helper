import * as React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { Light } from 'react-syntax-highlighter';
import {
  vs2015,
  a11yLight,
} from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { IconButton } from '@chakra-ui/react';
import { TbArrowBarDown, TbArrowBarUp } from 'react-icons/tb';
import { getLanguage } from './language';
import './CodeBlock.scss';
import { CodeWhiteSpace } from '../../store/config';
import { Box } from '@chakra-ui/react';
import { useTheme, ThemeStyle } from '../../ThemeContext';
import Graph from '../../routes/CodeChat/Graph';
import { LANGUAGE_TO_GRAPH_TYPE } from '../../utils';

export interface CodeBlockProps {
  language: string;
  value: string;
  // 是否允许折叠
  collapsable?: boolean;
  defaultExpanded?: boolean;
  codeWhiteSpace?: CodeWhiteSpace;
  hiddenLineNumber?: boolean;
  actionButton?: React.ReactNode;
  showChart?: boolean;
  maxHeight?: number;
  startLineNumber?: number;
  metaData?: {
    [propName: string]: string;
  };
  // setshowChart: (showChart: boolean) => void;
}

const MAX_COLLAPSE_HEIGHT = 320;
const MAX_COLLAPSE_LINE = 20;

function CodeBlock(props: CodeBlockProps) {
  const { activeTheme } = useTheme();
  const {
    language,
    value,
    collapsable,
    defaultExpanded = false,
    codeWhiteSpace = CodeWhiteSpace.NoWrap,
    actionButton,
    showChart,
    maxHeight,
    hiddenLineNumber = false,
    startLineNumber = 1
  } = props;

  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  const lineLength = React.useMemo(() => {
    const lineList = value.split('\n');
    return lineList.length;
  }, [value]);

  const lineNumberRender = React.useMemo(() => {
    const content = [];
    for (let i = 0; i < lineLength; i++) {
      content.push(
        <div key={i} style={{ height: '19.5px' }}>
          {startLineNumber + i}
        </div>,
      );
    }
    return content;
  }, [lineLength, startLineNumber]);

  const getStyle = () => {
    let style = {};
    if (maxHeight) {
      style = {
        maxHeight: maxHeight,
        overflow: 'auto',
      };
    } else if (collapsable) {
      style = {
        height:
          isExpanded || lineLength < MAX_COLLAPSE_LINE || showChart
            ? '100%'
            : MAX_COLLAPSE_HEIGHT,
        overflow: 'hidden',
      };
    }

    return style;
  };

  return (
    <Box
      id="codeblock-highlighter-markdown"
      className="codeblock relative w-full font-sans overflow-x-auto"
      bg={activeTheme === ThemeStyle.Light ? 'white' : 'black'}
    >
      <Box className="relative" style={getStyle()}>
      {showChart && LANGUAGE_TO_GRAPH_TYPE[language] && (
        <Box height={{ height: '100%' }}>
          <Graph
            type={LANGUAGE_TO_GRAPH_TYPE[language]}
            chart={value}
          />
        </Box>
      )}
        {!showChart ? (
          <Box>
            {activeTheme === ThemeStyle.Light ? (
              <Light
                className="codeblock-highlighter"
                language={getLanguage(language)}
                style={a11yLight}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  width: '100%',
                  background: 'white',
                  padding: '1rem',
                  color: 'black',
                  paddingLeft:
                    codeWhiteSpace === CodeWhiteSpace.Wrap ? '20px' : '40px',
                }}
                codeTagProps={{
                  style: {},
                  className:
                    codeWhiteSpace === CodeWhiteSpace.Wrap
                      ? 'codeblock-highlighter-code'
                      : '',
                }}
              >
                {value}
              </Light>
            ) : (
              <SyntaxHighlighter
                className="codeblock-highlighter"
                language={getLanguage(language)}
                style={vs2015}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  width: '100%',
                  background: 'transparent',
                  padding: '1rem',
                  paddingLeft:
                    !hiddenLineNumber ? codeWhiteSpace === CodeWhiteSpace.Wrap ? '20px' : '40px' : '20px'
                }}
                codeTagProps={{
                  style: {},
                  className:
                    codeWhiteSpace === CodeWhiteSpace.Wrap
                      ? 'codeblock-highlighter-code'
                      : '',
                }}
              >
                {value}
              </SyntaxHighlighter>
            )}
            {!hiddenLineNumber && codeWhiteSpace === CodeWhiteSpace.NoWrap ? (
              <Box
                className={`absolute top-[1rem] w-[40px] text-right pr-2 font-mono select-none ${
                  activeTheme === ThemeStyle.Light
                    ? 'text-black bg-white'
                    : 'text-zinc-500 bg-black'
                }`}
              >
                {lineNumberRender}
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Box>
      {!showChart && collapsable && lineLength > MAX_COLLAPSE_LINE && (
        <Box
          className="w-full flex"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Box display="flex" flex="1">
            <IconButton
              w="full"
              borderRadius="0"
              size="sm"
              aria-label="collapse"
              icon={isExpanded ? <TbArrowBarUp /> : <TbArrowBarDown />}
              onClick={() => setIsExpanded(!isExpanded)}
            />
          </Box>
          {actionButton && isExpanded ? (
            <Box bg="questionsBgColor">{actionButton}</Box>
          ) : null}
        </Box>
      )}
    </Box>
  );
}

const MemoCodeBlock = React.memo(CodeBlock);
MemoCodeBlock.displayName = 'CodeBlock';

export default MemoCodeBlock;
