import * as React from 'react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Spinner,
  Text,
  Textarea,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { AiFillFolder, AiOutlineUser } from 'react-icons/ai';
import { usePostMessage, BroadcastActions } from '../../../PostMessageProvider';
import useCustomToast from '../../../hooks/useCustomToast';
import { useChatConfig } from '../../../store/chat-config';
import { useAuthStore } from '../../../store/auth';
import { useConfigStore } from '../../../store/config';
import { ThemeStyle, useTheme } from '../../../ThemeContext';
import { useWorkspaceStore } from '../../../store/workspace';
import { computeEffectiveRules } from '../../../utils/computeEffectiveRules';
import { ChatModelType } from '../../../services/chatModel';
import {
  generateAgent,
  formatAgentAsMarkdown,
  GeneratedAgent,
  MAX_GENERATE_RETRIES,
} from '../../../services/agentCreation';
import { getErrorMessage } from '../../../utils';
import { useSubagentStore } from '../../../modules/subagent';
import ModelPicker from './ModelPicker';

interface CreateAgentViewProps {
  onBack: () => void;
  onClose: () => void;
  onSuccess?: () => void;
}

type AgentScope = 'project' | 'user';

interface ScopeOption {
  value: AgentScope;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  getPath: (workspacePath: string) => string;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: 'project',
    label: '项目',
    description: '存储至当前项目，团队成员共享',
    icon: AiFillFolder,
    color: 'blue',
    getPath: (workspacePath) => `${workspacePath}/.codemaker/agents/`,
  },
  {
    value: 'user',
    label: '个人',
    description: '存储至用户目录，仅本人可用',
    icon: AiOutlineUser,
    color: 'purple',
    getPath: () => '~/.codemaker/agents/',
  },
];

const MAX_INPUT_LENGTH = 2000;
const IDENTIFIER_REGEX = /^[a-z0-9-]+$/;

function truncatePath(path: string, maxLen = 32): string {
  if (path.length <= maxLen) return path;
  const tail = path.slice(-(maxLen - 3));
  const slashIdx = tail.indexOf('/');
  // 无 '/' 时强制截取，确保 '.../' + segment 总长度 ≤ maxLen
  return '.../' + (slashIdx >= 0 ? tail.slice(slashIdx + 1) : tail.slice(0, maxLen - 4));
}

function CreateAgentView({
  onBack,
  onSuccess,
}: CreateAgentViewProps) {
  const { activeTheme } = useTheme();
  const isDark = activeTheme !== ThemeStyle.Light;
  const { postMessage } = usePostMessage();
  const { toast } = useCustomToast();
  // const model = useChatConfig((state) => state.config?.model || '');
  // 默认使用 opus-4-6 模型进行 Agent 配置生成，后续可考虑增加模型选择
  const model = 'claude-opus-4-6';
  const chatModels = useChatConfig((state) => state.chatModels);
  const username = useAuthStore((state) => state.username);
  const authExtends = useAuthStore((state) => state.authExtends);
  const codeChatModelsSetting = useConfigStore(
    (state) => state.config.codeChatModelsSetting,
  );
  const workspacePath = useWorkspaceStore(
    (state) => state.workspaceInfo?.workspace || '',
  );
  const existingIdentifiers = useSubagentStore((state) =>
    state.agents.filter((a) => a.source === 'custom').map((a) => a.name),
  );

  const [requirementInput, setRequirementInput] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatedConfig, setGeneratedConfig] =
    React.useState<GeneratedAgent | null>(null);
  const [previewMode, setPreviewMode] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [identifierError, setIdentifierError] = React.useState('');
  const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] =
    React.useState(false);
  const [scope, setScope] = React.useState<AgentScope>('project');
  const [maxStepsError, setMaxStepsError] = React.useState('');
  const [retryAttempt, setRetryAttempt] = React.useState(0);
  const [fatalError, setFatalError] = React.useState<string | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const cancelOverwriteRef = React.useRef<HTMLButtonElement | null>(null);
  const fatalDialogCancelRef = React.useRef<HTMLButtonElement | null>(null);

  const inputBg = isDark ? '#2d2d2d' : '#fff';
  const textColor = isDark ? '#e0e0e0' : '#222';
  const borderColor = isDark ? '#444' : '#e2e8f0';
  const cardBg = isDark ? '#1e1e1e' : '#f8faff';
  const cardSelectedBg = isDark ? '#1a2540' : '#ebf4ff';

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    function handleIDEMessage(event: MessageEvent) {
      const { type, data } = event.data || {};
      if (type !== 'CREATE_AGENT_RESULT') return;
      setIsSaving(false);
      if (data?.success) {
        toast({ title: 'Agent 创建成功', status: 'success', duration: 3000 });
        onSuccess?.();
        onBack();
      } else {
        const errorMsg: string = data?.message || '保存失败';
        if (
          errorMsg.includes('already exists') ||
          errorMsg.includes('已存在')
        ) {
          setIsOverwriteDialogOpen(true);
        } else {
          toast({ title: errorMsg, status: 'error', duration: 4000 });
        }
      }
    }
    window.addEventListener('message', handleIDEMessage);
    return () => window.removeEventListener('message', handleIDEMessage);
  }, [toast, onSuccess, onBack]);

  const handleGenerate = React.useCallback(() => {
    const trimmed = requirementInput.trim();
    if (!trimmed) {
      toast({
        title: '请描述 Agent 的功能需求',
        status: 'warning',
        duration: 2000,
      });
      return;
    }
    if (trimmed.length > MAX_INPUT_LENGTH) {
      toast({
        title: `描述过长，请精简到 ${MAX_INPUT_LENGTH} 字符以内`,
        status: 'warning',
        duration: 2000,
      });
      return;
    }
    setIsGenerating(true);
    setRetryAttempt(0);
    setFatalError(null);
    generateAgent(trimmed, model, {
      onController: (controller) => {
        abortControllerRef.current = controller;
      },
      onRetry: (attempt) => setRetryAttempt(attempt),
      onSuccess: (config) => {
        setGeneratedConfig(config);
        setPreviewMode(true);
        setIsGenerating(false);
        setRetryAttempt(0);
      },
      onError: (error) => {
        // eslint-disable-next-line no-console
        console.warn(
          '[CreateAgentView] generateAgent attempt failed:',
          error.message,
        );
      },
      onFatalError: (error) => {
        setIsGenerating(false);
        setRetryAttempt(0);
        setFatalError(getErrorMessage(error) || '生成失败，请重试');
      },
      existingIdentifiers,
      rules: computeEffectiveRules(undefined),
    });
  }, [requirementInput, model, toast, existingIdentifiers]);

  const setMetadataField = React.useCallback((key: string, value: unknown) => {
    setGeneratedConfig((prev) => {
      if (!prev) return prev;
      const next = { ...(prev.agentMetadata ?? {}) };
      if (value === undefined || value === null || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return { ...prev, agentMetadata: next };
    });
  }, []);

  const handleIdentifierChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setGeneratedConfig((prev) =>
        prev ? { ...prev, identifier: value } : prev,
      );
      setIdentifierError(
        value && !IDENTIFIER_REGEX.test(value)
          ? 'identifier 必须为小写字母、数字和连字符'
          : '',
      );
    },
    [],
  );

  const handleWhenToUseChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setGeneratedConfig((prev) =>
        prev ? { ...prev, whenToUse: value } : prev,
      );
    },
    [],
  );

  const handleSystemPromptChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setGeneratedConfig((prev) =>
        prev ? { ...prev, systemPrompt: value } : prev,
      );
    },
    [],
  );

  const handleMaxStepsChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (!raw.trim()) {
        setMaxStepsError('');
        setMetadataField('maxSteps', undefined);
        return;
      }
      if (!/^\d+$/.test(raw) || parseInt(raw, 10) <= 0) {
        setMaxStepsError('请输入正整数');
        setMetadataField('maxSteps', undefined);
      } else {
        setMaxStepsError('');
        setMetadataField('maxSteps', parseInt(raw, 10));
      }
    },
    [setMetadataField],
  );

  const doSave = React.useCallback(
    (overwrite = false) => {
      if (!generatedConfig) return;
      if (identifierError) {
        toast({
          title: 'identifier 格式不正确，请修正后再保存',
          status: 'warning',
          duration: 2000,
        });
        return;
      }
      if (maxStepsError) {
        toast({
          title: 'maxSteps 格式不正确，请修正后再保存',
          status: 'warning',
          duration: 2000,
        });
        return;
      }
      setIsSaving(true);
      postMessage({
        type: BroadcastActions.CREATE_AGENT,
        data: {
          identifier: generatedConfig.identifier,
          description: generatedConfig.whenToUse,
          systemPrompt: generatedConfig.systemPrompt,
          scope,
          markdown: formatAgentAsMarkdown(generatedConfig),
          ...(generatedConfig.agentMetadata ?? {}),
          ...(overwrite ? { overwrite: true } : {}),
        },
      });
    },
    [
      generatedConfig,
      identifierError,
      maxStepsError,
      scope,
      postMessage,
      toast,
    ],
  );

  const handleSave = React.useCallback(() => doSave(false), [doSave]);

  const handleOverwriteConfirm = React.useCallback(() => {
    setIsOverwriteDialogOpen(false);
    doSave(true);
  }, [doSave]);

  const handleCancelPreview = React.useCallback(() => {
    setPreviewMode(false);
    setGeneratedConfig(null);
    setMaxStepsError('');
  }, []);

  const isIdentifierValid = !!(
    generatedConfig?.identifier &&
    IDENTIFIER_REGEX.test(generatedConfig.identifier)
  );
  const canSave = isIdentifierValid && !maxStepsError;

  const displayModels = React.useMemo(() => {
    return Object.values(chatModels || {}).filter((config) => {
      if (!config?.enabled) return false;
      if (
        ![ChatModelType.CODEBASE, ChatModelType.ALL].includes(config.chatType)
      )
        return false;
      const authInfo = config.authInfo;
      const hasPermission =
        authInfo?.allowAll ||
        authInfo?.allowedUsers?.includes(username || '') ||
        authInfo?.allowedDepartments?.includes(authExtends?.department || '');
      if (!hasPermission) return false;
      const title = config.title || '';
      if (Object.prototype.hasOwnProperty.call(codeChatModelsSetting, title)) {
        return codeChatModelsSetting[title] !== false;
      }
      return true;
    });
  }, [chatModels, username, authExtends, codeChatModelsSetting]);

  return (
    <Box>
      <Box>
        {!previewMode && (
          <Box>
            <FormLabel fontSize="xs" color="gray.500" mb={2}>
              功能描述
            </FormLabel>
            <Textarea
              value={requirementInput}
              onChange={(e) => setRequirementInput(e.target.value)}
              placeholder="例如：一个代码审查专家，专注于发现安全漏洞和性能问题..."
              rows={7}
              maxLength={MAX_INPUT_LENGTH}
              isDisabled={isGenerating}
              bg={inputBg}
              color={textColor}
              borderColor={borderColor}
              fontSize="sm"
              resize="vertical"
              _placeholder={{ color: 'gray.400' }}
            />
            <Flex justifyContent="flex-end" mt={1}>
              <Text fontSize="xs" color="gray.400">
                {requirementInput.length}/{MAX_INPUT_LENGTH}
              </Text>
            </Flex>
            {isGenerating && (
              <Flex alignItems="center" gap={2} mt={4}>
                <Spinner size="sm" color="blue.400" />
                <Text fontSize="sm" color="gray.500">
                  {retryAttempt > 1
                    ? `正在重试 ${retryAttempt}/${MAX_GENERATE_RETRIES}...`
                    : '正在生成 Agent 配置...'}
                </Text>
              </Flex>
            )}
          </Box>
        )}

        {previewMode && generatedConfig && (
          <Box>
            <FormLabel fontSize="xs" color="gray.500" mb={2}>
              存储位置
            </FormLabel>
            <Flex gap={3} mb={4}>
              {SCOPE_OPTIONS.map((option) => {
                const isSelected = scope === option.value;
                return (
                  <Box
                    key={option.value}
                    flex={1}
                    p={3}
                    borderWidth="1.5px"
                    borderRadius="lg"
                    cursor="pointer"
                    borderColor={
                      isSelected ? `${option.color}.400` : borderColor
                    }
                    bg={isSelected ? cardSelectedBg : cardBg}
                    onClick={() => setScope(option.value)}
                    transition="all 0.15s"
                    _hover={{
                      borderColor: `${option.color}.400`,
                      bg: cardSelectedBg,
                    }}
                  >
                    <Flex alignItems="center" gap={2} mb={1}>
                      <Box
                        as={option.icon}
                        w="14px"
                        h="14px"
                        color={isSelected ? `${option.color}.400` : 'gray.400'}
                      />
                      <Text
                        fontSize="sm"
                        fontWeight={isSelected ? 'semibold' : 'normal'}
                        color={isSelected ? `${option.color}.400` : textColor}
                      >
                        {option.label}
                      </Text>
                    </Flex>
                    <Text fontSize="xs" color="gray.500" lineHeight="1.4">
                      {option.description}
                    </Text>
                    <Box
                      mt={2}
                      px={2}
                      py={1}
                      borderRadius="md"
                      bg={isDark ? '#111' : '#f0f4f8'}
                      overflow="hidden"
                    >
                      <Text
                        fontSize="10px"
                        color={isDark ? '#888' : '#666'}
                        fontFamily="mono"
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        title={option.getPath(workspacePath)}
                      >
                        {truncatePath(option.getPath(workspacePath))}
                      </Text>
                    </Box>
                  </Box>
                );
              })}
            </Flex>

            <FormControl isInvalid={!!identifierError} mb={4}>
              <FormLabel fontSize="xs" color="gray.500" mb={1}>
                标识符 (identifier)
              </FormLabel>
              <Input
                value={generatedConfig.identifier}
                onChange={handleIdentifierChange}
                size="sm"
                bg={inputBg}
                color={textColor}
                borderColor={identifierError ? 'red.400' : borderColor}
                fontSize="sm"
              />
              {identifierError && (
                <FormErrorMessage fontSize="xs">
                  {identifierError}
                </FormErrorMessage>
              )}
            </FormControl>

            <Flex gap={3} mb={4} alignItems="flex-end">
              <FormControl flex={1}>
                <FormLabel fontSize="xs" color="gray.500" mb={1}>
                  模型（可选）
                </FormLabel>
                <ModelPicker
                  isDark={isDark}
                  value={
                    (generatedConfig?.agentMetadata?.model as string) ?? ''
                  }
                  onChange={(value) => setMetadataField('model', value)}
                  displayModels={displayModels}
                  chatModels={chatModels}
                  triggerMinWidth="100%"
                  inheritButtonText="inherit（继承全局）"
                  inheritLabel="inherit（继承全局配置）"
                  placement="bottom-start"
                  menuMaxHeight="240px"
                />
              </FormControl>
              <FormControl flex={1} isInvalid={!!maxStepsError}>
                <FormLabel fontSize="xs" color="gray.500" mb={1}>
                  最大步长 maxSteps（可选）
                </FormLabel>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={String(generatedConfig?.agentMetadata?.maxSteps ?? '')}
                  onChange={handleMaxStepsChange}
                  size="sm"
                  bg={inputBg}
                  color={textColor}
                  borderColor={maxStepsError ? 'red.400' : borderColor}
                  fontSize="sm"
                  placeholder="默认 50"
                />
                {maxStepsError && (
                  <FormErrorMessage fontSize="xs">
                    {maxStepsError}
                  </FormErrorMessage>
                )}
              </FormControl>
            </Flex>

            <Box mb={4}>
              <Text fontSize="xs" color="gray.500" mb={1}>
                使用场景 (whenToUse)
              </Text>
              <Textarea
                value={generatedConfig.whenToUse}
                onChange={handleWhenToUseChange}
                h="240px"
                bg={inputBg}
                color={textColor}
                borderColor={borderColor}
                fontSize="sm"
                resize="vertical"
                overflowY="auto"
                sx={{ overflow: 'auto !important' }}
                placeholder="描述何时调用此 Agent，可手动修改"
              />
            </Box>

            <Box>
              <Text fontSize="xs" color="gray.500" mb={1}>
                系统提示词 (systemPrompt)
              </Text>
              <Box h={320} overflow="hidden">
                <Textarea
                  value={generatedConfig.systemPrompt}
                  onChange={handleSystemPromptChange}
                  h="100%"
                  bg={inputBg}
                  color={textColor}
                  borderColor={borderColor}
                  fontSize="sm"
                  resize="none"
                  overflowY="auto"
                  sx={{ overflow: 'auto !important' }}
                  placeholder="Agent 的完整系统提示词，可手动修改"
                />
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      <Flex gap={2} justifyContent="flex-end" mt={5} pt={4}>
        {!previewMode ? (
          <>
            <Button size="md" variant="ghost" onClick={onBack} isDisabled={isGenerating}>
              返回
            </Button>
            <Button
              colorScheme="blue"
              size="md"
              onClick={handleGenerate}
              isLoading={isGenerating}
              isDisabled={!requirementInput.trim()}
            >
              生成
            </Button>
          </>
        ) : (
          <>
            <Button size="md" variant="ghost" onClick={handleCancelPreview}>
              取消
            </Button>
            <Button
              colorScheme="green"
              size="md"
              onClick={handleSave}
              isLoading={isSaving}
              isDisabled={!canSave}
            >
              保存
            </Button>
          </>
        )}
      </Flex>

      <AlertDialog
        isOpen={isOverwriteDialogOpen}
        leastDestructiveRef={cancelOverwriteRef}
        onClose={() => setIsOverwriteDialogOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="md" fontWeight="medium">
              Agent 已存在
            </AlertDialogHeader>
            <AlertDialogBody fontSize="sm">
              名称为 <strong>{generatedConfig?.identifier}</strong> 的 Agent
              文件已存在，是否覆盖？
            </AlertDialogBody>
            <AlertDialogFooter gap={2}>
              <Button
                ref={cancelOverwriteRef}
                size="sm"
                variant="ghost"
                onClick={() => setIsOverwriteDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                colorScheme="red"
                size="sm"
                onClick={handleOverwriteConfirm}
              >
                覆盖
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog
        isOpen={fatalError !== null}
        leastDestructiveRef={fatalDialogCancelRef}
        onClose={() => setFatalError(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="md" fontWeight="medium">
              生成失败
            </AlertDialogHeader>
            <AlertDialogBody fontSize="sm">
              <Text mb={2}>
                已尝试 {MAX_GENERATE_RETRIES} 次仍未成功生成 Agent 配置。
              </Text>
              <Text fontSize="xs" color="gray.500" wordBreak="break-all">
                {fatalError}
              </Text>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={fatalDialogCancelRef}
                colorScheme="blue"
                size="sm"
                onClick={() => setFatalError(null)}
              >
                确定
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

export default CreateAgentView;