import { WarningIcon } from '@chakra-ui/icons';
import { Flex, Text, Button, Box, Collapse } from '@chakra-ui/react';
import React, { Component, ReactNode } from 'react';
import {
  logger as webToolsLogger,
  hub as webToolsHub,
} from '@dep305/codemaker-web-tools';
import {
  isChunkLoadError,
  showChunkToast,
  formatErrorDetail,
} from '../../utils/chunkErrorHandler';

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
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (isChunkLoadError(error)) {
      showChunkToast();
      return;
    }
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
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.onCopyDone();
  }

  private onCopyDone() {
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 1500);
  }

  private handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      this.setState({ hasError: false, error: null, showDetail: false });
    }
  };

  render() {
    if (!this.state.hasError || this.state.isChunkError) {
      return this.props.children;
    }

    const { error, showDetail, copied } = this.state;
    const detailText = error ? formatErrorDetail(error) : '';

    return (
      <>
        {this.props.children}
        <Flex
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.600"
          zIndex={9999}
          align="center"
          justify="center"
          onClick={this.handleOverlayClick}
        >
          <Box
            bg="panelBlockBgColor"
            borderRadius="lg"
            border="1px solid"
            borderColor="customBorder"
            p={6}
            w="420px"
            maxW="calc(100vw - 32px)"
            boxShadow="xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Flex align="center" justify="center" direction="column">
              <WarningIcon color="error" boxSize={6} mb={3} />
              <Text fontSize="md" fontWeight="600" mb={1}>
                未知错误
              </Text>
              <Text
                fontSize="sm"
                color="text.default"
                textAlign="center"
                mb={4}
              >
                应用遇到了意外错误，请尝试刷新页面或联系我们：7896636
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
                      position="relative"
                    >
                      <Text
                        fontSize="xs"
                        color={copied ? 'green.400' : 'text.muted'}
                        cursor="pointer"
                        position="absolute"
                        top={2}
                        right={2}
                        userSelect="none"
                        onClick={() => this.copyToClipboard(detailText)}
                        _hover={{
                          color: copied ? 'green.400' : 'text.secondary',
                        }}
                      >
                        {copied ? '✓ 已复制' : '复制'}
                      </Text>
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
                        {detailText}
                      </Text>
                    </Box>
                  </Collapse>
                </Box>
              )}
            </Flex>
          </Box>
        </Flex>
      </>
    );
  }
}

export default ErrorBoundary;
