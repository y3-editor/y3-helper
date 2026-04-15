import { createStandaloneToast } from '@chakra-ui/react';
import { CreateCustomToast } from '../components/CustomToast';


const { toast } = createStandaloneToast();

export const TOAST_STREAMING_PREVENT_SUBMIT_ID =
  'TOAST_STREAMING_PREVENT_SUBMIT_ID';

export function toastUserPromptCategoryWithoutInit() {
  toast({
    title: '用户 prompt 词库未初始化，请联系 Y3Maker 团队：000000',
    status: 'error',
    position: 'top',
    isClosable: true,
    render: CreateCustomToast,
  });
}
