import { type TabPanelProps, TabPanel, useTabPanel } from '@chakra-ui/react';
import { memo, useMemo } from 'react';
import { isEqual } from 'lodash';
import CustomTabPanelContext from './contexts/tab-panel';
import ErrorBoundary from '../ErrorBoundary';

const CustomTabPanel = memo(function ({ children, ...props }: TabPanelProps) {
  const tabPanelProps = useTabPanel(props);

  const isFocused = useMemo(
    () => !tabPanelProps.hidden,
    [tabPanelProps.hidden],
  );

  const contextValue = useMemo(() => ({ isFocused }), [isFocused]);

  return (
    <TabPanel {...props}>
      <CustomTabPanelContext.Provider value={contextValue}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </CustomTabPanelContext.Provider>
    </TabPanel>
  );
}, isEqual);

if (process.env.NODE_ENV === 'development') {
  (CustomTabPanel as any).whyDidYouRender = true;
}

export default CustomTabPanel
