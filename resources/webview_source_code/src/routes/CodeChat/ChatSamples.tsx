import * as React from 'react';
import { Button, Flex, VStack, Text, Box } from '@chakra-ui/react';
import { useChatStore, CodebaseChatMode } from '../../store/chat';
import { isMacOS } from '../../utils';
import { FaWindows } from 'react-icons/fa';
import { RiCommandLine } from 'react-icons/ri';
import Icon from '../../components/Icon';
import { IDE, useExtensionStore } from '../../store/extension';
import { useWorkspaceStore } from '../../store/workspace';
import useCustomToast from '../../hooks/useCustomToast';
import CodebaseModePicker from './CodebaseModePicker';
import { CHAT_SAMPLES, CODEBASE_CHAT_SAMPLES } from '../../const';

export interface ChatSamplesProps {
  onSubmit: (prompt: string) => void;
  onFillInput?: (prompt: string) => void;
  questions?: string[];
  isShowRecommendation: boolean;
}

export const ChatSamples = (props: ChatSamplesProps) => {
  const { questions, isShowRecommendation } = props;
  const { toast } = useCustomToast();
  const currentSession = useChatStore((state) => state.currentSession());
  const chatType = useChatStore((state) => state.chatType);
  const setCodebaseChatMode = useChatStore((state) => state.setCodebaseChatMode);
  const codebaseChatMode = useChatStore((state) => state.codebaseChatMode);
  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);

  // 本地选中的模式（点击只切换本地状态，发送时才确认到 store），新会话默认选中 vibe
  const [localSelectedMode, setLocalSelectedMode] = React.useState<CodebaseChatMode | undefined>(codebaseChatMode || 'vibe');

  React.useEffect(() => {
    // 当 codebaseChatMode 为 undefined 时（如切换到新的 codebase 会话），默认选中 'vibe'
    setLocalSelectedMode(codebaseChatMode || 'vibe');
  }, [codebaseChatMode]);

  const submitPrompt = (prompt: string) => {
    if (chatType === 'codebase' && !workspaceInfo.repoName) {
      toast({
        title: `未识别到仓库信息，请先打开代码仓库后使用本功能`,
        status: 'warning',
        duration: 2000,
      });
      return;
    }

    // codebase模式：填充到输入框
    // 普通聊天模式：直接发送
    if (chatType === 'codebase' && props.onFillInput) {
      props.onFillInput(prompt);
    } else {
      props.onSubmit(prompt);
    }
  };

  const ide = useExtensionStore((state) => state.IDE);
  const isMac = isMacOS();

  const promptExamples = React.useMemo(() => {
    if (chatType === 'codebase') {
      return CODEBASE_CHAT_SAMPLES;
    } else {
      if (!questions?.length) {
        return CHAT_SAMPLES;
      }
      return isShowRecommendation
        ? questions.map((i, index) => ({
          id: index,
          title: `问题${index + 1}`,
          description: i,
          prompt: `${i}`,
        }))
        : CHAT_SAMPLES;
    }
  }, [chatType, isShowRecommendation, questions]);

  // 处理本地模式选择变化，同时同步到 store
  // 注意：必须在所有条件返回之前调用 hooks
  const handleLocalModeSelect = React.useCallback((mode: CodebaseChatMode) => {
    setLocalSelectedMode(mode);
    // 同步到 store，这样 ChatInput 可以感知到选中的模式
    setCodebaseChatMode(mode);
  }, [setCodebaseChatMode]);

  if (currentSession?.data?.messages.length) {
    return null;
  }

  // 渲染 Codebase 模式的内容
  const renderCodebaseContent = () => {
    // 新会话（没有消息）时，始终显示模式选择器
    return (
      <CodebaseModePicker
        selectedMode={localSelectedMode}
        onSelectMode={handleLocalModeSelect}
        onFillInput={props.onFillInput}
      />
    );
  };

  return (
    <>
      {chatType === 'codebase' ? (
        renderCodebaseContent()
      ) : (
        <div className="py-4 px-2">
          <Flex justifyContent="center">
            <Text color="blue.300" fontSize="24px" fontWeight="bold">
              你可以和 CodeMaker 聊点什么？
            </Text>
          </Flex>
          {ide === IDE.VisualStudioCode && chatType === 'default' ? (
            <Flex
              justifyContent="center"
              fontStyle="12px"
              color="text.default"
              flexWrap="wrap"
            >
              使用
              <Box
                bg="themeBgColor"
                mx="1"
                display="flex"
                justifyContent="center"
                alignItems="center"
                borderRadius="4px"
                px="2"
              >
                {isMac ? (
                  <Icon as={RiCommandLine} size="sm" />
                ) : (
                  <Icon as={FaWindows} size="sm" />
                )}
              </Box>
              +
              <Box
                bg="themeBgColor"
                mx="1"
                display="flex"
                justifyContent="center"
                borderRadius="4px"
                px="2"
                alignItems="center"
              >
                Y
              </Box>
              与我快速对话
            </Flex>
          ) : null}
          <div>
            <VStack m={2} p={2}>
              {promptExamples.map((example) => (
                <Button
                  h="full"
                  w="full"
                  p={4}
                  mt="2"
                  textAlign="left"
                  justifyContent="left"
                  whiteSpace="normal"
                  onClick={() => submitPrompt(example.prompt)}
                  key={example.id}
                  borderRadius="8px"
                  bg="questionsBgColor"
                  borderColor="customBorder"
                  borderWidth="1px"
                  _hover={{ borderColor: 'blue.300', color: 'blue.300' }}
                >
                  <VStack align="flex-start">
                    <div className="text-[14px]">{example.title}</div>
                    <div className="text-[12px] opacity-60 font-normal">
                      {example.description}
                    </div>
                  </VStack>
                </Button>
              ))}
            </VStack>
          </div>
        </div>
      )}
    </>
  );
};