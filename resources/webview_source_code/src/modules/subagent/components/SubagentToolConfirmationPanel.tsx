/**
 * Subagent 工具确认蒙层
 * 覆盖在 Task 组件之上的简单确认对话框
 */

import {
  Button,
  Text,
  Code,
  Box,
  HStack,
  VStack,
} from '@chakra-ui/react';
import { TbAlertTriangleFilled } from 'react-icons/tb';

interface SubagentToolConfirmationPanelProps {
  toolName: string;
  toolParams: Record<string, any>;
  isDangerous: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

function SubagentToolConfirmationPanel({
  toolName,
  toolParams,
  isDangerous,
  onConfirm,
  onReject,
}: SubagentToolConfirmationPanelProps) {
  // 格式化工具参数显示
  const renderToolParams = () => {
    if (toolName === 'run_terminal_cmd' && toolParams.command) {
      return (
        <Code
          display="block"
          whiteSpace="pre-wrap"
          p={2}
          borderRadius="md"
          bg="bg.muted"
          fontSize="xs"
          color="text.primary"
          maxH="100px"
          overflowY="auto"
        >
          {toolParams.command}
        </Code>
      );
    }

    if (toolName === 'edit_file' || toolName === 'replace_in_file') {
      return (
        <Code fontSize="xs" px={2} py={1} bg="bg.muted" color="text.primary">
          {toolParams.target_file || toolParams.path}
        </Code>
      );
    }

    // 其他工具显示 JSON
    return (
      <Code
        display="block"
        whiteSpace="pre-wrap"
        p={2}
        borderRadius="md"
        bg="bg.muted"
        fontSize="xs"
        maxH="100px"
        overflowY="auto"
        color="text.primary"
      >
        {JSON.stringify(toolParams, null, 2)}
      </Code>
    );
  };

  const getToolDisplayName = () => {
    const names: Record<string, string> = {
      run_terminal_cmd: '终端命令',
      edit_file: '编辑文件',
      replace_in_file: '替换内容',
      read_file: '读取文件',
      grep_search: '搜索',
      task: '子任务',
    };
    return names[toolName] || toolName;
  };

  return (
    <>
      {/* 确认对话框 */}
      <Box
        position="relative"
        width="100%"
        height="auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <HStack px={3} py={2}>
          {isDangerous && (
            <Box
              as={TbAlertTriangleFilled}
              color="orange.500"
              _dark={{ color: 'orange.400' }}
              fontSize="md"
            />
          )}
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="text.primary"
            style={{ marginBottom: 0 }}
          >
            {getToolDisplayName()}
          </Text>
        </HStack>

        {/* 内容 */}
        <VStack align="stretch" spacing={2} px={3} py={3}>
          {renderToolParams()}

          {isDangerous && (
            <Box
              p={2}
              borderRadius="md"
              bg="orange.50"
              borderWidth="1px"
              borderColor="orange.200"
              _dark={{
                bg: 'orange.900',
                borderColor: 'orange.700',
              }}
            >
              <Text
                fontSize="xs"
                color="orange.700"
                _dark={{ color: 'orange.200' }}
                style={{ marginBottom: 0 }}
              >
                危险操作，请确认
              </Text>
            </Box>
          )}
        </VStack>

        {/* 按钮 */}
        <HStack
          spacing={2}
          px={3}
          py={2}
          borderTopWidth="1px"
          borderColor="border.default"
          justify="flex-end"
        >
          <Button size="xs" variant="ghost" onClick={onReject}>
            取消
          </Button>
          <Button
            size="xs"
            colorScheme={isDangerous ? 'orange' : 'blue'}
            onClick={onConfirm}
          >
            执行
          </Button>
        </HStack>
      </Box>
    </>
  );
}

export default SubagentToolConfirmationPanel;