import * as React from 'react';
import userReporter, { ReportErrorType } from '../utils/report';
import { UserEvent } from '../types/report';

function ErrorCollector() {
  React.useEffect(() => {
    function errorHandler(this: Window, event: ErrorEvent) {
      const { error, message } = event;
      userReporter.report({
        event: UserEvent.WEB_ERROR,
        extends: {
          error_type: ReportErrorType.Uncaught,
          error_message: error.message || message,
          error_stack: error.stack,
        },
      });
      return false;
    }

    function unhandledrejectionHandler(
      this: Window,
      event: PromiseRejectionEvent,
    ) {
      const { reason } = event;
      const _config = reason.config;
      const message = `${_config?.method} ${_config?.url} ${reason.code}, ${reason.message}`;
      userReporter.report({
        event: UserEvent.WEB_ERROR,
        extends: {
          error_type: ReportErrorType.Uncaught,
          error_message: message,
          error_stack: reason.stack,
        },
      });
    }

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', unhandledrejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener(
        'unhandledrejection',
        unhandledrejectionHandler,
      );
    };
  }, []);

  return null;
}

export default ErrorCollector;
