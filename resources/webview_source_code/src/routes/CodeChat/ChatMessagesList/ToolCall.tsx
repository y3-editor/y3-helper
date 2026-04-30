/**
 * 重构后的 ToolCall 组件 - 使用单一入口的 useToolCall Hook
 */

import { Flex, Button } from '@chakra-ui/react';
import { ToolCallProps } from './types';
import { useState } from 'react';
import { useChatStreamStore } from '../../../store/chat';
import ToolCallResults from './ToolCallResults';
import TaskProgressPanel from '../TaskProgressPanel';
import ConfirmPopver from '../../../components/ConfirmPopver';
import { terminalCmdFunction } from './TermialPanel';
import { useToolCall } from '../../../hooks/useToolCall';

export default function ToolCall(props: ToolCallProps) {
  const { message, isShare, isLatest } = props;

  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isMCPProcessing = useChatStreamStore((state) => state.isMCPProcessing);
  const messageProcessing = message.processing;

  // 还原原版本的 isAuthorizationPathCheck 逻辑
  const [isAuthorizationPathCheck] = useState(false);

  // 使用单一入口的工具调用Hook
  const {
    // 配置
    autoConfigItems,

    // 状态
    toolResponse,
    unselectedResults,
    toolResponseDisabled,
    handleSelectionChange,

    // 处理
    handleToolCall,
    getBtnLabel,

    // 标题
    toolCallTitle,
    shouldShowHeader,

    // 工具类型 - 从便捷访问中获取
    toolTypes,
    environment,
  } = useToolCall(message, isShare, !!isLatest);

  // 解构工具类型检查
  const {
    hasDangerousCommand,
    hasAskUserQuestionTool,
    hasTodoTool,
    hasTaskTool,
  } = toolTypes;

  // 解构环境检查
  const { repoNotMatch } = environment;

  // 检查是否是启用的命令工具（保持原版本变量名）
  const enableCommandTool = message.tool_calls?.some((tool) => {
    if (tool.function.name !== terminalCmdFunction) return false;
    const toolCallResult = message.tool_result?.[tool.id];
    return !!toolCallResult?.extra?.terminalStatus;
  });

  // 添加授权路径
  // const addAuthorizationPath = useCallback((path: string[]) => {
  //   postMessage({
  //     type: 'ADD_AUTHORIZATION_PATH',
  //     data: {
  //       path,
  //     },
  //   });
  //   toast({
  //     title: (
  //       <Box>
  //         已将路径添加到自动授权名单，
  //         <Button
  //           variant="link"
  //           color="#776fff"
  //           onClick={() => postMessage({ type: 'OPEN_EXTENSION_SETTING_AUTHORIZATION_PATH' })}
  //         >
  //           点击查看
  //         </Button>
  //       </Box>
  //     ),
  //     position: 'top',
  //     isClosable: true,
  //     duration: 2000,
  //     status: 'success',
  //   });
  // }, [postMessage, toast]);

  // 如果工具已禁用或命令工具已启用，只显示结果
  if (toolResponseDisabled || enableCommandTool) {
    if (hasTodoTool) return null;
    return (
      <TaskProgressPanel
        headerContent={toolCallTitle}
        showHeader={shouldShowHeader}
      >
        <ToolCallResults
          message={message}
          toolResponseDisabled={toolResponseDisabled}
          toolResponse={toolResponse}
          unselectedResults={unselectedResults}
          handleSelectionChange={handleSelectionChange}
          isLatest={isLatest}
        />
      </TaskProgressPanel>
    );
  }

  // 显示带操作按钮的完整面板
  return (
    <TaskProgressPanel
      headerContent={toolCallTitle}
      autoConfigItems={!messageProcessing ? autoConfigItems : []}
      showHeader={shouldShowHeader}
      footerContent={
        !toolResponseDisabled &&
        !isProcessing &&
        !messageProcessing &&
        !isMCPProcessing &&
        !isShare &&
        !hasAskUserQuestionTool &&
        !hasTaskTool ? (
          <Flex mt={0} gap={2} alignItems="center">
            <ConfirmPopver
              disabled={!hasDangerousCommand}
              title={'温馨提示'}
              description={'当前指令涉及文件/系统修改,请谨慎决定执行'}
              comfirmAfterDisabled={true}
              onConfirm={() => {
                if (repoNotMatch) return;
                handleToolCall(true);
              }}
            >
              <Button
                size="sm"
                variant="unstyled"
                disabled={repoNotMatch}
                cursor={repoNotMatch ? 'not-allowed' : 'pointer'}
                color={repoNotMatch ? 'gray.600' : '#7c7cff'}
                fontSize="12px"
                fontWeight="400"
                _hover={repoNotMatch ? undefined : { opacity: 0.8 }}
              >
                {getBtnLabel(true)}
              </Button>
            </ConfirmPopver>
            <Button
              size="sm"
              variant="unstyled"
              disabled={repoNotMatch || isAuthorizationPathCheck}
              cursor={
                repoNotMatch || isAuthorizationPathCheck
                  ? 'not-allowed'
                  : 'pointer'
              }
              onClick={() => {
                if (repoNotMatch || isAuthorizationPathCheck) return;
                handleToolCall(false);
              }}
              color={
                repoNotMatch || isAuthorizationPathCheck
                  ? 'gray.600'
                  : 'gray.400'
              }
              fontSize="12px"
              fontWeight="400"
              _hover={
                repoNotMatch || isAuthorizationPathCheck
                  ? undefined
                  : { opacity: 0.8 }
              }
            >
              {getBtnLabel(false)}
            </Button>
          </Flex>
        ) : undefined
      }
    >
      <ToolCallResults
        message={message}
        toolResponseDisabled={toolResponseDisabled}
        toolResponse={toolResponse}
        unselectedResults={unselectedResults}
        handleSelectionChange={handleSelectionChange}
        isLatest={isLatest}
      />
    </TaskProgressPanel>
  );
}