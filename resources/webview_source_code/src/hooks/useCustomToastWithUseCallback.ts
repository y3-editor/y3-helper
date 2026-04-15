import { useToast, UseToastOptions } from '@chakra-ui/react';
import { CreateCustomToast } from '../components/CustomToast';
import { useCallback } from 'react';

function useCustomToast() {
  const toast = useToast();
  const customToast = useCallback((options: UseToastOptions) => {
    toast({
      ...options,
      render: options.render ? options.render : CreateCustomToast,
      position: 'top',
    });
  }, [toast]);
  return {
    ...toast,
    toast: customToast,
  };
}

export default useCustomToast;
