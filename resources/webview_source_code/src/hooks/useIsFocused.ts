import React from 'react';
import CustomTabPanelContext from '../components/CustomTabPanel/contexts/tab-panel';
import { isUndefined } from 'lodash';

const useIsFocused = () => {
  const context = React.useContext(CustomTabPanelContext);
  if (isUndefined(context)) {
    return true;
  }
  const { isFocused } = context;
  return isUndefined(isFocused) ? true : isFocused;
};

export default useIsFocused;
