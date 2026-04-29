import { WarningIcon } from '@chakra-ui/icons';
import {
  Flex,
  Text,
  Button,
  Box,
  Collapse,
  createStandaloneToast,
} from '@chakra-ui/react';
import React, { Component, ReactNode } from 'react';
import {
  logger as webToolsLogger,
  hub as webToolsHub,
} from '@dep305/codemaker-web-tools';
import {
  isChunkLoadError,
  formatErrorDetail,
} from '../../utils/chunkErrorHandler';

const { toast } = createStandaloneToast();
const CHUNK_TOAST_ID = 'chunk-error-toast';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  isChunkError: boolean;
  error: Error | null;
  showDetail: boolean;
  copied: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    isChunkError: false,
    error: null,
    showDetail: false,
    copied: false,
  };

  static getDerivedStateFromError(error: Error) {
    const isChunkError = isChunkLoadError(error);
    // chunk 错误：在静态方法中触发 toast，避免在 render 中产生副作用
    if (isChunkError && !toast.isActive(CHUNK_TOAST_ID)) {
      toast({
        id: CHUNK_TOAST_ID,
        title: '应用已更新',
        description: '检测到新版本已发布，请刷新页面以获取最新功能。',
        status: 'warning',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    }
    return { hasError: true, isChunkError, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    webToolsHub.withScope((scope) => {
      scope.setExtra('componentStack', errorInfo.componentStack);
      webToolsLogger.captureException(error);
    });
  }

  private copyToClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => this.onCopyDone(),
        () => this.fallbackCopy(text),
      );
    } else {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.onCopyDone();
  }

  private onCopyDone() {
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { isChunkError, error, showDetail, copied } = this.state;

    return (
      <Flex
        align="center"
        justify="center"
        direction="column"
        h="50vh"
        w="100%"
        px={6}
      >
        <WarningIcon
          color={isChunkError ? 'warning' : 'error'}
          boxSize={6}
          mb={3}
        />
        <Text fontSize="md" fontWeight="600" mb={1}>
          {isChunkError ? '应用已更新' : '未知错误'}
        </Text>
        <Text fontSize="sm" color="text.default" textAlign="center" mb={4}>
          {isChunkError
            ? '检测到新版本已发布，请刷新页面以获取最新功能。'
            : '应用遇到了意外错误，请尝试刷新页面或联系我们：7896636'}
        </Text>
        <Button
          size="sm"
          colorScheme="blue"
          onClick={() => window.location.reload()}
          mb={3}
        >
          刷新页面
        </Button>

        {error && (
          <Box w="100%" maxW="480px">
            <Text
              fontSize="xs"
              color="text.muted"
              cursor="pointer"
              textAlign="center"
              userSelect="none"
              onClick={() => this.setState({ showDetail: !showDetail })}
              _hover={{ color: 'text.secondary' }}
            >
              {showDetail ? '▾ 收起详情' : '▸ 错误详情'}
            </Text>
            <Collapse in={showDetail} animateOpacity>
              <Box
                mt={2}
                p={3}
                bg="panelBlockBgColor"
                borderRadius="md"
                border="1px solid"
                borderColor="customBorder"
                maxH="200px"
                overflowY="auto"
                css={{ scrollbarWidth: 'thin' }}
              >
                <Text
                  as="pre"
                  fontSize="11px"
                  fontFamily="'SF Mono',Monaco,Menlo,Consolas,monospace"
                  color="text.default"
                  whiteSpace="pre-wrap"
                  wordBreak="break-all"
                  lineHeight="1.5"
                  m={0}
                >
                  {formatErrorDetail(error)}
                </Text>
              </Box>
              <Flex justify="center" mt={2}>
                <Button
                  size="xs"
                  variant="ghost"
                  color="text.muted"
                  _hover={{ color: 'text.secondary' }}
                  onClick={() =>
                    this.copyToClipboard(formatErrorDetail(error))
                  }
                >
                  {copied ? '✓ 已复制' : '📋 复制详情'}
                </Button>
              </Flex>
            </Collapse>
          </Box>
        )}
      </Flex>
    );
  }
}

export default ErrorBoundary;