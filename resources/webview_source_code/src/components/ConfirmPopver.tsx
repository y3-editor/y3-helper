import { useCallback, useRef, useState } from 'react';
import {
  Button,
  useOutsideClick,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverArrow,
  PopoverFooter,
  PopoverBody,
  ButtonGroup,
} from '@chakra-ui/react';

interface ConfirmPopverProps {
  disabled?: boolean;
  comfirmAfterDisabled?: boolean; // 禁用后是否直接执行确认
  onClose?: () => void;
  onConfirm: () => (void | Promise<void>);
  children: React.ReactNode;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmColorScheme?: string;
}

export default function ConfirmPopver({
  disabled = false,
  comfirmAfterDisabled = false,
  children,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
}: ConfirmPopverProps) {
  const [comfirming, setConfirming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick({
    ref: ref,
    handler: () => setIsOpen(false),
  });

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    onClose?.()
  }, [onClose])

  const handleComfirm = useCallback(async(e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onConfirm) return
    if (onConfirm instanceof Promise) {
      try {
        setConfirming(true)
        await onConfirm();
        setIsOpen(false)
      } finally {
        setConfirming(false)
      }
    } else {
      onConfirm();
      setIsOpen(false)
    }
  }, [onConfirm, setIsOpen])

  if (disabled) {
    return <div
      onClick={comfirmAfterDisabled ? handleComfirm : undefined}>
      {children}
    </div>;
  }
  return (
    <div ref={ref}>
      <Popover
        placement="bottom"
        closeOnBlur={true}
        isOpen={isOpen}
        isLazy
      >
        <PopoverTrigger>
          <div onClick={() => setIsOpen(true)}>
            {children}
          </div>
        </PopoverTrigger>
        <PopoverContent>
        <PopoverHeader pt={4} fontWeight="bold" border="0">
          {title}
        </PopoverHeader>
        <PopoverArrow />
        <PopoverBody>{description}</PopoverBody>
        <PopoverFooter
          border="0"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          pb={4}
        >
          <ButtonGroup size="sm">
          <Button variant="outline" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button
            colorScheme="blue"
            color="white"
            isLoading={comfirming}
            onClick={handleComfirm}
          >
            {confirmText}
          </Button>
          </ButtonGroup>
        </PopoverFooter>
        </PopoverContent>
      </Popover>
    </div>
  )
}
