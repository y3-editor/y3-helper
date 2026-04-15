import * as React from 'react';
import { uploadImg } from '../../services/chat';
import { Input } from '@chakra-ui/react';
import useCustomToast from '../../hooks/useCustomToast';
import { convertTextByAddress } from '../../utils/chatAttachParseHandler';
import { truncateContent } from '../../utils';
import { AttachType } from '../../store/attaches';
import { useSelecteFileAttach } from '../../routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectFileAttach';
import { FileItem } from '../../store/chat';
import EventBus, { EBusEvent } from '../../utils/eventbus';

// 支持的文件类型：Word、PDF、Excel
// eslint-disable-next-line react-refresh/only-export-components
export const allowedTypes = [
  'application/pdf', // PDF
  'application/msword', // Word (.doc)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Word (.docx)
  'application/vnd.ms-excel', // Excel (.xls)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Excel (.xlsx)
  'application/vnd.ms-powerpoint', // PowerPoint (.ppt)
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PowerPoint (.pptx)
];

// 文件大小限制：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 单次上传文件数量限制
const MAX_FILE_COUNT = 3;


const FileUpload: React.FC<any> = () => {
  const { toast, closeAll } = useCustomToast();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const selectFileHook = useSelecteFileAttach()

  const handleFileChange = React.useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // 检查文件数量
    if (files.length > MAX_FILE_COUNT) {
      toast({
        title: '上传失败',
        description: `单次最多上传 ${MAX_FILE_COUNT} 个文件`,
        position: 'top',
        status: 'error',
        isClosable: true,
      });
      return;
    }

    try {
      const promises = [];
      for (const file of files) {
        // 检查文件类型
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: '上传失败',
            description: '只允许上传：Word、PDF、Excel、PowerPoint 格式的文件',
            position: 'top',
            status: 'error',
            isClosable: true,
          });
          return;
        }
        // 检查文件大小
        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: '上传失败',
            description: '文件太大，不能上传，请选择小于 10MB 文件',
            position: 'top',
            status: 'error',
            isClosable: true,
          });
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        file.name
        promises.push(uploadImg(formData));
      }

      toast({
        description: '上传文档中...',
        status: 'loading',
        duration: null, // 不自动关闭
        isClosable: false,
        position: 'top',
      });

      const uploads: { url: string }[] = await Promise.all(promises);
      const fileAttachs: FileItem[] = []
      for (let i = 0; i < uploads.length; i++) {
        const upload = uploads[i];
        const file = files[i];
        const parsedContent = await convertTextByAddress(upload.url)
        const attachFile: FileItem = {
          attachType: AttachType.File,
          fileName: file.name,
          content: truncateContent(parsedContent, 80000),
          hadParsed: true,
          path: file.name,
        }
        fileAttachs.push(attachFile)
      }
      if (fileAttachs.length) {
        selectFileHook.selectFileAttaches(fileAttachs, true, true)
      }
      closeAll()
    } catch (e) {
      closeAll()
      requestAnimationFrame(() => {
        toast({
          title: '上传失败' + e,
          position: 'top',
          status: 'error',
          isClosable: true,
        });
      })
    } finally {
      event.target.value = '';
    }
  }, [closeAll, selectFileHook, toast])


  React.useEffect(() => {
    const onUpload = () => {
      inputRef.current?.click()
    }
    EventBus.instance.on(EBusEvent.Docs_File_Upload, onUpload)
    return () => {
      return EventBus.instance.off(EBusEvent.Docs_File_Upload, onUpload)
    }
  }, [handleFileChange])


  return (
    <>
      <Input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        accept=".doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        mb={4}
        display="none"
        multiple
      />
    </>
  );
};

export default FileUpload;
