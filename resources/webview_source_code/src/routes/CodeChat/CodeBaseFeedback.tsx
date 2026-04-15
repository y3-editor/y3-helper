import { Box, Button, Textarea } from '@chakra-ui/react';
import { ChatMessage, ChatFeedbackType } from '../../services';
import { useFormik } from 'formik';
import React, { ClipboardEvent, useCallback, useEffect } from 'react';
import useCustomToast from '../../hooks/useCustomToast';
import { IMultiAttachment, useChatAttach } from '../../store/chat';
import { uploadImg } from '../../services/chat';
import { getImageUrlFromAttachs, useSelectImageAttach } from './ChatTypeAhead/Attach/Hooks/useSelectImageAttach';

export interface CodeBaseFeedbackDetail {
  messages: ChatMessage[];
  topic: string;
  chat_type: string;
  chat_repo: string;
  session_id: string;
  message_id: string;
  feedback_type: ChatFeedbackType;
  feedback: string;
  imgUrls?: string[];
}

interface CodeBaseFeedbackProps {
  feedbackDetail: CodeBaseFeedbackDetail;
  onFeedbackSubmit: (detail: CodeBaseFeedbackDetail) => void;
  onResetFeedback: () => void;
}
interface FormValues {
  feedback: string;
}

type FormErrors = Partial<FormValues>;
const CodeBaseFeedback = (props: CodeBaseFeedbackProps) => {
  const { feedbackDetail, onResetFeedback, onFeedbackSubmit } = props;
  const { toast } = useCustomToast();
  const attachs = useChatAttach((state) => state.attachs);
  const selectImageHook = useSelectImageAttach()
  const updateAttachs = useChatAttach((state) => state.update);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const formik = useFormik<FormValues>({
    initialValues: {
      feedback: feedbackDetail.feedback,
    },
    validate: (values) => {
      const errors: FormErrors = {};
      if (!values.feedback.trim()) {
        errors.feedback =
          '请输入反馈内容，支持粘贴截图，或者点击输入框左上方的添加按钮附加图片';
      }
      return errors;
    },
    onSubmit: (values) => {
      onFeedbackSubmit({
        ...feedbackDetail,
        feedback: values.feedback,
        imgUrls: getImageUrlFromAttachs(attachs as IMultiAttachment),// (attachs as ImageUrl)?.imgUrls || []
      });
    },
  });

  useEffect(() => {
    updateAttachs(undefined);
    return () => {
      updateAttachs(undefined);
    };
  }, [updateAttachs]);

  const updateRawImg = useCallback(
    async (rawFile: File) => {
      const formData = new FormData();
      formData.append('file', rawFile);
      const data = await uploadImg(formData);
      selectImageHook.selectImageAttach([data.url]);
    },
    [selectImageHook],
  );

  // 统一上传静态文件逻辑
  const onCustomPaste = useCallback(
    async (e: ClipboardEvent) => {
      try {
        const { clipboardData } = e;
        const { files, items } = clipboardData;
        if (/^image\//.test(files?.[0]?.type)) {
          e.preventDefault();
          await updateRawImg(files?.[0]);
          const selectedIndex = (e.target as HTMLTextAreaElement)
            .selectionStart;
          // 恢复光标
          setTimeout(() => {
            const targetIndex = selectedIndex;
            inputRef.current?.focus?.();
            inputRef.current?.setSelectionRange?.(targetIndex, targetIndex);
          });
        } else if (!/^text\//.test(items?.[0]?.type)) {
          {
            e.preventDefault();
            toast({
              title: '复制失败',
              description: '只支持粘贴文本&图片内容！',
              position: 'top',
              status: 'error',
              isClosable: true,
              duration: 2000,
            });
          }
        }
      } catch (e) { /* empty */ }
    },
    [toast, updateRawImg],
  );

  return (
    <Box display="flex" p="4" alignItems="start" bg="questionsBgColor">
      <Box width="76px" flexShrink={0}>
        反馈说明
      </Box>
      <Box flexGrow={1} display="flex" flexDirection="column" height="100%">
        <Box flexGrow={1}>
          <Textarea
            ref={inputRef}
            value={formik.values.feedback}
            h="full"
            resize="none"
            placeholder={
              '请输入反馈内容，支持粘贴截图，或者点击输入框左上方的添加按钮附加图片'
            }
            onChange={(e) => {
              formik.setFieldValue('feedback', e.target.value);
            }}
            onPaste={onCustomPaste}
            _placeholder={{ fontSize: '13px' }}
          />
          {formik.errors.feedback && formik.touched.feedback && (
            <Box color="red.500" fontSize="sm">
              {formik.errors.feedback}
            </Box>
          )}
        </Box>

        <Box mt="4" display="flex" justifyContent="center" h="8">
          <Button
            size="sm"
            mr="2"
            colorScheme="blue"
            onClick={() => formik.handleSubmit()}
          >
            提交
          </Button>
          <Button size="sm" onClick={onResetFeedback}>
            取消
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default CodeBaseFeedback;
