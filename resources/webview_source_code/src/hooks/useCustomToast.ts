import { createStandaloneToast, useToast, UseToastOptions } from '@chakra-ui/react';
import { CreateCustomToast } from '../components/CustomToast';
import { useCallback } from 'react';

const { toast } = createStandaloneToast();
export const customToast = function (options: UseToastOptions) {
  return toast({
    ...options,
    render: options.render ? options.render : CreateCustomToast,
    position: options?.position || 'top',
  })
} as ReturnType<typeof createStandaloneToast>['toast'];

function useCustomToast() {
  const toast = useToast();
  const wrapperToast = useCallback((options: UseToastOptions) => {
    customToast({
      ...options,
      render: options.render ? options.render : CreateCustomToast,
      position: options?.position || 'top',
    });
  }, [])
  return {
    ...toast,
    toast: wrapperToast,
  };
}

export default useCustomToast;
