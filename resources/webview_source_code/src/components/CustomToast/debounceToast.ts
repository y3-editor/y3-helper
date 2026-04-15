import { createStandaloneToast, UseToastOptions } from '@chakra-ui/react';
import { CreateCustomToast } from '.';

const { toast } = createStandaloneToast();
type CustomToastOptions = UseToastOptions & { isCopyable?: boolean; enableHtml?: boolean };
type ToastFunction = (options: CustomToastOptions) => void;

export function createDebouncedToast(): ToastFunction {
  const activeToasts = new Set<string>();

  return (options: CustomToastOptions) => {
    const key = options.title || options.description || '';

    if (!activeToasts.has(key as string)) {
      activeToasts.add(key as string);

      toast({
        ...options,
        onCloseComplete: () => {
          activeToasts.delete(key as string);
          options.onCloseComplete?.();
        },
        render: CreateCustomToast,
      });
    }
  };
}
