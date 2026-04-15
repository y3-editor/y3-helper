import * as React from 'react';
interface EventContextType {
  updateHistory: (
    element: HTMLElement | HTMLInputElement,
    value: string,
  ) => void;
}

export const EventContext = React.createContext<EventContextType | null>(null);

export const useEventContext = () => {
  const context = React.useContext(EventContext);
  if (!context) {
    throw new Error('useEventContext must be used within EventProvider');
  }
  return context;
};
