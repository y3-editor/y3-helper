import * as React from 'react';
import { uploadImg } from '../../services/chat';
import { Input } from '@chakra-ui/react';
import useCustomToast from '../../hooks/useCustomToast';
import { useSelectImageAttach } from '../../routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectImageAttach';
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

const maxFileSize = 800 * 1024; // 800KB
const maxPixel = 8000;
const quality = 0.8;

// 压缩图片尺寸
// eslint-disable-next-line react-refresh/only-export-components
export const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (file.size <= maxFileSize && file.type === 'image/jpeg') {
      resolve(file);
    } else if (file.type === 'image/gif') {
      resolve(file);
    } else {
      const imageUrl = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const width = img.width;
          const height = img.height;
          const ratio = Math.min(
            maxPixel / width,
            maxPixel / height,
            1
          );
          // 压缩像素
          canvas.width = Math.floor(width * ratio);
          canvas.height = Math.floor(height * ratio);

          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          // 递归压缩直到满足大小要求
          const attemptCompress = (currentQuality: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  return resolve(file); // 无法解析，则返回原文件
                }
                // 检查文件大小
                if (blob.size > maxFileSize && currentQuality > 0.1) {
                  // 降低质量重试
                  const newQuality = Math.max(currentQuality - 0.1, 0.1);
                  attemptCompress(newQuality);
                } else {
                  const compressedFile = new File(
                    [blob],
                    file.name.replace(/\.\w+$/, '.jpeg'),
                    {
                      type: 'image/jpeg',
                      lastModified: Date.now()
                    }
                  );
                  resolve(compressedFile);
                }
              },
              'image/jpeg',// 有损压缩
              currentQuality
            );
          };
          attemptCompress(quality);
        }
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl)
          resolve(file)
        }
        img.src = imageUrl;
      } catch(e) {
        URL.revokeObjectURL(imageUrl)
        resolve(file)
      }
    }
  })
}

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
