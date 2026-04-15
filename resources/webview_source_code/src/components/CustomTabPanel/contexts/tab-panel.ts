import React from 'react';

type CustomPanelContextType = {
  isFocused?: boolean;
};

export const CustomPanelContext = React.createContext<CustomPanelContextType>(
  {},
);

export default CustomPanelContext;
