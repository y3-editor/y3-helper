import { WarningIcon } from '@chakra-ui/icons';
import { Flex, Text } from '@chakra-ui/react';
import React, { Component, ReactNode } from 'react';
import {
  logger as webToolsLogger,
  hub as webToolsHub,
} from '@dep305/codemaker-web-tools';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    webToolsHub.withScope((scope) => {
      scope.setExtra('componentStack', errorInfo.componentStack);
      webToolsLogger.captureException(error);
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Flex align="center" justify="center" h="50vh" w="100%">
          <WarningIcon color="error" boxSize={6} />
          <Text ml={2} color="error">
            未知错误，请尝试刷新
          </Text>
        </Flex>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
