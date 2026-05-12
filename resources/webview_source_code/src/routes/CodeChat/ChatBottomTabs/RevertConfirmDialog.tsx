import * as React from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Text,
  VStack,
} from '@chakra-ui/react';
import type { ChatFileItem } from '../../../store/chatApply';

export interface RevertConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: 'single' | 'batch';
  fileItem?: ChatFileItem;
  filePath?: string;
  batchCount?: number;
}

function RevertConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  mode,
  fileItem,
  filePath,
  batchCount,
}: RevertConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const handleConfirm = React.useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            {mode === 'single' ? '确认回退文件' : '确认批量回退'}
          </AlertDialogHeader>

          <AlertDialogBody>
            <VStack align="start" spacing={2}>
              {mode === 'single' && filePath && fileItem ? (
                <>
                  <Text fontSize="sm" color="text.default">
                    确定要回退以下文件的修改吗？
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" color="text.default">
                    {filePath}
                  </Text>
                  {fileItem.diffLines && (
                    <Text fontSize="xs" color="gray.500">
                      变更：+{fileItem.diffLines.add} -{fileItem.diffLines.delete}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text fontSize="sm" color="text.default">
                    确定要回退所有已应用的文件修改吗？
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    共 {batchCount || 0} 个文件
                  </Text>
                </>
              )}
            </VStack>
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose}>
              取消
            </Button>
            <Button
              bg={'blue.400'}
              color="white"
              onClick={handleConfirm}
              ml={3}
            >
              确认回退
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

export default RevertConfirmDialog;