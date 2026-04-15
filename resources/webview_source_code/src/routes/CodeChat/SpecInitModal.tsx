import * as React from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon, CopyIcon } from '@chakra-ui/icons';
import {
  useWorkspaceStore,
  SpecSetupStepId,
  SpecSetupStepStatus,
  SpecSetupStep,
  SpecFramework,
} from '../../store/workspace';
import { IDE, useExtensionStore } from '../../store/extension';
import { useChatPromptStore, useChatStore, useChatStreamStore } from '../../store/chat';
import { useTheme, ThemeStyle } from '../../ThemeContext';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import { PromptCategoryType } from '../../services/prompt';
import { BuiltInPrompt } from '../../services/builtInPrompts';
import { OPEN_SPEC_SETUP_PROMPT, SPECKIT_SETUP_PROMPT } from '../../services/builtInPrompts/spec';
import { supportsSpecInit, getSpecInitMinVersionHint } from '../../utils/specVersionUtils';

/** OpenSpec 初始化步骤配置 (2 步) */
const OPENSPEC_STEPS: { id: SpecSetupStepId; label: string }[] = [
  { id: SpecSetupStepId.OpenspecCli, label: 'openspec-cli 安装' },
  { id: SpecSetupStepId.OpenspecInit, label: 'openspec 初始化' },
];

/** SpecKit 初始化步骤配置 (2 步) */
const SPECKIT_STEPS: { id: SpecSetupStepId; label: string }[] = [
  { id: SpecSetupStepId.SpecifyCli, label: 'specify-cli 安装' },
  { id: SpecSetupStepId.SpeckitInit, label: 'speckit 初始化' },
];

/** 错误码提示项 */
interface ErrorCodeTipItem {
  text: string;
  linkText?: string;
  link?: string;
}

/** 错误码对应的提示信息映射 */
const ERROR_CODE_TIPS: Record<string, ErrorCodeTipItem[]> = {
  NODE_UNAVAILABLE: [
    {
      text: '安装 openspec-cli 需要 npm 命令，当前不可用',
      linkText: '',
      link: '',
    },
    {
      text: '- 请确认 Node.js 正确安装后重新点击初始化(推荐使用 nvm)',
      linkText: 'nvm 安装指南',
      link: 'https://github.com/nvm-sh/nvm',
    },
    {
      text: '- 也可以自行安装 openspec-cli 后重新点击初始化',
      linkText: '查看文档',
      link: 'https://github.com/Fission-AI/OpenSpec?tab=readme-ov-file#quick-start',
    },
  ],
  NODE_VERSION_INVALID: [
    {
      text: 'Node.js 版本不满足要求(>=20.19.0)',
      linkText: '',
      link: '',
    },
    {
      text: '- 请升级版本后重新点击初始化(推荐使用 nvm)',
      linkText: 'nvm 安装指南',
      link: 'https://github.com/nvm-sh/nvm',
    },
    {
      text: '- 也可以自行安装 openspec-cli 后重新点击初始化',
      linkText: '查看文档',
      link: 'https://github.com/Fission-AI/OpenSpec?tab=readme-ov-file#quick-start',
    },
  ],
  OPENSPEC_CLI_UNAVAILABLE: [
    {
      text: 'openspec-cli 未成功安装',
      linkText: '',
      link: '',
    },
    {
      text: '- 也可以自行安装 openspec-cli 后重新点击初始化',
      linkText: '查看安装文档',
      link: 'https://github.com/Fission-AI/OpenSpec?tab=readme-ov-file#quick-start',
    }
  ],
  UV_UNAVAILABLE: [
    {
      text: '安装 specify-cli 依赖 uv，当前 uv 命令不可用',
      linkText: '',
      link: '',
    },
    {
      text: '- 请确认 uv 已正确安装后重新点击初始化',
      linkText: '官方安装指南',
      link: 'https://github.com/astral-sh/uv?tab=readme-ov-file#installation',
    },
    {
      text: '- 也可以自行安装 specify-cli 后重新点击初始化',
      linkText: '查看安装文档',
      link: 'https://github.com/github/spec-kit?tab=readme-ov-file#1-install-specify-cli',
    },
  ],
  SPECIFY_CLI_UNAVAILABLE: [
    {
      text: 'specify-cli 未成功安装',
      linkText: '',
      link: '',
    },
    {
      text: '可以自行安装 specify-cli 后重新点击初始化',
      linkText: '查看安装文档',
      link: 'https://github.com/github/spec-kit?tab=readme-ov-file#1-install-specify-cli',
    },
  ],
};

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
  const size = '28px';

  // 已完成状态 - 使用主色（蓝色）
  if (status === SpecSetupStepStatus.Completed) {
    return (
      <Flex
        w={size}
        h={size}
        borderRadius="full"
        bg="blue.500"
        align="center"
        justify="center"
        flexShrink={0}
      >
        <CheckCircleIcon color="white" boxSize={4} />
      </Flex>
    );
  }

  if (status === SpecSetupStepStatus.Running) {
    return (
      <Flex
        w={size}
        h={size}
        borderRadius="full"
        bg="blue.500"
        align="center"
        justify="center"
        flexShrink={0}
      >
        <Spinner size="sm" color="white" speed="0.8s" />
      </Flex>
    );
  }

  if (status === SpecSetupStepStatus.Failed) {
    return (
      <Flex
        w={size}
        h={size}
        borderRadius="full"
        bg="red.500"
        align="center"
        justify="center"
        flexShrink={0}
      >
        <WarningIcon color="white" boxSize={3} />
      </Flex>
    );
  }

  return (
    <Flex
      w={size}
      h={size}
      borderRadius="full"
      bg={isLight ? 'gray.200' : 'gray.600'}
      align="center"
      justify="center"
      flexShrink={0}
    >
      <Text
        fontSize="12px"
        fontWeight="bold"
        color={isLight ? 'gray.500' : 'gray.400'}
        style={{ marginBottom: 0 }}
      >
        {stepNumber}
      </Text>
    </Flex>
  );
}

/** 错误信息显示组件 - 简化样式，无底色边框 */
function ErrorMessageBox({
  errorMessage
}: {
  errorMessage: string;
  stepName: string;
}) {
  const { postMessage } = usePostMessage();

  const handleCopy = React.useCallback(() => {
    postMessage({
      type: BroadcastActions.COPY_TO_CLIPBOARD,
      data: errorMessage,
    });
  }, [errorMessage, postMessage]);

  return (
    <Flex align="flex-start" gap={1} mt={3} width="100%">
      <Text
        fontSize="12px"
        color="red.500"
        isTruncated
        flex={1}
        style={{
          marginBottom: 0,
          wordBreak: 'break-word',
        }}
        title={errorMessage}
      >
        错误信息: {errorMessage}
      </Text>
      <Button
        size="xs"
        variant="ghost"
        colorScheme="gray"
        onClick={handleCopy}
        flexShrink={0}
        minW="auto"
        h="18px"
        px={1}
        title="复制错误信息"
        opacity={0.6}
        _hover={{ opacity: 1 }}
      >
        <CopyIcon boxSize={3} />
      </Button>
    </Flex>
  );
}

/** Spec 初始化弹窗组件 */
function SpecInitModal() {
  const { activeTheme } = useTheme();
  const isLight = activeTheme === ThemeStyle.Light;
  const { postMessage } = usePostMessage();

  const initModalVisible = useWorkspaceStore((state) => state.initModalVisible);
  const setInitModalVisible = useWorkspaceStore(
    (state) => state.setInitModalVisible
  );
  const currentSpecFramework = useWorkspaceStore(
    (state) => state.currentSpecFramework
  );
  const specInfo = useWorkspaceStore((state) => state.specInfo);
  const codebaseChatMode = useChatStore((state) => state.codebaseChatMode);

  const updateChatPrompt = useChatPromptStore((state) => state.update);
  const onUserSubmit = useChatStreamStore((state) => state.onUserSubmit);

  // Extension 版本信息（用于版本能力检测）
  const codeMakerVersion = useExtensionStore((state) => state.codeMakerVersion);
  const ide = useExtensionStore((state) => state.IDE);

  // 确定当前的 spec 模式
  // 优先使用 currentSpecFramework (由点击事件设置)，否则回退到 codebaseChatMode
  const specMode: 'openspec' | 'speckit' = React.useMemo(() => {
    if (currentSpecFramework === SpecFramework.SpecKit) {
      return 'speckit';
    }
    if (currentSpecFramework === SpecFramework.OpenSpec) {
      return 'openspec';
    }
    // 回退到 codebaseChatMode
    return codebaseChatMode === 'speckit' ? 'speckit' : 'openspec';
  }, [currentSpecFramework, codebaseChatMode]);

  // 按钮点击后等待状态
  const [isWaitingForResponse, setIsWaitingForResponse] = React.useState(false);

  // Extension 版本能力检测
  const supportsInit = React.useMemo(() => {
    return supportsSpecInit(codeMakerVersion, ide);
  }, [codeMakerVersion, ide]);

  // 监听插件的 SYNC_SPEC_INFO 消息
  React.useEffect(() => {
    if (!isWaitingForResponse) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_SPEC_INFO') {
        setIsWaitingForResponse(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isWaitingForResponse]);

  /** 获取当前 spec 模式的初始化步骤 */
  const getSetupSteps = React.useCallback((): SpecSetupStep[] => {
    if (!specInfo?.setupStatus) return [];

    if (specMode === 'openspec') {
      const openspecStatus = specInfo.setupStatus.openspec;
      if (!openspecStatus) return [];
      return [openspecStatus.openspecCli, openspecStatus.openspecInit].filter(
        Boolean
      );
    } else {
      const speckitStatus = specInfo.setupStatus.speckit;
      if (!speckitStatus) return [];
      return [speckitStatus.specifyCli, speckitStatus.speckitInit].filter(
        Boolean
      );
    }
  }, [specInfo, specMode]);

  const steps = getSetupSteps();
  const stepConfig = specMode === 'openspec' ? OPENSPEC_STEPS : SPECKIT_STEPS;
  const frameworkName = specMode === 'openspec' ? 'OpenSpec' : 'SpecKit';

  // 检查是否有步骤正在运行
  const isRunning = steps.some(
    (s) => s.status === SpecSetupStepStatus.Running
  );

  // 检查是否所有步骤都已完成
  const allCompleted = stepConfig.every((cfg) => {
    const step = steps.find((s) => s.id === cfg.id);
    return step?.status === SpecSetupStepStatus.Completed;
  });

  // 获取步骤状态
  const getStepStatus = (stepId: SpecSetupStepId): SpecSetupStepStatus => {
    const step = steps.find((s) => s.id === stepId);
    return step?.status ?? SpecSetupStepStatus.Pending;
  };

  // 获取失败的步骤及其名称
  const failedStep = steps.find(
    (s) => s.status === SpecSetupStepStatus.Failed
  );
  const failedStepName = failedStep
    ? stepConfig.find((cfg) => cfg.id === failedStep.id)?.label || ''
    : '';

  // 获取正在运行的步骤
  const runningStep = steps.find(
    (s) => s.status === SpecSetupStepStatus.Running
  );

  // 按钮是否应该显示 loading 状态
  const isButtonLoading = isWaitingForResponse || isRunning;

  /** 触发初始化 */
  const handleStartSetup = React.useCallback(() => {
    setIsWaitingForResponse(true);
    const actionType =
      specMode === 'openspec'
        ? BroadcastActions.OPEN_SPEC_SETUP
        : BroadcastActions.SPECKIT_SETUP;
    postMessage({ type: actionType, data: {} });
  }, [specMode, postMessage]);

  /** 关闭弹窗 */
  const handleClose = React.useCallback(() => {
    setInitModalVisible(false);
  }, [setInitModalVisible]);

  /** 处理指令点击 - 关闭弹窗并插入指令到输入框 */
  const handleCommandClick = React.useCallback(
    (prompt: BuiltInPrompt) => {
      handleClose();
      updateChatPrompt({
        description: prompt.description,
        name: prompt.name,
        prompt: prompt.prompt,
        _id: `/${prompt.name}`,
        type: PromptCategoryType._CodeMaker,
      });
      onUserSubmit(prompt.prompt, { event: "CodeChat.prompt_custom" }, prompt.prompt)
    },
    [setInitModalVisible, postMessage]
  );

  return (
    <Modal isOpen={initModalVisible} onClose={handleClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent
        borderRadius="12px"
        mx={4}
      >
        <ModalHeader
          fontSize="14px"
          fontWeight="bold"
          pb={2}
          color="text.default"
        >
          {frameworkName} 初始化
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Flex flexDirection="column" alignItems="center">
            {/* 横向进度条 */}
            <Flex align="flex-start" justify="center" mb={2} width="240px">
              {stepConfig.map((cfg, idx) => {
                const status = getStepStatus(cfg.id);
                const isLast = idx === stepConfig.length - 1;

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
                          getStepStatus(stepConfig[idx + 1].id) !==
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

            {/* 错误信息 */}
            {failedStep?.errorMessage && (
              <ErrorMessageBox
                errorMessage={failedStep.errorMessage}
                stepName={failedStepName}
              />
            )}

            {/* 错误码提示 - 简化样式，浅灰色文字，无底色 */}
            {failedStep?.errorCode && ERROR_CODE_TIPS[failedStep.errorCode] && (
              <VStack align="start" spacing={1} mt={2} width="100%">
                {ERROR_CODE_TIPS[failedStep.errorCode].map((tip, idx) => (
                  <Flex key={idx} align="center" gap={1} flexWrap="wrap">
                    <Text
                      fontSize="12px"
                      color={isLight ? 'gray.500' : 'gray.400'}
                      style={{ marginBottom: 0 }}
                    >
                      {tip.text}
                    </Text>
                    {tip.link && (
                      <Text
                        as='a'
                        rel="noopener noreferrer"
                        fontSize="12px"
                        color="blue.400"
                        textDecoration="underline"
                        _hover={{ color: 'blue.500' }}
                        cursor='pointer'
                        onClick={() => {
                          postMessage({
                            type: 'OPEN_IN_BROWSER',
                            data: {
                              url: tip.link,
                            },
                          })
                        }}
                        style={{ marginBottom: 0 }}
                      >
                        {tip.linkText || tip.link}
                      </Text>
                    )}
                  </Flex>
                ))}
              </VStack>
            )}

            {/* 版本不支持提示（未完成初始化且不支持初始化功能） */}
            {!allCompleted && !supportsInit && (
              <Box
                mt={3}
                p={3}
                borderRadius="8px"
                bg={isLight ? 'orange.50' : 'orange.900'}
                borderWidth="1px"
                borderColor={isLight ? 'orange.100' : 'orange.600'}
              >
                <Flex align="flex-start" gap={2}>
                  <WarningIcon color={isLight ? 'orange.400' : 'orange.300'} mt={0.5} boxSize={4} />
                  <Box flex={1}>
                    <Text fontSize="13px" fontWeight="600" color={isLight ? 'orange.800' : 'orange.100'} mb={1.5}>
                      当前版本不支持初始化功能
                    </Text>
                    <Text fontSize="12px" color={isLight ? 'orange.500' : 'orange.300'} mb={2}>
                      {getSpecInitMinVersionHint(ide)}
                    </Text>
                    {ide === IDE.VisualStudioCode && <Text fontSize="11px" color={isLight ? 'orange.700' : 'orange.200'}>
                      重新加载 VSCode 窗口可触发插件更新
                    </Text>}
                  </Box>
                </Flex>
              </Box>
            )}

            {/* 初始化按钮 */}
            {!allCompleted && supportsInit && (
              <Flex direction="column" align="center" mt={4}>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handleStartSetup}
                  borderRadius="6px"
                  px={6}
                  isDisabled={isButtonLoading}
                >
                  {isButtonLoading ? '初始化中...' : `初始化 ${frameworkName}`}
                </Button>
                {runningStep?.progressMessage && (
                  <Text
                    fontSize="11px"
                    color="blue.400"
                    textAlign="center"
                    mt={2}
                    style={{
                      marginBottom: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      wordBreak: 'break-word',
                    }}
                  >
                    {runningStep.progressMessage}
                  </Text>
                )}
              </Flex>
            )}

            {/* 初始化完成提示 - 指令可点击 */}
            {allCompleted && (
              <Box mt={3} width="100%">
                <Text
                  fontSize="13px"
                  color="green.500"
                  fontWeight="medium"
                  style={{ marginBottom: '8px' }}
                >
                  初始化成功！开始你的 SpecCoding 体验吧：
                </Text>
                <VStack align="start" spacing={1}>
                  <Flex align="center" gap={1} flexWrap="wrap">
                    <Text
                      fontSize="12px"
                      color="text.default"
                      style={{ marginBottom: 0 }}
                    >
                      1. 建议先使用
                      <Text
                        as="span"
                        fontSize="12px"
                        color="blue.400"
                        cursor="pointer"
                        mx={1}
                        _hover={{ textDecoration: 'underline' }}
                        onClick={() => handleCommandClick(specMode === 'openspec' ? OPEN_SPEC_SETUP_PROMPT : SPECKIT_SETUP_PROMPT)}
                        style={{ marginBottom: 0 }}
                      >
                        /{specMode === 'openspec' ? 'openspec-setup' : 'speckit-setup'}
                      </Text>
                      生成仓库规范，提高编码质量
                    </Text>
                  </Flex>
                  <Flex align="center" gap={1} flexWrap="wrap">
                    <Text
                      fontSize="12px"
                      color="text.default"
                      style={{ marginBottom: 0 }}
                    >
                      2. 使用 /{specMode === 'openspec' ? 'openspec-proposal' : 'speckit.specify'} 开启一个新的提案
                    </Text>
                  </Flex>
                </VStack>
              </Box>
            )}
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default SpecInitModal;
