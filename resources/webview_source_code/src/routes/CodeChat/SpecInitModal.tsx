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
  Radio,
  RadioGroup,
  Badge,
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon, CopyIcon } from '@chakra-ui/icons';
import {
  useWorkspaceStore,
  SpecSetupStepId,
  SpecSetupStepStatus,
  SpecSetupStep,
  SpecFramework,
} from '../../store/workspace';
import { useExtensionStore } from '../../store/extension';
import {
  useChatPromptStore,
  useChatStore,
  useChatStreamStore,
} from '../../store/chat';
import { useTheme, ThemeStyle } from '../../ThemeContext';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import { PromptCategoryType } from '../../services/prompt';
import { BuiltInPrompt } from '../../services/builtInPrompts';
import {
  OPEN_SPEC_SETUP_PROMPT,
  SPECKIT_SETUP_PROMPT,
} from '../../services/builtInPrompts/spec';
import {
  supportsSpecInit,
  supportsOpenSpecVersionSelection,
  getSpecInitMinVersionHint,
} from '../../utils/specVersionUtils';
import { usePromptApp } from '../../store/promp-app';
import { UnionType } from './ChatTypeAhead/Prompt/type';

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

/** OpenSpec 版本选项配置 */
const VERSION_OPTIONS = [
  {
    value: '1.x' as const,
    label: 'OpenSpec 1.x (OPSX)',
    badge: '推荐',
    description: '10 个工作流命令，工作流更灵活',
  },
  {
    value: '0.23' as const,
    label: 'OpenSpec 0.23',
    badge: null,
    description: '3 个基础命令，简单的线性流程',
  },
];

/** 初始化完成提示配置项 */
interface CompletionTipItem {
  text: string; // 如果有 {command} 占位符，则需要提供 command
  command?: {
    name: string;
    prompt: BuiltInPrompt;
  };
}

/** 初始化完成配置（命令列表 + 提示信息） */
interface CompletionConfig {
  commands: { command: string; description: string }[];
  tips: CompletionTipItem[];
}

/** 根据框架和版本获取初始化完成配置 */
const getCompletionConfig = (
  mode: 'openspec' | 'speckit',
  openspecVersion?: '0.23' | '1.x' | 'unknown',
): CompletionConfig => {
  if (mode === 'speckit') {
    return {
      commands: [
        { command: 'speckit.specify', description: '创建功能规格说明' },
        { command: 'speckit.plan', description: '制定实施计划' },
        { command: 'speckit.tasks', description: '生成任务列表' },
        { command: 'speckit.implement', description: '执行实施计划' },
        { command: 'speckit.checklist', description: '生成检查清单' },
      ],
      tips: [
        {
          text: '建议先点击 {command}，提高编码质量',
          command: { name: '生成仓库规范', prompt: SPECKIT_SETUP_PROMPT },
        },
      ],
    };
  }

  // OpenSpec 1.x
  if (openspecVersion === '1.x') {
    return {
      commands: [
        { command: 'opsx:onboard', description: '引导教程' },
        { command: 'opsx:explore', description: '探索模式' },
        { command: 'opsx:new', description: '创建新变更' },
        { command: 'opsx:ff', description: '快速创建所有工件' },
        { command: 'opsx:continue', description: '继续处理变更' },
        { command: 'opsx:apply', description: '实现任务' },
      ],
      tips: [],
    };
  }

  // OpenSpec 0.23 默认流程
  return {
    commands: [
      { command: 'openspec-proposal', description: '创建提案' },
      { command: 'openspec-apply', description: '实现任务' },
      { command: 'openspec-archive', description: '归档变更' },
    ],
    tips: [
      {
        text: '建议先点击 {command}，提高编码质量',
        command: { name: '生成仓库规范', prompt: OPEN_SPEC_SETUP_PROMPT },
      },
    ],
  };
};

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
    },
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
  errorMessage,
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
    (state) => state.setInitModalVisible,
  );
  const currentSpecFramework = useWorkspaceStore(
    (state) => state.currentSpecFramework,
  );
  const specInfo = useWorkspaceStore((state) => state.specInfo);
  const codebaseChatMode = useChatStore((state) => state.codebaseChatMode);

  const updateChatPrompt = useChatPromptStore((state) => state.update);
  const onUserSubmit = useChatStreamStore((state) => state.onUserSubmit);

  // Extension 版本信息（用于版本能力检测）
  const codeMakerVersion = useExtensionStore((state) => state.codeMakerVersion);
  const ide = useExtensionStore((state) => state.IDE);
  const updatePromptAppRunner = usePromptApp((state) => state.update);

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

  // 是否已点击初始化按钮
  const [hasClickedInit, setHasClickedInit] = React.useState(false);

  // OpenSpec 版本选择状态（默认 1.x）
  const [selectedOpenSpecVersion, setSelectedOpenSpecVersion] = React.useState<
    '0.23' | '1.x'
  >('1.x');

  // 弹窗打开时重置状态
  React.useEffect(() => {
    if (initModalVisible) {
      setHasClickedInit(false);
    }
  }, [initModalVisible]);

  // Extension 版本能力检测
  const supportsInit = React.useMemo(() => {
    return supportsSpecInit(codeMakerVersion, ide);
  }, [codeMakerVersion, ide]);

  const openspecSupportsVersionSelection = React.useMemo(() => {
    return supportsOpenSpecVersionSelection(codeMakerVersion, ide);
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
        Boolean,
      );
    } else {
      const speckitStatus = specInfo.setupStatus.speckit;
      if (!speckitStatus) return [];
      return [speckitStatus.specifyCli, speckitStatus.speckitInit].filter(
        Boolean,
      );
    }
  }, [specInfo, specMode]);

  const steps = getSetupSteps();
  const stepConfig = specMode === 'openspec' ? OPENSPEC_STEPS : SPECKIT_STEPS;
  const frameworkName = specMode === 'openspec' ? 'OpenSpec' : 'SpecKit';

  // 检查是否有步骤正在运行
  const isRunning = steps.some((s) => s.status === SpecSetupStepStatus.Running);

  // 检查框架是否实际存在于 frameworks 中
  // 防止用户删除框架目录后 setupStatus 残留 completed 状态导致误判
  const frameworkExists = specInfo.frameworks.some(
    (f) =>
      f.framework ===
      (specMode === 'openspec'
        ? SpecFramework.OpenSpec
        : SpecFramework.SpecKit),
  );

  // 检查是否所有步骤都已完成（框架必须实际存在才算真正完成）
  const allCompleted =
    frameworkExists &&
    stepConfig.every((cfg) => {
      const step = steps.find((s) => s.id === cfg.id);
      return step?.status === SpecSetupStepStatus.Completed;
    });

  // 获取步骤状态
  const getStepStatus = (stepId: SpecSetupStepId): SpecSetupStepStatus => {
    const step = steps.find((s) => s.id === stepId);
    return step?.status ?? SpecSetupStepStatus.Pending;
  };

  // 获取失败的步骤及其名称
  const failedStep = steps.find((s) => s.status === SpecSetupStepStatus.Failed);
  const failedStepName = failedStep
    ? stepConfig.find((cfg) => cfg.id === failedStep.id)?.label || ''
    : '';

  // 获取正在运行的步骤
  const runningStep = steps.find(
    (s) => s.status === SpecSetupStepStatus.Running,
  );

  // 按钮是否应该显示 loading 状态
  const isButtonLoading = isWaitingForResponse || isRunning;

  // 获取已安装的 OpenSpec 版本
  const installedOpenSpecVersion = React.useMemo(() => {
    if (specMode !== 'openspec') return undefined;
    const openspecInfo = specInfo?.frameworks?.find(
      (f) => f.framework === SpecFramework.OpenSpec,
    );
    return openspecInfo?.version;
  }, [specMode, specInfo]);

  // 有效的 OpenSpec 版本：支持版本选择时取用户选择值，否则取实际安装版本
  const effectiveOpenSpecVersion = React.useMemo(() => {
    return openspecSupportsVersionSelection
      ? selectedOpenSpecVersion
      : installedOpenSpecVersion;
  }, [
    openspecSupportsVersionSelection,
    selectedOpenSpecVersion,
    installedOpenSpecVersion,
  ]);

  // 获取初始化完成配置
  const completionConfig = React.useMemo(() => {
    return getCompletionConfig(specMode, effectiveOpenSpecVersion);
  }, [specMode, effectiveOpenSpecVersion]);

  /** 触发初始化 */
  const handleStartSetup = React.useCallback(() => {
    setHasClickedInit(true);
    setIsWaitingForResponse(true);
    const actionType =
      specMode === 'openspec'
        ? BroadcastActions.OPEN_SPEC_SETUP
        : BroadcastActions.SPECKIT_SETUP;

    // OpenSpec：支持版本选择时传递版本参数，否则不传（Extension 默认 0.23）
    const data =
      specMode === 'openspec' && openspecSupportsVersionSelection
        ? { version: selectedOpenSpecVersion }
        : {};
    postMessage({ type: actionType, data });
  }, [
    specMode,
    selectedOpenSpecVersion,
    openspecSupportsVersionSelection,
    postMessage,
  ]);

  /** 关闭弹窗 */
  const handleClose = React.useCallback(() => {
    setInitModalVisible(false);
  }, [setInitModalVisible]);

  /** 处理 Spec 指令点击*/
  const handleSpecCommandClick = React.useCallback(
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
      onUserSubmit(
        prompt.prompt,
        { event: 'CodeChat.prompt_custom' },
        prompt.prompt,
      );
    },
    [setInitModalVisible, postMessage],
  );

  return (
    <Modal isOpen={initModalVisible} onClose={handleClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent borderRadius="12px" mx={4}>
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
                        as="a"
                        rel="noopener noreferrer"
                        fontSize="12px"
                        color="blue.400"
                        textDecoration="underline"
                        _hover={{ color: 'blue.500' }}
                        cursor="pointer"
                        onClick={() => {
                          postMessage({
                            type: 'OPEN_IN_BROWSER',
                            data: {
                              url: tip.link,
                            },
                          });
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
              <Box mt={3} p={3}>
                <Flex align="flex-start" gap={2}>
                  <WarningIcon
                    color={isLight ? 'orange.400' : 'orange.400'}
                    mt={0.5}
                    boxSize={4}
                  />
                  <Box flex={1} color="text.default">
                    <Text fontSize="13px" fontWeight="600" mb={2}>
                      当前版本不支持初始化功能
                    </Text>
                    <Text fontSize="12px" mb={1}>
                      {getSpecInitMinVersionHint(ide)}
                    </Text>
                    <Text fontSize="12px">
                      <Text
                        as="span"
                        cursor="pointer"
                        color="blue.300"
                        _hover={{ textDecoration: 'underline' }}
                        onClick={() => {
                          postMessage({
                            type: BroadcastActions.OPEN_CHECK_UPDATE,
                          });
                        }}
                      >
                        检查可用更新
                      </Text>
                      ，更新完成后请
                      {openspecSupportsVersionSelection ? (
                        <Text
                          as="span"
                          cursor="pointer"
                          color="blue.300"
                          _hover={{ textDecoration: 'underline' }}
                          onClick={() => {
                            postMessage({
                              type: BroadcastActions.RELOAD_WINDOW,
                            });
                          }}
                        >
                          重载窗口
                        </Text>
                      ) : (
                        <Text as="span">重载窗口</Text>
                      )}
                      以启用新版本
                    </Text>
                  </Box>
                </Flex>
              </Box>
            )}

            {/* 版本选择器（仅 OpenSpec 且未完成初始化且版本支持，且未点击初始化） */}
            {specMode === 'openspec' &&
              !allCompleted &&
              openspecSupportsVersionSelection &&
              !hasClickedInit && (
                <Box mt={3} width="100%">
                  <Flex align="center" justify="space-between" mb={2}>
                    <Text
                      fontSize="12px"
                      fontWeight="medium"
                      color="text.default"
                    >
                      选择版本：
                    </Text>
                    <Text
                      fontSize="11px"
                      color="blue.300"
                      cursor="pointer"
                      _hover={{ textDecoration: 'underline' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        window.parent.postMessage(
                          {
                            type: BroadcastActions.OPEN_IN_BROWSER,
                            data: {
                              url: 'https://km.netease.com/v4/detail/blog/258353',
                            },
                          },
                          '*',
                        );
                      }}
                    >
                      了解差异
                    </Text>
                  </Flex>
                  <RadioGroup
                    value={selectedOpenSpecVersion}
                    onChange={(v) =>
                      setSelectedOpenSpecVersion(v as '0.23' | '1.x')
                    }
                  >
                    <VStack align="stretch" spacing={2}>
                      {VERSION_OPTIONS.map((option) => (
                        <Box
                          key={option.value}
                          borderWidth="1px"
                          borderRadius="6px"
                          p={2}
                          cursor="pointer"
                          borderColor={
                            selectedOpenSpecVersion === option.value
                              ? 'blue.400'
                              : isLight
                                ? 'gray.200'
                                : 'gray.600'
                          }
                          bg={
                            selectedOpenSpecVersion === option.value
                              ? isLight
                                ? 'blue.50'
                                : 'blue.900'
                              : 'transparent'
                          }
                          _hover={{
                            borderColor: 'blue.300',
                            bg:
                              selectedOpenSpecVersion === option.value
                                ? undefined
                                : isLight
                                  ? 'gray.50'
                                  : 'gray.700',
                          }}
                          onClick={() =>
                            setSelectedOpenSpecVersion(option.value)
                          }
                        >
                          <Flex align="center" gap={2}>
                            <Radio value={option.value} colorScheme="blue" />
                            <Box flex={1}>
                              <Flex align="center" gap={2}>
                                <Text
                                  fontSize="12px"
                                  fontWeight="medium"
                                  color="text.default"
                                >
                                  {option.label}
                                </Text>
                                {option.badge && (
                                  <Badge colorScheme="blue" fontSize="10px">
                                    {option.badge}
                                  </Badge>
                                )}
                              </Flex>
                              <Text
                                fontSize="11px"
                                color={isLight ? 'gray.600' : 'gray.400'}
                                mt={0.5}
                              >
                                {option.description}
                              </Text>
                            </Box>
                          </Flex>
                        </Box>
                      ))}
                    </VStack>
                  </RadioGroup>
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
                <Flex align="center" justifyContent="center" gap={2} mb={2}>
                  <CheckCircleIcon color="green.500" boxSize={4} />
                  <Text fontSize="13px" color="green.500" fontWeight="medium">
                    初始化成功！开始你的 SpecCoding 体验吧：
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
                  {completionConfig.commands.map((cmd) => (
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
                        handleSpecCommandClick(cmd.command, cmd.description)
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
                  {completionConfig.tips.map((tip, index) => {
                    return (
                      <Flex
                        key={tip.command?.name || index}
                        align="center"
                        gap={1}
                        flexWrap="wrap"
                      >
                        {tip.command ? (
                          <Text
                            fontSize="12px"
                            color="text.default"
                            style={{ marginBottom: 0 }}
                          >
                            • 如{tip.text.split('{command}')[0]}
                            <Text
                              as="span"
                              fontSize="12px"
                              color="blue.400"
                              cursor="pointer"
                              _hover={{ textDecoration: 'underline' }}
                              onClick={() =>
                                handleCommandClick(tip.command!.prompt)
                              }
                              style={{ marginBottom: 0 }}
                            >
                              {tip.command.name}
                            </Text>
                            {tip.text.split('{command}')[1]}
                          </Text>
                        ) : (
                          <Text
                            fontSize="12px"
                            color="text.default"
                            style={{ marginBottom: 0 }}
                          >
                            • {tip.text}
                          </Text>
                        )}
                      </Flex>
                    );
                  })}
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