import * as React from 'react';
import {
  IconButton,
  Box,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { TbX } from 'react-icons/tb';
import { RiPushpin2Line, RiPushpin2Fill } from 'react-icons/ri';
import { useChatStreamStore } from '../../store/chat';
import Icon from '../../components/Icon/index';
import Markdown from '../../components/Markdown';
import CodeBlockNumberLabel from '../../components/CodeBlockNumberLabel';

interface PrePromptCodeBlockProps {
  fillInputRef?: React.MutableRefObject<((text: string) => void) | null>;
}

export default function PrePromptCodeBlock({ fillInputRef }: PrePromptCodeBlockProps) {
  // const [prePromptCodeBlock, onRemovePrePromptCodeBlock, onUpdateHoldingValue] =
  //   useChatStreamStore((state) => [
  //     state.prePromptCodeBlock,
  //     state.onRemovePrePromptCodeBlock,
  //     state.onUpdateHoldingValue,
  //   ]);
  const prePromptCodeBlock = useChatStreamStore((state) => state.prePromptCodeBlock);
  const onRemovePrePromptCodeBlock = useChatStreamStore(
    (state) => state.onRemovePrePromptCodeBlock,
  );
  const onUpdateHoldingValue = useChatStreamStore(
    (state) => state.onUpdateHoldingValue,
  );
  const [expandedIndex, setExpandedIndex] = React.useState([
    prePromptCodeBlock ? prePromptCodeBlock.length - 1 : 0,
  ]);
  const handleRemovePrePromptCodeBlock = (index: number) => {
    onRemovePrePromptCodeBlock(index);
  };

  React.useEffect(() => {
    setExpandedIndex([prePromptCodeBlock ? prePromptCodeBlock.length - 1 : 0]);
  }, [prePromptCodeBlock]);

  if (!prePromptCodeBlock) {
    return null;
  }

  return (
    <>
      <Accordion
        index={expandedIndex}
        onChange={(expandedIndex: number[]) => {
          setExpandedIndex(expandedIndex);
        }}
        allowMultiple
      >
        {prePromptCodeBlock.map((code, index) => {
          const content = !prePromptCodeBlock
            ? ''
            : `\`\`\`${code?.language}\n${code?.content}\n\`\`\``;
          const isExpanded = expandedIndex.includes(index);
          const expandStyle = !isExpanded
            ? {
                borderBottomRadius: '4px',
              }
            : {};
          return (
            <AccordionItem
              _last={{ border: 'none' }}
              mb="2"
              border="none"
              key={index}
            >
              <AccordionButton
                h="28px"
                border="1px"
                bg="answerBgColor"
                borderColor="customBorder"
                borderTopRadius="4px"
                color="text.default"
                fontSize="12px"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                {...expandStyle}
                animation="none"
              >
                <Box flex="1" minWidth="60px" display="flex" alignItems="center">
                  <CodeBlockNumberLabel
                    number={code.sequenceNumber || index + 1}
                    onClick={(number) => {
                      // 实现点击序号添加到输入框的功能
                      if (fillInputRef?.current) {
                        const referenceText = `代码块${number} `;
                        fillInputRef.current(referenceText);
                      }
                    }}
                  />
                  <Box
                    fontSize="sm"
                    isTruncated
                    title={code.path || code.language}
                    textAlign="left"
                  >
                    {code.path || code.language}
                  </Box>
                </Box>
                <Box display="flex" alignItems="center">
                  {code.textEditorSelection ? (
                    <IconButton
                      variant="ghost"
                      size="xs"
                      ml={2}
                      aria-label="固定"
                      icon={
                        <Icon
                          as={code.holding ? RiPushpin2Fill : RiPushpin2Line}
                          size="xs"
                        />
                      }
                      color="text.default"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateHoldingValue(index, !code.holding);
                      }}
                    />
                  ) : null}

                  <IconButton
                    variant="ghost"
                    size="xs"
                    ml={code.textEditorSelection ? 0 : 2}
                    aria-label="删除代码块"
                    icon={<Icon as={TbX} size="xs" />}
                    color="text.default"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePrePromptCodeBlock(index);
                    }}
                  />
                  <IconButton
                    variant="ghost"
                    size="xs"
                    aria-label="删除代码块"
                    icon={<AccordionIcon fontSize="20px" />}
                    color="text.default"
                  />
                </Box>
              </AccordionButton>

              <AccordionPanel
                p="0"
                border="1px"
                borderBottom="none"
                borderColor="customBorder"
                maxHeight={200}
                overflow={'scroll'}
              >
                <div
                  className="relative"
                  // style={{ height: 'calc(100% - 28px)' }}
                >
                  <Markdown startLineNumber={code.startLine} data={content}>
                    {content}
                  </Markdown>
                </div>
              </AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
}
