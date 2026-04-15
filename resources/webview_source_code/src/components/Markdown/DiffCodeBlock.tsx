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

export interface CodeBlockProps {
  language: string;
  value: string;
  // 是否允许折叠
  collapsable?: boolean;
  defaultExpanded?: boolean;
  codeWhiteSpace?: CodeWhiteSpace;
  actionButton?: React.ReactNode;
  maxHeight?: number;
  startLineNumber?: number;
  metaData?: {
    [propName: string]: string;
  };
  addedLines: number[];
  removedLines: number[];
}

const MAX_COLLAPSE_HEIGHT = 320;
const MAX_COLLAPSE_LINE = 20;

function DiffCodeBlock(props: CodeBlockProps) {
  const { activeTheme } = useTheme();
  const {
    language,
    value,
    collapsable,
    defaultExpanded = false,
    codeWhiteSpace = CodeWhiteSpace.NoWrap,
    actionButton,
    maxHeight,
    startLineNumber = 1,
    addedLines = [],
    removedLines = []
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
          isExpanded || lineLength < MAX_COLLAPSE_LINE
            ? '100%'
            : MAX_COLLAPSE_HEIGHT,
        overflow: 'hidden',
      };
    }

    return style;
  };

  const diffLineProps = React.useMemo(() => {
    return (lineNumber: number) => {
      const style: any = { display: 'block' };
      if (addedLines.includes(lineNumber)) {
        style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
      } else if (removedLines.includes(lineNumber)) {
        style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
      }
      return { style };
    }
  }, [addedLines, removedLines])

  return (
    <Box
      id="codeblock-highlighter-markdown"
      className="codeblock relative w-full font-sans overflow-x-auto"
      bg={activeTheme === ThemeStyle.Light ? 'white' : 'black'}
    >
      <Box className="relative" style={getStyle()}>
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
                lineNumberStyle={{display: 'none'}}
                showLineNumbers={true}
                wrapLines={true}
                lineProps={diffLineProps}
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
                    codeWhiteSpace === CodeWhiteSpace.Wrap ? '20px' : '40px',
                }}
                codeTagProps={{
                  style: {},
                  className:
                    codeWhiteSpace === CodeWhiteSpace.Wrap
                      ? 'codeblock-highlighter-code'
                      : '',
                }}
                lineNumberStyle={{display: 'none'}}
                showLineNumbers={true}
                wrapLines={true}
                lineProps={diffLineProps}
              >
                {value}
              </SyntaxHighlighter>
            )}
            {codeWhiteSpace === CodeWhiteSpace.NoWrap ? (
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
      </Box>
      {collapsable && lineLength > MAX_COLLAPSE_LINE && (
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

const MemoDiffCodeBlock = React.memo(DiffCodeBlock);
MemoDiffCodeBlock.displayName = 'DiffCodeBlock';

export default MemoDiffCodeBlock;
