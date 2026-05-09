import * as React from 'react';
import { uploadImg } from '../../services/chat';
import { Input } from '@chakra-ui/react';
import useCustomToast from '../../hooks/useCustomToast';
import { useSelectImageAttach } from '../../routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectImageAttach';
import { compressImage } from './ImageResize';
export interface HandleImageUpload {
  handleUpload: () => void;
}
// eslint-disable-next-line react-refresh/only-export-components
export const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];


const ImageUpload = React.forwardRef<HandleImageUpload>((_, ref) => {
  const { toast } = useCustomToast();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const selectImageHook = useSelectImageAttach()

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    try {
      const promises = [];
      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: '上传失败',
            description: '只允许上传：.jpeg、.png、.webp、.gif 格式的图片',
            position: 'top',
            status: 'error',
            isClosable: true,
          });
          return;
        }
        const formData = new FormData();
        const smallFile = await compressImage(file);
        formData.append('file', smallFile);
        promises.push(uploadImg(formData));
      }
      const data = await Promise.all(promises);
      const imgUrls = data.map((i) => i.url);
      selectImageHook.selectImageAttach(imgUrls)
    } finally {
      event.target.value = '';
    }
  };

  React.useImperativeHandle(ref, () => ({
    handleUpload: () => {
      inputRef?.current?.click();
    },
  }));

  return (
    <>
      <Input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/gif"
        mb={4}
        display="none"
        multiple
      />
    </>
  );
});

export default ImageUpload;
