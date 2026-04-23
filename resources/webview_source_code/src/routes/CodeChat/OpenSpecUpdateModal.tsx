import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import * as React from 'react';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import { PromptCategoryType } from '../../services/prompt';
import { usePromptApp } from '../../store/promp-app';
import {
  SpecSetupStepId,
  SpecSetupStepStatus,
  useWorkspaceStore,
} from '../../store/workspace';
import { ThemeStyle, useTheme } from '../../ThemeContext';
import { UnionType } from './ChatTypeAhead/Prompt/type';

/** 升级步骤配置 */
const UPDATE_STEPS = [
  {
    id: SpecSetupStepId.UpgradeVersionCheck,
    key: 'versionCheck' as const,
    label: '检测版本',
  },
  {
    id: SpecSetupStepId.UpgradeCli,
    key: 'cliUpgrade' as const,
    label: '升级 CLI',
  },
  {
    id: SpecSetupStepId.UpgradeMigrateDocs,
    key: 'migrateDocs' as const,
    label: '迁移文档',
  },
];

/** 升级说明 */
const UPGRADE_NOTES = [
  'CLI 工具升级到 1.x',
  '文档结构迁移 (移除 openspec/AGENTS.md)',
  '新建 config.yaml（项目配置文件）',
  '弃用 project.md，建议内容手动迁移至 .codemaker/rules 中'
];

/** 新命令列表 */
const NEW_COMMANDS = [
  { command: 'opsx:onboard', description: '引导教程' },
  { command: 'opsx:explore', description: '探索模式' },
  { command: 'opsx:new', description: '创建新变更' },
  { command: 'opsx:ff', description: '快速创建所有工件' },
  { command: 'opsx:continue', description: '继续处理变更' },
  { command: 'opsx:apply', description: '实现任务' },
];

/** 横向进度步骤圆形图标 */
function StepCircle({
  status,
  stepNumber,
  isLight,
}: {
  status: SpecSetupStepStatus;
  stepNumber: number;
  isLight: boolean;
}) {
  const bgMap: Record<SpecSetupStepStatus, string> = {
    [SpecSetupStepStatus.Completed]: 'blue.500',
    [SpecSetupStepStatus.Running]: 'blue.500',
    [SpecSetupStepStatus.Failed]: 'red.500',
    [SpecSetupStepStatus.Pending]: isLight ? 'gray.200' : 'gray.600',
  };

  const contentMap: Record<SpecSetupStepStatus, React.ReactNode> = {
    [SpecSetupStepStatus.Completed]: (
      <CheckCircleIcon color="white" boxSize={4} />
    ),
    [SpecSetupStepStatus.Running]: (
      <Spinner size="sm" color="white" speed="0.8s" />
    ),
    [SpecSetupStepStatus.Failed]: <WarningIcon color="white" boxSize={3} />,
    [SpecSetupStepStatus.Pending]: (
      <Text
        fontSize="12px"
        fontWeight="bold"
        color={isLight ? 'gray.500' : 'gray.400'}
        style={{ marginBottom: 0 }}
      >
        {stepNumber}
      </Text>
    ),
  };

  return (
    <Flex
      w="28px"
      h="28px"
      borderRadius="full"
      bg={bgMap[status]}
      align="center"
      justify="center"
      flexShrink={0}
    >
      {contentMap[status]}
    </Flex>
  );
}

/** OpenSpec 升级弹窗组件 */
function OpenSpecUpdateModal() {
  const { activeTheme } = useTheme();
  const isLight = activeTheme === ThemeStyle.Light;
  const { postMessage } = usePostMessage();

  const openspecUpdateModalVisible = useWorkspaceStore(
    (state) => state.openspecUpdateModalVisible,
  );
  const setOpenspecUpdateModalVisible = useWorkspaceStore(
    (state) => state.setOpenspecUpdateModalVisible,
  );

  const upgradeStatus = useWorkspaceStore(
    (state) => state.specInfo?.setupStatus?.openspecUpgrade,
  );

  const updatePromptAppRunner = usePromptApp((state) => state.update);

  const [hasClickedUpgrade, setHasClickedUpgrade] = React.useState(false);

  // 弹窗打开时重置本地状态
  React.useEffect(() => {
    if (openspecUpdateModalVisible) {
      setHasClickedUpgrade(false);
    }
  }, [openspecUpdateModalVisible]);

  const steps = React.useMemo(() => {
    if (!upgradeStatus) return [];
    return UPDATE_STEPS.map((cfg) => ({
      id: cfg.id,
      status: upgradeStatus[cfg.key]?.status ?? SpecSetupStepStatus.Pending,
      errorMessage: upgradeStatus[cfg.key]?.errorMessage,
    }));
  }, [upgradeStatus]);

  const upgradedVersion = upgradeStatus?.upgradedVersion ?? '';
  const isRunning = steps.some((s) => s.status === SpecSetupStepStatus.Running);
  const allCompleted =
    steps.length > 0 &&
    steps.every((s) => s.status === SpecSetupStepStatus.Completed);
  const failedStep = steps.find((s) => s.status === SpecSetupStepStatus.Failed);

  /** 触发升级 */
  const handleStartUpgrade = React.useCallback(() => {
    setHasClickedUpgrade(true);
    postMessage({
      type: BroadcastActions.OPENSPEC_UPDATE,
      data: {},
    });
  }, [postMessage]);

  /** 关闭弹窗 */
  const handleClose = React.useCallback(() => {
    setOpenspecUpdateModalVisible(false);
  }, [setOpenspecUpdateModalVisible]);

  /** 处理指令点击*/
  const handleCommandClick = React.useCallback(
    (command: string, description: string) => {
      handleClose();
      updatePromptAppRunner({
        name: command,
        description: description,
        type: UnionType.Prompt,
        meta: {
          description: description,
          name: command,
          prompt: `/${command}`,
          _id: `/${command}`,
          type: PromptCategoryType._CodeMaker,
        },
      });
    },
    [handleClose, updatePromptAppRunner],
  );

  return (
    <Modal
      isOpen={openspecUpdateModalVisible}
      onClose={handleClose}
      isCentered
      size="md"
    >
      <ModalOverlay />
      <ModalContent borderRadius="12px" mx={4}>
        <ModalHeader
          fontSize="14px"
          fontWeight="bold"
          pb={2}
          color="text.default"
        >
          OpenSpec 版本升级
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Flex flexDirection="column" alignItems="center">
            {!hasClickedUpgrade && (
              <Box width="100%" mb={3}>
                <Text fontSize="13px" color="text.default" mb={3}>
                  此操作将把 OpenSpec 从 0.23 版本升级到 1.x 版本
                </Text>
                <VStack align="start" spacing={2} mb={3}>
                  {UPGRADE_NOTES.map((text, idx) => (
                    <Text key={idx} fontSize="12px" color="text.default">
                      {idx + 1}. {text}
                    </Text>
                  ))}
                </VStack>
                <Box
                  display="flex"
                  p={2}
                  gap={1}
                  borderRadius="6px"
                  bg={isLight ? 'orange.50' : 'rgba(251, 191, 36, 0.1)'}
                  borderWidth="1px"
                  borderColor={
                    isLight ? 'orange.200' : 'rgba(251, 191, 36, 0.2)'
                  }
                >
                  <WarningIcon
                    color={isLight ? 'orange.400' : 'orange.400'}
                    mt={0.5}
                    boxSize={4}
                  />
                  <Text
                    fontSize="11px"
                    flex=""
                    color={isLight ? 'orange.700' : 'orange.300'}
                  >
                    此操作不可逆，请确认后再继续
                  </Text>
                </Box>
              </Box>
            )}

            {/* 横向进度条 */}
            {hasClickedUpgrade && (
              <Flex align="flex-start" justify="center" mb={2} width="240px">
                {UPDATE_STEPS.map((cfg, idx) => {
                  const step = steps.find((s) => s.id === cfg.id);
                  const status = step?.status ?? SpecSetupStepStatus.Pending;
                  const isLast = idx === UPDATE_STEPS.length - 1;

                  return (
                    <React.Fragment key={cfg.id}>
                      <Flex direction="column" align="center" minW="70px">
                        <StepCircle
                          status={status}
                          stepNumber={idx + 1}
                          isLight={isLight}
                        />
                        <Text
                          fontSize="11px"
                          color={
                            status === SpecSetupStepStatus.Completed
                              ? 'blue.500'
                              : status === SpecSetupStepStatus.Failed
                                ? 'red.500'
                                : status === SpecSetupStepStatus.Running
                                  ? 'blue.500'
                                  : 'text.default'
                          }
                          textAlign="center"
                          style={{ marginBottom: 0, marginTop: '4px' }}
                        >
                          {cfg.label}
                        </Text>
                      </Flex>

                      {!isLast && (
                        <Box
                          flex={1}
                          h="2px"
                          bg={
                            steps[idx + 1]?.status !==
                              SpecSetupStepStatus.Pending ||
                            status === SpecSetupStepStatus.Completed
                              ? 'blue.400'
                              : isLight
                                ? 'gray.300'
                                : 'gray.600'
                          }
                          mt="14px"
                          mx={1}
                          minW="20px"
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </Flex>
            )}

            {/* 错误信息 */}
            {hasClickedUpgrade && failedStep?.errorMessage && (
              <Box mt={3} width="100%">
                <Text
                  fontSize="12px"
                  color="red.500"
                  textAlign="center"
                  style={{ marginBottom: 0 }}
                >
                  {failedStep?.errorMessage}
                </Text>
              </Box>
            )}

            {/* 升级按钮 */}
            {!(hasClickedUpgrade && allCompleted) && !(hasClickedUpgrade && failedStep) && (
              <Flex
                direction="column"
                align="center"
                mt={hasClickedUpgrade ? 2 : 4}
              >
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handleStartUpgrade}
                  borderRadius="6px"
                  px={6}
                  isDisabled={isRunning}
                >
                  {isRunning ? '升级中...' : '开始升级'}
                </Button>
              </Flex>
            )}

            {/* 升级完成提示 */}
            {hasClickedUpgrade && allCompleted && (
              <Box mt={3} width="100%">
                <Flex align="center" justifyContent="center" gap={2} mb={2}>
                  <CheckCircleIcon color="green.500" boxSize={4} />
                  <Text fontSize="13px" color="green.500" fontWeight="medium">
                    升级完成！OpenSpec 已升级到 {upgradedVersion}
                  </Text>
                </Flex>

                <Text
                  fontSize="12px"
                  fontWeight="medium"
                  color="text.default"
                  mb={2}
                >
                  新增命令：
                </Text>
                <VStack align="stretch" spacing={1.5} mb={3}>
                  {NEW_COMMANDS.map((cmd) => (
                    <Flex
                      key={cmd.command}
                      align="center"
                      justify="space-between"
                      p={2}
                      borderRadius="4px"
                      bg={isLight ? 'gray.50' : 'whiteAlpha.50'}
                      cursor="pointer"
                      _hover={{
                        bg: isLight ? 'gray.100' : 'whiteAlpha.100',
                      }}
                      onClick={() =>
                        handleCommandClick(cmd.command, cmd.description)
                      }
                    >
                      <Text
                        fontSize="12px"
                        fontFamily="mono"
                        color="blue.400"
                        fontWeight="medium"
                      >
                        /{cmd.command}
                      </Text>
                      <Text
                        fontSize="11px"
                        color={isLight ? 'gray.600' : 'gray.400'}
                      >
                        {cmd.description}
                      </Text>
                    </Flex>
                  ))}
                </VStack>

                <VStack align="start" spacing={1}>
                  <Text
                    fontSize="12px"
                    color={isLight ? 'gray.600' : 'gray.400'}
                  >
                    • 如存在 project.md，请手动迁移至 .codemaker/rules 中
                  </Text>
                  <Text
                    fontSize="12px"
                    color={isLight ? 'gray.600' : 'gray.400'}
                  >
                    • 使用 /opsx:new 创建你的第一个 change
                  </Text>
                  <Text
                    fontSize="12px"
                    color={isLight ? 'gray.600' : 'gray.400'}
                  >
                    • 如命令未显示，请重载 IDE 窗口
                  </Text>
                </VStack>
              </Box>
            )}
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default OpenSpecUpdateModal;