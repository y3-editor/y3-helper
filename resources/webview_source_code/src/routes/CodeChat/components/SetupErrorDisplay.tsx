import { CopyIcon } from '@chakra-ui/icons';
import { Button, Flex, Text, VStack } from '@chakra-ui/react';
import * as React from 'react';
import { BroadcastActions, usePostMessage } from '../../../PostMessageProvider';
import { ThemeStyle, useTheme } from '../../../ThemeContext';

/** 文档链接常量 */
const FAQ_DOC_URL =
  'https://docs.popo.netease.com/team/pc/codemaker/pageDetail/a91a8621b42c4ea69bd649410389fc44';
const MANUAL_DOC_URL =
  'https://docs.popo.netease.com/team/pc/codemaker/pageDetail/4926a95e01e44b25849641be581abafd';

/** 解决方案步骤：text 中用 {link} 标记链接位置 */
interface SolutionItem {
  /** 完整文案，用 {link} 占位链接 */
  text: string;
  linkText?: string;
  link?: string;
}

/** 错误码提示配置 */
interface ErrorCodeTipConfig {
  /** 上下文说明：为什么会出现这个错误 */
  context: string;
  /** 解决方案步骤 */
  solutions: SolutionItem[];
}

/** 默认解决方案（所有错误码统一） */
const DEFAULT_SOLUTIONS: SolutionItem[] = [
  {
    text: '1. 先参考 {link} 自行排查',
    linkText: '排障指南',
    link: FAQ_DOC_URL,
  },
  {
    text: '2. 排查后仍有问题，可参考 {link} 自行安装',
    linkText: '手动安装指南',
    link: MANUAL_DOC_URL,
  },
];

/** 错误码对应的提示信息映射 */
const ERROR_CODE_TIPS: Record<string, ErrorCodeTipConfig> = {
  NODE_UNAVAILABLE: {
    context: '安装 openspec-cli 需要 npm 命令，当前不可用',
    solutions: DEFAULT_SOLUTIONS,
  },
  NODE_VERSION_INVALID: {
    context: 'Node.js 版本不满足要求 (>= 20.19.0)',
    solutions: DEFAULT_SOLUTIONS,
  },
  OPENSPEC_CLI_UNAVAILABLE: {
    context: 'openspec-cli 安装失败或验证未通过',
    solutions: DEFAULT_SOLUTIONS,
  },
  OPENSPEC_INIT_FAILED: {
    context: 'openspec init 命令执行失败',
    solutions: DEFAULT_SOLUTIONS,
  },
  UV_UNAVAILABLE: {
    context: '安装 specify-cli 依赖 uv 命令，当前不可用',
    solutions: DEFAULT_SOLUTIONS,
  },
  SPECIFY_CLI_UNAVAILABLE: {
    context: 'specify-cli 安装失败或验证未通过',
    solutions: DEFAULT_SOLUTIONS,
  },
  SPECKIT_INIT_FAILED: {
    context: 'specify init 命令执行失败',
    solutions: DEFAULT_SOLUTIONS,
  },
  UPGRADE_NOT_023: {
    context: '升级功能仅适用于 OpenSpec 0.23 版本项目',
    solutions: DEFAULT_SOLUTIONS,
  },
  UPGRADE_CLI_FAILED: {
    context: 'CLI 升级到 1.x 版本失败',
    solutions: DEFAULT_SOLUTIONS,
  },
  UPGRADE_MIGRATE_FAILED: {
    context: '文档结构迁移失败',
    solutions: DEFAULT_SOLUTIONS,
  },
};

/** 组件 Props */
interface SetupErrorDisplayProps {
  errorMessage?: string;
  errorCode?: string;
}

/** 渲染含 {link} 占位符的文案行 */
function SolutionLine({
  solution,
  grayColor,
  onOpenLink,
}: {
  solution: SolutionItem;
  grayColor: string;
  onOpenLink: (url: string) => void;
}) {
  const { text, linkText, link } = solution;

  // 没有链接信息，直接渲染纯文本
  if (!link || !linkText || !text.includes('{link}')) {
    return (
      <Text fontSize="12px" color={grayColor} style={{ marginBottom: 0 }}>
        {text}
      </Text>
    );
  }

  const [before, after] = text.split('{link}');

  return (
    <Text fontSize="12px" color={grayColor} style={{ marginBottom: 0 }}>
      {before}
      <Text
        as="span"
        color="blue.400"
        textDecoration="underline"
        _hover={{ color: 'blue.500' }}
        cursor="pointer"
        onClick={() => onOpenLink(link)}
      >
        {linkText}
      </Text>
      {after}
    </Text>
  );
}

/** 统一错误展示组件（三层结构：错误信息 + 上下文 + 解决方案） */
function SetupErrorDisplay({
  errorMessage,
  errorCode,
}: SetupErrorDisplayProps) {
  const { postMessage } = usePostMessage();
  const { activeTheme } = useTheme();
  const isLight = activeTheme === ThemeStyle.Light;

  const handleCopy = React.useCallback(() => {
    if (errorMessage) {
      postMessage({
        type: BroadcastActions.COPY_TO_CLIPBOARD,
        data: errorMessage,
      });
    }
  }, [errorMessage, postMessage]);

  const handleOpenLink = React.useCallback(
    (url: string) => {
      postMessage({ type: 'OPEN_IN_BROWSER', data: { url } });
    },
    [postMessage],
  );

  const tipConfig = errorCode ? ERROR_CODE_TIPS[errorCode] : undefined;
  const grayColor = isLight ? 'gray.500' : 'gray.400';

  return (
    <VStack align="start" spacing={1} mt={3} width="100%">
      {/* 第一层：红色错误信息 + 复制按钮 */}
      {errorMessage && (
        <Flex align="flex-start" gap={1} width="100%">
          <Text
            fontSize="12px"
            color="red.500"
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
      )}

      {/* 第二层 + 第三层：上下文说明 + 解决方案（仅当存在对应错误码配置时） */}
      {tipConfig && (
        <>
          <Text fontSize="12px" color={grayColor} style={{ marginBottom: 0 }}>
            {tipConfig.context}
          </Text>
          <Text fontSize="12px" color={grayColor} style={{ marginBottom: 0 }}>
            解决方案：
          </Text>
          {tipConfig.solutions.map((solution, idx) => (
            <Flex key={idx} pl={2}>
              <SolutionLine
                solution={solution}
                grayColor={grayColor}
                onOpenLink={handleOpenLink}
              />
            </Flex>
          ))}
        </>
      )}
    </VStack>
  );
}

export default SetupErrorDisplay;