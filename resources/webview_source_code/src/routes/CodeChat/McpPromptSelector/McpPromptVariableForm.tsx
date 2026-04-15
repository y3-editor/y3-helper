import * as React from 'react';
import { Box, Button, Flex, Grid, Input, useMediaQuery, Tooltip } from '@chakra-ui/react';
import { SmallScreenWidth } from '../../../const';
import { useMcpPromptApp } from '../../../store/mcp-prompt';
import useCustomToast from '../../../hooks/useCustomToast';
import { getMcpPrompt, McpPromptResult } from '../../../services/mcp';

function extractTextFromResult(result: McpPromptResult): string {
    try {
        if (!result || !Array.isArray(result.messages)) return '';
        const pieces: string[] = [];
        for (const msg of result.messages) {
            const content = (msg)?.content;
            if (typeof content === 'string') {
                pieces.push(content);
                continue;
            }
            if (content && typeof content === 'object' && !Array.isArray(content)) {
                if ((content).type === 'text' && typeof (content).text === 'string') {
                    pieces.push((content).text);
                    continue;
                }
            }
            if (Array.isArray(content)) {
                for (const part of content) {
                    if (typeof part === 'string') {
                        pieces.push(part);
                    } else if (part && typeof part === 'object') {
                        if ((part).type === 'text' && typeof (part).text === 'string') {
                            pieces.push((part).text);
                        }
                    }
                }
            }
        }
        return pieces.join('\n\n');
    } catch {
        return '';
    }
}

const McpPromptVariableForm: React.FC = () => {
    const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
    const { toast } = useCustomToast();
    const pendingRunner = useMcpPromptApp((s) => s.pendingRunner);
    const runnerArgs = useMcpPromptApp((s) => s.runnerArgs);
    const setRunnerArgs = useMcpPromptApp((s) => s.setRunnerArgs);
    const setConfirmedRunner = useMcpPromptApp((s) => s.setConfirmedRunner);
    const reset = useMcpPromptApp((s) => s.reset);
    const [loading, setLoading] = React.useState(false);

    const handleUpdate = React.useCallback((name: string, value: string) => {
        setRunnerArgs({ ...runnerArgs, [name]: value });
    }, [runnerArgs, setRunnerArgs]);

    // 检查是否有未填写的必填项
    const hasEmptyRequiredFields = React.useMemo(() => {
        if (!pendingRunner) return false;
        const args = pendingRunner.arguments || [];
        return args.some((arg) => {
            if (!arg.required) return false;
            const value = String(runnerArgs[arg.name] ?? '').trim();
            return value === '';
        });
    }, [pendingRunner, runnerArgs]);

    const handleRun = React.useCallback(async () => {
        if (!pendingRunner) return;

        // 验证必填项
        const args = pendingRunner.arguments || [];
        const emptyRequiredFields = args.filter((arg) => {
            if (!arg.required) return false;
            const value = String(runnerArgs[arg.name] ?? '').trim();
            return value === '';
        });

        if (emptyRequiredFields.length > 0) {
            const fieldNames = emptyRequiredFields.map((f) => f.name).join('、');
            toast({
                title: '请填写必填项',
                description: `以下必填参数未填写: ${fieldNames}`,
                status: 'warning',
                duration: 3000,
                position: 'top'
            });
            return;
        }

        try {
            setLoading(true);
            const result = await getMcpPrompt({
                serverName: pendingRunner.serverName,
                promptName: pendingRunner.promptName,
                arguments: runnerArgs,
            });
            const text = extractTextFromResult(result);
            if (!text) {
                toast({ title: '未获取到可插入的文本内容', status: 'warning', duration: 2000, position: 'top' });
                return;
            }
            setConfirmedRunner({
                serverName: pendingRunner.serverName,
                promptName: pendingRunner.promptName,
                title: pendingRunner.title,
                arguments: pendingRunner.arguments,
            }, text);
        } catch (err) {
            if (err instanceof Error) {
                toast({ title: '运行失败', description: err?.message || 'GET_MCP_PROMPT_ERROR', status: 'error', duration: 2000, position: 'top' });
            }
        } finally {
            setLoading(false);
        }
    }, [pendingRunner, runnerArgs, toast, setConfirmedRunner]);

    React.useEffect(() => {
        if (pendingRunner && pendingRunner.arguments?.length === 0) {
            handleRun();
        }
    }, [pendingRunner, handleRun]);

    if (!pendingRunner) return null;

    const args = pendingRunner.arguments || [];

    if (args.length === 0) {
        return null;
    }

    return (
        <Flex width="auto" p="2" marginX={2} mt={2} padding={2} flexDirection="column" borderRadius="4px" bg="themeBgColor" gap={2}>
            {args.map((arg) => {
                const value = String(runnerArgs[arg.name] ?? '');
                const isEmpty = value.trim() === '';
                const showError = arg.required && isEmpty;
                const gridStyle = isSmallScreen ? {} : { gridTemplateColumns: '120px auto' };
                return (
                    <Grid key={arg.name} gap={2} alignItems="center" {...gridStyle}>
                        <Box textAlign={isSmallScreen ? 'left' : 'right'} color={showError ? 'red.500' : 'inherit'}>
                            {arg.name}{arg.required ? '*' : ''}
                        </Box>
                        <Input
                            size="sm"
                            placeholder={arg.description}
                            value={value}
                            onChange={(e) => handleUpdate(arg.name, e.target.value)}
                            borderColor={showError ? 'red.500' : undefined}
                            _hover={{ borderColor: showError ? 'red.500' : undefined }}
                            _focus={{ borderColor: showError ? 'red.500' : 'blue.500', boxShadow: showError ? '0 0 0 1px var(--chakra-colors-red-500)' : undefined }}
                        />
                    </Grid>
                );
            })}
            <Flex gap={2} justifyContent='flex-end'>
                <Tooltip
                    label="请先填写所有必填项"
                    isDisabled={!hasEmptyRequiredFields}
                    placement="top"
                >
                    <Button
                        size="sm"
                        isLoading={loading}
                        onClick={handleRun}
                        colorScheme="blue"
                        color="white"
                        isDisabled={hasEmptyRequiredFields}
                    >
                        确认
                    </Button>
                </Tooltip>
                <Button size="sm" variant="ghost" onClick={() => reset()}>关闭</Button>
            </Flex>
        </Flex>
    );
};

export default McpPromptVariableForm;
